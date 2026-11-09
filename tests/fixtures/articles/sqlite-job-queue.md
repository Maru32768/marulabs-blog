---
title: "SQLiteを使った永続ジョブキューの設計"
description: "SQLiteを使った永続ジョブキューの設計 についての記事。"
slug: sqlite-job-queue
createdAt: 2026-09-14T00:00:00+09:00
publishedAt: 2026-09-14T00:00:00+09:00
updatedAt: 2026-10-28T00:12:00+09:00
category: distributed-systems
tags: [sqlite, job-queue, at-least-once, wal]
revision: 4
kind: design
aiGenerated: false
changelog:
  - revision: 4
    date: 2026-10-28T00:12:00+09:00
    note: 説明を追記
---

## 概要

SQLiteで永続ジョブキューを設計する。配送保証は at-least-once とし、BEGIN IMMEDIATE で書き込みロックを先に取る。トランザクションの範囲を小さく保つことが重要だ。
