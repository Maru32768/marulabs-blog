import { expect, test } from "@playwright/test";
import { asNormalVisitor, MAIN_ARTICLE, mockCounter } from "./helpers.ts";

const counter = "[data-counter]";

test.describe("access counter", () => {
  test("shows the stored value in classic format", async ({ page }) => {
    await mockCounter(page, 12345);
    await page.goto("/");
    await expect(page.locator(counter)).toHaveText("0012345");
    await expect(page.locator(".panel-counter")).toContainText("トップページの表示回数");
    await expect(page.locator(".panel-counter")).toContainText("訪問者数ではありません");
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

    test("counts the home page once per tab and never other pages", async ({ page }) => {
      await asNormalVisitor(page);
      const methods: string[] = [];
      page.on("request", (request) => {
        if (request.url().endsWith("/api/counter")) methods.push(request.method());
      });
      await page.goto("/", { waitUntil: "networkidle" });
      await page.reload({ waitUntil: "networkidle" });
      for (const path of ["/about/", "/articles/", "/articles/postgres-mvcc/", "/search/"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page.locator(counter)).toHaveCount(0);
      }
      expect(methods).toEqual(["POST", "GET"]);
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

    test("stores no cookies and nothing beyond the per-tab marker", async ({ page, context }) => {
      await asNormalVisitor(page);
      await page.goto("/", { waitUntil: "networkidle" });
      expect(await context.cookies()).toEqual([]);
      const storage = await page.evaluate(() => ({
        local: Object.keys(localStorage),
        session: Object.keys(sessionStorage),
      }));
      expect(storage.local).toEqual([]);
      expect(storage.session).toEqual(["pv:/"]);
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
