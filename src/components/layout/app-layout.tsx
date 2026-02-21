import { Header } from "./header";
import { BottomNav } from "./bottom-nav";

export function AppLayout({
  children,
  headerSlot,
}: {
  children: React.ReactNode;
  headerSlot?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header>{headerSlot}</Header>
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
