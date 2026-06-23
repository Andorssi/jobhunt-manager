# Job Hunt Manager

就職活動のエントリーシート（ES）提出期限や適性検査（Webテスト）の受験期限を一覧管理できる、個人向けの就活管理Webアプリです。締切が近い項目や過ぎてしまった項目が一目でわかるように色分け表示されます。

## デモ

🔗 https://jobhunt.yut4k.com

Googleアカウントでログインして利用できます。

## 主な機能

- 応募企業ごとのES提出状況・締切、Webテストの種類・受験状況・締切を一覧管理
- 締切までの残り日数に応じて行の背景色が自動で変化（提出済みは緑、3日以内は黄色、期限超過は赤）
- 企業ごとのマイページURLやメモを保存
- Googleアカウントによるログイン認証（自分以外のデータにはアクセス不可）

## 技術構成

| カテゴリ | 使用技術 |
|---|---|
| フロントエンド | Next.js (App Router) / React / TypeScript |
| スタイリング | Tailwind CSS |
| バックエンド / DB | Supabase (PostgreSQL) |
| 認証 | Supabase Auth (Google OAuth, PKCEフロー) |
| ホスティング | Vercel |

## 認証アーキテクチャ

Googleログインには Supabase Auth の PKCE (Proof Key for Code Exchange) フローを採用しています。

1. ユーザーがログインボタンを押すと、ブラウザ側の Supabase クライアント（`@supabase/ssr` の `createBrowserClient`）が Google の認可ページへリダイレクトします。
2. 認証後、Google は `/auth/callback` に認可コードを付けてリダイレクトします。
3. `/auth/callback`（Route Handler）が `@supabase/ssr` の `createServerClient` を使い、認可コードをセッションに交換し、Cookie に保存します。
4. 以降のリクエストはこの Cookie を使ってサーバー・クライアント双方でセッションを共有します。

ブラウザ用クライアントとサーバー用クライアントの両方を `@supabase/ssr` に統一することで、Cookie ベースでセッション情報を一貫して管理し、認証情報の受け渡しによるログインループ等の不整合を防いでいます。

## セキュリティ

- データベースには Row Level Security (RLS) を適用し、`applications` テーブルへの SELECT / INSERT / UPDATE / DELETE はすべて `auth.uid() = owner_id` の条件で制限しています。ログインしていないユーザーや他人のデータには、API を直接叩いても一切アクセスできません。
- クライアントに公開される `NEXT_PUBLIC_SUPABASE_URL` ・ `NEXT_PUBLIC_SUPABASE_ANON_KEY` は、RLS によるアクセス制御を前提とした「公開を想定したキー」であり、Service Role Key 等の秘匿すべき鍵はクライアントコードに含めていません。
- Google OAuth のリダイレクト先 URL は Supabase 側で許可リスト管理しています。 <br>
(2026/6/23 update)
- 文字数制限を導入しました。
- URL入力はhttp/httpsのみを許可するようにしました。

## ローカルでの実行方法

```bash
git clone <このリポジトリのURL>
cd <リポジトリ名>
npm install
```

`.env.local` を作成し、以下を設定してください（値は自分の Supabase プロジェクトのものを使用）。

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxx
```

```bash
npm run dev
```

`http://localhost:3000` で起動します。Google ログインを動かすには、Supabase の Authentication 設定で Google プロバイダーを有効化し、Redirect URLs に `http://localhost:3000/auth/callback` を登録してください。

## 今後の展望

- 締切が近い企業をメールやLINEで通知する機能
- スマートフォン向けのレイアウト最適化
- 企業ごとの選考フロー（一次面接・二次面接など）の管理機能