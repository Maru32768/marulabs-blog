import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { site } from "../data/site.ts";
import { categoryBySlug } from "../data/taxonomy.ts";
import { articleUrl, byPublishedDesc } from "../lib/articles.ts";
import { getArticles } from "../lib/collection.ts";

export const GET: APIRoute = async () => {
  const articles = byPublishedDesc(await getArticles());
  return rss({
    title: site.title,
    description: site.description,
    site: site.url,
    customData: "<language>ja</language>",
    items: articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      link: articleUrl(a),
      pubDate: a.data.publishedAt,
      categories: [categoryBySlug(a.data.category).name, ...a.data.tags],
    })),
  });
};
