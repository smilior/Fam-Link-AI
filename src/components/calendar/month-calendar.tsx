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

// Pill colors (member-100 bg + member-700 text)
const PILL_COLORS: Record<string, { bg: string; text: string }> = {
  blue:   { bg: "#DBEAFE", text: "#1D4ED8" }, // papa
  pink:   { bg: "#FCE7F3", text: "#BE185D" }, // mama
  yellow: { bg: "#FEF9C3", text: "#A16207" }, // daughter
  green:  { bg: "#DCFCE7", text: "#15803D" }, // son
  all:    { bg: "#E0E7FF", text: "#4338CA" }, // brand/all
};

const BG_COLOR_MAP: Record<string, string> = {
  blue:   "bg-papa-500",
  pink:   "bg-mama-500",
  yellow: "bg-daughter-500",
  green:  "bg-son-500",
};

const RING_COLOR_MAP: Record<string, string> = {
  blue:   "ring-papa-200",
  pink:   "ring-mama-200",
  yellow: "ring-daughter-200",
  green:  "ring-son-200",
};

function getPrimaryColor(memberIds: string[], members: FamilyMember[]): string {
  if (memberIds.length === 0) return "all";
  const member = members.find((m) => m.id === memberIds[0]);
  return member?.color || "all";
}

type WeekDay = {
  date: number;      // display number
  dayOfMonth: number; // actual day in current month (0 if not current)
  isCurrent: boolean;
  dow: number; // 0=Sun
};

type PlacedEvent = EventWithMembers & {
  _startCol: number;
  _endCol: number;
  _isMulti: boolean;
};

function buildWeeks(year: number, month: number): WeekDay[][] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const dim = new Date(year, month, 0).getDate();
  const dimPrev = new Date(year, month - 1, 0).getDate();
  const weeks: WeekDay[][] = [];

  for (let w = 0; w < 6; w++) {
    const week: WeekDay[] = [];
    for (let d = 0; d < 7; d++) {
      const actual = 1 - firstDow + w * 7 + d;
      let display: number, dayOfMonth: number, isCurrent: boolean;
      if (actual < 1) {
        display = dimPrev + actual;
        dayOfMonth = 0;
        isCurrent = false;
      } else if (actual > dim) {
        display = actual - dim;
        dayOfMonth = 0;
        isCurrent = false;
      } else {
        display = actual;
        dayOfMonth = actual;
        isCurrent = true;
      }
      week.push({ date: display, dayOfMonth, isCurrent, dow: d });
    }
    weeks.push(week);
    if (1 - firstDow + (w + 1) * 7 > dim + 7) break;
  }
  // Trim last week if entirely next month
  while (
    weeks.length > 5 &&
    weeks[weeks.length - 1].every((d) => !d.isCurrent)
  )
    weeks.pop();

  return weeks;
}

function getEventsForWeek(
  week: WeekDay[],
  events: EventWithMembers[],
  filteredMemberIds: string[]
): PlacedEvent[] {
  const currentDays = week.filter((d) => d.isCurrent);
  if (currentDays.length === 0) return [];

  const wFirst = currentDays[0].dayOfMonth;
  const wLast = currentDays[currentDays.length - 1].dayOfMonth;

  const result: PlacedEvent[] = [];
  events.forEach((ev) => {
    if (
      filteredMemberIds.length > 0 &&
      !ev.memberIds.some((id) => filteredMemberIds.includes(id))
    )
      return;

    const eStart = new Date(ev.startAt).getDate();
    const eEnd = new Date(ev.endAt).getDate();

    if (eEnd < wFirst || eStart > wLast) return;

    // Find occupied columns in this week
    const cols: number[] = [];
    week.forEach((d, i) => {
      if (d.isCurrent && d.dayOfMonth >= eStart && d.dayOfMonth <= eEnd)
        cols.push(i);
    });
    if (cols.length === 0) return;

    result.push({
      ...ev,
      _startCol: cols[0],
      _endCol: cols[cols.length - 1],
      _isMulti: eStart !== eEnd,
    });
  });
  return result;
}

function allocateTracks(events: PlacedEvent[]): (PlacedEvent | null)[][] {
  // Multi-day first, then by start col
  const sorted = [...events].sort((a, b) => {
    if (a._isMulti && !b._isMulti) return -1;
    if (!a._isMulti && b._isMulti) return 1;
    return a._startCol - b._startCol;
  });

  const tracks: (PlacedEvent | null)[][] = [];
  sorted.forEach((ev) => {
    let placed = false;
    for (const track of tracks) {
      let ok = true;
      for (let c = ev._startCol; c <= ev._endCol; c++) {
        if (track[c]) { ok = false; break; }
      }
      if (ok) {
        for (let c = ev._startCol; c <= ev._endCol; c++) track[c] = ev;
        placed = true;
        break;
      }
    }
    if (!placed) {
      const newTrack: (PlacedEvent | null)[] = Array(7).fill(null);
      for (let c = ev._startCol; c <= ev._endCol; c++) newTrack[c] = ev;
      tracks.push(newTrack);
    }
  });
  return tracks;
}

export function MonthCalendar({
  year,
  month,
  events,
  members,
  currentMember,
}: Props) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filteredMemberIds, setFilteredMemberIds] = useState<string[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithMembers | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventWithMembers | null>(null);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month - 1;
  const todayDate = today.getDate();

  const handleMonthChange = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    router.push(`/dashboard?year=${newYear}&month=${newMonth}`);
  };

  const goToday = () => {
    const now = new Date();
    router.push(`/dashboard?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
  };

  const toggleFilter = (memberId: string) => {
    setFilteredMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const weeks = buildWeeks(year, month);

  const getSelectedDayEvents = () => {
    if (selectedDay === null) return [];
    const dayStart = new Date(year, month - 1, selectedDay).getTime();
    const dayEnd = dayStart + 86400000 - 1;
    return events.filter((e) => {
      const inDay = e.startAt <= dayEnd && e.endAt >= dayStart;
      const inFilter =
        filteredMemberIds.length === 0 ||
        e.memberIds.some((id) => filteredMemberIds.includes(id));
      return inDay && inFilter;
    });
  };

  const defaultDate =
    selectedDay !== null ? new Date(year, month - 1, selectedDay) : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Combined header: member filters left, month nav right */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
        {/* Member avatar filters */}
        <div className="flex items-center gap-1">
          {members.map((m) => {
            const isActive =
              filteredMemberIds.length === 0 ||
              filteredMemberIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleFilter(m.id)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 transition-all ${BG_COLOR_MAP[m.color] || "bg-slate-400"} ${RING_COLOR_MAP[m.color] || "ring-slate-200"} ${isActive ? "opacity-100" : "opacity-30"}`}
              >
                {m.displayName.charAt(0)}
              </button>
            );
          })}
        </div>
        {/* Month navigation */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleMonthChange(-1)}
            className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-base font-bold min-w-[88px] text-center">
            {year}年{month}月
          </h2>
          <button
            onClick={() => handleMonthChange(1)}
            className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-1 px-2.5 h-11 flex items-center text-sm font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 rounded-full"
          >
            今日
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
          <div
            key={d}
            className={`text-center text-sm font-medium py-1.5 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-400 dark:text-slate-500"}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {weeks.map((week, wi) => {
          const weekEvts = getEventsForWeek(week, events, filteredMemberIds);
          const tracks = allocateTracks(weekEvts);
          const isLastWeek = wi === weeks.length - 1;

          return (
            <div
              key={wi}
              className={`flex-1 flex flex-col min-h-0 overflow-hidden ${!isLastWeek ? "border-b border-slate-200 dark:border-slate-700" : ""}`}
              style={{
                backgroundSize: "calc(100% / 7) 100%",
                backgroundImage:
                  "linear-gradient(to right, transparent calc(100% - 1px), #f1f5f9 1px)",
              }}
            >
              {/* Day numbers row */}
              <div className="grid grid-cols-7 flex-shrink-0">
                {week.map((day, di) => {
                  const isToday =
                    isCurrentMonth &&
                    day.isCurrent &&
                    day.dayOfMonth === todayDate;
                  const isSelected =
                    day.isCurrent && day.dayOfMonth === selectedDay;
                  return (
                    <div
                      key={di}
                      className="py-0.5 px-1 cursor-pointer"
                      onClick={() =>
                        day.isCurrent &&
                        setSelectedDay((prev) =>
                          prev === day.dayOfMonth ? null : day.dayOfMonth
                        )
                      }
                    >
                      {isToday ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-[13px] font-bold">
                          {day.date}
                        </span>
                      ) : (
                        <span
                          className={`text-[13px] font-medium ${!day.isCurrent ? "text-slate-300 dark:text-slate-600" : day.dow === 0 ? "text-red-600 dark:text-red-400" : day.dow === 6 ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"} ${isSelected ? "underline decoration-brand-500" : ""}`}
                        >
                          {day.date}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Event tracks (up to 4) */}
              {tracks.slice(0, 4).map((track, ti) => {
                const pills: {
                  ev: PlacedEvent;
                  startCol: number;
                  span: number;
                }[] = [];
                const seen = new Set<string>();
                let col = 0;
                while (col < 7) {
                  const ev = track[col];
                  if (ev && !seen.has(ev.id)) {
                    seen.add(ev.id);
                    let span = 1;
                    while (col + span < 7 && track[col + span] === ev)
                      span++;
                    pills.push({ ev, startCol: col, span });
                    col += span;
                  } else {
                    col++;
                  }
                }

                return (
                  <div key={ti} className="grid grid-cols-7 flex-shrink-0">
                    {pills.map(({ ev, startCol, span }) => {
                      const color = getPrimaryColor(ev.memberIds, members);
                      const pillColor =
                        PILL_COLORS[color] || PILL_COLORS.all;
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailEvent(ev);
                            setShowDetailModal(true);
                          }}
                          style={{
                            gridColumn: `${startCol + 1} / span ${span}`,
                            backgroundColor: pillColor.bg,
                            color: pillColor.text,
                          }}
                          className="text-[10.5px] leading-[1.45] font-medium px-[3px] py-px rounded-[3px] mx-px mb-px overflow-hidden whitespace-nowrap text-ellipsis cursor-pointer"
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Selected day event list */}
      {selectedDay !== null && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 max-h-44 overflow-y-auto flex-shrink-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
            {month}月{selectedDay}日
          </p>
          {getSelectedDayEvents().length === 0 ? (
            <p className="text-sm text-slate-400">予定なし</p>
          ) : (
            getSelectedDayEvents().map((e) => {
              const startTime = new Date(e.startAt);
              const color = getPrimaryColor(e.memberIds, members);
              const pillColor = PILL_COLORS[color] || PILL_COLORS.all;
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    setDetailEvent(e);
                    setShowDetailModal(true);
                  }}
                  className="w-full text-left flex items-center gap-3 py-1.5 px-2 rounded-lg mb-1 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <span className="text-xs text-slate-500 w-9 flex-shrink-0 font-mono">
                    {e.isAllDay
                      ? "終日"
                      : `${String(startTime.getHours()).padStart(2, "0")}:${String(startTime.getMinutes()).padStart(2, "0")}`}
                  </span>
                  <span
                    className="text-sm font-medium px-1.5 py-0.5 rounded-sm overflow-hidden whitespace-nowrap text-ellipsis flex-1"
                    style={{
                      backgroundColor: pillColor.bg,
                      color: pillColor.text,
                    }}
                  >
                    {e.title}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => {
          setEditingEvent(null);
          setShowEventModal(true);
        }}
        className="fixed bottom-20 right-4 w-14 h-14 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Event detail modal */}
      {showDetailModal && detailEvent && (
        <EventDetailModal
          event={detailEvent}
          members={members}
          onClose={() => {
            setShowDetailModal(false);
            setDetailEvent(null);
          }}
          onEdit={() => {
            setShowDetailModal(false);
            setEditingEvent(detailEvent);
            setDetailEvent(null);
            setShowEventModal(true);
          }}
        />
      )}

      {/* Event modal */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          members={members}
          currentMember={currentMember}
          defaultDate={defaultDate}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
          }}
          onSaved={() => {
            setShowEventModal(false);
            setEditingEvent(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
