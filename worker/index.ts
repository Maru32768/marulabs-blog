/**
 * The only dynamic part of the site: a cumulative page view counter.
 * `run_worker_first: ["/api/*"]` routes just /api/* here. Everything else is served
 * as a static asset without invoking this code, so a failure here cannot affect articles.
 *
 * Privacy: this code never reads the client IP, sets no cookies and stores only one
 * integer. The rate limit key is a constant, not a per-client value.
 */

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  HIT_LIMITER: RateLimit;
  /** Only hits on this exact host count. Version URLs share the production database. */
  COUNT_HOST: string;
}

const COUNTER_NAME = "pageviews";

/** Non-browser clients and declared crawlers. Most never run the page script anyway. */
const NON_HUMAN_UA =
  /bot|crawl|spider|slurp|archiver|facebookexternalhit|embedly|preview|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|curl|wget|python|httpclient|okhttp|axios|node-fetch|go-http|java\/|ruby|perl|libwww/i;

function json(body: unknown, status: number, cacheControl: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Cheap request checks. Forgeable by a determined client, the rate limit bounds that case. */
export function isCountableRequest(request: Request, env: Pick<Env, "COUNT_HOST">): boolean {
  const url = new URL(request.url);
  if (url.hostname !== env.COUNT_HOST) return false;
  if (request.headers.get("Origin") !== url.origin) return false;
  if (request.headers.get("Sec-Fetch-Site") !== "same-origin") return false;
  const userAgent = request.headers.get("User-Agent") ?? "";
  return userAgent !== "" && !NON_HUMAN_UA.test(userAgent);
}

async function readCount(env: Env): Promise<number | null> {
  return env.DB.prepare("SELECT value FROM counters WHERE name = ?1").bind(COUNTER_NAME).first<number>("value");
}

async function incrementCount(env: Env): Promise<number | null> {
  return env.DB.prepare("UPDATE counters SET value = value + 1 WHERE name = ?1 RETURNING value")
    .bind(COUNTER_NAME)
    .first<number>("value");
}

async function handleCounter(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  }

  try {
    if (request.method === "GET") {
      const value = await readCount(env);
      if (value === null) return json({ error: "unavailable" }, 503, "no-store");
      return json({ value }, 200, "public, max-age=15");
    }

    let counted = false;
    if (isCountableRequest(request, env)) {
      const { success } = await env.HIT_LIMITER.limit({ key: COUNTER_NAME });
      counted = success;
    }

    const value = counted ? await incrementCount(env) : await readCount(env);
    if (value === null) return json({ error: "unavailable" }, 503, "no-store");
    return json({ value, counted }, 200, "no-store");
  } catch {
    // D1 outage or exhausted free tier. The page shows a placeholder and stays usable.
    return json({ error: "unavailable" }, 503, "no-store");
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/counter") return handleCounter(request, env);
    if (pathname.startsWith("/api/")) return json({ error: "not_found" }, 404, "no-store");
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
