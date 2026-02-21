import { getCurrentMember, getFamilyGroupWithMembers } from "@/lib/actions/family";
import { getServerSession } from "@/lib/auth-session";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const [session, member] = await Promise.all([
    getServerSession(),
    getCurrentMember(),
  ]);

  if (!member) redirect("/setup");

  const familyData = await getFamilyGroupWithMembers(member.familyGroupId);
  if (!familyData) redirect("/setup");

  return (
    <SettingsClient
      member={member}
      familyData={familyData}
      email={session?.user.email ?? ""}
    />
  );
}
