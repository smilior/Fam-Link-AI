import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-session";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function getCurrentMemberId(): Promise<string | null> {
  const session = await getServerSession();
  if (!session?.user) return null;
  const db = getDb();
  const member = await db
    .select({ id: schema.familyMember.id })
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, session.user.id))
    .get();
  return member?.id ?? null;
}

export async function POST(req: NextRequest) {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, p256dh, auth } = body as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  };

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription data" }, { status: 400 });
  }

  const db = getDb();

  // Upsert by endpoint (avoid duplicates)
  const existing = await db
    .select({ id: schema.pushSubscription.id })
    .from(schema.pushSubscription)
    .where(
      and(
        eq(schema.pushSubscription.memberId, memberId),
        eq(schema.pushSubscription.endpoint, endpoint)
      )
    )
    .get();

  if (!existing) {
    await db.insert(schema.pushSubscription).values({
      id: crypto.randomUUID(),
      memberId,
      endpoint,
      p256dh,
      auth,
      createdAt: Date.now(),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest) {
  const memberId = await getCurrentMemberId();
  if (!memberId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  await db
    .delete(schema.pushSubscription)
    .where(eq(schema.pushSubscription.memberId, memberId));

  return NextResponse.json({ ok: true });
}
