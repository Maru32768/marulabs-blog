---
title: とても長いタイトルの記事でレイアウトが崩れないことを確認するためのフィクスチャ記事 — A long mixed title with ThisIsAnExtremelyLongUnbrokenIdentifierThatMustWrapInsideItsContainerWithoutOverflowing
description: Markdown要素の表示と、横スクロールが必要なコードブロックやテーブルを確認するための記事。
slug: markdown-elements-with-a-very-long-title
createdAt: 2026-09-01T09:00:00+09:00
publishedAt: 2026-09-01T09:00:00+09:00
updatedAt: 2026-09-02T09:00:00+09:00
category: software-architecture
tags: [fixture, markdown, layout]
revision: 2
kind: explainer
aiGenerated: true
changelog:
  - revision: 2
    date: 2026-09-02T09:00:00+09:00
    note: テーブルの例を追加
  - revision: 1
    date: 2026-09-01T09:00:00+09:00
    note: 初版
---

## 段落と強調

日本語と English と `inline_code()` が混在する段落です。**太字**、_斜体_、~~取り消し線~~、[リンク](https://example.com/)、そして長い識別子 `ThisIsAnExtremelyLongInlineCodeIdentifierThatMustWrapInsteadOfOverflowingTheColumnOnNarrowScreens` を含みます。

### 見出しレベル3

#### 見出しレベル4

本文に続く段落です。

## リスト

- 箇条書き1
  - ネストした項目
    - さらにネストした項目
- 箇条書き2

1. 番号付き1
2. 番号付き2
   1. ネストした番号付き

- [x] 完了したタスク
- [ ] 未完了のタスク

## コードブロック

```typescript title="very-long-line.ts"
export function veryLongFunctionNameForHorizontalScrolling(firstArgument: string, secondArgument: number, thirdArgument: Record<string, unknown>, fourthArgument: ReadonlyArray<string>): Promise<void> { return Promise.resolve(); }
```

```text
プレーンテキストのブロック。行番号は付きません。
```

```unknownlang
言語が未対応でも plain text として表示される
```

## 表

| 列1        | 列2                                 | 列3                                 | 列4                                 | 列5                                 | 列6                                 |
| ---------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| 横に長い表 | `this_is_a_long_column_value_00001` | `this_is_a_long_column_value_00002` | `this_is_a_long_column_value_00003` | `this_is_a_long_column_value_00004` | `this_is_a_long_column_value_00005` |
| 2行目      | スクロールできる                    | スクロールできる                    | スクロールできる                    | スクロールできる                    | スクロールできる                    |

## 引用と注記

> 普通の引用です。
>
> 2段落目です。

> [!NOTE]
> タイトルなしのメモです。

---

水平線の後の段落です。[^1]

[^1]: 脚注の本文です。
