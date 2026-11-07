import { getCollection, type CollectionEntry } from "astro:content";
import { assertUniqueSlugs, byUpdatedDesc } from "./articles.ts";

export type Article = CollectionEntry<"articles">;

let cached: Promise<Article[]> | undefined;

/** Every published article, newest update first. This is the single query used by all pages. */
export function getArticles(): Promise<Article[]> {
  cached ??= getCollection("articles").then((entries) => {
    assertUniqueSlugs(entries);
    return byUpdatedDesc(entries);
  });
  return cached;
}
