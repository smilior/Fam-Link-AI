"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Bell, Camera, Grid2X2, Settings, type LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isScan?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "カレンダー", icon: Calendar },
  { href: "/notifications", label: "通知", icon: Bell },
  { href: "/scan", label: "スキャン", icon: Camera, isScan: true },
  { href: "/hub", label: "ハブ", icon: Grid2X2 },
  { href: "/settings", label: "設定", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/80 dark:bg-slate-900/80 backdrop-blur-md h-16 pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center justify-around max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          if (item.isScan) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 -mt-4"
              >
                <div className="w-12 h-12 rounded-full bg-brand-500 flex items-center justify-center shadow-lg">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] text-brand-500 font-medium">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] ${
                isActive ? "text-brand-500" : "text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
