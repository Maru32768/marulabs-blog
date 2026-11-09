---
title: "TCP再送タイマーの挙動をパケットキャプチャで追う"
description: "TCP再送タイマーの挙動をパケットキャプチャで追う についての記事。"
slug: tcp-retransmission
createdAt: 2026-08-20T00:00:00+09:00
publishedAt: 2026-08-20T00:00:00+09:00
updatedAt: 2026-08-20T00:12:00+09:00
category: networking
tags: [tcp, tcpdump, retransmission]
revision: 1
kind: analysis
aiGenerated: false

---

## 概要

TCPの再送タイマーがRTTに応じて変化する様子をパケットキャプチャで確認する。輻輳制御との関係も整理する。
