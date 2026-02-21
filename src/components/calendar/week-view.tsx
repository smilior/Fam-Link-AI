"use client";

import { useState, useRef, useEffect } from "react";
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
  startOfWeek: Date;
  events: EventWithMembers[];
  members: FamilyMember[];
  currentMember: FamilyMember;
};

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const COLOR_MAP: Record<string, string> = {
  blue: "bg-papa-200 border-papa-500 text-papa-700",
  pink: "bg-mama-200 border-mama-500 text-mama-700",
  yellow: "bg-daughter-200 border-daughter-500 text-daughter-700",
  green: "bg-son-200 border-son-500 text-son-700",
};

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeekView({
  startOfWeek,
  events,
  members,
  currentMember,
}: Props) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventWithMembers | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const today = new Date();

  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours();
      const scrollTo = Math.max(0, (currentHour - START_HOUR - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  const handleWeekChange = (delta: number) => {
    const newStart = new Date(startOfWeek);
    newStart.setDate(startOfWeek.getDate() + delta * 7);
    router.push(`/dashboard/week?date=${formatDate(newStart)}`);
  };

  const getEventsForDay = (date: Date) => {
    const dayStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    ).getTime();
    const dayEnd = dayStart + 86400000 - 1;
    return events.filter(
      (e) => e.startAt <= dayEnd && e.endAt >= dayStart
    );
  };

  const getEventPosition = (event: EventWithMembers) => {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const startMinutes =
      (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const endMinutes = (end.getHours() - START_HOUR) * 60 + end.getMinutes();
    const top = Math.max(0, (startMinutes / 60) * HOUR_HEIGHT);
    const height = Math.max(
      20,
      ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT
    );
    return { top, height };
  };

  const nowMinutes =
    (today.getHours() - START_HOUR) * 60 + today.getMinutes();
  const nowLineTop = (nowMinutes / 60) * HOUR_HEIGHT;
  const isCurrentWeek = weekDays.some(
    (d) =>
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
  );

  return (
    <div className="flex flex-col h-full">
      {/* Week header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => handleWeekChange(-1)}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold">
          {startOfWeek.getMonth() + 1}月{startOfWeek.getDate()}日 -{" "}
          {weekDays[6].getMonth() + 1}月{weekDays[6].getDate()}日
        </span>
        <button
          onClick={() => handleWeekChange(1)}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-slate-200 dark:border-slate-700">
        <div />
        {weekDays.map((day, i) => {
          const isToday =
            day.getFullYear() === today.getFullYear() &&
            day.getMonth() === today.getMonth() &&
            day.getDate() === today.getDate();
          return (
            <div key={i} className="text-center py-2">
              <div
                className={`text-xs ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500"}`}
              >
                {DAY_LABELS[i]}
              </div>
              <div
                className={`w-7 h-7 mx-auto flex items-center justify-center text-sm rounded-full ${isToday ? "bg-brand-500 text-white font-bold" : ""}`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div
          className="grid grid-cols-[40px_repeat(7,1fr)] relative"
          style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
        >
          {/* Time labels */}
          <div className="relative">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="absolute right-1 text-[10px] text-slate-400 -translate-y-1/2"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {START_HOUR + i}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayEvents = getEventsForDay(day).filter((e) => !e.isAllDay);
            return (
              <div
                key={dayIndex}
                className="relative border-l border-slate-100 dark:border-slate-800"
              >
                {/* Hour grid lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    className="absolute w-full border-t border-slate-100 dark:border-slate-800"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const { top, height } = getEventPosition(event);
                  const memberColor =
                    event.memberIds
                      .map(
                        (mid) => members.find((m) => m.id === mid)?.color
                      )
                      .filter(Boolean)[0] || "";
                  return (
                    <button
                      key={event.id}
                      onClick={() => {
                        setEditingEvent(event);
                        setSelectedDate(day);
                        setShowEventModal(true);
                      }}
                      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[10px] leading-tight overflow-hidden border-l-2 ${COLOR_MAP[memberColor] || "bg-slate-200 border-slate-400 text-slate-700"}`}
                      style={{ top, height }}
                    >
                      <span className="font-medium line-clamp-2">
                        {event.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Current time line */}
          {isCurrentWeek && nowMinutes >= 0 && nowMinutes <= TOTAL_HOURS * 60 && (
            <div
              className="absolute left-[40px] right-0 h-0.5 bg-red-500 z-10 pointer-events-none"
              style={{ top: nowLineTop }}
            >
              <div className="absolute -left-1.5 -top-1 w-3 h-3 bg-red-500 rounded-full" />
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => {
          setEditingEvent(null);
          setSelectedDate(undefined);
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
          defaultDate={selectedDate}
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
