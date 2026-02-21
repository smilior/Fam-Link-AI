import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { sendPushToMember } from "@/lib/push";

// JST offset: +9 hours
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getTodayRangeJST(): { start: number; end: number } {
  const nowUTC = Date.now();
  const nowJST = nowUTC + JST_OFFSET_MS;
  const jstDate = new Date(nowJST);
  const y = jstDate.getUTCFullYear();
  const m = jstDate.getUTCMonth();
  const d = jstDate.getUTCDate();
  // Today 00:00 JST in UTC
  const start = Date.UTC(y, m, d) - JST_OFFSET_MS;
  // Today 23:59:59.999 JST in UTC
  const end = Date.UTC(y, m, d + 1) - JST_OFFSET_MS - 1;
  return { start, end };
}

export async function POST(req: NextRequest) {
  // Verify Bearer token
  const secret = process.env.PUSH_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "PUSH_API_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const now = Date.now();
  const { end: todayEnd } = getTodayRangeJST();

  // Fetch all family groups
  const groups = await db.select({ id: schema.familyGroup.id }).from(schema.familyGroup);

  let sentCount = 0;

  for (const group of groups) {
    // Events starting from now until end of today
    const events = await db
      .select()
      .from(schema.event)
      .where(
        and(
          eq(schema.event.familyGroupId, group.id),
          gte(schema.event.startAt, now),
          lt(schema.event.startAt, todayEnd),
          eq(schema.event.isDeleted, 0)
        )
      );

    if (events.length === 0) continue;

    // Get all event-member associations
    const eventIds = events.map((e) => e.id);
    const eventMembers = await db
      .select()
      .from(schema.eventMember)
      .where(inArray(schema.eventMember.eventId, eventIds));

    // Group events by memberId
    const memberEventMap = new Map<string, typeof events>();
    for (const em of eventMembers) {
      if (!memberEventMap.has(em.memberId)) {
        memberEventMap.set(em.memberId, []);
      }
      const event = events.find((e) => e.id === em.eventId);
      if (event) memberEventMap.get(em.memberId)!.push(event);
    }

    // For each member, check dedup and send
    for (const [memberId, memberEvents] of memberEventMap) {
      // Check if we already sent a "today_schedule" notification today for any of these events
      const todayStart = getTodayRangeJST().start;
      const alreadySent = await db
        .select({ id: schema.notificationLog.id })
        .from(schema.notificationLog)
        .where(
          and(
            eq(schema.notificationLog.memberId, memberId),
            eq(schema.notificationLog.type, "today_schedule"),
            gte(schema.notificationLog.createdAt, todayStart)
          )
        )
        .get();

      if (alreadySent) continue;

      const titleList = memberEvents.map((e) => `・${e.title}`).join("\n");
      const body = `${memberEvents.length}件の予定があります\n${titleList}`;

      await sendPushToMember(memberId, {
        type: "today_schedule",
        title: "今日の予定",
        body,
        url: "/notifications",
      });

      sentCount++;
    }
  }

  return NextResponse.json({ sent: sentCount });
}
