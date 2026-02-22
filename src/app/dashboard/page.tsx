import { Suspense } from "react";
import { getCurrentMember, getFamilyGroupWithMembers } from "@/lib/actions/family";
import { getMonthEvents } from "@/lib/actions/calendar";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { redirect } from "next/navigation";

function CalendarSkeleton() {
  return (
    <div className="animate-pulse p-4">
      <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded mb-4 w-32" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded" />
        ))}
      </div>
    </div>
  );
}

async function CalendarView({ year, month }: { year: number; month: number }) {
  const member = await getCurrentMember();
  if (!member) redirect("/setup");

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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarView year={year} month={month} />
    </Suspense>
  );
}
