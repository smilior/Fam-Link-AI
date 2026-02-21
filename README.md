# Tsunagu — 家族をつなぐカレンダー

家族の予定を共有・管理するPWAアプリ。

**本番URL**: https://tsunagu.smilior.com

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16.1.6 (App Router) |
| 言語 | TypeScript |
| スタイル | Tailwind CSS v4 |
| DB | Turso (LibSQL) + Drizzle ORM |
| 認証 | Better Auth (Google OAuth) |
| プッシュ通知 | Web Push API (web-push 3.6.7, VAPID) |
| 祝日 | @holiday-jp/holiday_jp |
| デプロイ | Vercel |
| パッケージマネージャ | pnpm |

---

## ローカル開発

```bash
# 依存関係インストール
pnpm install

# .env.local を作成（下記「環境変数」参照）

# 開発サーバー起動
pnpm dev
```

---

## 環境変数

`.env.local` に以下を設定する。

```env
# Turso
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...

# Better Auth
BETTER_AUTH_SECRET=...

# Google OAuth (GCP Console で取得)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Web Push (npx web-push generate-vapid-keys で生成)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com

# Push送信APIのシークレット (openssl rand -hex 32 で生成)
PUSH_API_SECRET=...

# アプリURL
NEXT_PUBLIC_APP_URL=https://tsunagu.smilior.com
```

### Vercel への環境変数登録

`echo` は末尾に改行が入るため、以下の方法で登録すること。

```bash
python3 -c "import sys; sys.stdout.write('値')" | vercel env add 変数名 production
```

---

## データベース

```bash
# スキーマ変更後
pnpm db:generate
pnpm db:migrate

# スキーマを直接DBに反映（開発用）
pnpm db:push

# DB GUI
pnpm db:studio
```

---

## デプロイ

```bash
git push origin develop  # GitHubに反映
vercel --prod             # Vercelに本番デプロイ
```

---

## プッシュ通知

### 仕組み

1. ブラウザが `POST /api/push/subscribe` で購読情報をDBに保存
2. cronが `POST /api/push/send` を叩くと、その日のまだ始まっていない予定を全メンバーに通知
3. `/notifications` ページで通知履歴（未読のみ）を確認できる

### VAPIDキーの再生成

```bash
npx web-push generate-vapid-keys
# → .env.local と Vercel の環境変数を更新
```

### ローカルテスト

```bash
curl -X POST \
  -H "Authorization: Bearer $PUSH_API_SECRET" \
  http://localhost:3000/api/push/send
```

---

## Lolipop cronスクリプト

`lolipop/push_notify.sh` にcron用スクリプトを配置（**gitignore済み** — PUSHシークレットが含まれるため）。

```sh
#!/bin/sh
PATH=/usr/local/bin:/usr/bin:/bin
LOGFILE=$(dirname "$0")/push_notify.log
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOGFILE"
/usr/bin/curl -s -X POST \
  -H "Authorization: Bearer <PUSH_API_SECRET>" \
  https://tsunagu.smilior.com/api/push/send >> "$LOGFILE" 2>&1
echo "" >> "$LOGFILE"
```

**注意点**:
- Lolipopのcron環境はPATHが限られるため `PATH=` の明示が必要
- `chmod 755 push_notify.sh` で実行権限を付与すること
- curl はフルパス `/usr/bin/curl` で指定

---

## 主要機能

- **月次カレンダー**: スワイプで月移動、日付タップで詳細ボトムシート
- **繰り返し予定**: 毎日・毎週・毎月・毎年、1件のみ変更も可
- **ファミリー管理**: パパ/ママ/娘/息子ロール、招待コードでメンバー追加
- **プッシュ通知**: Web Push対応、今日の未来の予定をcronで配信
- **通知履歴**: 未読のみ表示、一括既読ボタン
- **祝日表示**: 祝日を赤色で表示、祝日名をセルに表示
- **PWA対応**: iOSホーム画面に追加可能

---

## ディレクトリ構成（主要部分）

```
src/
├── app/
│   ├── dashboard/          # カレンダー画面
│   ├── hub/                # ハブ画面
│   ├── notifications/      # 通知一覧
│   ├── settings/           # 設定画面
│   └── api/
│       └── push/           # Push通知API
├── components/
│   ├── calendar/           # カレンダーコンポーネント
│   └── layout/             # ヘッダー・BottomNav
└── lib/
    ├── actions/            # Server Actions
    ├── db/                 # スキーマ・型定義
    ├── holidays.ts         # 祝日ユーティリティ
    └── push.ts             # Push送信ヘルパー
```

---

## GCP (Google OAuth) 設定

承認済みリダイレクトURIに以下を登録:

- `https://tsunagu.smilior.com/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google`（開発用）
