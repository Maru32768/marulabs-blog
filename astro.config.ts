import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import { rehypeArticle } from "./src/plugins/rehype-article.ts";
import { classicTheme, codeMetaTransformer } from "./src/plugins/shiki-classic.ts";

/** Fixture builds use synthetic articles and a separate outDir, so they can never be deployed. */
const fixtures = process.env.BLOG_CONTENT === "fixtures";

export default defineConfig({
  site: "https://blog.marulabs.dev",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  outDir: fixtures ? "./dist-fixtures" : "./dist",
  cacheDir: fixtures ? "./node_modules/.astro-fixtures" : "./node_modules/.astro",
  markdown: {
    processor: unified({
      rehypePlugins: [rehypeHeadingIds, rehypeArticle],
      remarkRehype: { footnoteLabel: "脚注", footnoteBackLabel: "本文へ戻る" },
    }),
    shikiConfig: {
      theme: classicTheme,
      transformers: [codeMetaTransformer],
      langAlias: { output: "text", tf: "hcl" },
    },
  },
  integrations: [
    mdx(),
    sitemap({
      // The search page has no content of its own and is noindex.
      filter: (page) => !new URL(page).pathname.startsWith("/search/"),
    }),
  ],
  vite: {
    // Keep scripts external so the Content-Security-Policy can stay at script-src 'self'.
    build: { assetsInlineLimit: 0 },
  },
});
