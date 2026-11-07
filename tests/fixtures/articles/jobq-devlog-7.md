---
title: "jobq devlog #7: leaseの延長とハートビート"
description: "jobq devlog #7: leaseの延長とハートビート についての記事。"
slug: jobq-devlog-7
createdAt: 2026-11-06T00:00:00+09:00
publishedAt: 2026-11-06T00:00:00+09:00
updatedAt: 2026-11-06T00:12:00+09:00
category: development-logs
tags: [jobq, sqlite, devlog]
revision: 1
kind: devlog

---

## 概要

leaseの延長とハートビートを実装した。WALモードでは書き込み競合が起きると SQLITE_BUSY が返るので、リトライ間隔を計測している。
