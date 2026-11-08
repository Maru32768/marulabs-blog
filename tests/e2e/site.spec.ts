import { expect, test } from "@playwright/test";
import { FIXED_NOW, FIXTURE_COUNT, LONG_ARTICLE, MAIN_ARTICLE } from "./helpers.ts";

const KEY_PAGES = [
  "/",
  "/articles/",
  MAIN_ARTICLE,
  LONG_ARTICLE,
  "/categories/",
  "/tags/",
  "/archive/",
  "/changelog/",
  "/about/",
  "/search/",
  "/nope/",
];

test.describe("home", () => {
  test("shows numbers derived from the content", async ({ page }, info) => {
    await page.goto("/");
    await expect(page.locator(".panel-note").first()).toContainText(`${FIXTURE_COUNT} 記事`);
    if (info.project.name === "desktop") {
      // 12 articles with revisions 3+2+1+1+2+4+2+1+1+1+1+1 = 20.
      await expect(page.locator(".stats-strip")).toContainText(`記事 ${FIXTURE_COUNT} · 改訂 20 · カテゴリ 7`);
    }
    await expect(page.locator(".cat-grid.trow")).toHaveCount(7);
    await expect(page.locator(".avatar img")).toHaveJSProperty("naturalWidth", 112);
  });

  test("shows the requested sections", async ({ page }) => {
    await page.goto("/");
    for (const name of ["カテゴリ一覧", "最新の記事", "更新履歴", "管理人", "アクセスカウンター"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
  });

  test("does not contain features that were ruled out", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("body").innerText();
    for (const removed of [
      "前回の訪問",
      "既読",
      "ログイン",
      "ユーザー登録",
      "コメント",
      "Lab Status",
      "下書き",
      "設計ノート",
      "Kernels",
      "書き残す",
      "興味",
      "データ・カーネル",
    ]) {
      expect(text, removed).not.toContain(removed);
    }
  });

  test("marks only recently updated rows as new", async ({ page }) => {
    await page.clock.setFixedTime(FIXED_NOW);
    await page.goto("/");
    const recent = page.locator(".thread-grid.trow", { hasText: "jobq devlog #7" });
    await expect(recent).toHaveClass(/is-new/);
    const old = page.locator(".thread-grid.trow", { hasText: "Goが独自のアセンブラ" });
    await expect(old).not.toHaveClass(/is-new/);
  });

  test("collapses a category group without JavaScript dependencies", async ({ page }) => {
    await page.goto("/");
    const group = page.locator("details.group#systems");
    await expect(group).toHaveAttribute("open", "");
    await group.locator("summary").click();
    await expect(group).not.toHaveAttribute("open", "");
  });
});

test.describe("article", () => {
  test("renders metadata, tags and dates", async ({ page }) => {
    await page.goto(MAIN_ARTICLE);
    await expect(page.locator("h1")).toHaveText("PostgreSQLのMVCCとVACUUMの内部構造");
    await expect(page.locator(".art-facts")).toContainText("PostgreSQL 17");
    await expect(page.locator(".art-tags .tag")).toHaveCount(5);
    await expect(page.locator(".post-dates")).toContainText("2026/10/12 21:40");
    await expect(page.locator(".post-dates")).toContainText("2026/11/05 23:14");
    await expect(page.locator(".rev-rows .rev-id")).toHaveCount(3);
  });

  test("renders Markdown elements", async ({ page }) => {
    await page.goto(MAIN_ARTICLE);
    await expect(page.locator(".art-body h2")).toHaveCount(7);
    await expect(page.locator(".art-body ul li").first()).toBeVisible();
    await expect(page.locator(".art-body ol li").first()).toBeVisible();
    await expect(page.locator(".quote blockquote")).toContainText("VACUUM reclaims storage");
    await expect(page.locator(".quote-source")).toContainText("PostgreSQL Documentation");
    await expect(page.locator(".callout--note .callout-title")).toContainText("メモ: SELECT");
    await expect(page.locator(".callout--warning .callout-title")).toContainText("注意: VACUUM");
    await expect(page.locator(".table-scroll caption")).toHaveText("表1. VACUUM の種類と取得するロック");
    await expect(page.locator(".code--output figcaption")).toContainText("Output:");
  });

  test("highlights code and labels code blocks", async ({ page }) => {
    await page.goto(MAIN_ARTICLE);
    const figure = page.locator("figure.code").first();
    await expect(figure.locator("figcaption")).toContainText("Code: C");
    await expect(figure.locator("figcaption")).toContainText("src/include/access/htup_details.h");
    await expect(figure.locator(".line").first().locator("span").first()).toHaveCSS("color", "rgb(26, 26, 166)");
  });

  test("gives headings working anchors and a table of contents", async ({ page }, info) => {
    await page.goto(MAIN_ARTICLE);
    const toc = info.project.name === "desktop" ? page.locator(".article-side .toc") : page.locator(".toc--inline");
    await expect(toc).toBeVisible();
    await expect(toc.locator("a")).toHaveCount(7);
    for (const link of await toc.locator("a").all()) {
      const hash = decodeURIComponent((await link.getAttribute("href")) ?? "");
      await expect(page.locator(`[id="${hash.slice(1)}"]`)).toHaveCount(1);
    }
    await toc.locator("a").nth(3).click();
    await expect(page).toHaveURL(/#update/);
    await expect(page.locator(".art-body h2 >> nth=3 >> a.anchor")).toHaveAttribute("href", /#update/);
  });

  test("links previous, next and related articles", async ({ page }) => {
    await page.goto("/articles/linux-page-cache/");
    const nav = page.getByRole("navigation", { name: "前後の記事" });
    await expect(nav).toContainText("前の記事");
    await expect(nav).toContainText("次の記事");
    await expect(page.locator(".related-panel .trow").first()).toContainText("ext4のジャーナリング");
  });

  test("copies code", async ({ page, browserName, context }, info) => {
    test.skip(info.project.name !== "desktop" || browserName !== "chromium");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(MAIN_ARTICLE);
    const button = page.locator("figure.code [data-copy]").first();
    await button.click();
    await expect(button).toHaveText("コピー済");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("typedef struct HeapTupleFields");
  });

  test("includes SEO metadata", async ({ page }) => {
    await page.goto(MAIN_ARTICLE);
    await expect(page).toHaveTitle("PostgreSQLのMVCCとVACUUMの内部構造 — Maru's Blog");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://blog.marulabs.dev${MAIN_ARTICLE}`,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      "https://blog.marulabs.dev/og.png",
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /pageinspect/);
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}",
    ) as Record<string, unknown>;
    expect(jsonLd.headline).toBe("PostgreSQLのMVCCとVACUUMの内部構造");
  });
});

test.describe("layout", () => {
  for (const path of KEY_PAGES) {
    test(`has no horizontal page overflow on ${path}`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("long titles wrap inside the column", async ({ page }) => {
    await page.goto(LONG_ARTICLE);
    const title = await page.locator("h1").boundingBox();
    const column = await page.locator(".art").boundingBox();
    if (!title || !column) throw new Error("missing layout boxes");
    expect(title.x + title.width).toBeLessThanOrEqual(column.x + column.width);
  });

  test("code blocks scroll inside their own box and keep the gutter fixed", async ({ page }) => {
    await page.goto(LONG_ARTICLE);
    const pre = page.locator("figure.code pre").first();
    const sizes = await pre.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    await pre.evaluate((el) => {
      el.scrollLeft = 200;
    });
    expect(await pre.evaluate((el) => el.scrollLeft)).toBe(200);
  });

  test("wide tables scroll inside their own box", async ({ page }) => {
    await page.goto(LONG_ARTICLE);
    const sizes = await page
      .locator(".table-scroll")
      .first()
      .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
  });

  test("uses the agreed font sizes", async ({ page }) => {
    await page.goto(MAIN_ARTICLE);
    const size = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const article = await size(".art-body p");
    expect(article).toBeGreaterThanOrEqual(16);
    expect(article).toBeLessThanOrEqual(18);
    const ui = await size("body");
    expect(ui).toBeGreaterThanOrEqual(14);
    expect(ui).toBeLessThanOrEqual(16);
    const meta = await size(".post-dates");
    expect(meta).toBeGreaterThanOrEqual(12);
    expect(meta).toBeLessThanOrEqual(14);
  });

  test("touch targets on the mobile navigation are at least 44px", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile");
    await page.goto("/");
    const box = await page.locator(".nav a").first().boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("browser console", () => {
  for (const path of ["/", MAIN_ARTICLE, `/search/?q=${encodeURIComponent("vacuum")}`]) {
    test(`shows no errors or CSP violations on ${path}`, async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(message.text());
      });
      page.on("pageerror", (error) => problems.push(error.message));
      await page.goto(path, { waitUntil: "networkidle" });
      expect(problems).toEqual([]);
    });
  }
});

test.describe("site pages", () => {
  test("every internal link from key pages resolves", async ({ page, request }) => {
    const seen = new Set<string>();
    for (const path of ["/", MAIN_ARTICLE, "/categories/", "/tags/", "/archive/", "/changelog/", "/about/"]) {
      await page.goto(path);
      const hrefs = await page
        .locator('a[href^="/"]')
        .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).pathname));
      for (const href of hrefs) seen.add(href);
    }
    for (const href of seen) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
  });

  test("paginates the article list statically", async ({ page }) => {
    await page.goto("/articles/");
    await expect(page.locator(".thread-grid.trow")).toHaveCount(10);
    await page.locator(".pager a[rel=next]").click();
    await expect(page).toHaveURL(/\/articles\/page\/2\/$/);
    await expect(page.locator(".thread-grid.trow")).toHaveCount(2);
  });

  test("sorts by published date and revisions", async ({ page }) => {
    await page.goto("/articles/sort/revisions/");
    await expect(page.locator(".thread-title").first()).toHaveText("SQLiteを使った永続ジョブキューの設計");
    await page.goto("/articles/sort/published/");
    await expect(page.locator(".thread-title").first()).toHaveText("jobq devlog #7: leaseの延長とハートビート");
  });

  test("lists articles by category, tag and month", async ({ page }) => {
    await page.goto("/categories/networking/");
    await expect(page.locator(".thread-grid.trow")).toHaveCount(2);
    await page.goto("/tags/sqlite/");
    await expect(page.locator(".thread-grid.trow")).toHaveCount(2);
    await page.goto("/archive/2026/10/");
    await expect(page.locator(".thread-grid.trow")).toHaveCount(4);
  });

  test("jumps to a category from the footer", async ({ page }) => {
    await page.goto("/");
    await page.locator("#jump").selectOption("/categories/networking/");
    await page.locator(".ft-jump button").click();
    await expect(page).toHaveURL(/\/categories\/networking\/$/);
  });

  test("answers unknown paths with a real 404", async ({ page }) => {
    const response = await page.goto("/articles/does-not-exist/");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("ページが見つかりません");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  });

  test("redirects to the canonical trailing slash", async ({ request }) => {
    const response = await request.get("/about", { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/about/");
  });

  test("keeps the edge from rewriting pages, and only pages", async ({ request }) => {
    for (const path of ["/", "/about/", "/nope/"]) {
      expect((await request.get(path)).headers()["cache-control"], path).toContain("no-transform");
    }
    for (const path of ["/rss.xml", "/robots.txt", "/favicon.svg"]) {
      expect((await request.get(path)).headers()["cache-control"], path).not.toContain("no-transform");
    }
  });

  test("sends security headers on pages", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
  });
});

test.describe("feeds and sitemap", () => {
  const slugs = ["postgres-mvcc", "jobq-devlog-7", "markdown-elements-with-a-very-long-title"];

  test("RSS lists published articles", async ({ request }) => {
    const response = await request.get("/rss.xml");
    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml.match(/<item>/g)).toHaveLength(FIXTURE_COUNT);
    for (const slug of slugs) expect(xml).toContain(`https://blog.marulabs.dev/articles/${slug}/`);
  });

  test("Atom lists published articles", async ({ request }) => {
    const xml = await (await request.get("/atom.xml")).text();
    expect(xml.match(/<entry>/g)).toHaveLength(FIXTURE_COUNT);
    expect(xml).toContain("<updated>");
  });

  test("the sitemap lists articles and leaves out the search page", async ({ request }) => {
    expect((await request.get("/sitemap-index.xml")).status()).toBe(200);
    const xml = await (await request.get("/sitemap-0.xml")).text();
    for (const slug of slugs) expect(xml).toContain(`/articles/${slug}/`);
    expect(xml).not.toContain("/search/");
    expect(xml).not.toContain("/404");
  });

  test("robots.txt points to the sitemap", async ({ request }) => {
    expect(await (await request.get("/robots.txt")).text()).toContain(
      "Sitemap: https://blog.marulabs.dev/sitemap-index.xml",
    );
  });
});

test.describe("performance", () => {
  test("ships little JavaScript and loads no search code outside the search page", async ({ page }) => {
    const scripts: { url: string; size: number }[] = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "script") {
        void response.body().then((body) => scripts.push({ url: response.url(), size: body.length }));
      }
    });
    await page.goto(MAIN_ARTICLE, { waitUntil: "networkidle" });
    expect(scripts.some((s) => s.url.includes("pagefind"))).toBe(false);
    expect(scripts.reduce((sum, s) => sum + s.size, 0)).toBeLessThan(6 * 1024);
  });

  test("pages render without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(MAIN_ARTICLE);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".art-body h2").first()).toBeVisible();
    await page.goto("/");
    await expect(page.locator(".counter")).toHaveText("-------");
    await context.close();
  });
});
