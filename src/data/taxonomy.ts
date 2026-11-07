/** Fixed taxonomy from the design. Article counts are always derived from content. */
export const categoryGroups = [
  {
    id: "systems",
    title: "Systems",
    sub: "データ・カーネル・ネットワーク",
    categories: [
      {
        slug: "distributed-systems",
        name: "Distributed Systems",
        short: "Distributed",
        desc: "合意、レプリケーション、配送保証、分散トランザクション。",
      },
      {
        slug: "databases-storage",
        name: "Databases & Storage",
        short: "Databases",
        desc: "MVCC、WAL、インデックス、ストレージエンジンの内部構造。",
      },
      {
        slug: "operating-systems",
        name: "Operating Systems / Linux",
        short: "OS / Linux",
        desc: "メモリ管理、ファイルシステム、スケジューラ、システムコール。",
      },
      {
        slug: "networking",
        name: "Networking",
        short: "Networking",
        desc: "TCP/IP、HTTP、プロキシ、パケットキャプチャによる調査。",
      },
    ],
  },
  {
    id: "engineering",
    title: "Engineering",
    sub: "設計判断・信頼性・開発記録",
    categories: [
      {
        slug: "software-architecture",
        name: "Software Architecture",
        short: "Architecture",
        desc: "ドメインモデリング、境界設計、ツールチェーンの設計判断。",
      },
      {
        slug: "performance-reliability",
        name: "Performance & Reliability",
        short: "Reliability",
        desc: "SLO、障害対応、移行とロールバック、計測とプロファイリング。",
      },
      {
        slug: "development-logs",
        name: "Development Logs",
        short: "Development Logs",
        desc: "個人開発の進捗、試行錯誤、作業メモ。短く、頻繁に。",
      },
    ],
  },
] as const;

export type CategoryGroup = (typeof categoryGroups)[number];
export type Category = CategoryGroup["categories"][number];
export type CategorySlug = Category["slug"];

export const categories: readonly Category[] = categoryGroups.flatMap((g) => [...g.categories]);

export const categorySlugs = categories.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];

export function categoryBySlug(slug: CategorySlug): Category {
  const found = categories.find((c) => c.slug === slug);
  if (!found) throw new Error(`Unknown category: ${slug}`);
  return found;
}

export function groupOfCategory(slug: CategorySlug): CategoryGroup {
  const found = categoryGroups.find((g) => g.categories.some((c) => c.slug === slug));
  if (!found) throw new Error(`Unknown category: ${slug}`);
  return found;
}

/** Thread-style title prefix, e.g. [解析]. */
export const kinds = {
  analysis: { label: "解析", className: "pfx-a" },
  design: { label: "設計", className: "pfx-d" },
  explainer: { label: "解説", className: "pfx-e" },
  incident: { label: "障害調査", className: "pfx-i" },
  devlog: { label: "Devlog", className: "pfx-l" },
} as const;

export type Kind = keyof typeof kinds;

export const kindKeys = Object.keys(kinds) as [Kind, ...Kind[]];
