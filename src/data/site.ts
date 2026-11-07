export const site = {
  /** The only place the site name is written. The header highlights its last word. */
  title: "Maru's Blog",
  /** Not shown on pages. Feeds and search engines require a description. */
  description: "Maruの個人技術ブログ",
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
