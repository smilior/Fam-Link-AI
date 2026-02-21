# コネクト・ファミリー・ハブ (Fam-Link-AI) 技術設計書

> **プロジェクト名:** コネクト・ファミリー・ハブ (Fam-Link-AI)
> **作成日:** 2026-02-21
> **ステータス:** ドラフト
> **対象読者:** AI Agent（実装担当）
> **関連ドキュメント:** [企画書](./proposal.md) / [機能要件定義書](./requirements.md) / [デザイン要件定義書](./design-requirements.md)

---

## 目次

1. [DB 詳細設計](#1-db-詳細設計)
   - 1.1 [Drizzle スキーマ定義](#11-drizzle-スキーマ定義)
   - 1.2 [リレーション定義](#12-リレーション定義)
   - 1.3 [インデックス戦略](#13-インデックス戦略)
   - 1.4 [マイグレーション方針](#14-マイグレーション方針)
   - 1.5 [初期データ（シード）](#15-初期データシード)
2. [認証・セッション設計](#2-認証セッション設計)
   - 2.1 [Better Auth 構成](#21-better-auth-構成)
   - 2.2 [Google OAuth フロー](#22-google-oauth-フロー)
   - 2.3 [セッション管理](#23-セッション管理)
   - 2.4 [認可ミドルウェア](#24-認可ミドルウェア)
   - 2.5 [CSRF 対策](#25-csrf-対策)
3. [API 仕様](#3-api-仕様)
   - 3.1 [Server Actions vs API Routes 方針](#31-server-actions-vs-api-routes-方針)
   - 3.2 [Server Actions 一覧](#32-server-actions-一覧)
   - 3.3 [API Routes 一覧](#33-api-routes-一覧)
   - 3.4 [データフェッチ（Server Components）](#34-データフェッチserver-components)
4. [エラーハンドリング方針](#4-エラーハンドリング方針)
   - 4.1 [エラーレスポンス形式](#41-エラーレスポンス形式)
   - 4.2 [HTTP ステータスコード体系](#42-http-ステータスコード体系)
   - 4.3 [ユーザー向けエラーメッセージ](#43-ユーザー向けエラーメッセージ)
   - 4.4 [リトライ方針](#44-リトライ方針)
5. [環境変数・インフラ構成](#5-環境変数インフラ構成)
   - 5.1 [システム構成図](#51-システム構成図)
   - 5.2 [環境変数一覧](#52-環境変数一覧)
   - 5.3 [Turso 接続設定](#53-turso-接続設定)
   - 5.4 [Vercel デプロイ設定](#54-vercel-デプロイ設定)
   - 5.5 [Lolipop Cron 設定](#55-lolipop-cron-設定)

---

## 1. DB 詳細設計

### 1.1 Drizzle スキーマ定義

ORM は **Drizzle ORM** (`drizzle-orm` + `drizzle-orm/sqlite-core`) を使用する。DB は **Turso (libSQL)** で、ドライバは `@libsql/client` を使用する。

ID は全テーブルで **ULID** を使用する。生成には `ulid` パッケージを使用する。

タイムスタンプは全て **Unix ミリ秒（integer）** で格納し、Drizzle の `{ mode: 'timestamp_ms' }` で `Date` オブジェクトにマッピングする。

#### ファイル構成

```
src/db/
├── index.ts              # DB クライアント初期化
├── schema/
│   ├── index.ts           # 全スキーマの re-export
│   ├── family.ts          # family_group
│   ├── member.ts          # family_member（Better Auth user 拡張）
│   ├── calendar.ts        # event, event_member
│   ├── chat.ts            # chat_message
│   ├── todo.ts            # todo
│   ├── stamp.ts           # stamp
│   ├── notification.ts    # push_subscription, notification_log
│   ├── scan.ts            # scanned_document
│   ├── school.ts          # school_timetable, school_menu
│   ├── gamification.ts    # goal, badge, member_badge
│   └── album.ts           # album_photo
└── seed.ts                # 初期データ投入
```

> **Better Auth のテーブル** (`user`, `session`, `account`, `verification`) は Better Auth が自動管理する。Drizzle Adapter を通じて同一の DB に作成されるが、スキーマファイルでの明示的な定義は不要。`family_member.user_id` から `user.id` への FK 参照のみ必要。

#### `src/db/schema/family.ts`

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const familyGroup = sqliteTable("family_group", {
  id: text("id").primaryKey(),                    // ULID
  name: text("name").notNull(),
  inviteCode: text("invite_code").unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
```

#### `src/db/schema/member.ts`

```ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { familyGroup } from "./family";

export const familyMember = sqliteTable("family_member", {
  id: text("id").primaryKey(),                    // ULID
  userId: text("user_id").notNull().unique(),     // FK → Better Auth user.id
  familyGroupId: text("family_group_id")
    .notNull()
    .references(() => familyGroup.id),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["parent", "child"] }).notNull(),
  color: text("color").notNull(),                 // HEX コード（例: "#3B82F6"）
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_member_group").on(table.familyGroupId),
]);
```

#### `src/db/schema/calendar.ts`

```ts
import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
import { familyGroup } from "./family";
import { familyMember } from "./member";

export const event = sqliteTable("event", {
  id: text("id").primaryKey(),                    // ULID
  familyGroupId: text("family_group_id")
    .notNull()
    .references(() => familyGroup.id),
  title: text("title").notNull(),
  date: text("date").notNull(),                   // "YYYY-MM-DD"
  startTime: text("start_time"),                  // "HH:mm" — NULL = 終日
  endTime: text("end_time"),                      // "HH:mm"
  allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
  memo: text("memo"),
  category: text("category"),                     // "学校" | "仕事" | "家庭" | "習い事" | "その他"
  createdBy: text("created_by").references(() => familyMember.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_event_group_date").on(table.familyGroupId, table.date),
]);

export const eventMember = sqliteTable("event_member", {
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.memberId] }),
]);
```

#### `src/db/schema/chat.ts`

```ts
import { sqliteTable, text, integer, blob, index } from "drizzle-orm/sqlite-core";
import { event } from "./calendar";
import { familyMember } from "./member";

export const chatMessage = sqliteTable("chat_message", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id, { onDelete: "cascade" }),
  senderId: text("sender_id")
    .notNull()
    .references(() => familyMember.id),
  content: text("content"),
  image: blob("image"),                           // 添付画像（BLOB）
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_chat_event_time").on(table.eventId, table.createdAt),
]);
```

#### `src/db/schema/todo.ts`

```ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { familyGroup } from "./family";
import { familyMember } from "./member";

export const todo = sqliteTable("todo", {
  id: text("id").primaryKey(),
  familyGroupId: text("family_group_id")
    .notNull()
    .references(() => familyGroup.id),
  title: text("title").notNull(),
  memo: text("memo"),
  assigneeId: text("assignee_id").references(() => familyMember.id),
  dueDate: text("due_date"),                      // "YYYY-MM-DD"
  category: text("category"),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdBy: text("created_by").references(() => familyMember.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_todo_group_completed").on(table.familyGroupId, table.isCompleted),
]);
```

#### `src/db/schema/stamp.ts`

```ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { familyMember } from "./member";

export const stamp = sqliteTable("stamp", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),                   // "thanks" | "ok" | "fight" | "otsucare" | "nice"
  targetType: text("target_type").notNull(),       // "event" | "todo"
  targetId: text("target_id").notNull(),
  senderId: text("sender_id")
    .notNull()
    .references(() => familyMember.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_stamp_target").on(table.targetType, table.targetId),
]);
```

#### `src/db/schema/notification.ts`

```ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { familyMember } from "./member";

export const pushSubscription = sqliteTable("push_subscription", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_push_member").on(table.memberId),
]);

export const notificationLog = sqliteTable("notification_log", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
  targetType: text("target_type").notNull(),       // "event" | "todo" | "stamp"
  targetId: text("target_id").notNull(),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_notif_dedup").on(table.memberId, table.targetType, table.targetId),
]);
```

#### `src/db/schema/scan.ts`

```ts
import { sqliteTable, text, integer, blob, index } from "drizzle-orm/sqlite-core";
import { familyGroup } from "./family";
import { familyMember } from "./member";

export const scannedDocument = sqliteTable("scanned_document", {
  id: text("id").primaryKey(),
  familyGroupId: text("family_group_id")
    .notNull()
    .references(() => familyGroup.id),
  memberId: text("member_id").references(() => familyMember.id),
  image: blob("image").notNull(),                 // 原本画像（BLOB）
  ocrText: text("ocr_text"),
  aiResult: text("ai_result"),                    // AI 解析結果（JSON 文字列）
  memo: text("memo"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_scan_group_time").on(table.familyGroupId, table.createdAt),
]);
```

#### `src/db/schema/school.ts`

```ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { familyMember } from "./member";

export const schoolTimetable = sqliteTable("school_timetable", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
  dayOfWeek: integer("day_of_week").notNull(),     // 0=月 〜 4=金
  period: integer("period").notNull(),             // 1〜6
  subject: text("subject").notNull(),
}, (table) => [
  index("idx_timetable_member_day").on(table.memberId, table.dayOfWeek),
]);

export const schoolMenu = sqliteTable("school_menu", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
  date: text("date").notNull(),                    // "YYYY-MM-DD"
  menu: text("menu").notNull(),
}, (table) => [
  index("idx_menu_member_date").on(table.memberId, table.date),
]);
```

#### `src/db/schema/gamification.ts`

```ts
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { familyGroup } from "./family";
import { familyMember } from "./member";

export const goal = sqliteTable("goal", {
  id: text("id").primaryKey(),
  familyGroupId: text("family_group_id")
    .notNull()
    .references(() => familyGroup.id),
  ownerId: text("owner_id").references(() => familyMember.id), // NULL = 家族共通
  title: text("title").notNull(),
  targetType: text("target_type").notNull(),       // "manual" | "auto"
  targetValue: integer("target_value"),
  currentValue: integer("current_value").notNull().default(0),
  isCompleted: integer("is_completed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const badge = sqliteTable("badge", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),                    // Lucide アイコン名
});

export const memberBadge = sqliteTable("member_badge", {
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
  badgeId: text("badge_id")
    .notNull()
    .references(() => badge.id),
  earnedAt: integer("earned_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.memberId, table.badgeId] }),
]);
```

#### `src/db/schema/album.ts`

```ts
import { sqliteTable, text, integer, blob, index } from "drizzle-orm/sqlite-core";
import { event } from "./calendar";
import { familyMember } from "./member";

export const albumPhoto = sqliteTable("album_photo", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => event.id),
  image: blob("image").notNull(),                 // 写真（BLOB）
  caption: text("caption"),
  uploadedBy: text("uploaded_by").references(() => familyMember.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_photo_event").on(table.eventId),
]);
```

#### `src/db/schema/index.ts`

```ts
// 全スキーマの re-export
export * from "./family";
export * from "./member";
export * from "./calendar";
export * from "./chat";
export * from "./todo";
export * from "./stamp";
export * from "./notification";
export * from "./scan";
export * from "./school";
export * from "./gamification";
export * from "./album";
```

---

### 1.2 リレーション定義

Drizzle の `relations()` を使用して、クエリビルダー（`db.query.*`）でリレーションを含むデータを取得できるようにする。

```ts
// src/db/schema/relations.ts
import { relations } from "drizzle-orm";
import { familyGroup } from "./family";
import { familyMember } from "./member";
import { event, eventMember } from "./calendar";
import { chatMessage } from "./chat";
import { todo } from "./todo";
import { stamp } from "./stamp";
import { pushSubscription, notificationLog } from "./notification";
import { scannedDocument } from "./scan";
import { schoolTimetable, schoolMenu } from "./school";
import { goal, badge, memberBadge } from "./gamification";
import { albumPhoto } from "./album";

// --- family_group ---
export const familyGroupRelations = relations(familyGroup, ({ many }) => ({
  members: many(familyMember),
  events: many(event),
  todos: many(todo),
  goals: many(goal),
  scannedDocuments: many(scannedDocument),
}));

// --- family_member ---
export const familyMemberRelations = relations(familyMember, ({ one, many }) => ({
  familyGroup: one(familyGroup, {
    fields: [familyMember.familyGroupId],
    references: [familyGroup.id],
  }),
  eventMembers: many(eventMember),
  chatMessages: many(chatMessage),
  stamps: many(stamp),
  pushSubscriptions: many(pushSubscription),
  badges: many(memberBadge),
}));

// --- event ---
export const eventRelations = relations(event, ({ one, many }) => ({
  familyGroup: one(familyGroup, {
    fields: [event.familyGroupId],
    references: [familyGroup.id],
  }),
  createdByMember: one(familyMember, {
    fields: [event.createdBy],
    references: [familyMember.id],
  }),
  members: many(eventMember),
  chatMessages: many(chatMessage),
  photos: many(albumPhoto),
}));

// --- event_member ---
export const eventMemberRelations = relations(eventMember, ({ one }) => ({
  event: one(event, {
    fields: [eventMember.eventId],
    references: [event.id],
  }),
  member: one(familyMember, {
    fields: [eventMember.memberId],
    references: [familyMember.id],
  }),
}));

// --- chat_message ---
export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  event: one(event, {
    fields: [chatMessage.eventId],
    references: [event.id],
  }),
  sender: one(familyMember, {
    fields: [chatMessage.senderId],
    references: [familyMember.id],
  }),
}));

// --- todo ---
export const todoRelations = relations(todo, ({ one }) => ({
  familyGroup: one(familyGroup, {
    fields: [todo.familyGroupId],
    references: [familyGroup.id],
  }),
  assignee: one(familyMember, {
    fields: [todo.assigneeId],
    references: [familyMember.id],
    relationName: "assignee",
  }),
  createdByMember: one(familyMember, {
    fields: [todo.createdBy],
    references: [familyMember.id],
    relationName: "creator",
  }),
}));

// --- stamp ---
export const stampRelations = relations(stamp, ({ one }) => ({
  sender: one(familyMember, {
    fields: [stamp.senderId],
    references: [familyMember.id],
  }),
}));

// --- member_badge ---
export const memberBadgeRelations = relations(memberBadge, ({ one }) => ({
  member: one(familyMember, {
    fields: [memberBadge.memberId],
    references: [familyMember.id],
  }),
  badge: one(badge, {
    fields: [memberBadge.badgeId],
    references: [badge.id],
  }),
}));

// --- album_photo ---
export const albumPhotoRelations = relations(albumPhoto, ({ one }) => ({
  event: one(event, {
    fields: [albumPhoto.eventId],
    references: [event.id],
  }),
  uploader: one(familyMember, {
    fields: [albumPhoto.uploadedBy],
    references: [familyMember.id],
  }),
}));
```

---

### 1.3 インデックス戦略

各テーブルのインデックスは主要なクエリパターンに基づいて設計する。

| テーブル | インデックス名 | カラム | クエリパターン |
|---------|-------------|-------|------------|
| `family_member` | `idx_member_group` | `family_group_id` | グループの全メンバー取得 |
| `event` | `idx_event_group_date` | `family_group_id, date` | 月間・週間・日別のイベント取得 |
| `chat_message` | `idx_chat_event_time` | `event_id, created_at` | イベント別チャット履歴取得 |
| `todo` | `idx_todo_group_completed` | `family_group_id, is_completed` | 未完了 / 完了済み ToDo 取得 |
| `stamp` | `idx_stamp_target` | `target_type, target_id` | 特定イベント / ToDo のスタンプ取得 |
| `push_subscription` | `idx_push_member` | `member_id` | メンバーの全購読情報取得 |
| `notification_log` | `idx_notif_dedup` | `member_id, target_type, target_id` | 通知重複チェック |
| `scanned_document` | `idx_scan_group_time` | `family_group_id, created_at` | アーカイブ一覧（新しい順） |
| `school_timetable` | `idx_timetable_member_day` | `member_id, day_of_week` | 曜日別の時間割取得 |
| `school_menu` | `idx_menu_member_date` | `member_id, date` | 日付別の献立取得 |
| `album_photo` | `idx_photo_event` | `event_id` | イベントの写真取得 |

> **注意:** SQLite（Turso）では PK に自動で B-tree インデックスが作成される。UNIQUE 制約にもインデックスが自動作成される。上記は追加で明示的に作成するインデックスのみ。

---

### 1.4 マイグレーション方針

#### ツール

`drizzle-kit` を使用する。

```bash
# パッケージインストール
bun add drizzle-orm @libsql/client
bun add -D drizzle-kit
```

#### 環境別戦略

| 環境 | コマンド | 説明 |
|-----|---------|------|
| **開発** | `bunx drizzle-kit push` | スキーマを直接 DB にプッシュ（マイグレーションファイル不要、高速） |
| **本番** | `bunx drizzle-kit generate` → `bunx drizzle-kit migrate` | SQL マイグレーションファイルを生成し、適用 |

#### `drizzle.config.ts`

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",                    // マイグレーションファイル出力先
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

#### マイグレーションファイル管理

```
drizzle/
├── 0000_initial.sql          # 初回マイグレーション
├── 0001_add_album.sql        # 以降の変更
├── meta/
│   └── _journal.json         # drizzle-kit が管理するメタ情報
└── ...
```

- マイグレーションファイルは Git にコミットする
- **手動編集は禁止** — `drizzle-kit generate` で自動生成されたファイルのみ使用
- ロールバックが必要な場合は、逆のマイグレーションを手動で作成して `drizzle-kit migrate` で適用

---

### 1.5 初期データ（シード）

#### バッジマスタデータ

`badge` テーブルに全 7 種のバッジを投入する。（`design-requirements.md` セクション 2.7 に準拠）

```ts
// src/db/seed.ts
import { db } from "./index";
import { badge } from "./schema";
import { ulid } from "ulid";

const BADGE_SEEDS = [
  { name: "はじめの一歩",     description: "初回ログイン",                   icon: "Footprints" },
  { name: "スキャンマスター",  description: "AIスキャンを初めて完了",          icon: "ScanLine" },
  { name: "ToDoコンプリート", description: "ToDoを10個完了",                 icon: "CheckCircle" },
  { name: "カレンダーキング",  description: "予定を30個作成",                 icon: "Crown" },
  { name: "ファミリーヒーロー", description: "スタンプを10回送信",             icon: "Heart" },
  { name: "連続ログイン7日",   description: "7日連続でアプリを使用",           icon: "Flame" },
  { name: "アルバムマスター",  description: "写真を10枚アップロード",          icon: "Camera" },
];

export async function seed() {
  for (const b of BADGE_SEEDS) {
    await db.insert(badge).values({
      id: ulid(),
      ...b,
    }).onConflictDoNothing();
  }
}
```

#### 実行方法

```bash
# 開発時
bunx tsx src/db/seed.ts
```

> **スタンプ種別** (`thanks`, `ok`, `fight`, `otsucare`, `nice`) はマスタテーブルを持たず、`stamp.type` カラムにアプリケーション定数として管理する。

---

## 2. 認証・セッション設計

### 2.1 Better Auth 構成

**Better Auth** (`better-auth`) を使用し、Drizzle Adapter 経由で Turso に接続する。

#### サーバー設定

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,   // 30 日（秒単位）
    updateAge: 60 * 60 * 24,          // 24 時間ごとにセッション更新
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,                 // 5 分間クッキーキャッシュ
    },
  },
  advanced: {
    cookiePrefix: "fam-link",
    // Vercel + HTTPS 環境でのクッキー設定
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});
```

#### クライアント設定

```ts
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signOut, useSession } = authClient;
```

#### API Route ハンドラ

```ts
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

#### Better Auth が自動管理するテーブル

| テーブル | 用途 | 主要カラム |
|---------|------|----------|
| `user` | ユーザーマスタ | `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt` |
| `session` | セッション | `id`, `token`, `expiresAt`, `userId`, `ipAddress`, `userAgent` |
| `account` | OAuth アカウント | `id`, `accountId`, `providerId`, `userId`, `accessToken`, `refreshToken` |
| `verification` | メール検証トークン | `id`, `identifier`, `value`, `expiresAt` |

---

### 2.2 Google OAuth フロー

```
1. ユーザーが「Googleでログイン」ボタンをタップ
   └→ authClient.signIn.social({ provider: "google" })

2. Better Auth がリダイレクト URL を生成
   └→ Google OAuth 同意画面へリダイレクト

3. ユーザーが Google アカウントを選択・承認
   └→ Google が認可コードを /api/auth/callback/google に返却

4. Better Auth がコールバックを処理
   ├→ 認可コードをアクセストークンに交換
   ├→ Google ユーザー情報を取得
   ├→ user テーブルに upsert
   ├→ account テーブルに Google アカウントを保存
   └→ session テーブルにセッションを作成

5. セッションクッキーをセットしてリダイレクト
   ├→ family_member レコードが存在する場合 → `/` (メインボード)
   └→ family_member レコードが存在しない場合 → `/setup` (初期セットアップ)
```

**リダイレクト判定ロジック:**

```ts
// ログイン後のリダイレクト
async function getPostLoginRedirect(userId: string): Promise<string> {
  const member = await db.query.familyMember.findFirst({
    where: eq(familyMember.userId, userId),
  });
  return member ? "/" : "/setup";
}
```

---

### 2.3 セッション管理

| 項目 | 仕様 |
|-----|------|
| セッション保持期間 | 30 日 |
| セッション更新 | 24 時間ごとに `expiresAt` を延長 |
| クッキー名 | `fam-link.session_token` |
| `Secure` | 本番: `true` / 開発: `false` |
| `HttpOnly` | `true`（Better Auth デフォルト） |
| `SameSite` | `Lax`（Better Auth デフォルト） |
| `Path` | `/` |

#### サーバーサイドでのセッション取得

```ts
// Server Component / Server Action 内
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session; // { user, session } | null
}
```

#### 現在のメンバー情報取得ヘルパー

```ts
// src/lib/get-current-member.ts
import { db } from "@/db";
import { familyMember } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "./get-session";

export async function getCurrentMember() {
  const session = await getSession();
  if (!session) return null;

  return db.query.familyMember.findFirst({
    where: eq(familyMember.userId, session.user.id),
    with: { familyGroup: true },
  });
}
```

---

### 2.4 認可ミドルウェア

#### Next.js Middleware（ルートレベル）

```ts
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth"];
const SETUP_PATH = "/setup";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開パスはスキップ
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // セッションクッキーの存在チェック（軽量チェック）
  const sessionToken = request.cookies.get("fam-link.session_token");
  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)"],
};
```

> **注意:** Middleware はクッキーの存在のみチェックする。実際のセッション検証は Server Component / Server Action 内で `getSession()` を使用する。

#### Server Action 用 認可ヘルパー

```ts
// src/lib/authorize.ts
import { getCurrentMember } from "./get-current-member";

type Role = "parent" | "child";

/** 認証済みメンバー情報を取得。未認証の場合はエラーをスロー */
export async function requireAuth() {
  const member = await getCurrentMember();
  if (!member) throw new Error("UNAUTHORIZED");
  return member;
}

/** 特定ロールを要求。権限不足の場合はエラーをスロー */
export async function requireRole(role: Role) {
  const member = await requireAuth();
  if (member.role !== role) throw new Error("FORBIDDEN");
  return member;
}

/** parent ロールを要求 */
export async function requireParent() {
  return requireRole("parent");
}
```

#### 権限チェックの適用パターン

```ts
// Server Action の例
"use server";
import { requireAuth, requireParent } from "@/lib/authorize";

// 全員アクセス可能
export async function createEvent(formData: FormData) {
  const member = await requireAuth();
  // ... 予定作成
}

// parent のみ
export async function confirmScanResults(results: ScanResult[]) {
  const member = await requireParent();
  // ... スキャン結果確定
}

// 自分の予定のみ編集可能（child の場合）
export async function updateEvent(eventId: string, formData: FormData) {
  const member = await requireAuth();
  if (member.role === "child") {
    const isOwner = await checkEventOwnership(eventId, member.id);
    if (!isOwner) throw new Error("FORBIDDEN");
  }
  // ... 予定更新
}
```

---

### 2.5 CSRF 対策

| 項目 | 仕様 |
|-----|------|
| Server Actions | Next.js が自動で CSRF トークンを管理（`action` 属性の POST リクエストに CSRF トークンが含まれる） |
| API Routes (`/api/push/send`) | CSRF 保護不要（Bearer Token 認証のため、ブラウザからの直接リクエストではない） |
| Better Auth Routes (`/api/auth/*`) | Better Auth が内部で CSRF 保護を実装済み |

> Next.js App Router の Server Actions は、Origin ヘッダーの検証を自動で行うため、追加の CSRF 対策は不要。

---

## 3. API 仕様

### 3.1 Server Actions vs API Routes 方針

| 種別 | 用途 | 認証方式 |
|-----|------|---------|
| **Server Actions** | ユーザー操作に伴う全ミューテーション（CRUD） | セッション認証（`getSession()`） |
| **API Routes** | 外部からの HTTP リクエスト（Cron、Webhook） | Bearer Token / Better Auth |
| **Server Components** | データ取得（読み込み専用） | セッション認証（`getSession()`） |

**原則:**
- ブラウザからのデータ更新 → **Server Actions**（`"use server"`）
- 外部システムからの呼び出し → **API Routes**（`app/api/*/route.ts`）
- 画面表示用のデータ取得 → **Server Components** 内で直接 DB クエリ

---

### 3.2 Server Actions 一覧

#### 共通型定義

```ts
// src/types/action.ts
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
```

#### カレンダー (`src/actions/calendar.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `createEvent(formData)` | タイトル, 日付, 時刻, メンバーID[], カテゴリ, メモ | `ActionResult<Event>` | 全員 | CAL-001 |
| `updateEvent(eventId, formData)` | 同上 | `ActionResult<Event>` | parent: 全予定 / child: 自分の予定のみ | CAL-002 |
| `deleteEvent(eventId)` | イベントID | `ActionResult` | parent: 全予定 / child: 自分の予定のみ | CAL-003 |

#### ToDo (`src/actions/todo.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `createTodo(formData)` | タイトル, メモ, 担当者ID, 期限, カテゴリ | `ActionResult<Todo>` | 全員 | TODO-001 |
| `updateTodo(todoId, formData)` | 同上 | `ActionResult<Todo>` | 全員 | TODO-002 |
| `deleteTodo(todoId)` | ToDo ID | `ActionResult` | 全員 | TODO-002 |
| `toggleTodo(todoId)` | ToDo ID | `ActionResult<Todo>` | 全員 | TODO-003 |

#### チャット (`src/actions/chat.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `sendMessage(eventId, formData)` | テキスト, 画像(optional) | `ActionResult<ChatMessage>` | 全員 | CHAT-002, CHAT-003 |

#### スタンプ (`src/actions/stamp.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `sendStamp(targetType, targetId, type)` | 対象種別, 対象ID, スタンプ種別 | `ActionResult<Stamp>` | 全員 | STAMP-001 |

#### スキャン (`src/actions/scan.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `analyzeScan(formData)` | 画像ファイル | `ActionResult<ScanResult[]>` | 全員（撮影・解析まで） | SCAN-001, SCAN-002 |
| `confirmScanResults(results)` | 解析結果配列 | `ActionResult<Event[]>` | **parent のみ** | SCAN-003, SCAN-004 |
| `uploadDocument(formData)` | 画像ファイル, メンバーID, メモ | `ActionResult<ScannedDocument>` | 全員 | ARCHIVE-003 |

#### 家族・認証 (`src/actions/family.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `createFamilyGroup(formData)` | グループ名 | `ActionResult<FamilyGroup>` | 全員（未所属時） | AUTH-002 |
| `joinFamilyGroup(inviteCode)` | 招待コード | `ActionResult` | 全員（未所属時） | AUTH-003 |
| `updateProfile(formData)` | 表示名, カラー | `ActionResult` | 全員（自分のみ） | AUTH-004 |

#### 学校 (`src/actions/school.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `updateTimetable(memberId, entries)` | メンバーID, 時間割エントリ配列 | `ActionResult` | parent | SCHOOL-001 |
| `updateMenu(memberId, entries)` | メンバーID, 献立エントリ配列 | `ActionResult` | parent | SCHOOL-003 |

#### ゲーミフィケーション (`src/actions/gamification.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `createGoal(formData)` | タイトル, 目標値, オーナーID(optional) | `ActionResult<Goal>` | 全員 | GAME-001 |
| `updateGoalProgress(goalId, value)` | ゴールID, 現在値 | `ActionResult<Goal>` | 全員 | GAME-002 |

#### アルバム (`src/actions/album.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `uploadPhoto(eventId, formData)` | イベントID, 画像ファイル, キャプション | `ActionResult<AlbumPhoto>` | 全員 | ALBUM-001 |
| `deletePhoto(photoId)` | 写真ID | `ActionResult` | 全員（自分がアップロードした写真のみ） | — |

#### プッシュ通知 (`src/actions/notification.ts`)

| アクション | 入力 | 出力 | 権限 | 対応要件 |
|-----------|------|------|------|---------|
| `subscribePush(subscription)` | PushSubscription オブジェクト | `ActionResult` | 全員 | PUSH-001 |
| `unsubscribePush()` | — | `ActionResult` | 全員 | PUSH-001 |

---

### 3.3 API Routes 一覧

#### `POST /api/push/send` — 定時プッシュ通知送信

**対応要件:** PUSH-002, PUSH-003

```
リクエスト:
  Headers:
    Authorization: Bearer <PUSH_API_SECRET>
  Body: なし（定時バッチのため）

レスポンス:
  200: { sent: number, errors: number }
  401: { error: "Unauthorized" }
  500: { error: "Internal Server Error" }
```

**処理フロー:**

```
1. Bearer Token を検証
2. 全家族グループを取得
3. 各グループについて:
   a. 当日の未通知イベントを取得
   b. 翌日のイベントを取得
   c. 期限が近い ToDo（当日・翌日）を取得
4. 各メンバーについて:
   a. notification_log を確認し、未送信の通知を特定
   b. push_subscription を取得
   c. Web Push API でペイロードを送信
   d. notification_log に記録
5. 送信結果を返却
```

**通知ペイロード形式:**

```ts
interface PushPayload {
  title: string;       // "📅 明日の予定" | "✅ ToDoの期限"
  body: string;        // "授業参観 14:00 - ママ, 娘"
  icon: string;        // "/icons/icon-192.png"
  tag: string;         // "event-{id}" — 同一タグで通知を上書き
  data: {
    url: string;       // タップ時の遷移先 "/events/{id}" | "/hub"
  };
}
```

#### `GET/POST /api/auth/[...all]` — Better Auth ハンドラ

Better Auth が管理する認証エンドポイント群。ルーティングは Better Auth に委譲する。

| パス | 用途 |
|-----|------|
| `GET /api/auth/get-session` | セッション取得 |
| `POST /api/auth/sign-in/social` | ソーシャルログイン開始 |
| `GET /api/auth/callback/google` | Google OAuth コールバック |
| `POST /api/auth/sign-out` | ログアウト |

---

### 3.4 データフェッチ（Server Components）

Server Components 内で直接 DB クエリを実行する関数群。

#### ファイル構成

```
src/queries/
├── calendar.ts       # イベント取得
├── todo.ts           # ToDo 取得
├── chat.ts           # チャットメッセージ取得
├── notification.ts   # 通知取得
├── family.ts         # 家族メンバー取得
├── school.ts         # 時間割・献立取得
├── gamification.ts   # ゴール・バッジ取得
├── album.ts          # アルバム写真取得
└── scan.ts           # スキャン書類取得
```

#### 主要クエリ関数

| 関数 | 引数 | 戻り値 | 用途 |
|-----|------|-------|------|
| `getEventsByMonth(groupId, year, month)` | グループID, 年, 月 | `Event[]` (with members) | 月間カレンダー表示 |
| `getEventsByDateRange(groupId, start, end)` | グループID, 開始日, 終了日 | `Event[]` (with members) | 週間・日別表示 |
| `getEventDetail(eventId)` | イベントID | `Event` (with members, stamps, photos) | イベント詳細画面 |
| `getTodos(groupId, completed?)` | グループID, 完了フラグ(optional) | `Todo[]` (with assignee) | ToDo リスト |
| `getChatMessages(eventId)` | イベントID | `ChatMessage[]` (with sender) | チャットスレッド |
| `getNotifications(memberId)` | メンバーID | `NotificationLog[]` | 通知センター |
| `getFamilyMembers(groupId)` | グループID | `FamilyMember[]` | メンバーフィルタ・セレクター |
| `getTimetable(memberId)` | メンバーID | `SchoolTimetable[]` | 時間割表示 |
| `getMenusByMonth(memberId, year, month)` | メンバーID, 年, 月 | `SchoolMenu[]` | 給食献立表示 |
| `getGoals(groupId)` | グループID | `Goal[]` | ゴール一覧 |
| `getBadgesForMember(memberId)` | メンバーID | `MemberBadge[]` (with badge) | バッジコレクション |
| `getAlbumPhotos(groupId, year?, month?)` | グループID, 年(optional), 月(optional) | `AlbumPhoto[]` (with event) | アルバムタイムライン |
| `getScannedDocuments(groupId)` | グループID | `ScannedDocument[]` | 書類アーカイブ |

#### クエリ関数の実装例

```ts
// src/queries/calendar.ts
import { db } from "@/db";
import { event, eventMember, familyMember } from "@/db/schema";
import { and, eq, gte, lte, like } from "drizzle-orm";

export async function getEventsByMonth(
  groupId: string,
  year: number,
  month: number
) {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return db.query.event.findMany({
    where: and(
      eq(event.familyGroupId, groupId),
      like(event.date, `${prefix}%`)
    ),
    with: {
      members: { with: { member: true } },
    },
    orderBy: [event.date, event.startTime],
  });
}
```

---

## 4. エラーハンドリング方針

### 4.1 エラーレスポンス形式

#### Server Actions

Server Actions は `ActionResult<T>` 型で結果を返却する。例外をスローせず、成功/失敗を明示的に返す。

```ts
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: ErrorCode };

type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL_API_ERROR"
  | "INTERNAL_ERROR";
```

**実装パターン:**

```ts
"use server";
export async function createEvent(formData: FormData): Promise<ActionResult<Event>> {
  try {
    const member = await requireAuth();
    // バリデーション
    const title = formData.get("title") as string;
    if (!title) return { success: false, error: "タイトルを入力してください", code: "VALIDATION_ERROR" };
    // DB 操作
    const newEvent = await db.insert(event).values({ ... }).returning();
    return { success: true, data: newEvent[0] };
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return { success: false, error: "ログインが必要です", code: "UNAUTHORIZED" };
    }
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return { success: false, error: "権限がありません", code: "FORBIDDEN" };
    }
    console.error("createEvent error:", e);
    return { success: false, error: "予定の作成に失敗しました", code: "INTERNAL_ERROR" };
  }
}
```

#### API Routes

API Routes は標準的な HTTP ステータスコード + JSON レスポンスを返す。

```ts
// エラーレスポンス形式
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key",
  "code": "UNAUTHORIZED"
}
```

---

### 4.2 HTTP ステータスコード体系

| コード | 意味 | 使用場面 |
|:---:|------|---------|
| `200` | 成功 | 正常な GET / POST レスポンス |
| `400` | Bad Request | バリデーションエラー、不正なパラメータ |
| `401` | Unauthorized | 未認証、無効なセッション / API キー |
| `403` | Forbidden | 権限不足（child が parent 専用操作を実行等） |
| `404` | Not Found | 存在しないリソースへのアクセス |
| `409` | Conflict | 重複データ（同一招待コードでの二重参加等） |
| `413` | Payload Too Large | 画像アップロードサイズ超過（10MB 超） |
| `429` | Too Many Requests | レート制限超過（OpenAI API 等） |
| `500` | Internal Server Error | 予期しないサーバーエラー |
| `503` | Service Unavailable | 外部 API（OpenAI）が利用不可 |

---

### 4.3 ユーザー向けエラーメッセージ

| エラーコード | ユーザー表示メッセージ | トースト種別 |
|-----------|-------------------|:---:|
| `UNAUTHORIZED` | ログインが必要です | Error |
| `FORBIDDEN` | この操作を行う権限がありません | Error |
| `NOT_FOUND` | データが見つかりません | Error |
| `VALIDATION_ERROR` | （フィールド別の具体的メッセージ） | Warning |
| `CONFLICT` | すでに登録されています | Warning |
| `RATE_LIMITED` | しばらく待ってからもう一度お試しください | Warning |
| `EXTERNAL_API_ERROR` | サービスに一時的な問題が発生しています。もう一度お試しください | Error |
| `INTERNAL_ERROR` | 予期しないエラーが発生しました | Error |
| ネットワークエラー | 通信に失敗しました。接続を確認してください | Error |

**フィールド別バリデーションメッセージ:**

| フィールド | ルール | メッセージ |
|-----------|-------|----------|
| タイトル（予定/ToDo） | 必須, 1〜100文字 | 「タイトルを入力してください」 |
| 日付 | 必須, YYYY-MM-DD | 「日付を入力してください」 |
| 時刻 | HH:mm 形式 | 「正しい時刻を入力してください」 |
| 画像 | 最大 10MB, JPEG/PNG/WebP | 「画像は10MB以下のJPEG/PNG/WebPファイルを選択してください」 |
| 招待コード | 必須, 存在チェック | 「招待コードが見つかりません」 |
| グループ名 | 必須, 1〜50文字 | 「グループ名を入力してください」 |

---

### 4.4 リトライ方針

| 対象 | リトライ回数 | 間隔 | 備考 |
|-----|:---:|------|------|
| OpenAI API (`analyzeScan`) | 2 回 | 2 秒 → 4 秒（指数バックオフ） | `429` / `500` / `503` のみリトライ |
| Web Push 送信 | 1 回 | 3 秒後 | `410 Gone`（購読失効）の場合は購読レコードを削除 |
| Turso DB 接続 | 3 回 | 1 秒 → 2 秒 → 4 秒 | `@libsql/client` の組み込みリトライを利用 |
| ユーザー操作（Server Actions） | 0 回 | — | ユーザーに再試行ボタンを表示（自動リトライしない） |

**OpenAI API リトライ実装例:**

```ts
async function callOpenAI(imageBase64: string, retries = 2): Promise<ScanResult[]> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({ ... });
      return parseScanResponse(response);
    } catch (error) {
      if (attempt === retries) throw error;
      const status = (error as any)?.status;
      if (![429, 500, 503].includes(status)) throw error;
      await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
    }
  }
  throw new Error("Unreachable");
}
```

**Web Push 購読失効処理:**

```ts
async function sendPushToMember(memberId: string, payload: PushPayload) {
  const subscriptions = await getSubscriptions(memberId);
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (error) {
      if ((error as any)?.statusCode === 410) {
        // 購読が失効 → DB から削除
        await db.delete(pushSubscription).where(eq(pushSubscription.id, sub.id));
      }
    }
  }
}
```

---

## 5. 環境変数・インフラ構成

### 5.1 システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                         ユーザー                             │
│                    (スマホ / PC ブラウザ)                      │
│                        PWA (Service Worker)                  │
└───────────┬────────────────────────────┬────────────────────┘
            │ HTTPS                      │ Web Push
            ▼                            ▼
┌──────────────────────┐    ┌──────────────────────┐
│   Vercel (Next.js)   │    │   Web Push Service   │
│                      │    │  (FCM / APNs 等)     │
│  ┌────────────────┐  │    └──────────────────────┘
│  │ App Router     │  │                ▲
│  │ (SSR / RSC)    │  │                │
│  ├────────────────┤  │    ┌──────────────────────┐
│  │ Server Actions │  │    │   web-push (npm)     │
│  ├────────────────┤  │◄───┤   VAPID 認証         │
│  │ API Routes     │──┤    └──────────────────────┘
│  │ /api/push/send │  │
│  │ /api/auth/*    │  │
│  └────────────────┘  │
│          │           │
│          ▼           │
│  ┌────────────────┐  │    ┌──────────────────────┐
│  │ Drizzle ORM    │──┼───►│   Turso (libSQL)     │
│  │ @libsql/client │  │    │   エッジ DB           │
│  └────────────────┘  │    │   BLOB ストレージ兼用  │
│          │           │    └──────────────────────┘
│          ▼           │
│  ┌────────────────┐  │    ┌──────────────────────┐
│  │ OpenAI Client  │──┼───►│   OpenAI API         │
│  │ (GPT-4o)       │  │    │   画像 → OCR + 構造化 │
│  └────────────────┘  │    └──────────────────────┘
└──────────────────────┘
            ▲
            │ POST /api/push/send
            │ (Bearer Token)
┌──────────────────────┐
│   Lolipop Server     │
│   Cron Job           │
│   7:00/12:00/15:00   │
│   /18:00 JST         │
└──────────────────────┘
```

---

### 5.2 環境変数一覧

#### `.env.local`（ローカル開発用）

```bash
# ── Turso ──
TURSO_DATABASE_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"

# ── Better Auth ──
BETTER_AUTH_SECRET="random-32-char-secret"       # セッション暗号化キー
BETTER_AUTH_URL="http://localhost:3000"           # 開発環境のベース URL

# ── Google OAuth ──
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ── OpenAI ──
OPENAI_API_KEY="sk-..."

# ── Web Push (VAPID) ──
VAPID_PUBLIC_KEY="BPx..."                         # Base64
VAPID_PRIVATE_KEY="..."                            # Base64
VAPID_SUBJECT="mailto:admin@example.com"

# ── Push API ──
PUSH_API_SECRET="random-secret-for-cron"          # Lolipop → Vercel の認証

# ── App ──
NEXT_PUBLIC_APP_URL="http://localhost:3000"        # クライアントから参照
```

#### Vercel 環境変数（本番）

| 変数名 | スコープ | 説明 |
|--------|---------|------|
| `TURSO_DATABASE_URL` | Production, Preview | Turso 本番 DB URL |
| `TURSO_AUTH_TOKEN` | Production, Preview | Turso 認証トークン |
| `BETTER_AUTH_SECRET` | Production | セッション暗号化キー（本番専用、開発と異なる値） |
| `BETTER_AUTH_URL` | Production | `https://your-domain.vercel.app` |
| `GOOGLE_CLIENT_ID` | Production, Preview | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Production, Preview | Google OAuth Client Secret |
| `OPENAI_API_KEY` | Production | OpenAI API キー |
| `VAPID_PUBLIC_KEY` | Production | VAPID 公開鍵 |
| `VAPID_PRIVATE_KEY` | Production | VAPID 秘密鍵 |
| `VAPID_SUBJECT` | Production | VAPID サブジェクト |
| `PUSH_API_SECRET` | Production | Cron → API の認証シークレット |
| `NEXT_PUBLIC_APP_URL` | Production, Preview | アプリの公開 URL |

> **VAPID キーペアの生成:** `bunx web-push generate-vapid-keys`

---

### 5.3 Turso 接続設定

#### DB クライアント初期化

```ts
// src/db/index.ts
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

#### 接続仕様

| 項目 | 仕様 |
|-----|------|
| プロトコル | libSQL over HTTPS |
| 認証 | Auth Token（Turso ダッシュボードで生成） |
| リトライ | `@libsql/client` 組み込み（3 回、指数バックオフ） |
| BLOB 上限 | Turso の行サイズ上限に準拠（デフォルト 2GB/行）。画像は 10MB 以下に制限（NFR-003） |
| 同時接続 | Serverless 環境のため接続プーリングは不要（リクエストごとに接続） |

---

### 5.4 Vercel デプロイ設定

#### プロジェクト設定

| 項目 | 値 |
|-----|---|
| Framework | Next.js (Auto-detected) |
| Build Command | `bun run build` |
| Output Directory | `.next` |
| Install Command | `bun install` |
| Node.js Version | 20.x |
| Root Directory | `.` |

#### `next.config.ts` の本番設定

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 画像最適化（BLOB から直接配信するため外部ドメインは不要）
  images: {
    unoptimized: true, // BLOB 画像は Next.js Image 最適化の対象外
  },
};

export default nextConfig;
```

#### デプロイフロー

```
1. develop ブランチで開発
2. PR を main ブランチへ作成
3. Vercel が Preview デプロイを自動実行
4. レビュー・承認後に main にマージ
5. Vercel が Production デプロイを自動実行
6. 本番デプロイ後、必要に応じてマイグレーション実行:
   bunx drizzle-kit migrate
```

---

### 5.5 Lolipop Cron 設定

#### Cron ジョブ設定

| 項目 | 値 |
|-----|---|
| 実行スケジュール | `0 7,12,15,18 * * *`（毎日 7:00 / 12:00 / 15:00 / 18:00 JST） |
| 実行コマンド | `curl -X POST -H "Authorization: Bearer $PUSH_API_SECRET" https://<vercel-domain>/api/push/send` |
| タイムアウト | 30 秒 |

#### Lolipop 側の環境変数

| 変数名 | 説明 |
|--------|------|
| `PUSH_API_SECRET` | Vercel API 認証トークン（Vercel 側と同一の値） |
| `VERCEL_APP_URL` | `https://your-domain.vercel.app` |

#### セキュリティ

- Lolipop → Vercel 間は HTTPS で通信
- `Authorization: Bearer` ヘッダーで認証（API キー一致確認）
- Vercel 側の `/api/push/send` で Bearer Token を検証:

```ts
// src/app/api/push/send/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Bearer Token 検証
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.PUSH_API_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 通知送信処理
  try {
    const result = await sendScheduledNotifications();
    return NextResponse.json({ sent: result.sent, errors: result.errors });
  } catch (error) {
    console.error("Push send error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```
