---
title: "Bunとdd-trace-jsの通信問題を調査する"
description: "Bunとdd-trace-jsの通信問題を調査する についての記事。"
slug: bun-dd-trace
createdAt: 2026-10-17T00:00:00+09:00
publishedAt: 2026-10-17T00:00:00+09:00
updatedAt: 2026-10-19T00:12:00+09:00
category: networking
tags: [bun, dd-trace-js, http, tcpdump]
revision: 2
kind: incident
changelog:
  - revision: 2
    date: 2026-10-19T00:12:00+09:00
    note: 説明を追記
---

## 概要

Bun上で dd-trace-js のトレース送信が失敗する問題を tcpdump で調査した。HTTP のチャンク転送の扱いの違いが原因だった。パケットキャプチャで再現手順を確認した。
