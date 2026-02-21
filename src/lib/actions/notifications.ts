"use server";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-session";
import { eq, desc, and, count } from "drizzle-orm";
import { redirect } from "next/navigation";

async function getCurrentMemberId(): Promise<string> {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");
  const db = getDb();
  const member = await db
    .select({ id: schema.familyMember.id })
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, session.user.id))
    .get();
  if (!member) redirect("/setup");
  return member.id;
}

export async function getNotifications() {
  const memberId = await getCurrentMemberId();
  const db = getDb();
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
  const memberId = await getCurrentMemberId();
  const db = getDb();
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
  const session = await getServerSession();
  if (!session?.user) return 0;
  const db = getDb();
  const result = await db
    .select({ value: count() })
    .from(schema.notificationLog)
    .innerJoin(
      schema.familyMember,
      eq(schema.notificationLog.memberId, schema.familyMember.id)
    )
    .where(
      and(
        eq(schema.familyMember.userId, session.user.id),
        eq(schema.notificationLog.isRead, 0)
      )
    )
    .get();
  return result?.value ?? 0;
}
