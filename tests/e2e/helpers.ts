import type { BrowserContext, Page } from "@playwright/test";

/** Fixture articles, see tests/fixtures/articles. */
export const FIXTURE_COUNT = 12;
export const LONG_ARTICLE = "/articles/markdown-elements-with-a-very-long-title/";
export const MAIN_ARTICLE = "/articles/postgres-mvcc/";

/** Keeps "new" icons and the footer clock stable. */
export const FIXED_NOW = new Date("2026-11-07T12:00:00+09:00");

export async function mockCounter(page: Page, value: number): Promise<void> {
  await page.route("**/api/counter", (route) => route.fulfill({ json: { value } }));
}

/** Makes the browser look like a normal visitor to the counter. */
export async function asNormalVisitor(target: Page | BrowserContext): Promise<void> {
  await target.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
}
