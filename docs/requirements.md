# コネクト・ファミリー・ハブ (Fam-Link-AI) 要件定義書

> **プロジェクト名:** コネクト・ファミリー・ハブ (Fam-Link-AI)
> **作成日:** 2026-02-21
> **ステータス:** ドラフト
> **対象読者:** AI Agent（実装担当）
> **関連ドキュメント:** [企画書](./proposal.md)

---

## 目次

1. [ドキュメント概要](#1-ドキュメント概要)
2. [システム概要](#2-システム概要)
3. [ユーザーと権限](#3-ユーザーと権限)
4. [機能要件](#4-機能要件)
   - 4.1 [認証・ユーザー管理 (AUTH)](#41-認証ユーザー管理-auth)
   - 4.2 [共有カレンダー (CAL)](#42-共有カレンダー-cal)
   - 4.3 [プッシュ通知 (PUSH)](#43-プッシュ通知-push)
   - 4.4 [イベント別チャット (CHAT)](#44-イベント別チャット-chat)
   - 4.5 [共有ToDoリスト (TODO)](#45-共有todoリスト-todo)
   - 4.6 [スタンプ・リアクション (STAMP)](#46-スタンプリアクション-stamp)
   - 4.7 [AIプリントスキャン (SCAN)](#47-aiプリントスキャン-scan)
   - 4.8 [学校書類アーカイブ (ARCHIVE)](#48-学校書類アーカイブ-archive)
   - 4.9 [学校スケジュールハブ (SCHOOL)](#49-学校スケジュールハブ-school)
   - 4.10 [ゲーミフィケーション (GAME)](#410-ゲーミフィケーション-game)
   - 4.11 [ストーリー・アルバム (ALBUM)](#411-ストーリーアルバム-album)
5. [非機能要件](#5-非機能要件)
6. [データモデル](#6-データモデル)
7. [画面一覧・遷移](#7-画面一覧遷移)
8. [外部連携](#8-外部連携)
9. [フェーズ別スコープ](#9-フェーズ別スコープ)

---

## 1. ドキュメント概要

### 1.1 目的

本ドキュメントは、企画書（`docs/proposal.md`）の内容をもとに、AI Agentが実装可能な粒度で機能要件・非機能要件・データモデル・外部連携を定義する。

### 1.2 要件IDの体系

| プレフィックス | カテゴリ |
|:---:|---------|
| AUTH | 認証・ユーザー管理 |
| CAL | 共有カレンダー |
| PUSH | プッシュ通知 |
| CHAT | イベント別チャット |
| TODO | 共有ToDoリスト |
| STAMP | スタンプ・リアクション |
| SCAN | AIプリントスキャン |
| ARCHIVE | 学校書類アーカイブ |
| SCHOOL | 学校スケジュールハブ |
| GAME | ゲーミフィケーション |
| ALBUM | ストーリー・アルバム |
| NFR | 非機能要件 |

各要件は `プレフィックス-連番` の形式（例: `AUTH-001`）で一意に識別する。

### 1.3 優先度の定義

| ラベル | 意味 |
|:---:|------|
| P1 | Phase 1（MVP）で実装必須 |
| P2 | Phase 2（v1.0）で実装 |
| P3 | Phase 3（v2.0）で実装 |

---

## 2. システム概要

### 2.1 システム構成

```
[ブラウザ (PWA)]
    ↕ HTTPS
[Vercel (Next.js App Router)]
    ↕ libSQL over HTTPS
[Turso (DB)]

[Lolipopサーバー (Cron)]
    → HTTPS → [Vercel API Route /api/push/send]
                    ↕
               [Web Push API → ブラウザ]

[OpenAI API]
    ← 画像 + プロンプト ← [Vercel API Route /api/scan]
```

### 2.2 技術スタック（確定）

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js (App Router) + TypeScript |
| スタイリング | Tailwind CSS |
| PWA | next-pwa |
| バックエンド | Next.js API Routes / Server Actions |
| DB | Turso (libSQL) |
| ORM | Drizzle ORM |
| 認証 | Better Auth (Google OAuth) |
| AI/OCR | OpenAI API (GPT-4o等、マルチモーダル) |
| プッシュ通知 | Web Push API |
| Cron | Lolipopサーバー |
| ホスティング | Vercel (アプリ) + Lolipop (Cron) |
| ストレージ | Turso DB内 BLOB |
| 状態管理 | Zustand |
| アニメーション | Framer Motion |

### 2.3 前提条件

- ユーザーは最大4人（パパ・ママ・娘・息子）の固定家族構成
- 全ユーザーがGoogleアカウントを所持している
- 主な利用端末はスマートフォン（PWA）
- リアルタイム同期は不要。画面更新（ページ遷移・リロード）で最新データを取得する
- 画像ファイルはTurso DB内にBLOBとして保存する

---

## 3. ユーザーと権限

### 3.1 ユーザー種別

本システムは単一家族向けであり、ロールによる権限分離は最小限とする。

| ロール | 説明 | 該当メンバー |
|-------|------|------------|
| `parent` | 親。全機能にアクセス可能。AIスキャン結果の確定権限を持つ。 | パパ、ママ |
| `child` | 子。自分の予定の登録・編集が可能。AIスキャン結果の確定は不可。 | 娘、息子 |

### 3.2 権限マトリクス

| 操作 | parent | child |
|-----|:---:|:---:|
| 予定の作成・編集・削除 | ✅ | ✅（自分の予定のみ） |
| 他メンバーの予定の編集・削除 | ✅ | ❌ |
| AIスキャン結果の確定 | ✅ | ❌ |
| ToDo作成・アサイン | ✅ | ✅ |
| 家族グループ設定の変更 | ✅ | ❌ |
| チャット送信 | ✅ | ✅ |
| スタンプ送信 | ✅ | ✅ |
| ゴール設定 | ✅ | ✅ |

### 3.3 カラーコーディング

各メンバーに固定のテーマカラーを割り当てる。UI全体で一貫して使用する。

| メンバー | カラー | HEXコード（参考） |
|---------|-------|:---:|
| パパ | ブルー | `#3B82F6` |
| ママ | ピンク | `#EC4899` |
| 娘 | イエロー | `#EAB308` |
| 息子 | グリーン | `#22C55E` |

---

## 4. 機能要件

### 4.1 認証・ユーザー管理 (AUTH)

#### AUTH-001: Googleログイン（P1）

- Better AuthのGoogle OAuthプロバイダーを使用してログインする
- ログイン後、ユーザーがDB上の家族グループに紐づいていなければ初期セットアップ画面へ遷移する
- **受入条件:**
  - Googleアカウントでログインできる
  - ログイン後、セッションが維持される
  - 未登録ユーザーは初期セットアップ画面に遷移する

#### AUTH-002: 家族グループ作成（P1）

- 最初のユーザー（parent）が家族グループを作成する
- グループ作成時に、グループ名（デフォルト: 「〇〇家」）を設定する
- **受入条件:**
  - 家族グループを作成できる
  - 作成者が自動的にparentロールで登録される

#### AUTH-003: 家族メンバー招待（P1）

- parentが招待リンクまたは招待コードを発行し、他の家族メンバーを招待する
- 招待されたメンバーはGoogleログイン後、グループに参加する
- 参加時にロール（parent / child）、表示名、カラーを設定する
- **受入条件:**
  - 招待リンク/コードでグループに参加できる
  - 参加時にロール・表示名・カラーが設定される
  - グループメンバーは最大4人まで

#### AUTH-004: プロフィール編集（P1）

- 表示名、カラー、通知設定の変更ができる
- **受入条件:**
  - 表示名を変更できる
  - カラーを変更できる（4色から選択）
  - 変更が即座にDBに反映される

#### AUTH-005: ログアウト（P1）

- ログアウトするとセッションが破棄され、ログイン画面に戻る
- **受入条件:**
  - ログアウト後、認証が必要な画面にアクセスできない

---

### 4.2 共有カレンダー (CAL)

#### CAL-001: 予定の作成（P1）

- 以下の項目を入力して予定を作成する
  - タイトル（必須）
  - 日付（必須）
  - 開始時刻・終了時刻（任意）
  - 終日フラグ（boolean）
  - メモ（任意、テキスト）
  - 対象メンバー（複数選択可、デフォルト: 作成者）
  - カテゴリ（任意: 学校、仕事、家庭、習い事、その他）
- **受入条件:**
  - 必須項目を入力して予定が作成できる
  - 作成した予定がカレンダー上に表示される
  - 対象メンバーのカラーでラベルが表示される

#### CAL-002: 予定の編集（P1）

- 作成済みの予定の全項目を編集できる
- parentは全員の予定を編集可能。childは自分が対象の予定のみ編集可能
- **受入条件:**
  - 権限に応じて予定を編集できる
  - 編集内容がDBに保存される

#### CAL-003: 予定の削除（P1）

- 予定を削除できる。権限ルールはCAL-002と同じ
- 削除前に確認ダイアログを表示する
- **受入条件:**
  - 確認後、予定が削除される
  - カレンダー上から即座に消える

#### CAL-004: 月間ビュー（P1）

- 月間カレンダーを表示する
- 各日付セルに、その日の予定をメンバーカラーのドットまたはラベルで表示する
- 前月・翌月への切替ができる
- **受入条件:**
  - 月間カレンダーが正しく表示される
  - 予定がカラーコーディングされて表示される
  - 月の切替ができる

#### CAL-005: 週間ビュー（P1）

- 週間カレンダーを表示する
- タイムライン形式で予定を時間帯ごとに表示する
- 前週・翌週への切替ができる
- **受入条件:**
  - 週間カレンダーが正しく表示される
  - 時間帯に予定が配置される

#### CAL-006: 日別ビュー（P1）

- 選択した日の予定を時系列で一覧表示する
- 各予定をタップするとイベント詳細画面に遷移する
- **受入条件:**
  - 選択日の予定が時系列で表示される
  - 予定タップでイベント詳細に遷移する

#### CAL-007: メンバーフィルタ（P1）

- カレンダー上部にメンバーアイコン（カラー付き）を表示する
- タップでON/OFFを切替え、特定メンバーの予定のみ表示できる
- **受入条件:**
  - メンバーフィルタのON/OFFが切り替わる
  - フィルタに応じて予定の表示/非表示が切り替わる

#### CAL-008: 今日へ戻る（P1）

- カレンダー表示中に「今日」ボタンで当日に戻れる
- **受入条件:**
  - ボタンタップで今日の日付にスクロール/遷移する

---

### 4.3 プッシュ通知 (PUSH)

#### PUSH-001: PWAプッシュ通知の購読（P1）

- ユーザーが初回ログイン後、ブラウザのプッシュ通知許可を求める
- 許可された場合、Web Push APIのsubscription情報をDBに保存する
- **受入条件:**
  - 通知許可ダイアログが表示される
  - 許可後、subscription情報がDBに保存される
  - 拒否された場合もエラーにならず、アプリは通常通り利用できる

#### PUSH-002: 定時通知バッチ（P1）

- Lolipopサーバーのcronジョブが以下のスケジュールでVercel API Route `POST /api/push/send` を呼び出す
  - 7:00 / 12:00 / 15:00 / 18:00（JST、1日4回）
- APIは以下のロジックで通知対象を決定する:
  - 当日の未通知イベント
  - 翌日のイベント（18:00の通知のみ）
  - 期限が近いToDo（期限当日 or 翌日）
- **受入条件:**
  - cron起動でAPIが正常に呼び出される
  - 条件に合致するイベント/ToDoの通知がメンバーに送信される
  - 同一イベントに対する重複通知を防ぐ（通知済みフラグ管理）

#### PUSH-003: 通知APIのセキュリティ（P1）

- `/api/push/send` はAPIキー（環境変数 `PUSH_API_SECRET`）による認証を必須とする
- Lolipopからのリクエストヘッダー `Authorization: Bearer <PUSH_API_SECRET>` を検証する
- **受入条件:**
  - APIキーなしのリクエストは403を返す
  - 正しいAPIキー付きリクエストは正常に処理される

#### PUSH-004: 通知センター画面（P1）

- 送信済みの通知履歴を一覧表示する
- 各通知をタップすると該当イベント/ToDoに遷移する
- **受入条件:**
  - 通知履歴が新しい順に一覧表示される
  - タップで該当画面に遷移する

---

### 4.4 イベント別チャット (CHAT)

#### CHAT-001: チャットスレッド表示（P2）

- イベント詳細画面の下部にチャットスレッドを表示する
- メッセージは時系列（古い順）で表示する
- 各メッセージにはメンバー名、カラーアイコン、送信日時を表示する
- **受入条件:**
  - イベントに紐づくメッセージが時系列で表示される
  - メンバーのカラーで識別できる

#### CHAT-002: メッセージ送信（P2）

- テキストメッセージを送信できる
- 送信後、画面更新でスレッドに反映される
- **受入条件:**
  - テキストを入力して送信できる
  - 送信後にメッセージがスレッドに表示される

#### CHAT-003: 画像送信（P2）

- チャットに画像を添付して送信できる
- 画像はTurso DB内にBLOBとして保存する
- サムネイル表示し、タップで拡大表示する
- **受入条件:**
  - 画像を選択して送信できる
  - サムネイルが表示される
  - タップで拡大表示できる

---

### 4.5 共有ToDoリスト (TODO)

#### TODO-001: ToDoの作成（P2）

- 以下の項目を入力してToDoを作成する
  - タイトル（必須）
  - メモ（任意）
  - 担当者（メンバー選択、任意）
  - 期限日（任意）
  - カテゴリ（買い物、旅行準備、家事、その他）
- **受入条件:**
  - ToDoが作成され、リストに表示される

#### TODO-002: ToDo一覧表示（P2）

- 未完了のToDoを一覧表示する（デフォルト）
- 完了済みToDoの表示切替ができる
- 担当者カラーでラベルを表示する
- **受入条件:**
  - 未完了ToDoが一覧表示される
  - 完了/未完了の切替ができる

#### TODO-003: ToDoの完了（P2）

- チェックボックスをタップしてToDoを完了状態にする
- 完了時、完了日時をDBに記録する
- **受入条件:**
  - チェックで完了状態に変わる
  - 完了日時が記録される

#### TODO-004: ToDoの編集・削除（P2）

- ToDoの各項目を編集できる
- 削除は確認ダイアログ後に実行する
- **受入条件:**
  - 編集内容がDBに保存される
  - 確認後に削除できる

---

### 4.6 スタンプ・リアクション (STAMP)

#### STAMP-001: スタンプ送信（P2）

- 予定またはToDo完了に対して、スタンプ（定義済みリアクション）を送信できる
- スタンプ種別: `ありがとう` / `了解` / `がんばれ` / `おつかれ` / `いいね`
- **受入条件:**
  - スタンプを選択して送信できる
  - 送信先のメンバーに通知される（次回の定時通知に含まれる）

#### STAMP-002: スタンプ表示（P2）

- イベント詳細画面・ToDo完了時に、受信したスタンプを表示する
- 誰がどのスタンプを送ったかを表示する
- **受入条件:**
  - スタンプがメンバーカラー付きで表示される

---

### 4.7 AIプリントスキャン (SCAN)

#### SCAN-001: 画像アップロード（P2）

- スマホカメラで撮影、またはギャラリーから画像を選択してアップロードする
- アップロード画像はTurso DB内にBLOBとして保存する
- 対応フォーマット: JPEG, PNG
- 最大ファイルサイズ: 10MB
- **受入条件:**
  - カメラ撮影またはギャラリー選択で画像をアップロードできる
  - アップロード中はローディング表示される

#### SCAN-002: AI解析（P2）

- アップロード画像をOpenAI API（GPT-4o等、マルチモーダル）に送信する
- プロンプトで以下の構造化データを抽出する:
  ```json
  {
    "events": [
      {
        "title": "イベント名",
        "date": "YYYY-MM-DD",
        "start_time": "HH:mm | null",
        "end_time": "HH:mm | null",
        "location": "場所 | null",
        "items": ["持ち物1", "持ち物2"],
        "notes": "その他の情報"
      }
    ],
    "source_text": "OCRで読み取ったテキスト全文"
  }
  ```
- **受入条件:**
  - 画像からイベント情報が構造化JSONとして返却される
  - 解析中はローディング表示される
  - APIエラー時はエラーメッセージを表示し、リトライ可能

#### SCAN-003: 解析結果プレビュー・編集（P2）

- AI解析結果をプレビュー画面で表示する
- ユーザー（parent）が各項目を確認・修正できる
- 対象メンバー（誰の予定か）を手動で選択する
- **受入条件:**
  - 解析結果が編集可能なフォームで表示される
  - 各項目を修正できる
  - 対象メンバーを選択できる

#### SCAN-004: カレンダー登録確定（P2）

- parentが「登録」ボタンを押すと、解析結果をカレンダーの予定として登録する
- 複数イベントが解析された場合、一括登録できる
- 原本画像をイベントに紐づけて保存する（ARCHIVE連携）
- **受入条件:**
  - 確定操作でカレンダーに予定が登録される
  - 原本画像がイベントに紐づく
  - 登録完了後、カレンダー画面に遷移する

---

### 4.8 学校書類アーカイブ (ARCHIVE)

#### ARCHIVE-001: 書類一覧表示（P2）

- AIスキャンでアップロードされた書類画像を一覧表示する
- フィルタ: メンバー別（娘/息子）、日付範囲
- **受入条件:**
  - 書類画像がサムネイル一覧で表示される
  - メンバー別フィルタが動作する

#### ARCHIVE-002: 書類詳細表示（P2）

- 書類画像の拡大表示
- 紐づくカレンダーイベントへのリンク
- OCR抽出テキストの表示
- **受入条件:**
  - 画像が拡大表示される
  - 紐づくイベントに遷移できる

#### ARCHIVE-003: 書類の手動アップロード（P2）

- AIスキャンを経由せず、書類画像を直接アーカイブにアップロードできる
- メンバー（娘/息子）とメモを設定する
- **受入条件:**
  - 画像をアップロードしてアーカイブに保存できる

---

### 4.9 学校スケジュールハブ (SCHOOL)

#### SCHOOL-001: 年間行事の登録・表示（P2）

- 娘・息子それぞれの学校年間行事を登録・一覧表示する
- カレンダーの予定としても同期する
- **受入条件:**
  - 年間行事を登録できる
  - メンバー別に一覧表示される
  - カレンダー上にも表示される

#### SCHOOL-002: 時間割の登録・表示（P2）

- 曜日ごとの時間割をテーブル形式で登録・表示する
- メンバー（娘/息子）ごとに管理する
- **受入条件:**
  - 時間割を曜日×時限のグリッドで登録できる
  - メンバー別に表示できる

#### SCHOOL-003: 献立表の登録・表示（P2）

- 給食の献立情報を日付ごとに登録・表示する
- AIスキャンで献立表画像から自動抽出も可能（SCAN連携）
- **受入条件:**
  - 日付ごとの献立を登録・表示できる

---

### 4.10 ゲーミフィケーション (GAME)

#### GAME-001: ゴール設定（P3）

- 家族共通のゴール、または個人ゴールを設定する
- ゴールの例: 「今週の予定を全員が確認する」「ToDoを全部完了する」
- 達成条件を定義する（手動完了 or 自動判定）
- **受入条件:**
  - ゴールを作成・編集・削除できる
  - 家族共通/個人の区別ができる

#### GAME-002: 達成度の可視化（P3）

- ゴールに対する進捗をプログレスバーで表示する
- 週間・月間の達成率を表示する
- **受入条件:**
  - プログレスバーが進捗に応じて更新される
  - 週間・月間の切替ができる

#### GAME-003: バッジ・リワード（P3）

- 特定の条件を満たすとバッジを獲得する
  - 例: 「初めてのスキャン」「ToDoコンプリート」「7日連続ログイン」
- バッジ一覧画面で獲得済み/未獲得を表示する
- 獲得時にアニメーション（Framer Motion）で演出する
- **受入条件:**
  - 条件達成時にバッジが付与される
  - アニメーションが再生される
  - バッジ一覧が表示される

---

### 4.11 ストーリー・アルバム (ALBUM)

#### ALBUM-001: 写真アップロード（P3）

- カレンダーのイベントに写真を紐づけてアップロードする
- 写真はTurso DB内にBLOBとして保存する
- **受入条件:**
  - イベントに写真を追加できる
  - 追加した写真がイベント詳細に表示される

#### ALBUM-002: タイムライン表示（P3）

- 月別に写真をタイムライン形式で一覧表示する
- 各写真にイベント名と日付を表示する
- **受入条件:**
  - 月別のタイムラインが表示される
  - 写真タップで拡大表示できる

#### ALBUM-003: 振り返りサマリー（P3）

- 月次・年次で自動サマリーを生成する
- サマリー内容: イベント数、ToDo完了数、バッジ獲得数、写真数
- **受入条件:**
  - 月間サマリーが閲覧できる
  - 年間サマリーが閲覧できる

---

## 5. 非機能要件

### NFR-001: 対応ブラウザ・デバイス（P1）

- **対応ブラウザ:** Chrome（Android）、Safari（iOS）の最新2バージョン
- **対応デバイス:** スマートフォン（主）、タブレット・PC（副）
- レスポンシブデザインで全画面幅に対応する

### NFR-002: PWA対応（P1）

- ホーム画面への追加（Add to Home Screen）に対応する
- Service Workerによる基本的なオフラインフォールバック（オフライン時にキャッシュ済みページを表示）
- Web App Manifestを正しく設定する（アプリ名、アイコン、テーマカラー）

### NFR-003: パフォーマンス（P1）

- 初回読み込み（LCP）: 3秒以内（3G回線想定外、Wi-Fi/4G想定）
- 画面遷移: 1秒以内
- 画像アップロード（10MB）: 10秒以内

### NFR-004: セキュリティ（P1）

- 全通信をHTTPS経由で行う
- 認証はBetter Auth（Google OAuth）で管理し、未認証アクセスはログイン画面にリダイレクトする
- API Routeは全てセッション認証を検証する（`/api/push/send` のみAPIキー認証）
- SQLインジェクション対策: Drizzle ORMのパラメータバインディングを使用する
- XSS対策: Reactの標準エスケープ + `dangerouslySetInnerHTML` を使用しない

### NFR-005: データバックアップ（P1）

- Tursoのビルトインバックアップ機能を利用する
- バックアップ頻度・保持期間はTursoプランに準拠

### NFR-006: アクセシビリティ（P1）

- セマンティックHTML（`<button>`, `<nav>`, `<main>` 等）を使用する
- カラーだけに依存しない情報伝達（ラベル・アイコンを併用）
- フォントサイズ: 最小14px

---

## 6. データモデル

### 6.1 テーブル一覧

以下にDrizzle ORMで定義するテーブルの論理設計を示す。Better Authが自動生成するテーブル（`user`, `session`, `account`）は省略し、アプリ固有テーブルのみ記載する。

#### `family_group` — 家族グループ

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| name | text | NOT NULL | グループ名 |
| invite_code | text | UNIQUE | 招待コード |
| created_at | integer | NOT NULL | 作成日時（Unix ms） |

#### `family_member` — 家族メンバー（Better Auth userの拡張）

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| user_id | text | FK → user.id, UNIQUE | Better Authのuser ID |
| family_group_id | text | FK → family_group.id | 所属グループ |
| display_name | text | NOT NULL | 表示名 |
| role | text | NOT NULL | `parent` or `child` |
| color | text | NOT NULL | テーマカラー HEXコード |
| created_at | integer | NOT NULL | 作成日時 |

#### `event` — カレンダー予定

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| family_group_id | text | FK → family_group.id | 所属グループ |
| title | text | NOT NULL | タイトル |
| date | text | NOT NULL | 日付 `YYYY-MM-DD` |
| start_time | text | | 開始時刻 `HH:mm` |
| end_time | text | | 終了時刻 `HH:mm` |
| all_day | integer | NOT NULL DEFAULT 0 | 終日フラグ |
| memo | text | | メモ |
| category | text | | カテゴリ |
| created_by | text | FK → family_member.id | 作成者 |
| created_at | integer | NOT NULL | 作成日時 |
| updated_at | integer | NOT NULL | 更新日時 |

#### `event_member` — 予定×メンバー（多対多）

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| event_id | text | FK → event.id | 予定ID |
| member_id | text | FK → family_member.id | メンバーID |
| PK | | (event_id, member_id) | 複合主キー |

#### `chat_message` — チャットメッセージ

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| event_id | text | FK → event.id | 紐づくイベント |
| sender_id | text | FK → family_member.id | 送信者 |
| content | text | | テキスト内容 |
| image | blob | | 添付画像（BLOB） |
| created_at | integer | NOT NULL | 送信日時 |

#### `todo` — ToDo

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| family_group_id | text | FK → family_group.id | 所属グループ |
| title | text | NOT NULL | タイトル |
| memo | text | | メモ |
| assignee_id | text | FK → family_member.id | 担当者 |
| due_date | text | | 期限日 `YYYY-MM-DD` |
| category | text | | カテゴリ |
| is_completed | integer | NOT NULL DEFAULT 0 | 完了フラグ |
| completed_at | integer | | 完了日時 |
| created_by | text | FK → family_member.id | 作成者 |
| created_at | integer | NOT NULL | 作成日時 |

#### `stamp` — スタンプ（リアクション）

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| type | text | NOT NULL | スタンプ種別 |
| target_type | text | NOT NULL | `event` or `todo` |
| target_id | text | NOT NULL | 対象ID |
| sender_id | text | FK → family_member.id | 送信者 |
| created_at | integer | NOT NULL | 送信日時 |

#### `push_subscription` — プッシュ通知購読

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| member_id | text | FK → family_member.id | メンバー |
| endpoint | text | NOT NULL | Web Push endpoint |
| p256dh | text | NOT NULL | 公開鍵 |
| auth | text | NOT NULL | 認証シークレット |
| created_at | integer | NOT NULL | 登録日時 |

#### `notification_log` — 通知送信ログ

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| member_id | text | FK → family_member.id | 送信先 |
| target_type | text | NOT NULL | `event` or `todo` or `stamp` |
| target_id | text | NOT NULL | 対象ID |
| sent_at | integer | NOT NULL | 送信日時 |

#### `scanned_document` — スキャン書類

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| family_group_id | text | FK → family_group.id | 所属グループ |
| member_id | text | FK → family_member.id | 対象メンバー（娘/息子） |
| image | blob | NOT NULL | 原本画像（BLOB） |
| ocr_text | text | | OCR抽出テキスト |
| ai_result | text | | AI解析結果（JSON文字列） |
| memo | text | | メモ |
| created_at | integer | NOT NULL | アップロード日時 |

#### `school_timetable` — 時間割

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| member_id | text | FK → family_member.id | 対象メンバー |
| day_of_week | integer | NOT NULL | 曜日（0=月〜4=金） |
| period | integer | NOT NULL | 時限（1〜6） |
| subject | text | NOT NULL | 教科名 |

#### `school_menu` — 給食献立

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| member_id | text | FK → family_member.id | 対象メンバー |
| date | text | NOT NULL | 日付 `YYYY-MM-DD` |
| menu | text | NOT NULL | 献立内容 |

#### `goal` — ゴール

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| family_group_id | text | FK → family_group.id | 所属グループ |
| owner_id | text | FK → family_member.id, NULL | 個人ゴール時のオーナー。NULLは家族共通 |
| title | text | NOT NULL | ゴール名 |
| target_type | text | NOT NULL | 判定方法（`manual` or `auto`） |
| target_value | integer | | 自動判定時の目標値 |
| current_value | integer | NOT NULL DEFAULT 0 | 現在値 |
| is_completed | integer | NOT NULL DEFAULT 0 | 達成フラグ |
| created_at | integer | NOT NULL | 作成日時 |

#### `badge` — バッジ定義

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| name | text | NOT NULL | バッジ名 |
| description | text | NOT NULL | 獲得条件の説明 |
| icon | text | NOT NULL | アイコン識別子 |

#### `member_badge` — メンバー×バッジ（獲得記録）

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| member_id | text | FK → family_member.id | メンバー |
| badge_id | text | FK → badge.id | バッジ |
| earned_at | integer | NOT NULL | 獲得日時 |
| PK | | (member_id, badge_id) | 複合主キー |

#### `album_photo` — アルバム写真

| カラム | 型 | 制約 | 説明 |
|-------|---|------|-----|
| id | text | PK | ULID |
| event_id | text | FK → event.id | 紐づくイベント |
| image | blob | NOT NULL | 写真（BLOB） |
| caption | text | | キャプション |
| uploaded_by | text | FK → family_member.id | アップロード者 |
| created_at | integer | NOT NULL | アップロード日時 |

### 6.2 ER図（概要）

```
family_group 1──* family_member
family_member 1──1 user (Better Auth)
family_member 1──* push_subscription

family_group 1──* event
event *──* family_member (via event_member)
event 1──* chat_message
event 1──* album_photo

family_group 1──* todo
todo *──1 family_member (assignee)

stamp *──1 family_member (sender)
stamp ──> event | todo (polymorphic)

notification_log *──1 family_member

family_group 1──* scanned_document
scanned_document *──1 family_member

family_member 1──* school_timetable
family_member 1──* school_menu

family_group 1──* goal
family_member 1──* member_badge
badge 1──* member_badge
```

---

## 7. 画面一覧・遷移

### 7.1 画面一覧

| # | 画面名 | パス | Phase | 説明 |
|:-:|-------|------|:---:|------|
| 1 | ログイン | `/login` | P1 | Googleログインボタン |
| 2 | 初期セットアップ | `/setup` | P1 | グループ作成 or 招待コード入力 |
| 3 | メインボード | `/` | P1 | 月間カレンダー（デフォルト） |
| 4 | 週間ビュー | `/week` | P1 | 週間タイムライン |
| 5 | 日別ビュー | `/day/[date]` | P1 | 選択日の予定一覧 |
| 6 | 予定作成・編集 | `/events/new`, `/events/[id]/edit` | P1 | 予定フォーム |
| 7 | イベント詳細 | `/events/[id]` | P1 | 予定詳細 + チャット(P2) |
| 8 | 通知センター | `/notifications` | P1 | 通知履歴一覧 |
| 9 | AIスキャナー | `/scan` | P2 | 撮影 → 解析 → 登録フロー |
| 10 | 学校・ToDoハブ | `/hub` | P2 | タブ切替（ToDo / アーカイブ / 時間割 / 献立） |
| 11 | ゴール・リワード | `/goals` | P3 | ゴール一覧 + バッジ |
| 12 | アルバム | `/album` | P3 | 月別タイムライン |
| 13 | 設定 | `/settings` | P1 | プロフィール・通知設定 |

### 7.2 画面遷移図

```
/login → /setup → /（メインボード）

/（メインボード）
├── /week
├── /day/[date]
├── /events/new
├── /events/[id] → /events/[id]/edit
│                → チャット (P2, 同一画面内)
├── /notifications → /events/[id] or /hub
├── /scan → 解析結果 → /events/[id] (P2)
├── /hub (P2)
│   ├── ToDoタブ
│   ├── アーカイブタブ → 書類詳細
│   ├── 時間割タブ
│   └── 献立タブ
├── /goals (P3)
├── /album (P3)
└── /settings
```

---

## 8. 外部連携

### 8.1 OpenAI API

| 項目 | 値 |
|-----|---|
| 用途 | お便り画像のOCR＋構造化抽出 |
| エンドポイント | `POST https://api.openai.com/v1/chat/completions` |
| モデル | `gpt-4o`（または同等のマルチモーダルモデル） |
| 入力 | システムプロンプト + ユーザーメッセージ（画像添付） |
| 出力 | 構造化JSON（SCAN-002参照） |
| 認証 | APIキー（環境変数 `OPENAI_API_KEY`） |
| レート制限 | OpenAIプランに準拠 |

### 8.2 Google OAuth

| 項目 | 値 |
|-----|---|
| 用途 | ユーザー認証 |
| プロバイダー | Google OAuth 2.0 |
| 管理 | Better Authが処理 |
| 必要な設定 | Google Cloud Console でOAuthクライアントID/Secretを取得 |
| 環境変数 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

### 8.3 Web Push

| 項目 | 値 |
|-----|---|
| 用途 | PWAプッシュ通知 |
| プロトコル | Web Push Protocol (RFC 8030) |
| 暗号化 | VAPID認証 |
| 環境変数 | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| ライブラリ | `web-push` (npm) |

### 8.4 Lolipop Cron → Vercel API

| 項目 | 値 |
|-----|---|
| 用途 | 定時プッシュ通知のトリガー |
| 実行スケジュール | 7:00, 12:00, 15:00, 18:00（JST） |
| リクエスト | `POST https://<vercel-domain>/api/push/send` |
| 認証 | `Authorization: Bearer <PUSH_API_SECRET>` |
| 環境変数（Lolipop側） | `PUSH_API_SECRET`, `VERCEL_APP_URL` |

---

## 9. フェーズ別スコープ

### Phase 1: MVP（4〜6週間）

| 要件ID | 要件名 |
|:---:|-------|
| AUTH-001〜005 | 認証・ユーザー管理 全件 |
| CAL-001〜008 | 共有カレンダー 全件 |
| PUSH-001〜004 | プッシュ通知 全件 |
| NFR-001〜006 | 非機能要件 全件 |

**完了条件:** 家族4人がGoogleログインし、予定を作成・閲覧でき、定時通知が届く状態

### Phase 2: v1.0（MVP後 6〜8週間）

| 要件ID | 要件名 |
|:---:|-------|
| CHAT-001〜003 | イベント別チャット |
| TODO-001〜004 | 共有ToDoリスト |
| STAMP-001〜002 | スタンプ・リアクション |
| SCAN-001〜004 | AIプリントスキャン |
| ARCHIVE-001〜003 | 学校書類アーカイブ |
| SCHOOL-001〜003 | 学校スケジュールハブ |

**完了条件:** お便りからAIで予定登録、チャットでの相談、ToDo管理が機能する状態

### Phase 3: v2.0（v1.0後 8〜12週間）

| 要件ID | 要件名 |
|:---:|-------|
| GAME-001〜003 | ゲーミフィケーション |
| ALBUM-001〜003 | ストーリー・アルバム |

**完了条件:** ゴール・バッジ・アルバムが機能し、継続利用を促進する仕組みが整った状態
