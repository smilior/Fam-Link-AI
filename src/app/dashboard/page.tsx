import { getCurrentMember, getFamilyGroupWithMembers } from "@/lib/actions/family";
import { getMonthEvents } from "@/lib/actions/calendar";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { redirect } from "next/navigation";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/setup");

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const [events, familyData] = await Promise.all([
    getMonthEvents(year, month, member.familyGroupId),
    getFamilyGroupWithMembers(member.familyGroupId),
  ]);

  return (
    <MonthCalendar
      year={year}
      month={month}
      events={events}
      members={familyData?.members ?? []}
      currentMember={member}
    />
  );
}
