---
title: "データマイグレーションとロールバックの設計"
description: "データマイグレーションとロールバックの設計 についての記事。"
slug: data-migration-rollback
createdAt: 2026-10-10T00:00:00+09:00
publishedAt: 2026-10-10T00:00:00+09:00
updatedAt: 2026-10-10T00:12:00+09:00
category: performance-reliability
tags: [migration, rollback, expand-contract]
revision: 1
kind: design

---

## 概要

expand-contract パターンでデータマイグレーションを段階的に進める。ロールバック可能な範囲を明確にしておくと、障害時の判断が速くなる。
