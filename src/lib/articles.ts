import type { ArticleData } from "./article-schema.ts";
import { categories, type CategorySlug } from "../data/taxonomy.ts";

/** Minimal shape of a collection entry, so these helpers stay testable without astro:content. */
export interface ArticleLike {
  id: string;
  body?: string | undefined;
  filePath?: string | undefined;
  data: ArticleData;
}

export const articleUrl = (a: { data: { slug: string } }): string => `/articles/${a.data.slug}/`;
export const categoryUrl = (slug: CategorySlug): string => `/categories/${slug}/`;
export const tagUrl = (tag: string): string => `/tags/${encodeURIComponent(tag)}/`;
export const archiveUrl = (year: number, month: number): string => `/archive/${year}/${pad(month)}/`;

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function byUpdatedDesc<T extends ArticleLike>(articles: readonly T[]): T[] {
  return [...articles].sort((a, b) => b.data.updatedAt.getTime() - a.data.updatedAt.getTime());
}

export function byPublishedDesc<T extends ArticleLike>(articles: readonly T[]): T[] {
  return [...articles].sort((a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime());
}

export function byRevisionDesc<T extends ArticleLike>(articles: readonly T[]): T[] {
  return [...articles].sort(
    (a, b) => b.data.revision - a.data.revision || b.data.updatedAt.getTime() - a.data.updatedAt.getTime(),
  );
}

/** Japanese technical prose reads at roughly 600 characters per minute. */
export function readingMinutes(body: string | undefined): number {
  const chars = (body ?? "").replace(/\s+/g, "").length;
  return Math.max(1, Math.ceil(chars / 600));
}

export function charCount(body: string | undefined): number {
  return (body ?? "").replace(/\s+/g, "").length;
}

export interface SiteStats {
  articles: number;
  revisions: number;
  categories: number;
}

export function siteStats(articles: readonly ArticleLike[]): SiteStats {
  return {
    articles: articles.length,
    revisions: articles.reduce((sum, a) => sum + a.data.revision, 0),
    categories: categories.length,
  };
}

export interface CategoryStats<T extends ArticleLike> {
  articles: T[];
  revisions: number;
  latest: T | undefined;
  /** Most used tags within the category, shown where the design has サブカテゴリ. */
  topTags: string[];
}

export function categoryStats<T extends ArticleLike>(all: readonly T[], slug: CategorySlug): CategoryStats<T> {
  const articles = byUpdatedDesc(all.filter((a) => a.data.category === slug));
  return {
    articles,
    revisions: articles.reduce((sum, a) => sum + a.data.revision, 0),
    latest: articles[0],
    topTags: tagCounts(articles)
      .slice(0, 3)
      .map((t) => t.tag),
  };
}

export function tagCounts(articles: readonly ArticleLike[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of articles) {
    for (const t of a.data.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** Year and month of a date as seen in JST, because every date on the site is shown in JST. */
export function jstYearMonth(date: Date): { year: number; month: number } {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1 };
}

export interface ArchiveMonth<T> {
  year: number;
  month: number;
  articles: T[];
}

/** Months with at least one article, newest first, grouped by publish date. */
export function archiveMonths<T extends ArticleLike>(articles: readonly T[]): ArchiveMonth<T>[] {
  const months = new Map<string, ArchiveMonth<T>>();
  for (const a of byPublishedDesc(articles)) {
    const { year, month } = jstYearMonth(a.data.publishedAt);
    const key = `${year}-${month}`;
    const bucket = months.get(key) ?? { year, month, articles: [] };
    bucket.articles.push(a);
    months.set(key, bucket);
  }
  return [...months.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

export interface ChangelogEntry<T> {
  date: Date;
  type: "new" | "revision";
  revision: number;
  note: string | undefined;
  article: T;
}

/**
 * Site-wide update history, derived from frontmatter only:
 * r1 is the publish event, later revisions come from each article's changelog.
 */
export function changelogEntries<T extends ArticleLike>(articles: readonly T[]): ChangelogEntry<T>[] {
  const entries: ChangelogEntry<T>[] = [];
  for (const a of articles) {
    entries.push({ date: a.data.publishedAt, type: "new", revision: 1, note: undefined, article: a });
    for (const c of a.data.changelog ?? []) {
      if (c.revision > 1) {
        entries.push({ date: c.date, type: "revision", revision: c.revision, note: c.note, article: a });
      }
    }
  }
  return entries.sort((x, y) => y.date.getTime() - x.date.getTime());
}

/** Same category and shared tags raise the score. Unrelated articles are never padded in. */
export function relatedArticles<T extends ArticleLike>(article: T, all: readonly T[], limit = 3): T[] {
  const tags = new Set(article.data.tags);
  return all
    .filter((a) => a.id !== article.id)
    .map((a) => ({
      a,
      score: a.data.tags.filter((t) => tags.has(t)).length * 2 + (a.data.category === article.data.category ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || y.a.data.updatedAt.getTime() - x.a.data.updatedAt.getTime())
    .slice(0, limit)
    .map((x) => x.a);
}

/** Previous and next by publish date. */
export function prevNext<T extends ArticleLike>(article: T, all: readonly T[]): { prev?: T; next?: T } {
  const ordered = byPublishedDesc(all).reverse();
  const i = ordered.findIndex((a) => a.id === article.id);
  const result: { prev?: T; next?: T } = {};
  const prev = ordered[i - 1];
  const next = ordered[i + 1];
  if (i >= 0 && prev) result.prev = prev;
  if (i >= 0 && next) result.next = next;
  return result;
}

/** Published parts of the same series. Unwritten parts are deliberately not represented. */
export function seriesParts<T extends ArticleLike>(article: T, all: readonly T[]): T[] {
  const name = article.data.series?.name;
  if (!name) return [];
  return all
    .filter((a) => a.data.series?.name === name)
    .sort((a, b) => (a.data.series?.part ?? 0) - (b.data.series?.part ?? 0));
}

export function assertUniqueSlugs(articles: readonly ArticleLike[]): void {
  const seen = new Set<string>();
  for (const a of articles) {
    if (seen.has(a.data.slug)) throw new Error(`記事の slug が重複しています: ${a.data.slug}`);
    seen.add(a.data.slug);
  }
}

export function paginationWindow(current: number, last: number, span = 2): (number | "gap")[] {
  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= last; p++) {
    if (p === 1 || p === last || Math.abs(p - current) <= span) pages.push(p);
    else if (pages.at(-1) !== "gap") pages.push("gap");
  }
  return pages;
}

export const ARTICLE_PAGE_SIZE = 10;

/** Static sort orders of the article list. Each one is a set of pre-rendered pages. */
export const articleSorts = {
  updated: { base: "/articles/", path: "", label: "更新日", order: byUpdatedDesc },
  published: { base: "/articles/sort/published/", path: "sort/published", label: "投稿日", order: byPublishedDesc },
  revisions: { base: "/articles/sort/revisions/", path: "sort/revisions", label: "改訂数", order: byRevisionDesc },
} as const;

export type ArticleSort = keyof typeof articleSorts;

export const articleSortKeys = Object.keys(articleSorts) as ArticleSort[];
