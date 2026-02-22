import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
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

      // Get all members of the group
      const groupMembers = await db
        .select({ id: schema.familyMember.id })
        .from(schema.familyMember)
        .where(eq(schema.familyMember.familyGroupId, group.id));

      if (groupMembers.length === 0) continue;

      // Send all events to every member in the group
      const titleList = events.map(formatEventLine).join("\n");
      const body = `${events.length}件の予定があります\n${titleList}`;

      for (const member of groupMembers) {
        await sendPushToMember(member.id, {
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
