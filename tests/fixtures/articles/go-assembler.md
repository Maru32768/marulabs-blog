---
title: "Goが独自のアセンブラを採用している理由"
description: "Goが独自のアセンブラを採用している理由 についての記事。"
slug: go-assembler
createdAt: 2026-09-30T00:00:00+09:00
publishedAt: 2026-09-30T00:00:00+09:00
updatedAt: 2026-09-30T00:12:00+09:00
category: software-architecture
tags: [go, plan9, assembler, toolchain]
revision: 1
kind: analysis
aiGenerated: false

---

## 概要

Goのツールチェーンは Plan 9 由来のアセンブラを使っている。アーキテクチャ間で文法を揃えることと、コンパイラとの統合が理由だ。
