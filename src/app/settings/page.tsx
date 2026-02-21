import { getCurrentMember, getFamilyGroupWithMembers } from "@/lib/actions/family";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/setup");

  const familyData = await getFamilyGroupWithMembers(member.familyGroupId);
  if (!familyData) redirect("/setup");

  return <SettingsClient member={member} familyData={familyData} />;
}
