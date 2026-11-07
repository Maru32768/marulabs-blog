import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { toString } from "hast-util-to-string";

const LANGUAGE_LABELS: Record<string, string> = {
  bash: "Shell",
  c: "C",
  console: "Shell",
  cpp: "C++",
  css: "CSS",
  go: "Go",
  hcl: "HCL",
  html: "HTML",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  jsonc: "JSON",
  md: "Markdown",
  python: "Python",
  rust: "Rust",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  terraform: "HCL",
  toml: "TOML",
  ts: "TypeScript",
  typescript: "TypeScript",
  yaml: "YAML",
};

/** Fenced languages rendered without line numbers. `output` also uses the dark terminal style. */
const PLAIN_LANGUAGES = new Set(["output", "plaintext", "text", "txt"]);

const h = (tagName: string, properties: Element["properties"], children: ElementContent[] = []): Element => ({
  type: "element",
  tagName,
  properties,
  children,
});

const text = (value: string): Text => ({ type: "text", value });

const isElement = (node: RootContent | ElementContent | undefined, tagName?: string): node is Element =>
  node?.type === "element" && (tagName === undefined || node.tagName === tagName);

function codeFigure(pre: Element): Element {
  const language = String(pre.properties.dataLanguage ?? "plaintext");
  const title = pre.properties.dataTitle === undefined ? undefined : String(pre.properties.dataTitle);
  delete pre.properties.dataTitle;

  if (language === "output") {
    return h("figure", { className: ["code", "code--output"] }, [
      h("figcaption", {}, [h("b", {}, [text(title ? `Output: ${title}` : "Output:")])]),
      pre,
    ]);
  }

  const plain = PLAIN_LANGUAGES.has(language);
  const label = plain ? "Text" : (LANGUAGE_LABELS[language] ?? language);
  const caption: ElementContent[] = [h("b", {}, [text(`Code: ${label}`)])];
  if (title) caption.push(text(` — ${title}`));

  return h("figure", { className: plain ? ["code", "code--plain"] : ["code"] }, [
    h("figcaption", {}, [
      h("span", {}, caption),
      h("button", { type: "button", className: ["btn", "btn--sm"], dataCopy: "", hidden: true }, [text("コピー")]),
    ]),
    pre,
  ]);
}

const ALERT = /^\[!(NOTE|WARNING|QUOTE)\][ \t]*/;

function blockquote(node: Element): Element {
  const firstParagraphIndex = node.children.findIndex((c) => isElement(c, "p"));
  const paragraph = node.children[firstParagraphIndex];
  const first = isElement(paragraph) ? paragraph.children[0] : undefined;
  const match = first?.type === "text" ? ALERT.exec(first.value) : null;

  if (!match || !isElement(paragraph) || first?.type !== "text") {
    return h("div", { className: ["quote"] }, [node]);
  }

  const type = match[1];
  const afterMarker = first.value.slice(match[0].length);
  const newline = afterMarker.indexOf("\n");
  const title = (newline === -1 ? afterMarker : afterMarker.slice(0, newline)).trim();
  const rest = newline === -1 ? "" : afterMarker.slice(newline + 1);

  // Keep whatever follows the title line as the paragraph body.
  if (rest) first.value = rest;
  else paragraph.children.shift();
  const body = node.children.filter(
    (c, i) =>
      !(i === firstParagraphIndex && paragraph.children.length === 0) && !(c.type === "text" && !c.value.trim()),
  );

  if (type === "QUOTE") {
    const source = title
      ? [h("div", { className: ["quote-source"] }, [text("Originally from "), h("b", {}, [text(title)])])]
      : [];
    node.children = [...source, ...body];
    return h("div", { className: ["quote"] }, [node]);
  }

  const heading = type === "NOTE" ? "メモ" : "注意";
  const variant = type === "NOTE" ? "callout--note" : "callout--warning";
  return h("div", { className: ["callout", variant] }, [
    h("div", { className: ["callout-body"] }, [
      h("p", { className: ["callout-title"] }, [text(title ? `${heading}: ${title}` : heading)]),
      ...body,
    ]),
  ]);
}

const TABLE_CAPTION = /^Table:\s*/;

/** `Table: ...` on the paragraph right before a table becomes its caption. */
function tableBlock(table: Element, captionParagraph: Element | undefined): Element {
  if (captionParagraph) {
    const caption = toString(captionParagraph).replace(TABLE_CAPTION, "");
    table.children.unshift(h("caption", {}, [text(caption)]));
  }
  return h("div", { className: ["table-scroll"], tabIndex: 0 }, [table]);
}

function isCaptionParagraph(node: RootContent | ElementContent | undefined): node is Element {
  return isElement(node, "p") && TABLE_CAPTION.test(toString(node));
}

function transformChildren(parent: Root | Element): void {
  const output: (RootContent | ElementContent)[] = [];

  for (const child of parent.children) {
    if (!isElement(child)) {
      output.push(child);
      continue;
    }

    if (child.tagName === "pre" && child.properties.dataLanguage !== undefined) {
      output.push(codeFigure(child));
      continue;
    }

    if (child.tagName === "table") {
      let captionParagraph: Element | undefined;
      const previousIndex = output.findLastIndex((n) => !(n.type === "text" && !n.value.trim()));
      const previous = output[previousIndex];
      if (isCaptionParagraph(previous)) {
        captionParagraph = previous;
        output.splice(previousIndex);
      }
      output.push(tableBlock(child, captionParagraph));
      continue;
    }

    transformChildren(child);

    if (child.tagName === "blockquote") {
      output.push(blockquote(child));
      continue;
    }

    if (/^h[2-4]$/.test(child.tagName) && typeof child.properties.id === "string") {
      // No text node: heading text stays clean for the TOC and the search index.
      child.children.push(
        h("a", { className: ["anchor"], href: `#${child.properties.id}`, ariaLabel: "この見出しへのリンク" }),
      );
    }

    if (child.tagName === "img") {
      child.properties.loading = "lazy";
      child.properties.decoding = "async";
    }

    output.push(child);
  }

  parent.children = output;
}

/**
 * Turns plain Markdown output into the forum-style blocks from the design:
 * captioned code figures, Quote boxes, メモ/注意 callouts, scrollable tables and
 * heading anchors. Runs after Shiki and after heading ids are assigned.
 */
export function rehypeArticle() {
  return (tree: Root): void => {
    transformChildren(tree);
  };
}
