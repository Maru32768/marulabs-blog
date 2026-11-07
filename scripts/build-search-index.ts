/**
 * Builds the Pagefind index from article pages only. Lists, About and the search page
 * itself are never indexed. A site with no articles yet gets no index: Pagefind refuses
 * to build an empty one, and the search page handles that state.
 *
 * Usage: node scripts/build-search-index.ts [siteDir]
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as pagefind from "pagefind";

const site = process.argv[2] ?? "dist";
const articlesDir = join(site, "articles");

const articlePages = existsSync(articlesDir)
  ? readdirSync(articlesDir, { withFileTypes: true }).filter(
      (entry) =>
        entry.isDirectory() &&
        !["page", "sort"].includes(entry.name) &&
        existsSync(join(articlesDir, entry.name, "index.html")),
    )
  : [];

if (articlePages.length === 0) {
  console.log(`[search] ${site}: no article pages, skipping the search index`);
  process.exit(0);
}

const { index, errors } = await pagefind.createIndex({});
if (!index) throw new Error(`Pagefind failed to start: ${errors.join(", ")}`);

// Article pages live at exactly articles/<slug>/index.html. Paginated lists are deeper.
const added = await index.addDirectory({ path: site, glob: "articles/*/index.html" });
if (added.errors.length > 0) throw new Error(added.errors.join(", "));

const written = await index.writeFiles({ outputPath: join(site, "pagefind") });
if (written.errors.length > 0) throw new Error(written.errors.join(", "));

await pagefind.close();

if (added.page_count !== articlePages.length) {
  throw new Error(`Indexed ${added.page_count} pages, expected ${articlePages.length}`);
}
console.log(`[search] ${site}: indexed ${added.page_count} articles`);
