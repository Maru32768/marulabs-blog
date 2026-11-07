import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CANARY_MARKER,
  PRIVATE_MARKER,
  checkSourceFile,
  checkTrackedPath,
  findSecrets,
  readPublishedSlugs,
  reviewHints,
  verifyDist,
} from "../../scripts/lib/boundary.ts";

let dir: string;

function write(path: string, content: string | Buffer): void {
  const full = join(dir, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

const fragment = (url: string, content = "本文") =>
  gzipSync(Buffer.from(`pagefind_dcd${JSON.stringify({ url, content, meta: { title: "t" } })}`));

/** A minimal correct build with one published article. Tests break it in one way each. */
function writeCleanDist(slug = "published"): void {
  write("index.html", `<a href="/articles/${slug}/">x</a>`);
  write(`articles/${slug}/index.html`, "<h1>x</h1>");
  write("articles/index.html", "list");
  write("articles/page/2/index.html", "list");
  write("rss.xml", `<link>https://blog.marulabs.dev/articles/${slug}/</link>`);
  write("atom.xml", `<id>https://blog.marulabs.dev/articles/${slug}/</id>`);
  write("sitemap-index.xml", "<sitemapindex/>");
  write("sitemap-0.xml", `<loc>https://blog.marulabs.dev/articles/${slug}/</loc><loc>https://blog.marulabs.dev/</loc>`);
  write("pagefind/pagefind-entry.json", "{}");
  write("pagefind/fragment/ja_1.pf_fragment", fragment(`/articles/${slug}/`));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "boundary-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("verifyDist", () => {
  it("passes a clean build", () => {
    writeCleanDist();
    expect(verifyDist(dir, ["published"])).toEqual([]);
  });

  it("passes an empty site with no search index", () => {
    write("index.html", "home");
    write("rss.xml", "<rss/>");
    write("atom.xml", "<feed/>");
    write("sitemap-0.xml", "<loc>https://blog.marulabs.dev/</loc>");
    expect(verifyDist(dir, [])).toEqual([]);
  });

  it.each([
    [
      "an unpublished article page",
      () => {
        write("articles/secret-draft/index.html", "x");
      },
      /articles\/ pages.*secret-draft/,
    ],
    [
      "an unpublished article in RSS",
      () => {
        write("rss.xml", "<link>https://x/articles/published/</link><link>https://x/articles/secret-draft/</link>");
      },
      /rss\.xml.*secret-draft/,
    ],
    [
      "an unpublished article in Atom",
      () => {
        write("atom.xml", "<id>https://x/articles/published/</id><id>https://x/articles/secret-draft/</id>");
      },
      /atom\.xml.*secret-draft/,
    ],
    [
      "an unpublished article in the sitemap",
      () => {
        write("sitemap-0.xml", "<loc>https://x/articles/published/</loc><loc>https://x/articles/secret-draft/</loc>");
      },
      /sitemap.*secret-draft/,
    ],
    [
      "an unpublished article in the search index",
      () => {
        write("pagefind/fragment/ja_2.pf_fragment", fragment("/articles/secret-draft/"));
      },
      /pagefind.*secret-draft/,
    ],
    [
      "a non-article page in the search index",
      () => {
        write("pagefind/fragment/ja_2.pf_fragment", fragment("/about/"));
      },
      /non-article page/,
    ],
    [
      "a link to an unpublished article",
      () => {
        write("about/index.html", '<a href="/articles/secret-draft/">x</a>');
      },
      /link to unpublished/,
    ],
    [
      "the private marker in HTML",
      () => {
        write("about/index.html", `text ${PRIVATE_MARKER}`);
      },
      /private marker/,
    ],
    [
      "the canary in a script",
      () => {
        write("_astro/a.js", `const a = "${CANARY_MARKER}";`);
      },
      /private marker/,
    ],
    [
      "the private marker in the search index",
      () => {
        write("pagefind/fragment/ja_1.pf_fragment", fragment("/articles/published/", `本文 ${PRIVATE_MARKER}`));
      },
      /fragment.*private marker/,
    ],
    [
      "an unexpected top-level directory",
      () => {
        write("knowledge/note.html", "x");
      },
      /unexpected top-level/,
    ],
    [
      "a Markdown source file",
      () => {
        write("articles/published/source.md", "x");
      },
      /source-like/,
    ],
    [
      "a secret",
      () => {
        write("about/index.html", `token ${["gh", "p_"].join("")}${"a".repeat(36)}`);
      },
      /secret/,
    ],
  ])("detects %s", (_name, breakIt, expected) => {
    writeCleanDist();
    breakIt();
    const problems = verifyDist(dir, ["published"]);
    expect(problems.join("\n")).toMatch(expected);
  });

  it("does not mistake a path mentioned in article text for a link", () => {
    writeCleanDist();
    write("articles/published/index.html", "<p>URL は <code>/articles/some-slug/</code> の形式です。</p>");
    expect(verifyDist(dir, ["published"])).toEqual([]);
  });

  it("detects a link to an unpublished article by absolute URL", () => {
    writeCleanDist();
    write("about/index.html", '<a href="https://blog.marulabs.dev/articles/secret-draft/">x</a>');
    expect(verifyDist(dir, ["published"]).join("\n")).toMatch(/link to unpublished.*secret-draft/);
  });

  it("detects a published article that is missing from each output", () => {
    writeCleanDist();
    expect(verifyDist(dir, ["published", "another"]).join("\n")).toMatch(
      /articles\/ pages.*another[\s\S]*rss\.xml.*another[\s\S]*atom\.xml.*another[\s\S]*sitemap.*another[\s\S]*pagefind.*another/,
    );
  });

  it("detects a search index on a site with nothing published", () => {
    write("rss.xml", "<rss/>");
    write("atom.xml", "<feed/>");
    write("sitemap-0.xml", "<loc>https://x/</loc>");
    write("pagefind/pagefind-entry.json", "{}");
    expect(verifyDist(dir, []).join("\n")).toMatch(/index exists although nothing is published/);
  });

  it("reports a missing build", () => {
    expect(verifyDist(join(dir, "nope"), [])).toEqual([`${join(dir, "nope")}: does not exist, build first`]);
  });
});

describe("source checks", () => {
  it("forbids private content paths, state and environment files", () => {
    for (const path of [
      "knowledge/databases/note.md",
      "drafts/post.md",
      "src/content/drafts/post.md",
      "src/content/knowledge/post.md",
      "terraform/terraform.tfstate",
      "terraform/terraform.tfstate.backup",
      "terraform/prod.tfvars",
      ".env",
      ".env.production",
      ".dev.vars",
      "cloudflare.env",
      ".mise.local.toml",
      "mise.local.toml",
      ".mise.ops.local.toml",
    ]) {
      expect(checkTrackedPath(path), path).not.toEqual([]);
    }
  });

  it("allows normal paths", () => {
    for (const path of [
      "src/content/articles/post.md",
      "terraform/main.tf",
      "tests/fixtures/articles/a.md",
      "README.md",
      ".mise.toml",
      ".mise.ops.toml",
      "mise.lock",
      "ops.env.example",
    ]) {
      expect(checkTrackedPath(path), path).toEqual([]);
    }
  });

  it("treats the marker as a leak in published sources only", () => {
    const text = `note ${PRIVATE_MARKER}`;
    expect(checkSourceFile("src/content/articles/post.md", text)).not.toEqual([]);
    expect(checkSourceFile("public/note.txt", text)).not.toEqual([]);
    expect(checkSourceFile("tests/fixtures/canary/note.md", text)).toEqual([]);
  });

  it.each([
    ["AWS", ["AK", "IA", "ABCDEFGHIJKLMNOP"].join("")],
    ["GitHub", `${["gh", "p_"].join("")}${"a".repeat(36)}`],
    ["Anthropic", `${["sk", "ant"].join("-")}-${"a".repeat(24)}`],
    ["private key", ["-----BEGIN RSA", "PRIVATE KEY-----"].join(" ")],
    ["assignment", `api_token = "${"a1".repeat(16)}"`],
  ])("finds a %s secret", (_name, secret) => {
    expect(findSecrets(`before ${secret} after`)).not.toEqual([]);
  });

  it("does not flag secret references in workflows or ordinary prose", () => {
    expect(findSecrets("apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}")).toEqual([]);
    expect(findSecrets("パスワードやトークンは記事に書かない。The password is required.")).toEqual([]);
  });

  it("raises review hints for details worth a second look", () => {
    expect(reviewHints("/home/alice/project")).toContain("absolute home directory path");
    expect(reviewHints("connect to 10.1.2.3")).toContain("private IP address");
    expect(reviewHints("db01.corp is down")).toContain("internal hostname");
    expect(reviewHints("mail me at someone@company.co.jp")).toContain("email address");
    expect(reviewHints("user@example.com on 8.8.8.8 in /usr/local")).toEqual([]);
  });
});

describe("readPublishedSlugs", () => {
  it("reads slugs from frontmatter", () => {
    write("content/a.md", "---\nslug: alpha\n---\nbody");
    write("content/sub/b.mdx", "---\ntitle: x\nslug: beta\n---\nbody");
    write("content/README.txt", "ignored");
    expect(readPublishedSlugs(join(dir, "content"))).toEqual(["alpha", "beta"]);
  });

  it("returns nothing for a missing or empty directory", () => {
    expect(readPublishedSlugs(join(dir, "missing"))).toEqual([]);
  });

  it("fails on an article without a slug", () => {
    write("content/a.md", "---\ntitle: x\n---\nbody");
    expect(() => readPublishedSlugs(join(dir, "content"))).toThrow(/no slug/);
  });
});
