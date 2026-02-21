import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "./schema";

export type User = InferSelectModel<typeof schema.user>;
export type NewUser = InferInsertModel<typeof schema.user>;
export type Session = InferSelectModel<typeof schema.session>;
export type FamilyGroup = InferSelectModel<typeof schema.familyGroup>;
export type FamilyMember = InferSelectModel<typeof schema.familyMember>;
export type Event = InferSelectModel<typeof schema.event>;
export type EventMember = InferSelectModel<typeof schema.eventMember>;
export type ChatMessage = InferSelectModel<typeof schema.chatMessage>;
export type NotificationLog = InferSelectModel<typeof schema.notificationLog>;
