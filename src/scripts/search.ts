/**
 * Search page logic on Pagefind's JS API. The index is built from the published
 * site at build time; no search server is involved. The Pagefind runtime is loaded
 * only on this page, on first use.
 */

interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string; updated?: string; kind?: string };
  filters: { category?: string[]; tag?: string[] };
}

interface PagefindSearchResponse {
  results: { id: string; data: () => Promise<PagefindResultData> }[];
  filters: Record<string, Record<string, number>>;
  totalFilters: Record<string, Record<string, number>>;
  unfilteredResultCount: number;
}

interface Pagefind {
  init: () => Promise<void>;
  filters: () => Promise<Record<string, Record<string, number>>>;
  search: (
    query: string | null,
    options?: { filters?: Record<string, string>; sort?: Record<string, "asc" | "desc"> },
  ) => Promise<PagefindSearchResponse>;
}

const RESULTS_PER_PAGE = 20;

const form = document.querySelector<HTMLFormElement>("#search-form");
const queryInput = document.querySelector<HTMLInputElement>("#q");
const categorySelect = document.querySelector<HTMLSelectElement>("#category");
const tagSelect = document.querySelector<HTMLSelectElement>("#tag");
const sortSelect = document.querySelector<HTMLSelectElement>("#sort");
const statusBox = document.querySelector<HTMLElement>("#search-status");
const results = document.querySelector<HTMLElement>("#search-results");
const more = document.querySelector<HTMLButtonElement>("#search-more");

let pagefindPromise: Promise<Pagefind | null> | undefined;

function loadPagefind(): Promise<Pagefind | null> {
  pagefindPromise ??= (async () => {
    try {
      // Generated after the Astro build, so it must stay opaque to the bundler.
      const path = "/pagefind/pagefind.js";
      const pagefind = (await import(/* @vite-ignore */ path)) as Pagefind;
      await pagefind.init();
      return pagefind;
    } catch {
      return null;
    }
  })();
  return pagefindPromise;
}

/** Excerpts contain only <mark> tags as markup. Everything else is rendered as text. */
function appendExcerpt(parent: HTMLElement, excerpt: string): void {
  for (const [index, part] of excerpt.split(/<\/?mark>/).entries()) {
    const decoded = part
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&amp;", "&");
    if (index % 2 === 1) {
      const mark = document.createElement("mark");
      mark.textContent = decoded;
      parent.append(mark);
    } else {
      parent.append(decoded);
    }
  }
}

function renderResult(data: PagefindResultData): HTMLElement {
  const row = document.createElement("article");
  row.className = "result";

  const title = document.createElement("h3");
  title.className = "result-title";
  const link = document.createElement("a");
  link.href = data.url;
  link.textContent = data.meta.title ?? data.url;
  title.append(link);

  const excerpt = document.createElement("p");
  excerpt.className = "result-excerpt";
  appendExcerpt(excerpt, data.excerpt);

  const meta = document.createElement("p");
  meta.className = "result-meta";
  meta.textContent = [data.filters.category?.[0], data.meta.updated ? `更新 ${data.meta.updated}` : undefined]
    .filter(Boolean)
    .join(" · ");

  row.append(title, excerpt, meta);
  return row;
}

function fillOptions(select: HTMLSelectElement, counts: Record<string, number>, selected: string): void {
  const first = select.options[0];
  select.replaceChildren(...(first ? [first] : []));
  const names = Object.keys(counts).sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0) || a.localeCompare(b));
  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${name} (${String(counts[name] ?? 0)})`;
    select.append(option);
  }
  select.value = names.includes(selected) ? selected : "";
}

function readState(): { q: string; category: string; tag: string; sort: string } {
  const params = new URLSearchParams(location.search);
  return {
    q: params.get("q")?.trim() ?? "",
    category: params.get("category") ?? "",
    tag: params.get("tag") ?? "",
    sort: params.get("sort") ?? "",
  };
}

async function run(): Promise<void> {
  if (!form || !queryInput || !statusBox || !results || !more || !categorySelect || !tagSelect || !sortSelect) return;
  const state = readState();
  queryInput.value = state.q;
  sortSelect.value = state.sort === "updated" ? "updated" : "";

  if (results.dataset.hasArticles === "false") {
    statusBox.textContent = "まだ公開記事はありません。";
    return;
  }

  const pagefind = await loadPagefind();
  if (!pagefind) {
    statusBox.textContent = "検索インデックスを読み込めませんでした。";
    return;
  }

  const available = await pagefind.filters();
  fillOptions(categorySelect, available.category ?? {}, state.category);
  fillOptions(tagSelect, available.tag ?? {}, state.tag);

  const hasFilter = Boolean(state.category || state.tag);
  if (!state.q && !hasFilter) {
    statusBox.textContent = "キーワードを入力してください。";
    return;
  }

  statusBox.textContent = "検索中…";
  const filters: Record<string, string> = {};
  if (state.category) filters.category = state.category;
  if (state.tag) filters.tag = state.tag;
  const response = await pagefind.search(state.q || null, {
    filters,
    ...(state.sort === "updated" ? { sort: { updated: "desc" as const } } : {}),
  });

  let shown = 0;
  const showNext = async (): Promise<void> => {
    const batch = response.results.slice(shown, shown + RESULTS_PER_PAGE);
    const rows = await Promise.all(batch.map((result) => result.data()));
    results.append(...rows.map(renderResult));
    shown += batch.length;
    more.hidden = shown >= response.results.length;
  };
  more.addEventListener("click", () => void showNext());
  await showNext();

  const label = [state.q && `「${state.q}」`, state.category, state.tag && `タグ ${state.tag}`]
    .filter(Boolean)
    .join(" / ");
  statusBox.textContent =
    response.results.length === 0
      ? `${label} に一致する記事はありませんでした。`
      : `${label} の検索結果: ${String(response.results.length)} 件`;
}

void run();

export {};
