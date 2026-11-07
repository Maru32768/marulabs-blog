/** Article-page enhancements: copy buttons, print link and the current section in the TOC. */

function enableCopyButtons(): void {
  // The clipboard API exists only on secure contexts.
  if (!window.isSecureContext) return;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.hidden = false;
    button.addEventListener("click", () => {
      const code = button.closest("figure")?.querySelector("code")?.textContent ?? "";
      void navigator.clipboard.writeText(code).then(
        () => {
          button.textContent = "コピー済";
          setTimeout(() => {
            button.textContent = "コピー";
          }, 1500);
        },
        () => {
          button.textContent = "失敗";
        },
      );
    });
  }
}

function enablePrintLink(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-print]")) {
    button.hidden = false;
    button.addEventListener("click", () => {
      window.print();
    });
  }
}

function trackCurrentSection(): void {
  const links = new Map(
    [...document.querySelectorAll<HTMLAnchorElement>("[data-toc] a")].map((a) => [
      decodeURIComponent(a.hash.slice(1)),
      a,
    ]),
  );
  const headings = [...links.keys()].map((id) => document.getElementById(id)).filter((heading) => heading !== null);
  if (headings.length === 0) return;

  const visible = new Set<Element>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      const current = headings.find((heading) => visible.has(heading));
      if (!current) return;
      for (const [id, link] of links) {
        if (id === current.id) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    },
    { rootMargin: "0px 0px -70% 0px" },
  );
  for (const heading of headings) observer.observe(heading);
}

enableCopyButtons();
enablePrintLink();
trackCurrentSection();
