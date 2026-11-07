import { describe, expect, it } from "vitest";
import { articleSchema } from "../../src/lib/article-schema.ts";

const valid = {
  title: "記事",
  description: "説明",
  slug: "valid-slug",
  createdAt: "2026-01-01T00:00:00+09:00",
  publishedAt: "2026-01-02T00:00:00+09:00",
  updatedAt: "2026-01-03T00:00:00+09:00",
  category: "databases-storage",
  tags: ["postgresql"],
  revision: 1,
  kind: "analysis",
};

describe("articleSchema", () => {
  it("accepts a valid article", () => {
    expect(articleSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["draft", true],
    ["status", "draft"],
    ["visibility", "private"],
    ["sources", ["knowledge/x.md"]],
    ["reviewedBy", "me"],
  ])("rejects the private-only key %s", (key, value) => {
    expect(articleSchema.safeParse({ ...valid, [key]: value }).success).toBe(false);
  });

  it.each([
    "title",
    "description",
    "slug",
    "createdAt",
    "publishedAt",
    "updatedAt",
    "category",
    "tags",
    "revision",
    "kind",
  ])("requires %s", (key) => {
    const { [key as keyof typeof valid]: _removed, ...rest } = valid;
    expect(articleSchema.safeParse(rest).success).toBe(false);
  });

  it.each([
    ["uppercase slug", { slug: "Bad-Slug" }],
    ["slug with a path", { slug: "../escape" }],
    ["unknown category", { category: "nope" }],
    ["unknown kind", { kind: "nope" }],
    ["invalid date", { publishedAt: "not a date" }],
    ["revision zero", { revision: 0 }],
    ["uppercase tag", { tags: ["PostgreSQL"] }],
    ["no tags", { tags: [] }],
  ])("rejects %s", (_name, patch) => {
    expect(articleSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("rejects dates in the wrong order", () => {
    expect(articleSchema.safeParse({ ...valid, publishedAt: "2025-01-01T00:00:00+09:00" }).success).toBe(false);
    expect(articleSchema.safeParse({ ...valid, updatedAt: "2026-01-01T12:00:00+09:00" }).success).toBe(false);
  });

  it("rejects a future publish date, because there is no scheduled publishing", () => {
    const future = "2999-01-01T00:00:00+09:00";
    expect(articleSchema.safeParse({ ...valid, publishedAt: future, updatedAt: future }).success).toBe(false);
  });

  it("requires a changelog from revision 2 on, matching the revision", () => {
    expect(articleSchema.safeParse({ ...valid, revision: 2 }).success).toBe(false);
    const changelog = [{ revision: 2, date: "2026-01-03T00:00:00+09:00", note: "修正" }];
    expect(articleSchema.safeParse({ ...valid, revision: 2, changelog }).success).toBe(true);
    expect(articleSchema.safeParse({ ...valid, revision: 3, changelog }).success).toBe(false);
  });
});
