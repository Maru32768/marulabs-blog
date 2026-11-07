import { expect, test } from "@playwright/test";
import { FIXED_NOW, MAIN_ARTICLE, mockCounter } from "./helpers.ts";

/**
 * Screenshots depend on installed fonts, so these only run in the Playwright container.
 * Update baselines with: npm run test:e2e:update
 */
test.skip(!process.env.PW_CONTAINER, "visual baselines are only valid in the Playwright container");

const SCREENS: [string, string][] = [
  ["home", "/"],
  ["article", MAIN_ARTICLE],
  ["search", `/search/?q=${encodeURIComponent("トランザクション")}`],
  ["not-found", "/nope/"],
];

for (const [name, path] of SCREENS) {
  test(`matches the baseline: ${name}`, async ({ page }) => {
    await page.clock.setFixedTime(FIXED_NOW);
    await mockCounter(page, 12345);
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}
