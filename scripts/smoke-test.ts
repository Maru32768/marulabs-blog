/**
 * Post-deploy check of the live site. Does not add to the counter: it only reads.
 *
 * Usage: node scripts/smoke-test.ts https://blog.marulabs.dev
 */
const base = process.argv[2] ?? "https://blog.marulabs.dev";

interface Check {
  path: string;
  status: number;
  contains?: string;
  /** Must not be in the body. Checked as a browser would see it, after any edge rewriting. */
  absent?: string;
}

const INJECTED_ANALYTICS = "cloudflareinsights";

// Cloudflare only injects into responses to requests that look like a page view.
const BROWSER_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
};

const checks: Check[] = [
  { path: "/", status: 200, contains: "Maru's", absent: INJECTED_ANALYTICS },
  { path: "/articles/", status: 200, contains: "記事一覧", absent: INJECTED_ANALYTICS },
  { path: "/about/", status: 200, contains: "このサイトについて" },
  { path: "/search/", status: 200, contains: "サイト内検索" },
  { path: "/rss.xml", status: 200, contains: "<rss" },
  { path: "/atom.xml", status: 200, contains: "<feed" },
  { path: "/sitemap-index.xml", status: 200, contains: "sitemap" },
  { path: "/robots.txt", status: 200, contains: "Sitemap:" },
  { path: "/this-page-does-not-exist/", status: 404, contains: "ページが見つかりません" },
  { path: "/api/counter", status: 200, contains: '"value"' },
];

async function attempt(check: Check): Promise<string | undefined> {
  const response = await fetch(new URL(check.path, base), { redirect: "manual", headers: BROWSER_HEADERS });
  const body = await response.text();
  if (response.status !== check.status) return `${check.path}: expected ${check.status}, got ${response.status}`;
  if (check.contains && !body.includes(check.contains)) return `${check.path}: missing "${check.contains}"`;
  if (check.absent && body.includes(check.absent)) return `${check.path}: must not contain "${check.absent}"`;
  return undefined;
}

let failures: string[] = [];
// Deployments and new custom domains can take a moment to become visible.
for (let round = 1; round <= 10; round++) {
  const results = await Promise.all(
    checks.map((check) => attempt(check).catch((error: unknown) => `${check.path}: ${String(error)}`)),
  );
  failures = results.filter((result) => result !== undefined);
  if (failures.length === 0) break;
  if (round < 10) await new Promise((resolve) => setTimeout(resolve, 6000));
}

if (failures.length > 0) {
  console.error(`Smoke test failed for ${base}:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`Smoke test passed for ${base}: ${checks.length} checks.`);

export {};
