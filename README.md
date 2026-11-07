# Maru's System Lab

ソフトウェアエンジニアの調査記録と設計ノート。2000年代前半の技術フォーラム風の個人技術ブログです。

https://blog.marulabs.dev

- Astro（静的生成）+ TypeScript
- Pagefind（全文検索。検索サーバー不要）
- Cloudflare Workers Static Assets + D1（アクセスカウンター）
- Terraform + GitHub Actions

設計判断の理由は [docs/DECISIONS.md](docs/DECISIONS.md)、検索の検証結果は [docs/SEARCH_QUALITY.md](docs/SEARCH_QUALITY.md) にあります。

## 公開・非公開のセキュリティ境界

```
marulabs-knowledge (Private)                marulabs-blog (Public, このリポジトリ)
┌─────────────────────────┐                ┌───────────────────────────┐
│ Private Knowledge       │                │ Published                 │
│        │                │  人のレビュー  │ src/content/articles/     │
│        ▼                │  明示的な昇格  │        │ mainへのマージ   │
│ Draft ─────────────────────────────────▶ │        ▼                  │
└─────────────────────────┘    公開用PR    │ GitHub Actions → Cloudflare │
                                           └───────────────────────────┘
```

| 状態              | 場所               | Web に出るか | 検索・RSS・サイトマップ |
| ----------------- | ------------------ | ------------ | ----------------------- |
| Private Knowledge | Private リポジトリ | 出ない       | 対象外                  |
| Draft             | Private リポジトリ | 出ない       | 対象外                  |
| Published         | このリポジトリ     | 出る         | 対象                    |

**このリポジトリにコミットした時点で、その情報は公開されたものとして扱ってください。** ビルド対象から外しても、GitHub 上の Git 履歴からは読めます。

境界の守り方:

- Private リポジトリはサブモジュールにもせず、CI に読み取り権限もありません。公開記事はこのリポジトリだけでビルドできます。
- Frontmatter に `draft` や `status` があるとビルドが失敗します。「未公開」の状態はこのリポジトリに存在しません。
- `npm run verify:source` は、禁止パス、非公開マーカー、秘密情報らしき文字列を検査します。CI では Git の全履歴も対象です。
- `npm run verify:dist` は、記事ページ、RSS、Atom、サイトマップ、Pagefind 索引のそれぞれが公開記事の slug と**完全に一致する**ことを確認します。
- デプロイ（プレビューを含む）に使うのは、この検査を通過した `dist` そのものです。

## ローカル開発

ツールは [mise](https://mise.jdx.dev/) で管理しています。`.mise.toml` に「どこまで自動で上げてよいか」、`mise.lock` に正確なバージョンとチェックサムを書いています。

```bash
mise trust && mise trust .mise.ops.toml
```

```bash
mise install
```

```bash
npm ci
```

```bash
npm run dev
```

開発サーバーで動くのは静的ページだけです。カウンター API も含めて本番と同じ構成で確認するには、ビルドしてから Wrangler を起動します。

```bash
npm run build
```

```bash
npx wrangler d1 migrations apply DB --local
```

```bash
npm run preview
```

記事がまだない場合に表示を確認するには、テスト用の記事でビルドします。

```bash
npm run build:fixtures
```

```bash
npx wrangler dev --assets dist-fixtures --var COUNT_HOST:localhost
```

### ツールを更新する

`mise.lock` を最新にして、動作を確かめてからコミットします。メジャーバージョンをまたぐときは、先に `.mise.toml` を書き換えます。

```bash
mise lock --bump && mise install && npm run check
```

## 環境変数

環境変数も mise で管理します。**秘密情報は普段は読み込みません。** `ops` プロファイルを指定したコマンドにだけ渡します。

```bash
mise -E ops exec -- terraform -chdir=terraform plan
```

| 変数                                          | 内容                                | 定義する場所                        | 読み込まれるとき |
| --------------------------------------------- | ----------------------------------- | ----------------------------------- | ---------------- |
| `ASTRO_TELEMETRY_DISABLED`                    | Astro のテレメトリを無効にする      | `.mise.toml`                        | 常に             |
| `WRANGLER_SEND_METRICS`                       | Wrangler のテレメトリを無効にする   | `.mise.toml`                        | 常に             |
| `CLOUDFLARE_ACCOUNT_ID`                       | Cloudflare のアカウント ID          | `~/.config/marulabs/cloudflare.env` | `ops` のみ       |
| `CLOUDFLARE_API_TOKEN`                        | Terraform 用トークン（秘密）        | `~/.config/marulabs/cloudflare.env` | `ops` のみ       |
| `CLOUDFLARE_DEPLOY_TOKEN`                     | GitHub に登録するデプロイ用（秘密） | `~/.config/marulabs/cloudflare.env` | `ops` のみ       |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | R2 の S3 認証情報（秘密）           | `~/.config/marulabs/cloudflare.env` | `ops` のみ       |
| `TF_VAR_account_id` / `AWS_ENDPOINT_URL_S3`   | アカウント ID から生成する          | `.mise.ops.toml`                    | `ops` のみ       |

ファイルは `ops.env.example` をコピーして作ります。

```bash
mkdir -p ~/.config/marulabs && install -m 600 ops.env.example ~/.config/marulabs/cloudflare.env
```

注意点:

- **`.env` を使わないでください。** Astro は `.env` の値をビルド時にページから読めるようにし、静的 HTML に出力できてしまいます。Wrangler もそこからトークンを読みます。どちらも実際に確認しました。
- `npm ci`、ビルド、テストに `ops` を付けないでください。依存パッケージのスクリプトにトークンを渡さないためです。
- `mise -E ops env` は秘密情報をそのまま表示します。ログや Issue に貼らないでください。`redact` が効くのは `mise run` の出力だけで、`mise exec` の出力は隠されません。
- ファイルがないと `Field CLOUDFLARE_ACCOUNT_ID is not defined` で止まります。上のコマンドで作ってください。

## 記事を公開する

下書きは [marulabs-knowledge](https://github.com/Maru32768/marulabs-knowledge)（Private）で書きます。詳しい手順はそちらの README にあります。

1. Private リポジトリの `drafts/` で Draft を確定し、人がレビューして `status: approved` にする
2. Private リポジトリの CLI で、このリポジトリのブランチへファイルを置く（コミットもプッシュもしません）
3. 次のコマンドで検査し、内容を読み直す

   ```bash
   npm run verify:source
   ```

   ```bash
   npm run build
   ```

   ```bash
   npm run verify:dist
   ```

4. コミットしてプッシュし、公開用 PR を作る。**プッシュした時点でブランチの内容は公開されます**
5. PR のプレビューを確認して `main` にマージする。**マージが公開の境界です**。GitHub Actions が自動でデプロイします

## 公開記事を更新する

`src/content/articles/<slug>.md` を編集して PR を作ります。

- **誤字の修正など:** 本文だけ直します。履歴は Git に残ります。
- **内容の変更:** `revision` を 1 上げ、`updatedAt` を更新し、`changelog` に理由を追加します。

```yaml
revision: 2
updatedAt: 2026-12-01T21:00:00+09:00
changelog:
  - revision: 2
    date: 2026-12-01T21:00:00+09:00
    note: HOT の説明を修正
  - revision: 1
    date: 2026-11-10T20:00:00+09:00
    note: 初版
```

## 記事の書式

```yaml
---
title: PostgreSQLのMVCCとVACUUMの内部構造
description: 検索結果やRSSに出る要約（300文字以内）
slug: postgres-mvcc # URL になる。lower-kebab-case
createdAt: 2026-10-10T20:00:00+09:00
publishedAt: 2026-10-12T21:40:00+09:00 # 未来の日時は不可（予約公開はありません）
updatedAt: 2026-11-05T23:14:00+09:00
category: databases-storage # src/data/taxonomy.ts
tags: [postgresql, mvcc] # 小文字。1〜12個
revision: 1
kind: analysis # analysis 解析 / design 設計 / explainer 解説 / incident 障害調査 / devlog
# 以下は任意
target: PostgreSQL 17 # 対象
verifiedOn: PostgreSQL 17 / Debian 13 # 検証環境
keyPoints: [要点1, 要点2] # この記事の要点
series: { name: PostgreSQL Internals, part: 1 }
changelog: [] # revision 2 以降は必須
---
```

不正な値や未知のキーはビルドエラーになります。本文で使える記法:

````markdown
```c title="src/foo.h（抜粋）"
int main(void) { return 0; }
```

```output
プログラムの出力（ダーク表示、行番号なし）
```

> [!NOTE] メモの見出し
> 本文。

> [!WARNING] 注意の見出し
> 本文。

> [!QUOTE] 出典名
> 引用文。

Table: 表1. 表の見出し（表の直前の段落）

| 列  | 列  |
| --- | --- |
````

`.mdx` も使えます。

## テスト

| コマンド                                                                       | 内容                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `npm run check`                                                                | 型、lint、ユニットテスト、ソース検査、ビルド、成果物の検査 |
| `npm test`                                                                     | ユニットテストと Worker のテスト（workerd + 実 D1）        |
| `npm run test:e2e:docker`                                                      | ブラウザのテスト。先に `npm run build:fixtures` が必要     |
| `npm run test:e2e`                                                             | 同上、ローカルのブラウザで実行。ビジュアル比較は省略       |
| `npm run verify:dist -- --dir dist-fixtures --content tests/fixtures/articles` | フィクスチャのビルドの検査                                 |

ブラウザのテストは、デプロイされないフィクスチャのビルド（`dist-fixtures/`）に対して、本番と同じ Worker と workerd 上で動きます。`tests/fixtures/canary/` の下書き風ファイルに識別文字列を入れてあり、これがどの出力にも現れないことを確認しています。

### ビジュアルリグレッション

スクリーンショットはフォントに依存するので、Playwright 公式のコンテナの中でだけ比較します。見た目を意図して変えたらベースラインを更新し、差分を確認してからコミットします。

```bash
npm run test:e2e:update
```

## CI/CD

`.github/workflows/ci.yml`:

| ジョブ      | タイミング          | 内容                                                              |
| ----------- | ------------------- | ----------------------------------------------------------------- |
| `verify`    | PR、`main`          | 履歴を含むソース検査、型、lint、テスト、ビルド、成果物の検査      |
| `e2e`       | PR、`main`          | フィクスチャのビルドとブラウザのテスト                            |
| `terraform` | PR、`main`          | `fmt` と `validate` のみ（state に触れない）                      |
| `preview`   | 同じリポジトリの PR | 検査済みの `dist` を Version URL へアップロード                   |
| `deploy`    | `main`              | D1 マイグレーション、検査済みの `dist` のデプロイ、スモークテスト |

Private リポジトリへのアクセス権限はどのジョブにもありません。Actions は SHA で固定しています。ツールは `jdx/mise-action` が `.mise.toml` と `mise.lock` から入れます。`MISE_LOCKED=1` により、ロックにないバージョンやチェックサムの異なるものはエラーになります。CI では `ops` プロファイルを使いません。

### 必要な権限と Secrets

GitHub の Repository secrets:

| 名前                    | 内容                         |
| ----------------------- | ---------------------------- |
| `CLOUDFLARE_API_TOKEN`  | デプロイ用トークン（下の表） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare のアカウント ID   |

Cloudflare の API トークンは用途ごとに分けます。

| トークン     | 置き場所                               | 権限                                                                                                                                                         |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| デプロイ用   | GitHub Secrets                         | Account: Workers Scripts Edit, D1 Edit                                                                                                                       |
| Terraform 用 | 管理人のマシンのみ（`cloudflare.env`） | Account: Workers Scripts Edit, D1 Edit, Workers R2 Storage Edit, Account Settings Read / Zone（marulabs.dev のみ）: Zone Read, DNS Edit, Workers Routes Edit |

## Cloudflare への初回デプロイ

一度だけ必要な手順です。以降は `main` へのマージだけでデプロイされます。

1. [環境変数](#環境変数)のとおり `~/.config/marulabs/cloudflare.env` を用意します。

2. state 用の R2 バケットを作ります（Terraform の外で一度だけ）。

   ```bash
   mise -E ops exec -- npx wrangler r2 bucket create marulabs-tfstate
   ```

3. Terraform を初期化します。

   ```bash
   mise -E ops exec -- terraform -chdir=terraform init
   ```

4. Worker 本体と D1 だけを先に作ります。カスタムドメインは Worker にコードが入ってから付けます。**plan の内容を必ず確認してください。**

   ```bash
   mise -E ops exec -- terraform -chdir=terraform plan -target=cloudflare_worker.blog -target=cloudflare_d1_database.blog -out=first.tfplan
   ```

   ```bash
   mise -E ops exec -- terraform -chdir=terraform apply first.tfplan
   ```

5. 次の値を `wrangler.jsonc` の `database_id` に入れてコミットします。

   ```bash
   mise -E ops exec -- terraform -chdir=terraform output -raw d1_database_id
   ```

6. GitHub にデプロイ用の Secrets を登録します。

   ```bash
   mise -E ops exec -- sh -c 'printf %s "$CLOUDFLARE_DEPLOY_TOKEN" | gh secret set CLOUDFLARE_API_TOKEN && printf %s "$CLOUDFLARE_ACCOUNT_ID" | gh secret set CLOUDFLARE_ACCOUNT_ID'
   ```

7. `main` にプッシュすると CI がマイグレーションとデプロイを行います。手元から行う場合は次のとおりです。

   ```bash
   npm run build && mise -E ops exec -- sh -c 'npx wrangler d1 migrations apply DB --remote && npx wrangler deploy'
   ```

8. カスタムドメインを作成します。追加されるのが `cloudflare_workers_custom_domain.blog` だけであることを確認します。

   ```bash
   mise -E ops exec -- terraform -chdir=terraform plan -out=domain.tfplan
   ```

   ```bash
   mise -E ops exec -- terraform -chdir=terraform apply domain.tfplan
   ```

9. 確認します。

   ```bash
   node scripts/smoke-test.ts https://blog.marulabs.dev
   ```

## Terraform の運用

| 管理対象                            | リソース                                |
| ----------------------------------- | --------------------------------------- |
| 既存の Zone（読み取りのみ）         | `data.cloudflare_zone.main`             |
| Worker 本体（コードなし）           | `cloudflare_worker.blog`                |
| D1                                  | `cloudflare_d1_database.blog`           |
| カスタムドメイン（DNS・証明書込み） | `cloudflare_workers_custom_domain.blog` |

- **DNS レコードを Terraform に書かないでください。** カスタムドメインが自動で管理します。
- コードとバインディングは Wrangler の担当です（`wrangler.jsonc`）。理由は [docs/DECISIONS.md](docs/DECISIONS.md) にあります。
- **state:** R2 の非公開バケット `marulabs-tfstate`。リポジトリには置きません。R2 のトークンはこのバケットに限定します。
- **変更の手順:** 必ず `plan` を確認してから `apply` します。既存リソースの破壊や置き換えが出たら止めてください。コマンドは `mise -E ops exec -- terraform -chdir=terraform <サブコマンド>` の形で実行します。
- Worker と D1 には `prevent_destroy` を付けています。

## アクセスカウンターの仕組み

`POST /api/counter` が累計を 1 増やして返し、`GET /api/counter` が読み取るだけです。表示するのは**サイト全体の累計ページビュー**で、訪問者数ではありません。

```sql
UPDATE counters SET value = value + 1 WHERE name = 'pageviews' RETURNING value
```

- **保存するもの:** 整数 1 つだけ。IP アドレスは読まず、Cookie もフィンガープリントも使いません。
- **過剰カウント対策:** 同じタブの同じページは 30 分間数えません（sessionStorage）。自動化ブラウザ、既知のボット、他のオリジン、本番以外のホストからは数えません。さらにロケーションごとに毎分 60 件の上限があります。
- **障害時:** API が落ちても、応答しなくても、記事の表示には影響しません。`/api/*` 以外は Worker を通らず配信され、カウンターの表示が `-------` になるだけです。
- **料金:** 静的アセットへのリクエストは無料かつ無制限です。1 PV が D1 の 1 行書き込みで、無料枠は 1 日 10 万行です。

値を確認するには:

```bash
mise -E ops exec -- npx wrangler d1 execute DB --remote --command "SELECT * FROM counters"
```

## 障害時の復旧

| 症状                           | 確認すること                                              | 復旧                                                                                                                    |
| ------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| デプロイ後にサイトが壊れた     | Actions のログ                                            | `mise -E ops exec -- npx wrangler rollback` で直前のバージョンに戻してから、`git revert` の PR をマージする             |
| 公開すべきでない内容を公開した | -                                                         | 下の「情報を公開してしまったとき」                                                                                      |
| CI が赤く、デプロイされない    | 失敗したジョブ                                            | 公開境界の検査の失敗は、原因を直してください。検査を無効にしないでください                                              |
| カウンターが `-------`         | `curl -i https://blog.marulabs.dev/api/counter`           | 503 なら D1 の無料枠の超過か障害。翌日 09:00 JST（00:00 UTC）に回復します。記事は読めます                               |
| カウンターの値を失った         | D1 Time Travel（無料枠は 7 日）                           | `mise -E ops exec -- npx wrangler d1 time-travel restore DB --timestamp=<UNIX秒>`                                       |
| ドメインにつながらない         | `terraform plan` の差分、ダッシュボードのカスタムドメイン | `terraform apply` で作り直します。DNS レコードを手で作らないでください                                                  |
| API トークンの漏洩             | -                                                         | ダッシュボードで失効させ、新しいトークンを GitHub Secrets に登録します                                                  |
| ローカルの作業環境を失った     | -                                                         | リポジトリを clone して `mise install`、`cloudflare.env` を作り直して `terraform init` します。state は R2 にあります   |
| state を壊した                 | R2 のオブジェクト                                         | `terraform import` で取り込み直します（D1: `<account_id>/<database_id>`、カスタムドメイン: `<account_id>/<domain_id>`） |

### 情報を公開してしまったとき

1. **秘密情報なら、最初に失効させます。** 公開された時点で漏れたものとして扱います。履歴の削除より先です。
2. `git revert` の PR をマージして、サイトから消します（急ぐなら記事を消した状態で `wrangler rollback` または手動デプロイ）。
3. Git の履歴に残っていることに注意してください。必要なら履歴を書き換え、GitHub Support にキャッシュの削除を依頼します。RSS リーダーや検索エンジンのキャッシュにも残る可能性があります。

## ライセンス

[LICENSE.md](LICENSE.md) を参照してください。本文は CC BY 4.0、コードは MIT です。
