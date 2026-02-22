import { Suspense } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadCountForCurrentMember } from "@/lib/actions/notifications";

type Props = {
  title?: string;
  showBell?: boolean;
  children?: React.ReactNode;
};

async function UnreadBadge() {
  const unreadCount = await getUnreadCountForCurrentMember();

  return (
    <Link
      href="/notifications"
      className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
    >
      <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

function UnreadBadgeFallback() {
  return (
    <div className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
      <div className="w-5 h-5" />
    </div>
  );
}

export function Header({ title, showBell, children }: Props) {
  return (
    <header className="flex-shrink-0 flex items-center justify-between px-5 h-14 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 z-30">
      {title ? (
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
      ) : (
        <span className="font-bold text-lg bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text text-transparent">
          Tsunagu
        </span>
      )}
      <div className="flex items-center gap-1">
        {showBell && (
          <Suspense fallback={<UnreadBadgeFallback />}>
            <UnreadBadge />
          </Suspense>
        )}
        {children}
      </div>
    </header>
  );
}
