import { z } from "astro/zod";
import { categorySlugs, kindKeys } from "../data/taxonomy.ts";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lower-kebab-case で指定してください");
const tag = z.string().regex(/^[a-z0-9][a-z0-9.+#-]*$/, "タグは小文字英数字と . + # - のみです");

/**
 * Published article frontmatter.
 *
 * The object is strict on purpose: private-only keys such as `draft`, `status`,
 * `sources` or `visibility` fail the build instead of being silently dropped.
 * Everything in this collection is public, there is no "unpublished" state here.
 */
export const articleSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(300),
    slug,
    createdAt: z.coerce.date(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    category: z.enum(categorySlugs),
    tags: z.array(tag).min(1).max(12),
    revision: z.number().int().min(1),
    kind: z.enum(kindKeys),
    /** 対象: e.g. "PostgreSQL 17" */
    target: z.string().trim().min(1).optional(),
    /** 検証環境: e.g. "PostgreSQL 17 / Debian 13" */
    verifiedOn: z.string().trim().min(1).optional(),
    /** この記事の要点 */
    keyPoints: z.array(z.string().trim().min(1)).min(1).max(8).optional(),
    series: z.strictObject({ name: z.string().trim().min(1), part: z.number().int().min(1) }).optional(),
    /** Human-readable revision notes. Git remains the source of truth for the diff. */
    changelog: z
      .array(
        z.strictObject({
          revision: z.number().int().min(1),
          date: z.coerce.date(),
          note: z.string().trim().min(1),
        }),
      )
      .min(1)
      .optional(),
  })
  .superRefine((a, ctx) => {
    const issue = (path: string, message: string): void => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };

    if (a.publishedAt < a.createdAt) issue("publishedAt", "publishedAt は createdAt 以降にしてください");
    if (a.updatedAt < a.publishedAt) issue("updatedAt", "updatedAt は publishedAt 以降にしてください");
    if (a.publishedAt.getTime() > Date.now()) {
      issue("publishedAt", "未来の publishedAt は使えません（予約公開はありません）");
    }

    if (a.changelog) {
      const newest = Math.max(...a.changelog.map((c) => c.revision));
      if (newest !== a.revision) issue("changelog", `changelog の最大 revision (${newest}) が revision と一致しません`);
      const seen = new Set(a.changelog.map((c) => c.revision));
      if (seen.size !== a.changelog.length) issue("changelog", "changelog の revision が重複しています");
    } else if (a.revision > 1) {
      issue("changelog", "revision 2 以降は changelog に改訂理由を記録してください");
    }
  });

export type ArticleData = z.infer<typeof articleSchema>;
