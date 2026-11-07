export const site = {
  title: "Maru's System Lab",
  tagline: "Distributed Systems · Databases · Kernels · Networks",
  taglineShort: "Systems · DB · Kernels · Net",
  description: "ソフトウェアエンジニアの調査記録と設計ノート",
  welcome: "ようこそ。分散システム・データベース・OS・ネットワークについての調査記録と設計ノートを置いています。",
  url: "https://blog.marulabs.dev",
  author: "Maru",
  /** Displayed as 開設. The first year on the copyright line is derived from it. */
  launched: { year: 2026, month: 11 },
  github: "https://github.com/Maru32768",
  repo: "https://github.com/Maru32768/marulabs-blog",
  license: "本文 CC BY 4.0 / コード MIT",
} as const;

export const nav = [
  { key: "home", label: "ホーム", href: "/" },
  { key: "articles", label: "記事一覧", href: "/articles/" },
  { key: "categories", label: "カテゴリ", href: "/categories/" },
  { key: "tags", label: "タグ", href: "/tags/" },
  { key: "archive", label: "アーカイブ", href: "/archive/" },
  { key: "devlog", label: "開発ログ", href: "/categories/development-logs/" },
  { key: "changelog", label: "更新履歴", href: "/changelog/" },
] as const;

export type NavKey = (typeof nav)[number]["key"] | "about" | "search" | "none";
