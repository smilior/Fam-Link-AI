import { getCurrentMember, getFamilyGroupWithMembers } from "@/lib/actions/family";
import { getWeekEvents } from "@/lib/actions/calendar";
import { WeekView } from "@/components/calendar/week-view";
import { redirect } from "next/navigation";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/setup");

  const params = await searchParams;
  const baseDate = params.date ? new Date(params.date) : new Date();
  const startOfWeek = new Date(baseDate);
  startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [events, familyData] = await Promise.all([
    getWeekEvents(startOfWeek.getTime(), endOfWeek.getTime(), member.familyGroupId),
    getFamilyGroupWithMembers(member.familyGroupId),
  ]);

  return (
    <WeekView
      startOfWeek={startOfWeek}
      events={events}
      members={familyData?.members ?? []}
      currentMember={member}
    />
  );
}
