"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EventModal } from "./event-modal";
import { EventDetailModal } from "./event-detail-modal";
import type { FamilyMember } from "@/lib/db/types";

export type EventWithMembers = {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  isAllDay: number | null;
  memberIds: string[];
};

type Props = {
  year: number;
  month: number;
  events: EventWithMembers[];
  members: FamilyMember[];
  currentMember: FamilyMember;
};

// ── Color system ──────────────────────────────────────────────────────────────
// Normal: soft bg + dark text   Important: solid bg + white text
const PILL: Record<string, { bg: string; text: string }> = {
  blue:   { bg: "#DBEAFE", text: "#1E40AF" },
  pink:   { bg: "#FCE7F3", text: "#9D174D" },
  yellow: { bg: "#FEF9C3", text: "#854D0E" },
  green:  { bg: "#DCFCE7", text: "#14532D" },
  all:    { bg: "#E0E7FF", text: "#3730A3" },
};

const AVATAR_BG: Record<string, string> = {
  blue: "#3B82F6", pink: "#EC4899", yellow: "#EAB308", green: "#22C55E",
};

const RING: Record<string, string> = {
  blue: "ring-papa-200", pink: "ring-mama-200",
  yellow: "ring-daughter-200", green: "ring-son-200",
};

function primaryColor(memberIds: string[], members: FamilyMember[]): string {
  const m = members.find((x) => x.id === memberIds[0]);
  return m?.color ?? "all";
}

// ── Calendar grid builder ─────────────────────────────────────────────────────
type Cell = { date: number; dom: number; cur: boolean; dow: number };

function buildWeeks(y: number, m: number): Cell[][] {
  const first = new Date(y, m - 1, 1).getDay();
  const dim   = new Date(y, m, 0).getDate();
  const dprev = new Date(y, m - 1, 0).getDate();
  const weeks: Cell[][] = [];

  for (let w = 0; w < 6; w++) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const n = 1 - first + w * 7 + d;
      if (n < 1)      week.push({ date: dprev + n, dom: 0, cur: false, dow: d });
      else if (n > dim) week.push({ date: n - dim, dom: 0, cur: false, dow: d });
      else              week.push({ date: n, dom: n, cur: true, dow: d });
    }
    weeks.push(week);
    if (1 - first + (w + 1) * 7 > dim + 7) break;
  }
  while (weeks.length > 5 && weeks.at(-1)!.every((c) => !c.cur)) weeks.pop();
  return weeks;
}

// ── Event layout ──────────────────────────────────────────────────────────────
type PEv = EventWithMembers & { sc: number; ec: number; multi: boolean };

function weekEvents(week: Cell[], evs: EventWithMembers[], filter: string[]): PEv[] {
  const cur = week.filter((c) => c.cur);
  if (!cur.length) return [];
  const wf = cur[0].dom, wl = cur.at(-1)!.dom;
  const out: PEv[] = [];

  evs.forEach((ev) => {
    if (filter.length && !ev.memberIds.some((id) => filter.includes(id))) return;
    const es = new Date(ev.startAt).getDate();
    const ee = new Date(ev.endAt).getDate();
    if (ee < wf || es > wl) return;

    const cols: number[] = [];
    week.forEach((c, i) => {
      if (c.cur && c.dom >= es && c.dom <= ee) cols.push(i);
    });
    if (!cols.length) return;
    out.push({ ...ev, sc: cols[0], ec: cols.at(-1)!, multi: es !== ee });
  });
  return out;
}

function allocate(evs: PEv[]): (PEv | null)[][] {
  const sorted = [...evs].sort((a, b) =>
    a.multi === b.multi ? a.sc - b.sc : a.multi ? -1 : 1
  );
  const tracks: (PEv | null)[][] = [];
  sorted.forEach((ev) => {
    let placed = false;
    for (const t of tracks) {
      if (Array.from({ length: ev.ec - ev.sc + 1 }, (_, i) => ev.sc + i).every((c) => !t[c])) {
        for (let c = ev.sc; c <= ev.ec; c++) t[c] = ev;
        placed = true; break;
      }
    }
    if (!placed) {
      const t: (PEv | null)[] = Array(7).fill(null);
      for (let c = ev.sc; c <= ev.ec; c++) t[c] = ev;
      tracks.push(t);
    }
  });
  return tracks;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MonthCalendar({ year, month, events, members, currentMember }: Props) {
  const router = useRouter();
  const [selDay, setSelDay]           = useState<number | null>(null);
  const [filter, setFilter]           = useState<string[]>([]);
  const [showCreate, setShowCreate]   = useState(false);
  const [editEv, setEditEv]           = useState<EventWithMembers | null>(null);
  const [detailEv, setDetailEv]       = useState<EventWithMembers | null>(null);

  const today = new Date();
  const isCurMon = today.getFullYear() === year && today.getMonth() === month - 1;

  const nav = (d: number) => {
    let nm = month + d, ny = year;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1)  { nm = 12; ny--; }
    router.push(`/dashboard?year=${ny}&month=${nm}`);
  };

  const weeks = buildWeeks(year, month);

  const dayEvs = (dom: number) => {
    const s = new Date(year, month - 1, dom).getTime();
    const e = s + 86400000 - 1;
    return events.filter((ev) => {
      const ok = ev.startAt <= e && ev.endAt >= s;
      const fok = !filter.length || ev.memberIds.some((id) => filter.includes(id));
      return ok && fok;
    });
  };

  return (
    <div className="flex flex-col h-full select-none">

      {/* ── Sub-header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/60">
        {/* Member filter avatars */}
        <div className="flex items-center gap-1.5">
          {members.map((m) => {
            const on = !filter.length || filter.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() =>
                  setFilter((p) =>
                    p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]
                  )
                }
                className={`w-8 h-8 rounded-full ring-2 text-white text-[11px] font-bold transition-all duration-150 flex items-center justify-center ${RING[m.color] ?? "ring-slate-200"} ${on ? "opacity-100 scale-100" : "opacity-30 scale-95"}`}
                style={{ backgroundColor: AVATAR_BG[m.color] ?? "#94a3b8" }}
              >
                {m.displayName.charAt(0)}
              </button>
            );
          })}
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => nav(-1)} className="w-10 h-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-[15px] font-bold w-[88px] text-center tabular-nums">
            {year}年{month}月
          </span>
          <button onClick={() => nav(1)} className="w-10 h-10 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
          <button
            onClick={() => router.push(`/dashboard?year=${today.getFullYear()}&month=${today.getMonth() + 1}`)}
            className="ml-1 px-3 h-8 rounded-full text-[13px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
          >
            今日
          </button>
        </div>
      </div>

      {/* ── Weekday header ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/60">
        {["日","月","火","水","木","金","土"].map((d, i) => (
          <div
            key={d}
            className={`py-1.5 text-center text-[11px] font-semibold tracking-wide ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Week rows ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
        {weeks.map((week, wi) => {
          const tracks = allocate(weekEvents(week, events, filter));
          return (
            <div
              key={wi}
              className="flex-1 flex flex-col min-h-0 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
              style={{
                backgroundImage: "linear-gradient(to right, transparent calc(100%/7*1 - 1px), #f1f5f9 calc(100%/7*1 - 1px), #f1f5f9 calc(100%/7*1), transparent calc(100%/7*1), transparent calc(100%/7*2 - 1px), #f1f5f9 calc(100%/7*2 - 1px), #f1f5f9 calc(100%/7*2), transparent calc(100%/7*2), transparent calc(100%/7*3 - 1px), #f1f5f9 calc(100%/7*3 - 1px), #f1f5f9 calc(100%/7*3), transparent calc(100%/7*3), transparent calc(100%/7*4 - 1px), #f1f5f9 calc(100%/7*4 - 1px), #f1f5f9 calc(100%/7*4), transparent calc(100%/7*4), transparent calc(100%/7*5 - 1px), #f1f5f9 calc(100%/7*5 - 1px), #f1f5f9 calc(100%/7*5), transparent calc(100%/7*5), transparent calc(100%/7*6 - 1px), #f1f5f9 calc(100%/7*6 - 1px), #f1f5f9 calc(100%/7*6), transparent calc(100%/7*6))",
              }}
            >
              {/* Day numbers */}
              <div className="grid grid-cols-7 flex-shrink-0">
                {week.map((cell, di) => {
                  const isToday = isCurMon && cell.cur && cell.dom === today.getDate();
                  const isSel   = cell.cur && cell.dom === selDay;
                  const isSun   = cell.dow === 0;
                  const isSat   = cell.dow === 6;
                  return (
                    <div
                      key={di}
                      onClick={() =>
                        cell.cur && setSelDay((p) => p === cell.dom ? null : cell.dom)
                      }
                      className={`pt-[3px] pb-px pl-1 cursor-pointer group`}
                    >
                      {isToday ? (
                        <span className="inline-flex w-[22px] h-[22px] items-center justify-center rounded-full bg-brand-500 text-white text-[13px] font-bold leading-none">
                          {cell.date}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex w-[22px] h-[22px] items-center justify-center rounded-full text-[13px] font-medium leading-none transition-colors
                            ${!cell.cur ? "text-slate-300 dark:text-slate-600" :
                              isSun ? "text-red-500" :
                              isSat ? "text-blue-500" :
                              "text-slate-700 dark:text-slate-200"}
                            ${isSel ? "bg-brand-100 dark:bg-brand-900/40 ring-1 ring-brand-400" : "group-hover:bg-slate-100 dark:group-hover:bg-slate-800"}
                          `}
                        >
                          {cell.date}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Event pills */}
              {tracks.slice(0, 4).map((track, ti) => {
                type Pill = { ev: PEv; sc: number; span: number };
                const pills: Pill[] = [];
                const seen = new Set<string>();
                let c = 0;
                while (c < 7) {
                  const ev = track[c];
                  if (ev && !seen.has(ev.id)) {
                    seen.add(ev.id);
                    let span = 1;
                    while (c + span < 7 && track[c + span] === ev) span++;
                    pills.push({ ev, sc: c, span });
                    c += span;
                  } else { c++; }
                }

                return (
                  <div key={ti} className="grid grid-cols-7 flex-shrink-0">
                    {pills.map(({ ev, sc, span }) => {
                      const col  = primaryColor(ev.memberIds, members);
                      const pill = PILL[col] ?? PILL.all;
                      return (
                        <button
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); setDetailEv(ev); }}
                          style={{
                            gridColumn: `${sc + 1} / span ${span}`,
                            backgroundColor: pill.bg,
                            color: pill.text,
                          }}
                          className="text-[10.5px] font-semibold leading-[1.5] px-[5px] py-[1px] rounded-[3px] mx-[2px] mb-[2px] overflow-hidden whitespace-nowrap text-ellipsis text-left hover:brightness-95 active:brightness-90 transition-all cursor-pointer"
                          title={ev.title}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* +N overflow */}
              {tracks.length > 4 && (() => {
                const over: Record<number, number> = {};
                tracks.slice(4).forEach((t) =>
                  t.forEach((ev, c) => { if (ev) over[c] = (over[c] ?? 0) + 1; })
                );
                return (
                  <div className="grid grid-cols-7 flex-shrink-0">
                    {Object.entries(over).map(([col, n]) => (
                      <div
                        key={col}
                        style={{ gridColumn: Number(col) + 1 }}
                        className="text-[9px] text-slate-400 font-medium pl-1 pb-px"
                      >
                        +{n}件
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* ── Selected day drawer ─────────────────────────────────────────── */}
      {selDay !== null && (() => {
        const evs = dayEvs(selDay);
        return (
          <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                {month}月{selDay}日
              </span>
              <button
                onClick={() => { setEditEv(null); setShowCreate(true); }}
                className="text-[12px] text-brand-500 font-semibold"
              >
                ＋ 追加
              </button>
            </div>
            <div className="px-3 pb-3 max-h-36 overflow-y-auto space-y-1">
              {evs.length === 0 ? (
                <p className="text-[13px] text-slate-300 dark:text-slate-600 px-1 py-2">
                  予定なし
                </p>
              ) : (
                evs.map((ev) => {
                  const col  = primaryColor(ev.memberIds, members);
                  const pill = PILL[col] ?? PILL.all;
                  const t    = new Date(ev.startAt);
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setDetailEv(ev)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors"
                    >
                      <span
                        className="w-1 h-full min-h-[28px] rounded-full flex-shrink-0"
                        style={{ backgroundColor: AVATAR_BG[col] ?? "#94a3b8" }}
                      />
                      <span className="text-[11px] text-slate-400 w-9 flex-shrink-0 font-mono">
                        {ev.isAllDay ? "終日" : `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`}
                      </span>
                      <span
                        className="text-[13px] font-medium flex-1 truncate px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: pill.bg, color: pill.text }}
                      >
                        {ev.title}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      <button
        onClick={() => { setEditEv(null); setShowCreate(true); }}
        className="fixed bottom-[76px] right-4 w-14 h-14 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white rounded-full shadow-xl shadow-brand-500/30 flex items-center justify-center z-40 transition-all duration-150"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {detailEv && (
        <EventDetailModal
          event={detailEv}
          members={members}
          onClose={() => setDetailEv(null)}
          onEdit={() => {
            setEditEv(detailEv);
            setDetailEv(null);
            setShowCreate(true);
          }}
        />
      )}
      {showCreate && (
        <EventModal
          event={editEv}
          members={members}
          currentMember={currentMember}
          defaultDate={selDay !== null ? new Date(year, month - 1, selDay) : undefined}
          onClose={() => { setShowCreate(false); setEditEv(null); }}
          onSaved={() => { setShowCreate(false); setEditEv(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
