import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// ─── Better Auth Required Tables ─────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ─── Fam-Link Domain Tables ─────────────────────────────────

export const familyGroup = sqliteTable("family_group", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const familyMember = sqliteTable("family_member", {
  id: text("id").primaryKey(),
  familyGroupId: text("family_group_id")
    .notNull()
    .references(() => familyGroup.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  role: text("role").notNull(), // papa | mama | daughter | son
  displayName: text("display_name").notNull(),
  color: text("color").notNull(), // blue | pink | yellow | green
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at").notNull(),
});

export const event = sqliteTable("event", {
  id: text("id").primaryKey(),
  familyGroupId: text("family_group_id")
    .notNull()
    .references(() => familyGroup.id),
  createdByMemberId: text("created_by_member_id")
    .notNull()
    .references(() => familyMember.id),
  title: text("title").notNull(),
  description: text("description"),
  startAt: integer("start_at").notNull(),
  endAt: integer("end_at").notNull(),
  isAllDay: integer("is_all_day").default(0),
  location: text("location"),
  source: text("source").default("manual"), // manual | ai_scan
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const eventMember = sqliteTable(
  "event_member",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => event.id),
    memberId: text("member_id")
      .notNull()
      .references(() => familyMember.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.memberId] }),
  })
);

export const chatMessage = sqliteTable("chat_message", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => event.id),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
  content: text("content"),
  stampType: text("stamp_type"), // thanks | ok | cheer | tired | like
  createdAt: integer("created_at").notNull(),
});

export const pushSubscription = sqliteTable("push_subscription", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const notificationLog = sqliteTable("notification_log", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMember.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  relatedId: text("related_id"),
  isRead: integer("is_read").default(0),
  createdAt: integer("created_at").notNull(),
});
