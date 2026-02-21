import Link from "next/link";
import { Bell } from "lucide-react";

type Props = {
  title?: string;
  showBell?: boolean;
  children?: React.ReactNode;
};

export function Header({ title, showBell, children }: Props) {
  return (
    <header className="flex-shrink-0 flex items-center justify-between px-5 h-14 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 z-30">
      {title ? (
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
      ) : (
        <span className="font-bold text-lg bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text text-transparent">
          Fam-Link
        </span>
      )}
      <div className="flex items-center gap-1">
        {showBell && (
          <Link
            href="/notifications"
            className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
        )}
        {children}
      </div>
    </header>
  );
}
