# marulabs-blog

技術ブログ「Maru's Blog」（https://blog.marulabs.dev）の Public リポジトリ。

**このリポジトリのすべては公開情報です。** コミットした時点で公開されたものとして扱ってください。Web のビルド対象から外しても、GitHub 上の非公開性は保証されません。

## 公開に関する絶対のルール

1. **Claude は明示的な指示なしに Draft を公開しない。** Draft をこのリポジトリへ移動しない。公開用 PR を作らない。マージしない。
2. **Private Knowledge を Public リポジトリにコピーしない。** 要約や引用の形でも同じ。
3. **公開記事の作成では、非公開情報や機密情報を意図せず含めない。** 認証情報、顧客や第三者の情報、社内のホスト名、個人情報、未公開の計画など。
4. 公開の境界は**人間による `main` へのマージ**です。Claude が PR をマージするのは、そのマージを明示的に指示されたときだけです。
5. 記事の内容を変える変更を、指示なしにコミットしない。誤字の修正でも確認する。
6. `tests/fixtures/` に本物の調査記録を置かない。

下書きと調査記録は `marulabs-knowledge`（Private）に置きます。この2つのリポジトリの間で自動的に同期する仕組みを作らないでください。

## アーキテクチャ

- **Astro 7**（静的生成のみ）+ **TypeScript**。Markdown は `unified()` パイプライン（`astro.config.ts`）
- **Pagefind**: 記事ページだけを索引。`scripts/build-search-index.ts` が生成
- **Cloudflare Workers Static Assets**: 全ページを静的に配信。Worker（`worker/index.ts`）が動くのは `/api/*` だけ
- **D1**: 累計 PV の整数 1 行だけ。IP は読まない
- 判断の理由は `docs/DECISIONS.md` を参照。設計を変えるときはここも更新する

```
src/content/articles/  公開記事。唯一のコンテンツソース
src/lib/               スキーマと集計（articles.ts は純粋関数でテスト可能）
src/plugins/           Markdown の変換（コード図表、Quote、メモ、表、アンカー）
src/styles/tokens.css  デザイントークン
worker/                カウンター API
migrations/            D1 スキーマ
scripts/               検索索引、公開境界の検査、スモークテスト
terraform/             Worker 本体、D1、カスタムドメイン
tests/                 unit, worker, e2e, fixtures
```

## 実装ルール

- アプリケーションコードとスクリプトは TypeScript。`node scripts/x.ts` で直接動く（`erasableSyntaxOnly`）。インポートには `.ts` を付ける
- React などのクライアントフレームワークを入れない。JavaScript は段階的な拡張に限る。**JS なしでも記事は読めること**
- クライアントの JS は `src/scripts/` に置く。`site.ts` は全ページ、`article.ts` は記事ページ、`search.ts` は検索ページ
- `<script>` は外部ファイルにする（CSP が `script-src 'self'`）
- 数値や履歴はすべて Markdown から生成する。**ダミーデータを表示しない**
- `getStaticPaths` はスコープの外へ巻き上げられる。ローカル定数を参照せず、モジュールからインポートする
- HTML 圧縮の影響で、改行だけの空白は消える。インラインの要素の間に空白が要るときは `{" "}` を書く

## デザイン原則

2000〜2003 年頃の技術系サイトや vBulletin/phpBB の外観を維持します。

- 色、グラデーション、サイズは `src/styles/tokens.css` のトークンを使う。値を直接書かない
- 細いボーダー、ベベル、表組み、ピクセルアイコン（`src/data/icons.ts`）を使う
- 角丸、影の強いカード、大きな余白など、現代的な UI を持ち込まない
- 文字サイズの目安: 本文 16〜18px、UI 14〜16px、メタデータ 12〜14px
- モバイルの幅は 390px を基準に確認する。ページ全体が横スクロールしてはいけない。コードと表はそれぞれの枠の中でスクロールする
- 作らないもの: コメント、掲示板、登録・ログイン、前回訪問日時、既読管理、CMS 画面、自動公開、非公開ナレッジの閲覧画面

## コンテンツの扱い

- Frontmatter の仕様は `src/lib/article-schema.ts`。未知のキーはビルドエラー
- `draft` や `status` のような「未公開」の概念をこのリポジトリに持ち込まない。ここにある記事はすべて公開済み
- 改訂するときは `revision` を上げ、`updatedAt` と `changelog` を更新する。詳細は README

## ツールと環境変数

ツールと環境変数は mise で管理する。

- バージョンは `.mise.toml`（どこまで自動で上げてよいか）と `mise.lock`（正確なバージョンとチェックサム）で決まる。バージョンを別の場所に書かない。`mise.lock` はコミットする
- 秘密情報は `~/.config/marulabs-blog/ops.env` に置く。リポジトリの中には置かない
- **`.env` を作らない。** Astro が値を静的 HTML に出力でき、Wrangler もトークンを読む
- Cloudflare の認証情報が必要なコマンドは `mise -E ops exec -- <コマンド>` で実行する（`.mise.ops.toml`）。インフラの操作のときだけ付ける。`npm ci`、ビルド、テストに付けない
- **秘密情報を表示しない。** `mise -E ops env` や `env`、`printenv` を実行しない。`ops.env` の中身を読まない。確認が必要なら変数名だけを見る
- CI で `ops` プロファイルを使わない

## テスト

コードを変えたら次を通してください。

```bash
npm run check
```

型、lint、ユニットテスト、ソース検査、ビルド、成果物の検査をまとめて実行します。

ブラウザのテストはフィクスチャのビルドに対して動きます。

```bash
npm run build:fixtures
```

```bash
npm run test:e2e:docker
```

- ビジュアルリグレッションは Playwright のコンテナの中でだけ有効です（フォントが異なるため）
- 見た目を意図して変えたら `npm run test:e2e:update` でベースラインを更新し、差分の画像を確認してからコミットする
- 公開境界に関わるコードを変えたら、**漏洩を実際に検出できること**をテストで確認する（`tests/unit/boundary.test.ts`）

## デプロイ

`main` へのマージで GitHub Actions がテストし、検査済みの `dist` をデプロイします。手動の `wrangler deploy` は障害時だけにしてください。

## Terraform

- `terraform/` は Worker 本体、D1、カスタムドメインを管理する。既存の Zone は参照するだけ
- **`apply` の前に必ず `plan` を確認する。** 既存リソースの破壊や置き換えが含まれる場合は、明示的な承認なしに実行しない
- コマンドは `mise -E ops exec -- terraform -chdir=terraform <サブコマンド>` で実行する
- `prevent_destroy` を外さない。state と `*.tfvars` をコミットしない
- plan の出力を Issue や PR に貼らない
