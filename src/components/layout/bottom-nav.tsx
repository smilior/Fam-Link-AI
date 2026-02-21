"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Bell,
  ScanLine,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "カレンダー", icon: Calendar },
  { href: "/notifications", label: "通知", icon: Bell },
  { href: "/scan", label: "スキャン", icon: ScanLine },
  { href: "/hub", label: "ハブ", icon: LayoutGrid },
  { href: "/settings", label: "設定", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex-shrink-0 flex items-stretch bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-30"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[64px] relative"
          >
            {/* Active top indicator */}
            <div
              className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full transition-colors duration-200 ${
                isActive ? "bg-brand-500" : "bg-transparent"
              }`}
            />
            <Icon
              className={`w-5 h-5 transition-colors duration-200 ${
                isActive
                  ? "text-brand-500"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            />
            <span
              className={`text-[11px] font-medium transition-colors duration-200 ${
                isActive
                  ? "text-brand-500"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
