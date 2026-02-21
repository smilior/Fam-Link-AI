"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { EventModal } from "./event-modal";
import type { FamilyMember } from "@/lib/db/types";

type EventWithMembers = {
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

const COLOR_MAP: Record<string, string> = {
  blue: "bg-papa-500",
  pink: "bg-mama-500",
  yellow: "bg-daughter-500",
  green: "bg-son-500",
};

const BORDER_COLOR_MAP: Record<string, string> = {
  blue: "border-papa-500",
  pink: "border-mama-500",
  yellow: "border-daughter-500",
  green: "border-son-500",
};

export function MonthCalendar({
  year,
  month,
  events,
  members,
  currentMember,
}: Props) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filteredMemberIds, setFilteredMemberIds] = useState<string[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithMembers | null>(
    null
  );

  const getDaysInMonth = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++)
      days.push(new Date(year, month - 1, d));
    return days;
  };

  const getEventsForDay = (date: Date) => {
    const dayStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();
    const dayEnd = dayStart + 86400000 - 1;
    return events.filter((e) => {
      const inDay = e.startAt <= dayEnd && e.endAt >= dayStart;
      const inFilter =
        filteredMemberIds.length === 0 ||
        e.memberIds.some((id) => filteredMemberIds.includes(id));
      return inDay && inFilter;
    });
  };

  const handleMonthChange = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    }
    if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    router.push(`/dashboard?year=${newYear}&month=${newMonth}`);
  };

  const today = new Date();
  const days = getDaysInMonth();

  return (
    <div className="flex flex-col h-full">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => handleMonthChange(-1)}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-lg font-semibold">
          {year}年{month}月
        </span>
        <button
          onClick={() => handleMonthChange(1)}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Member filter */}
      <div className="flex gap-2 px-4 pb-3">
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() =>
              setFilteredMemberIds((prev) =>
                prev.includes(m.id)
                  ? prev.filter((id) => id !== m.id)
                  : [...prev, m.id]
              )
            }
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold transition-opacity ${COLOR_MAP[m.color] || "bg-slate-400"} ${filteredMemberIds.length > 0 && !filteredMemberIds.includes(m.id) ? "opacity-30" : "opacity-100"}`}
          >
            {m.displayName.charAt(0)}
          </button>
        ))}
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 text-center text-xs text-slate-500 px-1 pb-1">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div
            key={d}
            className={
              d === "日"
                ? "text-red-500"
                : d === "土"
                  ? "text-blue-500"
                  : ""
            }
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 px-1 gap-0.5">
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const isToday =
            day.getFullYear() === today.getFullYear() &&
            day.getMonth() === today.getMonth() &&
            day.getDate() === today.getDate();
          const isSelected =
            selectedDate?.getDate() === day.getDate() &&
            selectedDate?.getMonth() === day.getMonth() &&
            selectedDate?.getFullYear() === day.getFullYear();
          const dayEvents = getEventsForDay(day);
          return (
            <button
              key={day.toISOString()}
              onClick={() =>
                setSelectedDate((prev) =>
                  prev?.getDate() === day.getDate() &&
                  prev?.getMonth() === day.getMonth() &&
                  prev?.getFullYear() === day.getFullYear()
                    ? null
                    : day
                )
              }
              className={`flex flex-col items-center py-1 rounded-lg min-h-[52px] ${isSelected ? "bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-500" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <span
                className={`w-6 h-6 flex items-center justify-center text-sm rounded-full ${isToday ? "bg-brand-500 text-white font-bold" : day.getDay() === 0 ? "text-red-500" : day.getDay() === 6 ? "text-blue-500" : ""}`}
              >
                {day.getDate()}
              </span>
              {/* Event dots (max 3) */}
              <div className="flex gap-0.5 flex-wrap justify-center mt-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const memberColors = e.memberIds
                    .map((mid) => members.find((m) => m.id === mid)?.color)
                    .filter(Boolean);
                  return (
                    <span
                      key={e.id}
                      className={`w-1.5 h-1.5 rounded-full ${COLOR_MAP[memberColors[0] || ""] || "bg-slate-400"}`}
                    />
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[8px] text-slate-500">
                    +{dayEvents.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day event list */}
      {selectedDate && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 max-h-48 overflow-y-auto">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
            {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日
          </p>
          {getEventsForDay(selectedDate).length === 0 ? (
            <p className="text-sm text-slate-400">予定なし</p>
          ) : (
            getEventsForDay(selectedDate).map((e) => {
              const startTime = new Date(e.startAt);
              const memberColors = e.memberIds
                .map((mid) => members.find((m) => m.id === mid)?.color)
                .filter(Boolean);
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    setEditingEvent(e);
                    setShowEventModal(true);
                  }}
                  className={`w-full text-left flex items-center gap-3 py-2 px-3 rounded-lg mb-1 border-l-4 bg-white dark:bg-slate-800 shadow-sm ${BORDER_COLOR_MAP[memberColors[0] || ""] || "border-slate-300"}`}
                >
                  <span className="text-xs text-slate-500">
                    {e.isAllDay
                      ? "終日"
                      : `${String(startTime.getHours()).padStart(2, "0")}:${String(startTime.getMinutes()).padStart(2, "0")}`}
                  </span>
                  <span className="text-sm font-medium">{e.title}</span>
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
        className="fixed bottom-20 right-4 w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Event modal */}
      {showEventModal && (
        <EventModal
          event={editingEvent}
          members={members}
          currentMember={currentMember}
          defaultDate={selectedDate || undefined}
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
