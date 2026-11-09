---
title: "Linuxのページキャッシュを理解する"
description: "Linuxのページキャッシュを理解する についての記事。"
slug: linux-page-cache
createdAt: 2026-10-24T00:00:00+09:00
publishedAt: 2026-10-24T00:00:00+09:00
updatedAt: 2026-11-03T00:12:00+09:00
category: operating-systems
tags: [linux, page-cache, mmap, writeback]
revision: 2
kind: explainer
aiGenerated: false
changelog:
  - revision: 2
    date: 2026-11-03T00:12:00+09:00
    note: 説明を追記
---

## 概要

ページキャッシュはファイルの内容をメモリ上に保持する仕組みだ。dirty page は writeback によってディスクへ書き戻される。mmap で読み込んだページも同じキャッシュを共有する。
