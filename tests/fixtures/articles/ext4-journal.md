---
title: "ext4のジャーナリングとfsyncのコスト"
description: "ext4のジャーナリングとfsyncのコスト についての記事。"
slug: ext4-journal
createdAt: 2026-07-15T00:00:00+09:00
publishedAt: 2026-07-15T00:00:00+09:00
updatedAt: 2026-07-15T00:12:00+09:00
category: operating-systems
tags: [linux, ext4, fsync, filesystem]
revision: 1
kind: explainer

---

## 概要

ext4のジャーナリングと fsync のコストを計測した。ファイルシステムのクラッシュ整合性についても扱う。
