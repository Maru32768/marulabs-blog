import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { articleSchema } from "./lib/article-schema.ts";

/**
 * The only content source of the site. Drafts and private knowledge live in a
 * separate private repository and are never read here.
 *
 * BLOG_CONTENT=fixtures swaps in synthetic test articles and, in astro.config.ts,
 * a separate outDir (dist-fixtures), so a fixture build can never be deployed.
 */
const base = process.env.BLOG_CONTENT === "fixtures" ? "./tests/fixtures/articles" : "./src/content/articles";

const articles = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base }),
  schema: articleSchema,
});

export const collections = { articles };
