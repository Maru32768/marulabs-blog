/**
 * Publication boundary checks, shared by verify-source.ts and verify-dist.ts.
 * The boundary itself is structural: drafts and private knowledge live in another
 * repository. These checks catch mistakes at the edge of it, by comparing every output
 * against an allowlist (the published articles) rather than looking for known-bad names.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import { parse as parseYaml } from "yaml";

// Split so that this file does not contain the strings it looks for.
export const PRIVATE_MARKER = ["MARULABS", "PRIVATE"].join("-");
export const CANARY_MARKER = ["MARULABS", "CANARY"].join("-");

const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { name: "Anthropic API key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "Slack token", pattern: /\bxox[abeoprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: "Credential assignment",
    pattern:
      /\b(?:api[_-]?token|api[_-]?key|secret[_-]?key|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9_+/-]{24,}/i,
  },
];

export const FORBIDDEN_TRACKED_PATHS: { pattern: RegExp; reason: string }[] = [
  { pattern: /(^|\/)(knowledge|drafts?)\//, reason: "private content directories belong in marulabs-knowledge" },
  { pattern: /^src\/content\/(?!articles\/)/, reason: "only src/content/articles is a content source" },
  { pattern: /\.tfstate(\.|$)/, reason: "Terraform state must not be committed" },
  { pattern: /\.tfvars$/, reason: "Terraform variables must not be committed" },
  { pattern: /(^|\/)\.env(\.|$)|(^|\/)\.dev\.vars/, reason: "environment files must not be committed" },
];

/** Paths where the private marker is a real leak. Tests and docs may name it. */
const PUBLISHED_SOURCE = /^(src|public)\//;

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".wasm",
  ".pagefind",
  ".pf_fragment",
  ".pf_index",
  ".pf_filter",
  ".pf_meta",
]);

export function isBinaryPath(path: string): boolean {
  return BINARY_EXTENSIONS.has(extname(path).toLowerCase());
}

export function findSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

export function checkTrackedPath(path: string): string[] {
  return FORBIDDEN_TRACKED_PATHS.filter(({ pattern }) => pattern.test(path)).map(({ reason }) => `${path}: ${reason}`);
}

export function checkSourceFile(path: string, text: string): string[] {
  const problems = findSecrets(text).map((name) => `${path}: looks like a secret (${name})`);
  if (PUBLISHED_SOURCE.test(path)) {
    for (const marker of [PRIVATE_MARKER, CANARY_MARKER]) {
      if (text.includes(marker)) problems.push(`${path}: contains the private marker ${marker}`);
    }
  }
  return problems;
}

/** Things worth a human look before publishing. Reported as warnings: they can be legitimate. */
export function reviewHints(text: string): string[] {
  const hints: [RegExp, string][] = [
    [/(?:\/home\/|\/Users\/|C:\\Users\\)[A-Za-z0-9._-]+/, "absolute home directory path"],
    [
      /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/,
      "private IP address",
    ],
    [/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:internal|corp|intranet|lan)\b/i, "internal hostname"],
    [/[A-Za-z0-9._%+-]+@(?!example\.(?:com|org|net)\b)[A-Za-z0-9-]+\.[A-Za-z.]{2,}/, "email address"],
  ];
  return hints.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Reads `slug` from article frontmatter, without Astro. The list every output is checked against. */
export function readPublishedSlugs(contentDir: string): string[] {
  if (!existsSync(contentDir)) return [];
  return walk(contentDir)
    .filter((file) => /\.mdx?$/.test(file))
    .map((file) => {
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, "utf8"))?.[1];
      const slug = frontmatter ? (parseYaml(frontmatter) as { slug?: unknown }).slug : undefined;
      if (typeof slug !== "string") throw new Error(`${file}: frontmatter has no slug`);
      return slug;
    })
    .sort();
}

const ALLOWED_TOP_LEVEL = new Set([
  "404.html",
  "_astro",
  "_headers",
  "about",
  "archive",
  "articles",
  "atom.xml",
  "categories",
  "changelog",
  "favicon.svg",
  "fonts",
  "index.html",
  "og.png",
  "pagefind",
  "robots.txt",
  "rss.xml",
  "search",
  "sitemap-index.xml",
  "tags",
]);

const isAllowedTopLevel = (name: string): boolean => ALLOWED_TOP_LEVEL.has(name) || /^sitemap-\d+\.xml$/.test(name);

const ARTICLE_PATH = /\/articles\/([^/"'<>\s#?]+)\//g;
const LIST_SEGMENTS = new Set(["page", "sort"]);

function articleSlugsIn(text: string): Set<string> {
  const slugs = new Set<string>();
  for (const match of text.matchAll(ARTICLE_PATH)) {
    const slug = match[1];
    if (slug && !LIST_SEGMENTS.has(slug)) slugs.add(decodeURIComponent(slug));
  }
  return slugs;
}

/** Real links only: an article may legitimately mention such a path in its text or code. */
function linkedArticleSlugs(html: string): Set<string> {
  const hrefs = [...html.matchAll(/\bhref="([^"]*)"/g)].map((match) => match[1] ?? "");
  const local = hrefs.filter((href) => href.startsWith("/") || href.startsWith("https://blog.marulabs.dev/"));
  return articleSlugsIn(local.map((href) => (href.endsWith("/") ? href : `${href}/`)).join("\n"));
}

function compareSets(label: string, actual: Set<string>, expected: Set<string>): string[] {
  const problems: string[] = [];
  for (const slug of actual) if (!expected.has(slug)) problems.push(`${label}: contains unpublished article "${slug}"`);
  for (const slug of expected) if (!actual.has(slug)) problems.push(`${label}: is missing published article "${slug}"`);
  return problems;
}

function scanForMarkers(label: string, text: string): string[] {
  return [PRIVATE_MARKER, CANARY_MARKER]
    .filter((marker) => text.includes(marker))
    .map((marker) => `${label}: contains the private marker ${marker}`);
}

interface PagefindFragment {
  url?: string;
  content?: string;
  meta?: Record<string, string>;
}

/** Pagefind fragments are gzip-compressed JSON behind a short signature. */
export function decodePagefindFragment(buffer: Buffer): PagefindFragment {
  const text = gunzipSync(buffer).toString("utf8");
  return JSON.parse(text.slice(text.indexOf("{"))) as PagefindFragment;
}

/** Returns every way the build output differs from "exactly the published articles". */
export function verifyDist(distDir: string, publishedSlugs: readonly string[]): string[] {
  const problems: string[] = [];
  if (!existsSync(distDir)) return [`${distDir}: does not exist, build first`];

  const expected = new Set(publishedSlugs);
  const rel = (file: string) => relative(distDir, file).split(sep).join("/");

  for (const entry of readdirSync(distDir)) {
    if (!isAllowedTopLevel(entry)) problems.push(`${entry}: unexpected top-level entry in the build output`);
  }

  const files = walk(distDir);
  const linked = new Set<string>();

  for (const file of files) {
    const path = rel(file);
    if (/\.(mdx?|markdown|tfstate|env)$/.test(path)) problems.push(`${path}: source-like file in the build output`);
    if (isBinaryPath(path)) continue;
    const text = readFileSync(file, "utf8");
    problems.push(
      ...scanForMarkers(path, text),
      ...findSecrets(text).map((name) => `${path}: looks like a secret (${name})`),
    );
    if (path.endsWith(".html")) for (const slug of linkedArticleSlugs(text)) linked.add(slug);
  }

  const articleDir = join(distDir, "articles");
  const pages = new Set(
    existsSync(articleDir)
      ? readdirSync(articleDir).filter(
          (name) => !LIST_SEGMENTS.has(name) && statSync(join(articleDir, name)).isDirectory(),
        )
      : [],
  );
  problems.push(...compareSets("articles/ pages", pages, expected));

  for (const slug of linked) {
    if (!expected.has(slug)) problems.push(`HTML links: link to unpublished article "${slug}"`);
  }

  for (const feed of ["rss.xml", "atom.xml"]) {
    const path = join(distDir, feed);
    if (existsSync(path)) problems.push(...compareSets(feed, articleSlugsIn(readFileSync(path, "utf8")), expected));
    else problems.push(`${feed}: missing`);
  }

  const sitemaps = files.filter((f) => /sitemap-\d+\.xml$/.test(f));
  if (sitemaps.length === 0) problems.push("sitemap: missing");
  const inSitemap = new Set(sitemaps.flatMap((f) => [...articleSlugsIn(readFileSync(f, "utf8"))]));
  problems.push(...compareSets("sitemap", inSitemap, expected));

  const fragmentDir = join(distDir, "pagefind", "fragment");
  if (expected.size === 0) {
    if (existsSync(join(distDir, "pagefind"))) problems.push("pagefind: index exists although nothing is published");
  } else if (!existsSync(fragmentDir)) {
    problems.push("pagefind: index is missing");
  } else {
    const indexed = new Set<string>();
    for (const name of readdirSync(fragmentDir)) {
      const fragment = decodePagefindFragment(readFileSync(join(fragmentDir, name)));
      const slug = /^\/articles\/([^/]+)\/$/.exec(fragment.url ?? "")?.[1];
      if (slug) indexed.add(decodeURIComponent(slug));
      else problems.push(`pagefind: indexed a non-article page "${fragment.url ?? "?"}"`);
      problems.push(...scanForMarkers(`pagefind fragment ${name}`, JSON.stringify(fragment)));
    }
    problems.push(...compareSets("pagefind", indexed, expected));
  }

  return problems;
}
