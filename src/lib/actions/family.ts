"use server";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-session";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const ROLE_COLOR_MAP: Record<string, string> = {
  papa: "blue",
  mama: "pink",
  daughter: "yellow",
  son: "green",
};

export async function createFamilyGroup(
  name: string,
  role: string,
  displayName: string
) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();
  const groupId = crypto.randomUUID();
  const inviteCode = generateInviteCode();
  const now = Date.now();

  await db.insert(schema.familyGroup).values({
    id: groupId,
    name,
    inviteCode,
    createdAt: now,
  });

  const memberId = crypto.randomUUID();
  await db.insert(schema.familyMember).values({
    id: memberId,
    familyGroupId: groupId,
    userId: session.user.id,
    role,
    displayName,
    color: ROLE_COLOR_MAP[role] || "blue",
    createdAt: now,
  });

  return { groupId, memberId, inviteCode };
}

export async function joinFamilyGroup(
  inviteCode: string,
  role: string,
  displayName: string
) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();
  const groups = await db
    .select()
    .from(schema.familyGroup)
    .where(eq(schema.familyGroup.inviteCode, inviteCode.toUpperCase()))
    .limit(1);

  if (groups.length === 0) {
    throw new Error("招待コードが見つかりません");
  }

  const group = groups[0];
  const memberId = crypto.randomUUID();
  const now = Date.now();

  await db.insert(schema.familyMember).values({
    id: memberId,
    familyGroupId: group.id,
    userId: session.user.id,
    role,
    displayName,
    color: ROLE_COLOR_MAP[role] || "blue",
    createdAt: now,
  });

  return { groupId: group.id, memberId };
}

export async function getCurrentMember() {
  const session = await getServerSession();
  if (!session?.user) return null;

  const db = getDb();
  const members = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, session.user.id))
    .limit(1);

  return members[0] ?? null;
}

export async function getFamilyGroupWithMembers(familyGroupId: string) {
  const db = getDb();
  const groups = await db
    .select()
    .from(schema.familyGroup)
    .where(eq(schema.familyGroup.id, familyGroupId))
    .limit(1);
  if (groups.length === 0) return null;

  const members = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.familyGroupId, familyGroupId));

  return { group: groups[0], members };
}

export async function updateFamilyMember(
  memberId: string,
  data: { displayName?: string; avatarUrl?: string }
) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();
  await db
    .update(schema.familyMember)
    .set(data)
    .where(
      and(
        eq(schema.familyMember.id, memberId),
        eq(schema.familyMember.userId, session.user.id)
      )
    );
}
