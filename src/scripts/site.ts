/**
 * Progressive enhancement shared by all pages. The site is fully readable without it.
 * Nothing here delays rendering: this is a deferred module and every step is optional.
 */

const COUNTER_ENDPOINT = "/api/counter";
const COUNTER_DIGITS = 7;
const COUNTER_TIMEOUT_MS = 3000;
const REPEAT_VIEW_WINDOW_MS = 30 * 60 * 1000;
const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Reloads and back-and-forth navigation in the same tab count once per 30 minutes.
 * sessionStorage is per tab and is gone when the tab closes: no identifier, no cookie.
 */
function shouldCountView(path: string): boolean {
  if (navigator.webdriver) return false;
  try {
    const key = `pv:${path}`;
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < REPEAT_VIEW_WINDOW_MS) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    // Storage blocked: reading is always safe, counting is not.
    return false;
  }
}

async function updateCounter(): Promise<void> {
  const element = document.querySelector<HTMLElement>("[data-counter]");
  const skip = document.body.hasAttribute("data-no-count");
  const count = !skip && shouldCountView(location.pathname);
  if (!count && !element) return;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, COUNTER_TIMEOUT_MS);
  try {
    const response = await fetch(COUNTER_ENDPOINT, {
      method: count ? "POST" : "GET",
      signal: controller.signal,
      keepalive: count,
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    const { value } = (await response.json()) as { value?: unknown };
    if (element && typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
      element.textContent = String(value).padStart(COUNTER_DIGITS, "0");
      element.dataset.state = "ok";
    }
  } catch {
    if (element) {
      element.dataset.state = "error";
      element.title = "カウンターを取得できませんでした";
    }
  } finally {
    clearTimeout(timer);
  }
}

function updateClock(): void {
  const element = document.querySelector("[data-clock]");
  const box = document.querySelector<HTMLElement>("[data-clock-box]");
  if (!element || !box) return;
  element.textContent = new Date().toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
  box.hidden = false;
}

/** Rows updated recently get the "new" icon. This depends on the date only, not on the reader. */
function markRecentlyUpdated(): void {
  const now = Date.now();
  for (const element of document.querySelectorAll<HTMLElement>("[data-updated]")) {
    if (now - new Date(element.dataset.updated ?? 0).getTime() < NEW_WINDOW_MS) {
      element.classList.add("is-new");
    }
  }
}

/** Forum-style "jump" selects. Without script the form submits to a plain index page. */
function enableJumpForms(): void {
  for (const form of document.querySelectorAll<HTMLFormElement>("form[data-jump]")) {
    form.addEventListener("submit", (event) => {
      const select = form.querySelector("select");
      if (select?.value) {
        event.preventDefault();
        location.assign(select.value);
      }
    });
  }
}

updateClock();
markRecentlyUpdated();
enableJumpForms();
void updateCounter();
