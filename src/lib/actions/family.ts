"use server";

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-session";
import { eq, and, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

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

export const getCurrentMember = cache(async function getCurrentMember() {
  const session = await getServerSession();
  if (!session?.user) return null;

  const db = getDb();
  const members = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, session.user.id))
    .limit(1);

  return members[0] ?? null;
});

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

export async function addNonUserMember(
  role: string,
  displayName: string
) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();

  // Get current member's family group
  const currentMember = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, session.user.id))
    .limit(1);

  if (currentMember.length === 0) {
    throw new Error("ファミリーグループが見つかりません");
  }

  const familyGroupId = currentMember[0].familyGroupId;
  const memberId = crypto.randomUUID();
  const now = Date.now();

  await db.insert(schema.familyMember).values({
    id: memberId,
    familyGroupId,
    userId: null, // No account for child members
    role,
    displayName,
    color: ROLE_COLOR_MAP[role] || "yellow",
    createdAt: now,
  });

  return { memberId };
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

export async function updateMyDisplayName(displayName: string) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const trimmed = displayName.trim();
  if (!trimmed) throw new Error("名前を入力してください");

  const db = getDb();
  await db
    .update(schema.familyMember)
    .set({ displayName: trimmed })
    .where(eq(schema.familyMember.userId, session.user.id));
}

export async function updateFamilyGroupName(groupId: string, name: string) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("グループ名を入力してください");

  const db = getDb();

  // Verify the requester belongs to this group
  const members = await db
    .select()
    .from(schema.familyMember)
    .where(
      and(
        eq(schema.familyMember.familyGroupId, groupId),
        eq(schema.familyMember.userId, session.user.id)
      )
    )
    .limit(1);
  if (!members.length) throw new Error("権限がありません");

  await db
    .update(schema.familyGroup)
    .set({ name: trimmed })
    .where(eq(schema.familyGroup.id, groupId));
}

export async function updateMemberRole(memberId: string, role: string) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  if (!["papa", "mama", "daughter", "son"].includes(role)) {
    throw new Error("無効なロールです");
  }

  const db = getDb();

  const me = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, session.user.id))
    .limit(1);
  if (!me.length) throw new Error("メンバーが見つかりません");

  const target = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.id, memberId))
    .limit(1);
  if (!target.length || target[0].familyGroupId !== me[0].familyGroupId) {
    throw new Error("権限がありません");
  }

  await db
    .update(schema.familyMember)
    .set({ role, color: ROLE_COLOR_MAP[role] ?? "blue" })
    .where(eq(schema.familyMember.id, memberId));
}

export async function updateMemberDisplayName(memberId: string, displayName: string) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const trimmed = displayName.trim();
  if (!trimmed) throw new Error("名前を入力してください");

  const db = getDb();

  // Get requester's family group
  const me = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, session.user.id))
    .limit(1);
  if (!me.length) throw new Error("メンバーが見つかりません");

  // Verify target member is in same family group
  const target = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.id, memberId))
    .limit(1);
  if (!target.length || target[0].familyGroupId !== me[0].familyGroupId) {
    throw new Error("権限がありません");
  }

  await db
    .update(schema.familyMember)
    .set({ displayName: trimmed })
    .where(eq(schema.familyMember.id, memberId));
}

export async function deleteNonUserMember(targetMemberId: string) {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();

  // 操作者のmemberIdとfamilyGroupIdを取得
  const me = await db
    .select({ familyGroupId: schema.familyMember.familyGroupId })
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, session.user.id))
    .get();
  if (!me) throw new Error("メンバーが見つかりません");

  // 削除対象がアカウントなし かつ 同じファミリーグループであることを確認
  const target = await db
    .select()
    .from(schema.familyMember)
    .where(
      and(
        eq(schema.familyMember.id, targetMemberId),
        eq(schema.familyMember.familyGroupId, me.familyGroupId),
        isNull(schema.familyMember.userId)
      )
    )
    .get();
  if (!target) throw new Error("削除できないメンバーです");

  // 関連データを削除してからメンバーを削除
  await db.delete(schema.eventMember).where(eq(schema.eventMember.memberId, targetMemberId));
  await db.delete(schema.pushSubscription).where(eq(schema.pushSubscription.memberId, targetMemberId));
  await db.delete(schema.notificationLog).where(eq(schema.notificationLog.memberId, targetMemberId));
  await db.delete(schema.familyMember).where(eq(schema.familyMember.id, targetMemberId));
}

export async function deleteMyAccount() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const db = getDb();
  const userId = session.user.id;

  // 1. Disconnect familyMember from this account (preserve family data)
  await db
    .update(schema.familyMember)
    .set({ userId: null })
    .where(eq(schema.familyMember.userId, userId));

  // 2. Delete all sessions for this user
  await db
    .delete(schema.session)
    .where(eq(schema.session.userId, userId));

  // 3. Delete all OAuth accounts for this user
  await db
    .delete(schema.account)
    .where(eq(schema.account.userId, userId));

  // 4. Delete the user record
  await db
    .delete(schema.user)
    .where(eq(schema.user.id, userId));
}

export async function getOrphanedFamilyGroups() {
  // Helper: find family groups that have no members with a userId (fully disconnected)
  const db = getDb();
  const membersWithUser = await db
    .select({ familyGroupId: schema.familyMember.familyGroupId })
    .from(schema.familyMember)
    .where(isNull(schema.familyMember.userId));
  return membersWithUser;
}
