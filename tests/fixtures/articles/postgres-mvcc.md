---
title: PostgreSQLのMVCCとVACUUMの内部構造
description: PostgreSQLのタプルヘッダをpageinspectで観察しながら、可視性判定とVACUUMの動作を追う。
slug: postgres-mvcc
createdAt: 2026-10-10T20:00:00+09:00
publishedAt: 2026-10-12T21:40:00+09:00
updatedAt: 2026-11-05T23:14:00+09:00
category: databases-storage
tags: [postgresql, mvcc, vacuum, internals, pageinspect]
revision: 3
kind: analysis
aiGenerated: false
target: PostgreSQL 17
verifiedOn: PostgreSQL 17 / Debian 13
series:
  name: PostgreSQL Internals
  part: 1
keyPoints:
  - PostgreSQLのUPDATEは行を書き換えず、新しいバージョンのタプルを追記する。
  - どのバージョンが見えるかは、タプルヘッダの xmin / xmax とスナップショットの比較で決まる。
  - 古いバージョンの回収と、XID周回に備えた凍結（freeze）が VACUUM の仕事。
changelog:
  - revision: 3
    date: 2026-11-05T23:14:00+09:00
    note: XID周回とfreezeの節を追加
  - revision: 2
    date: 2026-10-20T10:00:00+09:00
    note: HOT の説明を修正（インデックスが指す先の記述）
  - revision: 1
    date: 2026-10-12T21:40:00+09:00
    note: 初版
---

## はじめに

PostgreSQLのテーブルは、更新を繰り返すと実データ以上に膨らむことがある。原因の多くは、MVCCが残していく古い行バージョン（dead tuple）だ。それを回収するのが VACUUM である。

本稿では、ヒープページ上のタプルヘッダを `pageinspect` で直接のぞきながら、可視性判定の仕組みと VACUUM の動作を順に追っていく。

## タプルヘッダと xmin / xmax

ヒープ上の各タプルは、先頭に23バイトの固定長ヘッダ `HeapTupleHeaderData` を持つ。MVCCに関わるフィールドは次のとおり。

```c title="src/include/access/htup_details.h（抜粋）"
typedef struct HeapTupleFields
{
    TransactionId t_xmin;     /* inserting xact ID */
    TransactionId t_xmax;     /* deleting or locking xact ID */
    union
    {
        CommandId     t_cid;    /* inserting or deleting command ID, or both */
        TransactionId t_xvac;   /* old-style VACUUM FULL xact ID */
    }           t_field3;
} HeapTupleFields;

struct HeapTupleHeaderData
{
    union
    {
        HeapTupleFields t_heap;
        DatumTupleFields t_datum;
    }           t_choice;

    ItemPointerData t_ctid;    /* current TID of this or newer tuple */
    uint16      t_infomask2;   /* number of attributes + various flags */
    uint16      t_infomask;    /* various flag bits */
    uint8       t_hoff;        /* sizeof header incl. bitmap, padding */
    bits8       t_bits[FLEXIBLE_ARRAY_MEMBER];  /* bitmap of NULLs */
};
```

- `t_xmin` — このタプルを挿入したトランザクションのID。
- `t_xmax` — 削除、更新、または行ロックしたトランザクションのID。未設定なら 0。
- `t_ctid` — 自分自身、または更新後の新しいバージョンを指す TID（ブロック番号, 行ポインタ番号）。
- `t_infomask` — コミット済み・アボート済みを示すヒントビットや、ロックの種類などのフラグ。

## スナップショットと可視性判定

スナップショットは「ある時点で、どのトランザクションが完了していたか」を表す。中身はおおむね、`xmin`（これより古いXIDはすべて完了済み）、`xmax`（これ以降のXIDはまだ始まっていない）、その間で実行中だったXIDの一覧 `xip` の3つである。

READ COMMITTED では文ごとに、REPEATABLE READ ではトランザクション内の最初の文でスナップショットを取る。あるタプルが見えるのは、単純化すると次の2条件を両方満たすときだ。

1. `t_xmin` がコミット済みで、スナップショットから見て「過去」にある。
2. `t_xmax` が未設定・アボート済み、またはスナップショットから見て「未来」にある。

実際の判定は `HeapTupleSatisfiesMVCC()` にあり、サブトランザクションや、行ロックだけを表す xmax（`HEAP_XMAX_LOCK_ONLY`）も扱う。

> [!NOTE] SELECTでページがdirtyになる理由
> コミット状態の確認には `pg_xact`（旧 clog）を引く必要がある。そこで一度判定した結果を `t_infomask` のヒントビットに書き戻し、次回以降の参照を省く。読み取りだけのクエリでWALや書き込みI/Oが発生するのはこのためだ。

## UPDATE と HOT

実際にタプルを観察してみる。2行を持つ `accounts` テーブルの1行目を更新し、ページの中身を表示する。

```sql title="psql"
CREATE EXTENSION IF NOT EXISTS pageinspect;

BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;

SELECT lp, t_xmin, t_xmax, t_ctid
  FROM heap_page_items(get_raw_page('accounts', 0));
```

```output
 lp | t_xmin | t_xmax | t_ctid
----+--------+--------+--------
  1 |    751 |    753 | (0,3)
  2 |    752 |      0 | (0,2)
  3 |    753 |      0 | (0,3)
(3 rows)
```

`lp=1` が更新前、`lp=3` が更新後のバージョンだ。旧タプルの `t_xmax` には更新したトランザクション 753 が入り、`t_ctid` は新しいタプル `(0,3)` を指している。行は書き換えられたのではなく、追記されている。

更新した列がどのインデックスにも含まれず、新しいタプルが同じページに収まる場合、インデックスには新しいエントリを追加しない。これが **HOT（Heap-Only Tuple）更新**だ。インデックスは元の行ポインタを指したままで、ページ内の `t_ctid` チェーンをたどって新しいバージョンに到達する。`fillfactor` を下げてページに空きを残すのは、HOT が成立する確率を上げるためである。

## VACUUM がやっていること

> [!QUOTE] PostgreSQL Documentation — VACUUM
> VACUUM reclaims storage occupied by dead tuples.

どのスナップショットからも見えなくなったタプルを、ここでは dead tuple と呼ぶ。その境界は、実行中の全トランザクションのうち最も古いスナップショット（OldestXmin）で決まる。通常の VACUUM は次の順に処理する。

1. ヒープを走査して dead tuple の TID を集める。visibility map で all-visible とされたページは読み飛ばす。
2. 集めた TID を指すエントリを、各インデックスから削除する。
3. ヒープ側の行ポインタを未使用（`LP_UNUSED`）に戻し、空き容量を Free Space Map に記録する。
4. 全タプルが可視になったページを、visibility map に all-visible として記録する。

Table: 表1. VACUUM の種類と取得するロック

| 種類              | ロック                   | 領域の扱い                                     | 主な用途                         |
| ----------------- | ------------------------ | ---------------------------------------------- | -------------------------------- |
| `VACUUM`          | `SHARE UPDATE EXCLUSIVE` | ページ内で再利用。末尾の空ページのみ切り詰め   | 定常的な回収                     |
| `VACUUM FULL`     | `ACCESS EXCLUSIVE`       | テーブルを書き直し、OSへ返却                   | 肥大化の解消（読み書きが止まる） |
| `VACUUM (FREEZE)` | `SHARE UPDATE EXCLUSIVE` | 通常の VACUUM と同じ                           | 積極的な凍結                     |
| `autovacuum`      | `SHARE UPDATE EXCLUSIVE` | 通常の VACUUM と同じ                           | 閾値に基づく自動実行             |

> [!WARNING] VACUUM しても縮まないとき
> 長時間実行中のトランザクション、放置されたレプリケーションスロット、`hot_standby_feedback` を有効にしたスタンバイ上の長いクエリは、OldestXmin を古いまま留める。dead tuple が回収されないときは、まず `pg_stat_activity` の `backend_xmin` を確認する。

## XID の周回と freeze

トランザクションIDは32ビットで、比較には「自分から2<sup>31</sup>前までを過去、それ以降を未来」とみなす循環的な演算を使う。古いタプルの xmin を放置すると、約20億トランザクション後に「未来」側へ回り込み、そのタプルは突然見えなくなる。

そこで VACUUM は十分に古いタプルを凍結（freeze）し、どのスナップショットからも常に過去として扱われる印をつける。9.4以降は xmin を書き換えず、`t_infomask` の `HEAP_XMIN_FROZEN` ビットで表す。

```sql title="データベースごとの XID 年齢"
SELECT datname, age(datfrozenxid) AS xid_age
  FROM pg_database
 ORDER BY xid_age DESC;
```

この値が `autovacuum_freeze_max_age`（既定 2億）を超えると、autovacuum は無効化されていても周回防止のための VACUUM を強制的に開始する。

## まとめ

- MVCCは「書き換えずに追記する」ことで、読み取りと書き込みを互いにブロックさせない。その代償が dead tuple だ。
- 可視性は、タプルの xmin / xmax とスナップショットの比較だけで決まる。
- VACUUM は回収と凍結の両方を担う。どちらも、古いスナップショットが1つ残るだけで止まる。

次回は、インデックス側に溜まる重複バージョンを扱う bottom-up index deletion（PostgreSQL 14〜）を読む。
