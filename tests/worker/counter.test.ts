import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker, { isCountableRequest, type Env } from "../../worker/index.ts";

const testEnv = env as unknown as Env;
const ORIGIN = "https://blog.example.test";
const BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

function hit(overrides: Record<string, string> = {}, url = `${ORIGIN}/api/counter`): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      Origin: new URL(url).origin,
      "Sec-Fetch-Site": "same-origin",
      "User-Agent": BROWSER_UA,
      ...overrides,
    },
  });
}

const call = (request: Request, environment: Env = testEnv) =>
  worker.fetch(request as Parameters<typeof worker.fetch>[0], environment);

const stored = async () =>
  testEnv.DB.prepare("SELECT value FROM counters WHERE name = 'pageviews'").first<number>("value");

beforeEach(async () => {
  await testEnv.DB.prepare("UPDATE counters SET value = 100 WHERE name = 'pageviews'").run();
});

describe("GET /api/counter", () => {
  it("returns the value without changing it", async () => {
    const response = await call(new Request(`${ORIGIN}/api/counter`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: 100 });
    expect(await stored()).toBe(100);
  });
});

describe("POST /api/counter", () => {
  it("counts a same-origin browser request", async () => {
    const response = await call(hit());
    expect(await response.json()).toEqual({ value: 101, counted: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await stored()).toBe(101);
  });

  it.each([
    ["declared crawler", { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }],
    ["headless browser", { "User-Agent": "Mozilla/5.0 HeadlessChrome/140.0 Safari/537.36" }],
    ["command line client", { "User-Agent": "curl/8.5.0" }],
    ["empty user agent", { "User-Agent": "" }],
    ["cross-site request", { "Sec-Fetch-Site": "cross-site" }],
    ["foreign origin", { Origin: "https://evil.example" }],
  ])("does not count a %s but still returns the value", async (_name, headers) => {
    const response = await call(hit(headers));
    expect(await response.json()).toEqual({ value: 100, counted: false });
    expect(await stored()).toBe(100);
  });

  it("does not count on another host such as a version preview URL", async () => {
    const response = await call(hit({}, "https://pr-1-marulabs-blog.example.workers.dev/api/counter"));
    expect(await response.json()).toEqual({ value: 100, counted: false });
    expect(await stored()).toBe(100);
  });

  it("does not count once the rate limit is reached", async () => {
    const limited: Env = { ...testEnv, HIT_LIMITER: { limit: () => Promise.resolve({ success: false }) } };
    const response = await call(hit(), limited);
    expect(await response.json()).toEqual({ value: 100, counted: false });
    expect(await stored()).toBe(100);
  });

  it("uses a constant rate limit key, never a per-client value", async () => {
    const keys: string[] = [];
    const recording: Env = {
      ...testEnv,
      HIT_LIMITER: {
        limit: ({ key }) => {
          keys.push(key);
          return Promise.resolve({ success: true });
        },
      },
    };
    await call(hit({ "CF-Connecting-IP": "203.0.113.5" }), recording);
    await call(hit({ "CF-Connecting-IP": "203.0.113.6" }), recording);
    expect(new Set(keys)).toEqual(new Set(["pageviews"]));
  });
});

describe("privacy", () => {
  it("stores nothing per visitor", async () => {
    await call(hit({ "CF-Connecting-IP": "203.0.113.5" }));
    const tables = await testEnv.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE '_cf_%'",
    ).all<{ name: string }>();
    expect(tables.results.map((t) => t.name)).toEqual(["counters"]);
    const rows = await testEnv.DB.prepare("SELECT * FROM counters").all();
    expect(rows.results).toEqual([{ name: "pageviews", value: 101 }]);
    expect(JSON.stringify(rows.results)).not.toContain("203.0.113.5");
  });

  it("sets no cookies", async () => {
    const response = await call(hit());
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });
});

describe("failure handling", () => {
  it("answers 503 instead of throwing when the database is unavailable", async () => {
    const broken: Env = {
      ...testEnv,
      DB: {
        prepare: () => {
          throw new Error("D1 unavailable");
        },
      } as unknown as D1Database,
    };
    expect((await call(new Request(`${ORIGIN}/api/counter`), broken)).status).toBe(503);
    expect((await call(hit(), broken)).status).toBe(503);
  });
});

describe("routing", () => {
  it("rejects other methods", async () => {
    const response = await call(new Request(`${ORIGIN}/api/counter`, { method: "DELETE" }));
    expect(response.status).toBe(405);
  });

  it("answers 404 for unknown API paths", async () => {
    expect((await call(new Request(`${ORIGIN}/api/other`))).status).toBe(404);
  });

  it("passes anything else to static assets", async () => {
    const response = await call(new Request(`${ORIGIN}/articles/`));
    expect(await response.text()).toBe("static asset");
  });
});

describe("isCountableRequest", () => {
  it("accepts only the configured host", () => {
    expect(isCountableRequest(hit(), { COUNT_HOST: "blog.example.test" })).toBe(true);
    expect(isCountableRequest(hit(), { COUNT_HOST: "other.example.test" })).toBe(false);
  });
});
