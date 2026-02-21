"use server";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-session";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentMember } from "./family";

export type CreateEventInput = {
  title: string;
  description?: string;
  startAt: number; // timestamp ms
  endAt: number; // timestamp ms
  isAllDay?: boolean;
  location?: string;
  memberIds: string[]; // 参加メンバーID配列
};

export async function createEvent(input: CreateEventInput) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const member = await getCurrentMember();
  if (!member) redirect("/setup");

  const db = getDb();
  const eventId = crypto.randomUUID();
  const now = Date.now();

  await db.insert(schema.event).values({
    id: eventId,
    familyGroupId: member.familyGroupId,
    createdByMemberId: member.id,
    title: input.title,
    description: input.description,
    startAt: input.startAt,
    endAt: input.endAt,
    isAllDay: input.isAllDay ? 1 : 0,
    location: input.location,
    source: "manual",
    createdAt: now,
    updatedAt: now,
  });

  const memberIds =
    input.memberIds.length > 0 ? input.memberIds : [member.id];
  await db
    .insert(schema.eventMember)
    .values(memberIds.map((memberId) => ({ eventId, memberId })));

  return { eventId };
}

export async function updateEvent(
  eventId: string,
  input: Partial<CreateEventInput>
) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();
  const now = Date.now();

  const { memberIds: _memberIds, isAllDay, ...rest } = input;
  await db
    .update(schema.event)
    .set({
      ...rest,
      ...(isAllDay !== undefined ? { isAllDay: isAllDay ? 1 : 0 } : {}),
      updatedAt: now,
    })
    .where(eq(schema.event.id, eventId));

  if (input.memberIds) {
    await db
      .delete(schema.eventMember)
      .where(eq(schema.eventMember.eventId, eventId));
    if (input.memberIds.length > 0) {
      await db
        .insert(schema.eventMember)
        .values(input.memberIds.map((memberId) => ({ eventId, memberId })));
    }
  }
}

export async function deleteEvent(eventId: string) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();
  await db
    .delete(schema.eventMember)
    .where(eq(schema.eventMember.eventId, eventId));
  await db.delete(schema.event).where(eq(schema.event.id, eventId));
}

export async function getMonthEvents(
  year: number,
  month: number,
  familyGroupId: string
) {
  const db = getDb();
  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const events = await db
    .select()
    .from(schema.event)
    .where(
      and(
        eq(schema.event.familyGroupId, familyGroupId),
        gte(schema.event.startAt, startOfMonth),
        lte(schema.event.startAt, endOfMonth)
      )
    );

  const eventIds = events.map((e) => e.id);
  const eventMembers =
    eventIds.length > 0
      ? await db
          .select()
          .from(schema.eventMember)
          .where(inArray(schema.eventMember.eventId, eventIds))
      : [];

  return events.map((e) => ({
    ...e,
    memberIds: eventMembers
      .filter((em) => em.eventId === e.id)
      .map((em) => em.memberId),
  }));
}

export async function getWeekEvents(
  startDate: number,
  endDate: number,
  familyGroupId: string
) {
  const db = getDb();
  const events = await db
    .select()
    .from(schema.event)
    .where(
      and(
        eq(schema.event.familyGroupId, familyGroupId),
        gte(schema.event.startAt, startDate),
        lte(schema.event.startAt, endDate)
      )
    );

  const eventIds = events.map((e) => e.id);
  const eventMembers =
    eventIds.length > 0
      ? await db
          .select()
          .from(schema.eventMember)
          .where(inArray(schema.eventMember.eventId, eventIds))
      : [];

  return events.map((e) => ({
    ...e,
    memberIds: eventMembers
      .filter((em) => em.eventId === e.id)
      .map((em) => em.memberId),
  }));
}
