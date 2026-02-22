"use server";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/actions/family";

export async function getNotifications() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  const db = getDb();
  const memberId = member.id;
  return db
    .select()
    .from(schema.notificationLog)
    .where(
      and(
        eq(schema.notificationLog.memberId, memberId),
        eq(schema.notificationLog.isRead, 0)
      )
    )
    .orderBy(desc(schema.notificationLog.createdAt))
    .limit(50);
}

export async function markAllRead() {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  const db = getDb();
  const memberId = member.id;
  await db
    .update(schema.notificationLog)
    .set({ isRead: 1 })
    .where(
      and(
        eq(schema.notificationLog.memberId, memberId),
        eq(schema.notificationLog.isRead, 0)
      )
    );
}

export async function getUnreadCount(memberId: string): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ value: count() })
    .from(schema.notificationLog)
    .where(
      and(
        eq(schema.notificationLog.memberId, memberId),
        eq(schema.notificationLog.isRead, 0)
      )
    )
    .get();
  return result?.value ?? 0;
}

export async function getUnreadCountForCurrentMember(): Promise<number> {
  const member = await getCurrentMember();
  if (!member) return 0;
  return getUnreadCount(member.id);
}
