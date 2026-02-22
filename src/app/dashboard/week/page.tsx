import { Suspense } from "react";
import { getCurrentMember, getFamilyGroupWithMembers } from "@/lib/actions/family";
import { getWeekEvents } from "@/lib/actions/calendar";
import { WeekView } from "@/components/calendar/week-view";
import { redirect } from "next/navigation";

function WeekSkeleton() {
  return (
    <div className="animate-pulse p-4">
      <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded mb-4 w-40" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-48 bg-gray-100 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function WeekCalendarView({
  startOfWeek,
  endOfWeek,
}: {
  startOfWeek: Date;
  endOfWeek: Date;
}) {
  const member = await getCurrentMember();
  if (!member) redirect("/setup");

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

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const baseDate = params.date ? new Date(params.date) : new Date();
  const startOfWeek = new Date(baseDate);
  startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return (
    <Suspense fallback={<WeekSkeleton />}>
      <WeekCalendarView startOfWeek={startOfWeek} endOfWeek={endOfWeek} />
    </Suspense>
  );
}
