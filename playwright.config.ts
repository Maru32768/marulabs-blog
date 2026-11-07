import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;

/**
 * Runs against the real Worker and asset routing under workerd, using the fixture build.
 * Screenshots depend on fonts, so baselines are only valid in the Playwright container.
 * See "Visual regression" in README.md.
 */
export default defineConfig({
  testDir: "tests/e2e",
  snapshotPathTemplate: "tests/e2e/__screenshots__/{arg}-{projectName}{ext}",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: [
      "npx wrangler d1 migrations apply DB --local --persist-to .wrangler/e2e",
      `npx wrangler dev --assets dist-fixtures --port ${PORT} --persist-to .wrangler/e2e --var COUNT_HOST:localhost`,
    ].join(" && "),
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: "false", CI: "1" },
  },
});
