import { describe, expect, it } from "vitest";
import type { ArticleData } from "../../src/lib/article-schema.ts";
import {
  archiveMonths,
  articleUrl,
  assertUniqueSlugs,
  byUpdatedDesc,
  categoryStats,
  changelogEntries,
  paginationWindow,
  prevNext,
  readingMinutes,
  relatedArticles,
  seriesParts,
  siteStats,
  tagCounts,
  tagUrl,
  type ArticleLike,
} from "../../src/lib/articles.ts";
import { formatDate, formatDateTime, formatShort } from "../../src/lib/format.ts";

function article(slug: string, overrides: Partial<ArticleData> = {}): ArticleLike {
  return {
    id: slug,
    data: {
      title: slug,
      description: slug,
      slug,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      category: "databases-storage",
      tags: ["a"],
      revision: 1,
      kind: "analysis",
      ...overrides,
    },
  };
}

describe("statistics come from content", () => {
  it("counts articles and revisions", () => {
    const stats = siteStats([article("a", { revision: 3 }), article("b")]);
    expect(stats).toEqual({ articles: 2, revisions: 4, categories: 7 });
  });

  it("reports zero for an empty site", () => {
    expect(siteStats([])).toEqual({ articles: 0, revisions: 0, categories: 7 });
    expect(categoryStats([], "networking")).toEqual({ articles: [], revisions: 0, latest: undefined, topTags: [] });
    expect(changelogEntries([])).toEqual([]);
    expect(archiveMonths([])).toEqual([]);
  });

  it("summarizes a category", () => {
    const newer = article("newer", { updatedAt: new Date("2026-03-01T00:00:00Z"), revision: 2, tags: ["x", "y"] });
    const older = article("older", { tags: ["x"] });
    const other = article("other", { category: "networking" });
    const stats = categoryStats([older, newer, other], "databases-storage");
    expect(stats.articles.map((a) => a.id)).toEqual(["newer", "older"]);
    expect(stats.revisions).toBe(3);
    expect(stats.latest?.id).toBe("newer");
    expect(stats.topTags).toEqual(["x", "y"]);
  });

  it("orders tags by count, then name", () => {
    const counts = tagCounts([article("a", { tags: ["b", "a"] }), article("c", { tags: ["b"] })]);
    expect(counts).toEqual([
      { tag: "b", count: 2 },
      { tag: "a", count: 1 },
    ]);
  });
});

describe("changelog", () => {
  it("merges publish events and revisions, newest first", () => {
    const a = article("a", {
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      revision: 2,
      changelog: [
        { revision: 1, date: new Date("2026-01-01T00:00:00Z"), note: "初版" },
        { revision: 2, date: new Date("2026-02-01T00:00:00Z"), note: "修正" },
      ],
    });
    const b = article("b", { publishedAt: new Date("2026-01-15T00:00:00Z") });
    const entries = changelogEntries([a, b]);
    expect(entries.map((e) => [e.article.id, e.type, e.revision])).toEqual([
      ["a", "revision", 2],
      ["b", "new", 1],
      ["a", "new", 1],
    ]);
  });
});

describe("archive", () => {
  it("groups by JST month, not UTC", () => {
    // 2026-01-31 20:00 UTC is already February in JST.
    const months = archiveMonths([article("a", { publishedAt: new Date("2026-01-31T20:00:00Z") })]);
    expect(months.map((m) => [m.year, m.month])).toEqual([[2026, 2]]);
  });
});

describe("navigation", () => {
  const first = article("first", { publishedAt: new Date("2026-01-01T00:00:00Z") });
  const second = article("second", { publishedAt: new Date("2026-02-01T00:00:00Z") });
  const third = article("third", { publishedAt: new Date("2026-03-01T00:00:00Z") });
  const all = [third, first, second];

  it("finds previous and next by publish date", () => {
    expect(prevNext(second, all)).toEqual({ prev: first, next: third });
    expect(prevNext(first, all)).toEqual({ next: second });
    expect(prevNext(third, all)).toEqual({ prev: second });
  });

  it("ranks related articles by shared tags and never pads with unrelated ones", () => {
    const base = article("base", { tags: ["a", "b"] });
    const twoTags = article("two-tags", { tags: ["a", "b"], category: "networking" });
    const oneTag = article("one-tag", { tags: ["a"], category: "networking" });
    const sameCategory = article("same-category", { tags: ["z"] });
    const unrelated = article("unrelated", { tags: ["z"], category: "networking" });
    const related = relatedArticles(base, [base, unrelated, sameCategory, oneTag, twoTags]);
    expect(related.map((a) => a.id)).toEqual(["two-tags", "one-tag", "same-category"]);
  });

  it("lists only published parts of a series", () => {
    const part2 = article("p2", { series: { name: "S", part: 2 } });
    const part1 = article("p1", { series: { name: "S", part: 1 } });
    expect(seriesParts(part1, [part2, part1, article("x")]).map((a) => a.id)).toEqual(["p1", "p2"]);
    expect(seriesParts(article("x"), [part1])).toEqual([]);
  });

  it("keeps gaps out of short page ranges and adds them to long ones", () => {
    expect(paginationWindow(1, 3)).toEqual([1, 2, 3]);
    expect(paginationWindow(5, 9)).toEqual([1, "gap", 3, 4, 5, 6, 7, "gap", 9]);
  });
});

describe("helpers", () => {
  it("rejects duplicate slugs", () => {
    expect(() => {
      assertUniqueSlugs([article("same"), article("same")]);
    }).toThrow(/same/);
  });

  it("estimates reading time from characters", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("あ".repeat(1200))).toBe(2);
    expect(readingMinutes(undefined)).toBe(1);
  });

  it("sorts by update time", () => {
    const a = article("a", { updatedAt: new Date("2026-01-01T00:00:00Z") });
    const b = article("b", { updatedAt: new Date("2026-02-01T00:00:00Z") });
    expect(byUpdatedDesc([a, b]).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("builds URLs", () => {
    expect(articleUrl(article("my-slug"))).toBe("/articles/my-slug/");
    expect(tagUrl("c++")).toBe("/tags/c%2B%2B/");
  });

  it("formats dates in JST", () => {
    const date = new Date("2026-11-05T14:14:00Z");
    expect(formatDate(date)).toBe("2026/11/05");
    expect(formatDateTime(date)).toBe("2026/11/05 23:14");
    expect(formatShort(date)).toBe("11/05");
    expect(formatDateTime(new Date("2026-11-05T15:00:00Z"))).toBe("2026/11/06 00:00");
  });
});
