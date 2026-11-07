import type { ShikiTransformer, ThemeRegistrationRaw } from "shiki";

/** Light syntax theme using the token colors from the design (.kw .ty .cm .st .nu .pp .fn). */
export const classicTheme: ThemeRegistrationRaw = {
  name: "marulabs-classic",
  type: "light",
  colors: { "editor.background": "#fbfbfd", "editor.foreground": "#1a2233" },
  settings: [
    { settings: { foreground: "#1a2233", background: "#fbfbfd" } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#2e6b30", fontStyle: "italic" },
    },
    {
      scope: ["keyword", "storage", "storage.modifier", "keyword.control", "keyword.operator.new", "keyword.other"],
      settings: { foreground: "#1a1aa6", fontStyle: "bold" },
    },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type", "support.class", "storage.type.built-in"],
      settings: { foreground: "#00607a" },
    },
    {
      scope: ["string", "string.quoted", "punctuation.definition.string"],
      settings: { foreground: "#a31515" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#9a3e00" },
    },
    {
      scope: ["meta.preprocessor", "keyword.control.directive", "constant.other", "variable.other.constant"],
      settings: { foreground: "#6b3a8c" },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call.generic"],
      settings: { foreground: "#7a3a00" },
    },
  ],
};

/** Carries the fence's title="..." to the rehype step and drops Shiki's inline background. */
export const codeMetaTransformer: ShikiTransformer = {
  name: "marulabs:code-meta",
  pre(node) {
    const raw = this.options.meta?.__raw ?? "";
    const title = /title="([^"]*)"/.exec(raw)?.[1];
    if (title) node.properties.dataTitle = title;
    delete node.properties.style;
  },
};
