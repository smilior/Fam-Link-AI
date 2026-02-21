import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, gte, lt, inArray } from "drizzle-orm";
import { sendPushToMember } from "@/lib/push";

// JST offset: +9 hours
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

type EventRow = typeof schema.event.$inferSelect;

function formatEventLine(ev: EventRow): string {
  const startJST = new Date(ev.startAt + JST_OFFSET_MS);
  const endJST = new Date(ev.endAt + JST_OFFSET_MS);

  // Compare calendar days in JST
  const startDay = Math.floor((ev.startAt + JST_OFFSET_MS) / 86400000);
  const endDay = Math.floor((ev.endAt + JST_OFFSET_MS) / 86400000);
  const isMultiDay = endDay > startDay;

  const sm = startJST.getUTCMonth() + 1;
  const sd = startJST.getUTCDate();
  const em = endJST.getUTCMonth() + 1;
  const ed = endJST.getUTCDate();
  const sh = String(startJST.getUTCHours()).padStart(2, "0");
  const smin = String(startJST.getUTCMinutes()).padStart(2, "0");

  if (ev.isAllDay) {
    if (isMultiDay) return `・${sm}/${sd}〜${em}/${ed} ${ev.title}`;
    return `・${ev.title}（終日）`;
  }

  if (isMultiDay) {
    return `・${sm}/${sd} ${sh}:${smin}〜 ${ev.title}`;
  }

  return `・${sh}:${smin} ${ev.title}`;
}

function getTodayEndJST(): number {
  const nowJST = Date.now() + JST_OFFSET_MS;
  const jstDate = new Date(nowJST);
  const y = jstDate.getUTCFullYear();
  const m = jstDate.getUTCMonth();
  const d = jstDate.getUTCDate();
  // Today 23:59:59.999 JST in UTC
  return Date.UTC(y, m, d + 1) - JST_OFFSET_MS - 1;
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

  let db: ReturnType<typeof getDb>;
  try {
    db = getDb();
  } catch (e) {
    return NextResponse.json({ error: "DB init failed", detail: String(e) }, { status: 500 });
  }

  try {
    const now = Date.now();
    const todayEnd = getTodayEndJST();

    // Fetch all family groups
    const groups = await db.select({ id: schema.familyGroup.id }).from(schema.familyGroup);

    let sentCount = 0;

    for (const group of groups) {
      // Events that haven't started yet and are within today
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

      // Send to each member (no dedup — each cron call reflects current remaining events)
      for (const [memberId, memberEvents] of memberEventMap) {
        const titleList = memberEvents.map(formatEventLine).join("\n");
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
  } catch (e) {
    console.error("[push/send] error:", e);
    return NextResponse.json({ error: "Internal error", detail: String(e) }, { status: 500 });
  }
}
