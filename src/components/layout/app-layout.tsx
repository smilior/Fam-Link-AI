import { Header } from "./header";
import { BottomNav } from "./bottom-nav";

type Props = {
  children: React.ReactNode;
  title?: string;
  /** ページコンテンツがスクロール不要な場合はtrue (カレンダー等) */
  fullHeight?: boolean;
};

export function AppLayout({ children, title, fullHeight }: Props) {
  return (
    <div className="h-dvh flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Header title={title} />
      <main
        className={`flex-1 min-h-0 ${fullHeight ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
