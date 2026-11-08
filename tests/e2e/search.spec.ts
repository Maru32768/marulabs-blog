import { expect, test, type Page } from "@playwright/test";

const search = async (page: Page, query: string) => {
  await page.goto(`/search/?q=${encodeURIComponent(query)}`);
  // Generous: parallel workers all load the Pagefind WASM from one local dev server.
  await expect(page.locator("#search-status")).not.toHaveText(/検索中|キーワードを入力/, { timeout: 20_000 });
  return page.locator(".result-title a").allTextContents();
};

/**
 * Search quality on mixed Japanese and English content. The results are written up in
 * docs/SEARCH_QUALITY.md. Each query must find the listed article.
 */
const FOUND: [string, string][] = [
  // Japanese words
  ["トランザクション", "PostgreSQLのMVCCとVACUUMの内部構造"],
  ["ページキャッシュ", "Linuxのページキャッシュを理解する"],
  ["ジョブキュー", "SQLiteを使った永続ジョブキューの設計"],
  ["可視性", "PostgreSQLのMVCCとVACUUMの内部構造"],
  ["再送", "TCP再送タイマーの挙動をパケットキャプチャで追う"],
  ["合意", "Raftのログレプリケーションを実装して理解する"],
  ["ジャーナリング", "ext4のジャーナリングとfsyncのコスト"],
  ["書き込み競合", "jobq devlog #7: leaseの延長とハートビート"],
  // Unspaced compound words and short phrases
  ["永続ジョブキュー", "SQLiteを使った永続ジョブキューの設計"],
  ["データマイグレーション", "データマイグレーションとロールバックの設計"],
  // English words and identifiers
  ["vacuum", "PostgreSQLのMVCCとVACUUMの内部構造"],
  ["VACUUM", "PostgreSQLのMVCCとVACUUMの内部構造"],
  ["MVCC", "PostgreSQLのMVCCとVACUUMの内部構造"],
  ["writeback", "Linuxのページキャッシュを理解する"],
  ["tcpdump", "Bunとdd-trace-jsの通信問題を調査する"],
  ["fsync", "ext4のジャーナリングとfsyncのコスト"],
  ["SQLITE_BUSY", "jobq devlog #7: leaseの延長とハートビート"],
  // Prefix match while typing
  ["postgre", "PostgreSQLのMVCCとVACUUMの内部構造"],
  // Mixed queries
  ["SQLite ジョブキュー", "SQLiteを使った永続ジョブキューの設計"],
  ["PostgreSQL 可視性", "PostgreSQLのMVCCとVACUUMの内部構造"],
];

test.describe("full-text search", () => {
  for (const [query, expected] of FOUND) {
    test(`finds "${expected}" for "${query}"`, async ({ page }) => {
      expect(await search(page, query)).toContain(expected);
    });
  }

  test("highlights matches in the excerpt", async ({ page }) => {
    await search(page, "トランザクション");
    await expect(page.locator(".result-excerpt mark").first()).toHaveText(/トランザクション/);
  });

  test("reports no results", async ({ page }) => {
    expect(await search(page, "存在しないはずの検索語xyzzy")).toEqual([]);
    await expect(page.locator("#search-status")).toContainText("一致する記事はありませんでした");
  });

  test("searches body text, not only titles", async ({ page }) => {
    expect(await search(page, "OldestXmin")).toEqual(["PostgreSQLのMVCCとVACUUMの内部構造"]);
  });

  test("filters by category and tag", async ({ page }) => {
    await page.goto(`/search/?q=${encodeURIComponent("sqlite")}&tag=devlog`);
    await expect(page.locator(".result-title a")).toHaveText(["jobq devlog #7: leaseの延長とハートビート"]);
    await page.goto(`/search/?q=${encodeURIComponent("sqlite")}&category=${encodeURIComponent("Distributed Systems")}`);
    await expect(page.locator(".result-title a")).toHaveText(["SQLiteを使った永続ジョブキューの設計"]);
    await expect(page.locator("#category")).toHaveValue("Distributed Systems");
  });

  test("lists all filter values with counts", async ({ page }) => {
    await page.goto("/search/");
    await expect(page.locator("#category option", { hasText: "Networking (2)" })).toHaveCount(1);
    await expect(page.locator("#tag option", { hasText: "sqlite (2)" })).toHaveCount(1);
  });

  test("sorts by update date", async ({ page }) => {
    await page.goto(`/search/?q=${encodeURIComponent("linux")}&sort=updated`);
    await expect(page.locator(".result-title a").first()).toHaveText("Linuxのページキャッシュを理解する");
  });

  test("submits from the header form on desktop", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await page.goto("/");
    await page.locator("#hq").fill("vacuum");
    await page.locator("#hq").press("Enter");
    await expect(page).toHaveURL(/\/search\/\?q=vacuum/);
    await expect(page.locator(".result-title a").first()).toHaveText("PostgreSQLのMVCCとVACUUMの内部構造");
  });

  test("opens the search page from the mobile header", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile");
    await page.goto("/");
    await page.locator(".hd-search-btn").click();
    await expect(page).toHaveURL(/\/search\/$/);
    await expect(page.locator("#q")).toBeVisible();
  });

  test("result links open the article", async ({ page }) => {
    await search(page, "OldestXmin");
    await page.locator(".result-title a").first().click();
    await expect(page).toHaveURL(/\/articles\/postgres-mvcc\/$/);
  });
});

test.describe("publication boundary", () => {
  test("the search index contains no canary or list pages", async ({ page }) => {
    expect(await search(page, "MARULABS-CANARY-7f3a9c")).toEqual([]);
    // "管理人" appears on every list page sidebar but in no article body.
    expect(await search(page, "管理人")).toEqual([]);
    // The About page is not an article.
    expect(await search(page, "sessionStorage")).toEqual([]);
  });

  test("the canary file cannot be fetched from the site", async ({ request }) => {
    for (const path of [
      "/tests/fixtures/canary/private-draft.md",
      "/drafts/private-draft/",
      "/articles/private-draft/",
      "/knowledge/",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});
