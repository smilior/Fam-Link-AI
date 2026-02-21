"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotificationLog } from "@/lib/db/types";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function formatDateGroup(ts: number): string {
  const nowJST = Date.now() + JST_OFFSET_MS;
  const tsJST = ts + JST_OFFSET_MS;
  const nowDate = new Date(nowJST);
  const tsDate = new Date(tsJST);

  const diffDays =
    Math.floor(nowDate.getTime() / 86400000) -
    Math.floor(tsDate.getTime() / 86400000);

  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  const m = tsDate.getUTCMonth() + 1;
  const d = tsDate.getUTCDate();
  return `${m}月${d}日`;
}

function formatTime(ts: number): string {
  const jst = new Date(ts + JST_OFFSET_MS);
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const m = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

type Props = {
  notifications: NotificationLog[];
  markAllRead: () => Promise<void>;
};

export function NotificationsList({ notifications, markAllRead }: Props) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);

  const hasUnread = notifications.some((n) => !n.isRead);

  const handleMarkAll = async () => {
    setMarking(true);
    await markAllRead();
    router.refresh();
    setMarking(false);
  };

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Bell className="w-10 h-10 opacity-30" />
        <p className="text-sm">通知はまだありません</p>
      </div>
    );
  }

  // Group by date
  const groups: { label: string; items: NotificationLog[] }[] = [];
  const seen = new Map<string, number>();
  for (const n of notifications) {
    const label = formatDateGroup(n.createdAt);
    if (!seen.has(label)) {
      seen.set(label, groups.length);
      groups.push({ label, items: [] });
    }
    groups[seen.get(label)!].items.push(n);
  }

  return (
    <div className="space-y-4">
      {hasUnread && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAll}
            disabled={marking}
            className="text-brand-500 font-medium"
          >
            {marking ? "処理中..." : "すべて既読"}
          </Button>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl px-4 py-3 ${
                  n.isRead
                    ? "bg-white dark:bg-slate-800"
                    : "bg-brand-50 dark:bg-brand-900/20 border-l-4 border-brand-500"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
                        {n.body}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                    {formatTime(n.createdAt)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
