import type { APIRoute } from "astro";
import { site } from "../data/site.ts";
import { categoryBySlug } from "../data/taxonomy.ts";
import { articleUrl, byUpdatedDesc } from "../lib/articles.ts";
import { getArticles } from "../lib/collection.ts";

const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);

export const GET: APIRoute = async () => {
  const articles = byUpdatedDesc(await getArticles());
  const updated = (
    articles[0]?.data.updatedAt ?? new Date(Date.UTC(site.launched.year, site.launched.month - 1))
  ).toISOString();

  const entries = articles.map((a) => {
    const url = new URL(articleUrl(a), site.url).href;
    return `  <entry>
    <title>${escapeXml(a.data.title)}</title>
    <link href="${escapeXml(url)}"/>
    <id>${escapeXml(url)}</id>
    <published>${a.data.publishedAt.toISOString()}</published>
    <updated>${a.data.updatedAt.toISOString()}</updated>
    <summary>${escapeXml(a.data.description)}</summary>
    <category term="${escapeXml(categoryBySlug(a.data.category).name)}"/>
  </entry>`;
  });

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">
  <title>${escapeXml(site.title)}</title>
  <link href="${site.url}/"/>
  <link rel="self" href="${site.url}/atom.xml"/>
  <id>${site.url}/</id>
  <updated>${updated}</updated>
  <author><name>${escapeXml(site.author)}</name></author>
${entries.join("\n")}
</feed>
`;

  return new Response(body, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
};
