import { expect, test } from "@playwright/test";
import { asNormalVisitor, MAIN_ARTICLE, mockCounter } from "./helpers.ts";

const counter = "[data-counter]";

test.describe("access counter", () => {
  test("shows the stored value in classic format", async ({ page }) => {
    await mockCounter(page, 12345);
    await page.goto("/");
    await expect(page.locator(counter)).toHaveText("0012345");
    await expect(page.locator(".panel-counter")).toContainText("トップページの表示回数");
    await expect(page.locator(".panel-counter")).toContainText("同じブラウザは1日1回まで");
  });

  test("automated browsers read but never count", async ({ page }) => {
    const methods: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/counter")) methods.push(request.method());
    });
    await page.goto("/", { waitUntil: "networkidle" });
    expect(methods).toEqual(["GET"]);
    await expect(page.locator(counter)).toHaveText(/^\d{7}$/);
  });

  test.describe("as a normal visitor", () => {
    test.use({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
    });

    test("counts a view against the real Worker and database", async ({ page }) => {
      await asNormalVisitor(page);
      const hit = page.waitForResponse((r) => r.url().endsWith("/api/counter") && r.request().method() === "POST");
      await page.goto("/");
      const body = (await (await hit).json()) as { value: number; counted: boolean };
      expect(body.counted).toBe(true);
      expect(body.value).toBeGreaterThan(0);
      await expect(page.locator(counter)).toHaveText(String(body.value).padStart(7, "0"));
    });

    test("counts the home page once a day across tabs and never other pages", async ({ context }) => {
      await asNormalVisitor(context);
      const methods: string[] = [];
      context.on("request", (request) => {
        if (request.url().endsWith("/api/counter")) methods.push(request.method());
      });
      const first = await context.newPage();
      await first.goto("/", { waitUntil: "networkidle" });
      await first.reload({ waitUntil: "networkidle" });
      const second = await context.newPage();
      await second.goto("/", { waitUntil: "networkidle" });
      for (const path of ["/about/", "/articles/", "/articles/postgres-mvcc/", "/search/"]) {
        await second.goto(path, { waitUntil: "networkidle" });
        await expect(second.locator(counter)).toHaveCount(0);
      }
      expect(methods).toEqual(["POST", "GET", "GET"]);
    });

    test("counts again after midnight JST", async ({ page }) => {
      await asNormalVisitor(page);
      const methods: string[] = [];
      page.on("request", (request) => {
        if (request.url().endsWith("/api/counter")) methods.push(request.method());
      });
      await page.clock.setFixedTime(new Date("2026-11-09T23:59:00+09:00"));
      await page.goto("/", { waitUntil: "networkidle" });
      await page.clock.setFixedTime(new Date("2026-11-10T00:01:00+09:00"));
      await page.reload({ waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      expect(methods).toEqual(["POST", "POST", "GET"]);
      expect(await page.evaluate(() => localStorage.getItem("counter:last-counted"))).toBe("2026-11-10");
    });

    test("does not count when Global Privacy Control is on", async ({ page }) => {
      await asNormalVisitor(page);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "globalPrivacyControl", { get: () => true });
      });
      const methods: string[] = [];
      page.on("request", (request) => {
        if (request.url().endsWith("/api/counter")) methods.push(request.method());
      });
      await page.goto("/", { waitUntil: "networkidle" });
      expect(methods).toEqual(["GET"]);
      await expect(page.locator(counter)).toHaveText(/^\d{7}$/);
    });

    test("does not count, and still works, when storage is blocked", async ({ page }) => {
      await asNormalVisitor(page);
      await page.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          get: () => {
            throw new DOMException("blocked", "SecurityError");
          },
        });
      });
      const methods: string[] = [];
      const errors: Error[] = [];
      page.on("pageerror", (error) => errors.push(error));
      page.on("request", (request) => {
        if (request.url().endsWith("/api/counter")) methods.push(request.method());
      });
      await page.goto("/", { waitUntil: "networkidle" });
      expect(methods).toEqual(["GET"]);
      await expect(page.locator(counter)).toHaveText(/^\d{7}$/);
      expect(errors).toEqual([]);
    });

    test("does not count the 404 page", async ({ page }) => {
      await asNormalVisitor(page);
      const methods: string[] = [];
      page.on("request", (request) => {
        if (request.url().endsWith("/api/counter")) methods.push(request.method());
      });
      await page.goto("/nope/", { waitUntil: "networkidle" });
      expect(methods).toEqual([]);
    });

    test("stores no cookies and nothing but the date of the last count", async ({ page, context }) => {
      await asNormalVisitor(page);
      await page.clock.setFixedTime(new Date("2026-11-09T23:30:00Z"));
      await page.goto("/", { waitUntil: "networkidle" });
      expect(await context.cookies()).toEqual([]);
      const storage = await page.evaluate(() => ({
        local: Object.fromEntries(Object.entries(localStorage)),
        session: Object.keys(sessionStorage),
      }));
      // 23:30 UTC is already the next day in JST.
      expect(storage.local).toEqual({ "counter:last-counted": "2026-11-10" });
      expect(storage.session).toEqual([]);
    });
  });

  for (const [name, failure] of [
    ["is unreachable", "abort"],
    ["answers 503", "503"],
    ["returns garbage", "garbage"],
  ] as const) {
    test(`pages stay readable when the API ${name}`, async ({ page }) => {
      await page.route("**/api/counter", (route) => {
        if (failure === "abort") return route.abort();
        if (failure === "503") return route.fulfill({ status: 503, json: { error: "unavailable" } });
        return route.fulfill({ status: 200, body: "<html>not json</html>" });
      });
      const errors: Error[] = [];
      page.on("pageerror", (error) => errors.push(error));
      await page.goto("/");
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator(counter)).toHaveText("-------");
      await expect(page.locator(counter)).toHaveAttribute("data-state", "error");
      await page.goto(MAIN_ARTICLE);
      await expect(page.locator(".art-body h2").first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("a hanging API does not block the page", async ({ page }) => {
    await page.route("**/api/counter", () => {
      // Never answers.
    });
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible({ timeout: 2000 });
    await expect(page.locator(counter)).toHaveAttribute("data-state", "error", { timeout: 5000 });
  });
});
