import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-session";
import { getCurrentMember } from "@/lib/actions/family";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const member = await getCurrentMember();
  if (!member) redirect("/setup");

  return (
    <div className="h-dvh flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Header title="カレンダー" showBell />
      {/* overflow-hidden: MonthCalendar が h-full で内部スクロールを管理する */}
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      <BottomNav />
    </div>
  );
}
