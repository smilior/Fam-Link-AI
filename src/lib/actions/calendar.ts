"use server";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-session";
import { eq, and, gte, lte, inArray, isNull, isNotNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentMember } from "./family";

export type RecurrenceRule = "daily" | "weekly" | "monthly" | "yearly";

export type CreateEventInput = {
  title: string;
  description?: string;
  startAt: number;
  endAt: number;
  isAllDay?: boolean;
  location?: string;
  memberIds: string[];
  recurrenceRule?: RecurrenceRule | null;
  recurrenceInterval?: number;
  recurrenceEndAt?: number | null;
  recurrenceDaysOfWeek?: string | null; // weekly only: "0,1,2,3,4,5,6"
};

// ── Create event ──────────────────────────────────────────────────────────────

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
    recurrenceRule: input.recurrenceRule ?? null,
    recurrenceInterval: input.recurrenceInterval ?? 1,
    recurrenceEndAt: input.recurrenceEndAt ?? null,
    recurrenceDaysOfWeek: input.recurrenceDaysOfWeek ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const memberIds = input.memberIds.length > 0 ? input.memberIds : [member.id];
  await db
    .insert(schema.eventMember)
    .values(memberIds.map((memberId) => ({ eventId, memberId })));

  return { eventId };
}

// ── Update event (master or regular) ─────────────────────────────────────────

export async function updateEvent(
  eventId: string,
  input: Partial<CreateEventInput>
) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();
  const now = Date.now();

  const { memberIds: _memberIds, isAllDay, recurrenceRule, recurrenceInterval, recurrenceEndAt, recurrenceDaysOfWeek, ...rest } = input;

  await db
    .update(schema.event)
    .set({
      ...rest,
      ...(isAllDay !== undefined ? { isAllDay: isAllDay ? 1 : 0 } : {}),
      ...(recurrenceRule !== undefined ? { recurrenceRule: recurrenceRule ?? null } : {}),
      ...(recurrenceInterval !== undefined ? { recurrenceInterval } : {}),
      ...(recurrenceEndAt !== undefined ? { recurrenceEndAt: recurrenceEndAt ?? null } : {}),
      ...(recurrenceDaysOfWeek !== undefined ? { recurrenceDaysOfWeek: recurrenceDaysOfWeek ?? null } : {}),
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

// ── Create exception (edit "this occurrence only") ────────────────────────────

export async function createEventException(
  masterEventId: string,
  instanceDate: number,
  data: {
    title: string;
    description?: string;
    startAt: number;
    endAt: number;
    isAllDay?: boolean;
    location?: string;
    memberIds: string[];
  }
) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const member = await getCurrentMember();
  if (!member) redirect("/setup");

  const db = getDb();
  const now = Date.now();
  const exceptionId = crypto.randomUUID();

  // Fetch master to get familyGroupId
  const masters = await db
    .select()
    .from(schema.event)
    .where(eq(schema.event.id, masterEventId))
    .limit(1);
  if (!masters.length) throw new Error("繰り返し予定が見つかりません");

  await db.insert(schema.event).values({
    id: exceptionId,
    familyGroupId: masters[0].familyGroupId,
    createdByMemberId: member.id,
    title: data.title,
    description: data.description,
    startAt: data.startAt,
    endAt: data.endAt,
    isAllDay: data.isAllDay ? 1 : 0,
    location: data.location,
    source: "manual",
    parentEventId: masterEventId,
    exceptionDate: instanceDate,
    createdAt: now,
    updatedAt: now,
  });

  const memberIds = data.memberIds.length > 0 ? data.memberIds : [member.id];
  await db
    .insert(schema.eventMember)
    .values(memberIds.map((memberId) => ({ eventId: exceptionId, memberId })));

  return { exceptionId };
}

// ── Delete single occurrence (creates tombstone) ──────────────────────────────

export async function deleteEventInstance(
  masterEventId: string,
  instanceDate: number
) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const member = await getCurrentMember();
  if (!member) redirect("/setup");

  const db = getDb();
  const now = Date.now();

  // Check if an exception already exists for this date
  const existing = await db
    .select()
    .from(schema.event)
    .where(
      and(
        eq(schema.event.parentEventId, masterEventId),
        eq(schema.event.exceptionDate, instanceDate)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Mark existing exception as deleted
    await db
      .update(schema.event)
      .set({ isDeleted: 1, updatedAt: now })
      .where(eq(schema.event.id, existing[0].id));
  } else {
    // Create tombstone exception
    const masters = await db
      .select()
      .from(schema.event)
      .where(eq(schema.event.id, masterEventId))
      .limit(1);
    if (!masters.length) throw new Error("繰り返し予定が見つかりません");

    await db.insert(schema.event).values({
      id: crypto.randomUUID(),
      familyGroupId: masters[0].familyGroupId,
      createdByMemberId: member.id,
      title: "", // tombstone
      startAt: instanceDate,
      endAt: instanceDate,
      parentEventId: masterEventId,
      exceptionDate: instanceDate,
      isDeleted: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ── Delete event (cascade for recurring masters) ──────────────────────────────

export async function deleteEvent(eventId: string) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();

  // Delete exception events for this master (if any)
  const exceptions = await db
    .select({ id: schema.event.id })
    .from(schema.event)
    .where(eq(schema.event.parentEventId, eventId));

  if (exceptions.length > 0) {
    const exceptionIds = exceptions.map((e) => e.id);
    await db
      .delete(schema.eventMember)
      .where(inArray(schema.eventMember.eventId, exceptionIds));
    await db
      .delete(schema.event)
      .where(inArray(schema.event.id, exceptionIds));
  }

  await db
    .delete(schema.eventMember)
    .where(eq(schema.eventMember.eventId, eventId));
  await db.delete(schema.event).where(eq(schema.event.id, eventId));
}

// ── Recurrence expansion helper ───────────────────────────────────────────────

type OccurrencePair = { startAt: number; endAt: number };

function generateOccurrences(
  masterStartAt: number,
  masterEndAt: number,
  rule: string,
  interval: number,
  recurrenceEndAt: number | null,
  rangeStart: number,
  rangeEnd: number,
  daysOfWeek?: string | null
): OccurrencePair[] {
  const duration = masterEndAt - masterStartAt;
  const results: OccurrencePair[] = [];
  const limitAt = recurrenceEndAt ?? rangeEnd + 1;
  let iterations = 0;

  // Weekly with specific days-of-week selected
  if (rule === "weekly" && daysOfWeek) {
    const days = daysOfWeek
      .split(",")
      .map(Number)
      .filter((n) => n >= 0 && n <= 6)
      .sort((a, b) => a - b);
    if (days.length === 0) return results;

    // Find start of the week (Sunday midnight local) that contains masterStartAt
    const masterDate = new Date(masterStartAt);
    const masterMidnight = new Date(
      masterDate.getFullYear(), masterDate.getMonth(), masterDate.getDate()
    ).getTime();
    const timeOfDay = masterStartAt - masterMidnight; // ms since midnight
    const weekSundayMidnight = masterMidnight - masterDate.getDay() * 86400000;

    let weekStart = weekSundayMidnight;
    while (weekStart <= Math.min(limitAt, rangeEnd) && iterations < 500) {
      for (const day of days) {
        iterations++;
        const occStart = weekStart + day * 86400000 + timeOfDay;
        if (occStart < masterStartAt) continue; // before first occurrence
        if (occStart > Math.min(limitAt, rangeEnd)) break;
        if (occStart >= rangeStart - duration) {
          results.push({ startAt: occStart, endAt: occStart + duration });
        }
      }
      weekStart += interval * 7 * 86400000;
    }
    return results;
  }

  // Default: all other rules (daily / weekly-no-days / monthly / yearly)
  let current = masterStartAt;
  while (current <= Math.min(limitAt, rangeEnd) && iterations < 500) {
    iterations++;
    if (current >= rangeStart - duration) {
      results.push({ startAt: current, endAt: current + duration });
    }
    const d = new Date(current);
    switch (rule) {
      case "daily":
        current += interval * 86400000;
        break;
      case "weekly":
        current += interval * 7 * 86400000;
        break;
      case "monthly":
        d.setMonth(d.getMonth() + interval);
        current = d.getTime();
        break;
      case "yearly":
        d.setFullYear(d.getFullYear() + interval);
        current = d.getTime();
        break;
      default:
        return results;
    }
  }
  return results;
}

// ── Shared event result type ──────────────────────────────────────────────────

export type CalendarEvent = {
  id: string;
  familyGroupId: string;
  title: string;
  description?: string | null;
  startAt: number;
  endAt: number;
  isAllDay: number | null;
  location?: string | null;
  recurrenceRule?: string | null;
  recurrenceInterval?: number | null;
  recurrenceEndAt?: number | null;
  recurrenceDaysOfWeek?: string | null;
  parentEventId?: string | null;
  exceptionDate?: number | null;
  memberIds: string[];
  // Virtual occurrence fields
  masterEventId?: string;
  masterStartAt?: number;
  masterEndAt?: number;
  instanceDate?: number;
  isVirtual?: boolean;
};

// ── getMonthEvents ────────────────────────────────────────────────────────────

export async function getMonthEvents(
  year: number,
  month: number,
  familyGroupId: string
): Promise<CalendarEvent[]> {
  const db = getDb();
  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  // Phase 1: Fetch regular events and recurring masters in parallel
  const [regularEvents, recurringMasters] = await Promise.all([
    db
      .select()
      .from(schema.event)
      .where(
        and(
          eq(schema.event.familyGroupId, familyGroupId),
          isNull(schema.event.recurrenceRule),
          isNull(schema.event.parentEventId),
          lte(schema.event.startAt, endOfMonth),
          gte(schema.event.endAt, startOfMonth)
        )
      ),
    db
      .select()
      .from(schema.event)
      .where(
        and(
          eq(schema.event.familyGroupId, familyGroupId),
          isNotNull(schema.event.recurrenceRule),
          isNull(schema.event.parentEventId),
          lte(schema.event.startAt, endOfMonth),
          or(
            isNull(schema.event.recurrenceEndAt),
            gte(schema.event.recurrenceEndAt, startOfMonth)
          )
        )
      ),
  ]);

  const masterIds = recurringMasters.map((m) => m.id);
  const regularIds = regularEvents.map((e) => e.id);

  // Phase 2: Fetch exceptions + regular/master members in parallel
  const [allExceptions, regularEventMembers, masterEventMembers] = await Promise.all([
    masterIds.length > 0
      ? db
          .select()
          .from(schema.event)
          .where(inArray(schema.event.parentEventId, masterIds))
      : Promise.resolve([]),
    regularIds.length > 0
      ? db
          .select()
          .from(schema.eventMember)
          .where(inArray(schema.eventMember.eventId, regularIds))
      : Promise.resolve([]),
    masterIds.length > 0
      ? db
          .select()
          .from(schema.eventMember)
          .where(inArray(schema.eventMember.eventId, masterIds))
      : Promise.resolve([]),
  ]);

  // Build exception map: masterId → exceptionDate → exception event
  const exceptionMap = new Map<string, Map<number, (typeof allExceptions)[0]>>();
  allExceptions.forEach((exc) => {
    if (!exc.parentEventId || exc.exceptionDate === null) return;
    if (!exceptionMap.has(exc.parentEventId)) {
      exceptionMap.set(exc.parentEventId, new Map());
    }
    exceptionMap.get(exc.parentEventId)!.set(exc.exceptionDate!, exc);
  });

  // Phase 3: Fetch exception members (needs exception IDs from phase 2)
  const realExceptions = allExceptions.filter((e) => !e.isDeleted);
  const exceptionIds = realExceptions.map((e) => e.id);
  const exceptionEventMembers =
    exceptionIds.length > 0
      ? await db
          .select()
          .from(schema.eventMember)
          .where(inArray(schema.eventMember.eventId, exceptionIds))
      : [];

  // Build O(1) member lookup Map
  const membersByEventId = new Map<string, string[]>();
  for (const em of [...regularEventMembers, ...masterEventMembers, ...exceptionEventMembers]) {
    const arr = membersByEventId.get(em.eventId);
    if (arr) arr.push(em.memberId);
    else membersByEventId.set(em.eventId, [em.memberId]);
  }
  const membersOf = (id: string) => membersByEventId.get(id) ?? [];

  // 5. Build result: regular events
  const result: CalendarEvent[] = regularEvents.map((e) => ({
    ...e,
    memberIds: membersOf(e.id),
    recurrenceRule: e.recurrenceRule ?? null,
    recurrenceInterval: e.recurrenceInterval ?? null,
    recurrenceEndAt: e.recurrenceEndAt ?? null,
    parentEventId: e.parentEventId ?? null,
    exceptionDate: e.exceptionDate ?? null,
  }));

  // 6. Generate virtual occurrences for each master
  for (const master of recurringMasters) {
    const masterExceptions = exceptionMap.get(master.id) ?? new Map();
    const masterMemberIds = membersOf(master.id);
    const occurrences = generateOccurrences(
      master.startAt,
      master.endAt,
      master.recurrenceRule!,
      master.recurrenceInterval ?? 1,
      master.recurrenceEndAt ?? null,
      startOfMonth,
      endOfMonth,
      master.recurrenceDaysOfWeek ?? null
    );

    for (const { startAt, endAt } of occurrences) {
      // Skip if there's an exception for this occurrence date
      if (masterExceptions.has(startAt)) continue;

      result.push({
        ...master,
        id: `${master.id}:${startAt}`,
        startAt,
        endAt,
        memberIds: masterMemberIds,
        recurrenceRule: master.recurrenceRule ?? null,
        recurrenceInterval: master.recurrenceInterval ?? null,
        recurrenceEndAt: master.recurrenceEndAt ?? null,
        recurrenceDaysOfWeek: master.recurrenceDaysOfWeek ?? null,
        parentEventId: null,
        exceptionDate: null,
        // Virtual occurrence metadata
        masterEventId: master.id,
        masterStartAt: master.startAt,
        masterEndAt: master.endAt,
        instanceDate: startAt,
        isVirtual: true,
      });
    }

    // Add non-deleted exceptions that fall within this month
    for (const exc of realExceptions.filter(
      (e) => e.parentEventId === master.id
    )) {
      if (exc.startAt > endOfMonth || exc.endAt < startOfMonth) continue;
      result.push({
        ...exc,
        memberIds: membersOf(exc.id),
        recurrenceRule: exc.recurrenceRule ?? null,
        recurrenceInterval: exc.recurrenceInterval ?? null,
        recurrenceEndAt: exc.recurrenceEndAt ?? null,
        parentEventId: exc.parentEventId ?? null,
        exceptionDate: exc.exceptionDate ?? null,
        masterEventId: master.id,
        masterStartAt: master.startAt,
        masterEndAt: master.endAt,
        isVirtual: false,
      });
    }
  }

  return result;
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
