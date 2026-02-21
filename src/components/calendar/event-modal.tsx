"use client";

import { useState } from "react";
import { X, CalendarIcon, RefreshCw } from "lucide-react";
import { ja } from "date-fns/locale";
import { parseISO } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  createEventException,
  deleteEventInstance,
  type RecurrenceRule,
} from "@/lib/actions/calendar";
import type { FamilyMember } from "@/lib/db/types";

type EventData = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: number;
  endAt: number;
  isAllDay: number | null;
  memberIds: string[];
  recurrenceRule?: string | null;
  recurrenceInterval?: number | null;
  recurrenceEndAt?: number | null;
  recurrenceDaysOfWeek?: string | null;
  // Set for virtual occurrences (exception create mode)
  masterEventId?: string;
  masterStartAt?: number;
  masterEndAt?: number;
  instanceDate?: number;
  isVirtual?: boolean;
};

type Props = {
  event?: EventData | null;
  /** When set: editing "this occurrence only" — creates an exception */
  exceptionMode?: {
    masterEventId: string;
    instanceDate: number;
  };
  members: FamilyMember[];
  currentMember: FamilyMember;
  defaultDate?: Date;
  onClose: () => void;
  onSaved: () => void;
};

const RECURRENCE_OPTIONS: { value: RecurrenceRule | "none"; label: string }[] = [
  { value: "none",    label: "なし" },
  { value: "daily",  label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly",label: "毎月" },
  { value: "yearly", label: "毎年" },
];

const COLOR_MAP: Record<string, string> = {
  blue: "bg-papa-500",
  pink: "bg-mama-500",
  yellow: "bg-daughter-500",
  green: "bg-son-500",
};
void COLOR_MAP;

const AVATAR_BG: Record<string, string> = {
  blue: "#3B82F6", pink: "#EC4899", yellow: "#EAB308", green: "#22C55E",
};

function toDateStr(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeStr(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateJa(dateStr: string) {
  const d = parseISO(dateStr);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
}

type DatePickerSheet = "none" | "start" | "end" | "recurrenceEnd";

export function EventModal({
  event,
  exceptionMode,
  members,
  currentMember,
  defaultDate,
  onClose,
  onSaved,
}: Props) {
  const isEditing = !!event;
  const isException = !!exceptionMode;

  const defaultDateStr = defaultDate
    ? toDateStr(defaultDate.getTime())
    : toDateStr(Date.now());

  const [title, setTitle]       = useState(event?.title ?? "");
  const [isAllDay, setIsAllDay] = useState(event ? !!event.isAllDay : false);
  const [startDate, setStartDate] = useState(event ? toDateStr(event.startAt) : defaultDateStr);
  const [endDate, setEndDate]     = useState(event ? toDateStr(event.endAt)   : defaultDateStr);
  const [startTime, setStartTime] = useState(event ? toTimeStr(event.startAt) : "10:00");
  const [endTime, setEndTime]     = useState(event ? toTimeStr(event.endAt)   : "11:00");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    event?.memberIds ?? [currentMember.id]
  );
  const [location, setLocation] = useState(event?.location ?? "");

  // Recurrence state — disabled in exception mode
  const [recurrence, setRecurrence] = useState<RecurrenceRule | "none">(
    (event?.recurrenceRule as RecurrenceRule) ?? "none"
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    event?.recurrenceEndAt ? toDateStr(event.recurrenceEndAt) : ""
  );
  // Weekly days-of-week (0=Sun..6=Sat). Pre-populate from event or default to start day.
  const defaultWeekDays = (): number[] => {
    if (event?.recurrenceDaysOfWeek) {
      return event.recurrenceDaysOfWeek.split(",").map(Number);
    }
    return [new Date(event?.startAt ?? Date.now()).getDay()];
  };
  const [weekDays, setWeekDays] = useState<number[]>(defaultWeekDays);

  const toggleWeekDay = (d: number) => {
    setWeekDays((prev) =>
      prev.includes(d)
        ? prev.length > 1 ? prev.filter((x) => x !== d) : prev // 最低1つ必須
        : [...prev, d].sort((a, b) => a - b)
    );
  };

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState("");
  const [sheet, setSheet]         = useState<DatePickerSheet>("none");

  const handleStartDateChange = (dateStr: string) => {
    setStartDate(dateStr);
    if (endDate < dateStr) setEndDate(dateStr);
  };

  const handleSave = async () => {
    if (!title.trim()) { setError("タイトルを入力してください"); return; }
    if (!selectedMemberIds.length) { setError("誰の予定かを選択してください"); return; }
    if (endDate < startDate) { setError("終了日は開始日以降にしてください"); return; }

    setIsLoading(true);
    setError("");
    try {
      let startAt: number, endAt: number;
      if (isAllDay) {
        startAt = new Date(`${startDate}T00:00:00`).getTime();
        endAt   = new Date(`${endDate}T23:59:59`).getTime();
      } else {
        startAt = new Date(`${startDate}T${startTime}:00`).getTime();
        endAt   = new Date(`${endDate}T${endTime}:00`).getTime();
        if (endAt <= startAt) {
          setError("終了日時は開始日時より後にしてください");
          setIsLoading(false);
          return;
        }
      }

      const recurrenceEndAt = recurrenceEndDate
        ? new Date(`${recurrenceEndDate}T23:59:59`).getTime()
        : null;

      const payload = {
        title: title.trim(),
        description: event?.description ?? undefined,
        startAt,
        endAt,
        isAllDay,
        location: location || undefined,
        memberIds: selectedMemberIds,
        recurrenceRule: isException ? null : (recurrence === "none" ? null : recurrence),
        recurrenceEndAt: isException ? null : recurrenceEndAt,
        recurrenceDaysOfWeek: (!isException && recurrence === "weekly" && weekDays.length > 0)
          ? weekDays.join(",")
          : null,
      };

      if (isException && exceptionMode) {
        // Create exception for this occurrence only
        const { recurrenceRule: _r, recurrenceEndAt: _re, ...exceptionPayload } = payload;
        await createEventException(
          exceptionMode.masterEventId,
          exceptionMode.instanceDate,
          exceptionPayload
        );
      } else if (isEditing && event) {
        await updateEvent(event.id, payload);
      } else {
        await createEvent(payload);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;

    if (isException && exceptionMode) {
      if (!confirm("この日の予定のみを削除しますか？")) return;
      setIsLoading(true);
      try {
        await deleteEventInstance(exceptionMode.masterEventId, exceptionMode.instanceDate);
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除に失敗しました");
      } finally {
        setIsLoading(false);
      }
    } else {
      const isRecurring = !!event.recurrenceRule;
      const msg = isRecurring
        ? "この繰り返し予定をすべて削除しますか？"
        : "この予定を削除しますか？";
      if (!confirm(msg)) return;
      setIsLoading(true);
      try {
        await deleteEvent(event.id);
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "削除に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isMultiDay = startDate !== endDate;

  // ── Date picker dialog (centered) ────────────────────────────────────────
  const DateSheet = () => {
    if (sheet === "none") return null;

    const isStart       = sheet === "start";
    const isEnd         = sheet === "end";
    const isRecEnd      = sheet === "recurrenceEnd";
    const currentVal    = isStart ? startDate : isEnd ? endDate : recurrenceEndDate || startDate;
    const selected      = parseISO(currentVal);
    const label         = isStart ? "開始日" : isEnd ? "終了日" : "繰り返し終了日";

    return (
      <div
        className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center px-4"
        onClick={() => setSheet("none")}
      >
        <div
          className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <span className="text-base font-bold text-slate-800 dark:text-slate-100">
              {label}を選択
            </span>
            <button
              onClick={() => setSheet("none")}
              className="px-4 h-8 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full transition-colors"
            >
              完了
            </button>
          </div>
          <div className="flex justify-center px-2 pb-5">
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected}
              locale={ja}
              onSelect={(day) => {
                if (!day) return;
                const str = toDateStr(day.getTime());
                if (isStart) handleStartDateChange(str);
                else if (isEnd) {
                  if (str >= startDate) setEndDate(str);
                  else { setStartDate(str); setEndDate(str); }
                } else {
                  setRecurrenceEndDate(str);
                }
              }}
              disabled={
                isEnd
                  ? { before: parseISO(startDate) }
                  : isRecEnd
                  ? { before: parseISO(startDate) }
                  : undefined
              }
              classNames={{
                root: "rdp-custom",
                months: "flex flex-col",
                month: "space-y-3",
                month_caption: "flex items-center justify-between px-2",
                caption_label: "text-sm font-bold text-slate-800 dark:text-slate-100",
                nav: "flex items-center gap-1",
                button_previous: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500",
                button_next: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500",
                weekdays: "grid grid-cols-7 text-center",
                weekday: "text-[11px] font-semibold text-slate-400 pb-1",
                weeks: "space-y-1",
                week: "grid grid-cols-7",
                day: "flex items-center justify-center",
                day_button: "w-9 h-9 rounded-full text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-700",
                selected: "[&>button]:bg-brand-500 [&>button]:text-white [&>button]:hover:bg-brand-600",
                today: "[&>button]:font-bold [&>button]:text-brand-500",
                outside: "[&>button]:text-slate-300 dark:[&>button]:text-slate-600",
                disabled: "[&>button]:text-slate-200 dark:[&>button]:text-slate-700 [&>button]:cursor-not-allowed",
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-500" />
          </button>
          <div className="text-center">
            <h2 className="text-base font-bold">
              {isException ? "この日の予定を編集" : isEditing ? "予定を編集" : "予定を追加"}
            </h2>
            {isException && (
              <p className="text-[11px] text-slate-400">この日のみ変更します</p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 h-9 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 disabled:opacity-40 text-white text-sm font-semibold rounded-full transition-colors"
          >
            {isLoading ? "保存中..." : "保存"}
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-5 space-y-6">
            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タイトルを入力"
              autoFocus
              className="w-full text-xl font-bold border-0 border-b-2 border-slate-100 dark:border-slate-800 focus:border-brand-500 outline-none pb-3 bg-transparent placeholder:text-slate-200 dark:placeholder:text-slate-700"
            />

            {/* All-day toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">終日</p>
                <p className="text-xs text-slate-400">日付のみ・時刻なし</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAllDay((v) => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${isAllDay ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${isAllDay ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Date & Time card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50">
              {/* Start */}
              <button
                type="button"
                onClick={() => setSheet("start")}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <CalendarIcon className="w-4 h-4 text-brand-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">開始</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                    {formatDateJa(startDate)}
                  </p>
                </div>
                {!isAllDay && (
                  <input
                    type="time"
                    value={startTime}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400 bg-transparent border-0 outline-none w-20 text-right"
                  />
                )}
              </button>

              {/* End */}
              <button
                type="button"
                onClick={() => setSheet("end")}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className="w-4 flex-shrink-0 flex justify-center">
                  <div className={`w-0.5 h-4 rounded-full ${isMultiDay ? "bg-brand-400" : "bg-slate-200 dark:bg-slate-600"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">終了</p>
                  <p className={`text-sm font-semibold mt-0.5 ${isMultiDay ? "text-brand-600 dark:text-brand-400" : "text-slate-800 dark:text-slate-100"}`}>
                    {formatDateJa(endDate)}
                    {isMultiDay && (
                      <span className="ml-2 text-[10px] bg-brand-100 dark:bg-brand-900/40 text-brand-600 px-1.5 py-0.5 rounded-full font-bold">
                        複数日
                      </span>
                    )}
                  </p>
                </div>
                {!isAllDay && (
                  <input
                    type="time"
                    value={endTime}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400 bg-transparent border-0 outline-none w-20 text-right"
                  />
                )}
              </button>
            </div>

            {/* Recurrence (hidden in exception mode) */}
            {!isException && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">繰り返し</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setRecurrence(opt.value);
                        // 毎週に切り替えた際、曜日未設定なら開始日の曜日をデフォルト設定
                        if (opt.value === "weekly" && weekDays.length === 0) {
                          setWeekDays([new Date(startDate).getDay()]);
                        }
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-sm font-medium border-2 transition-all duration-150 ${
                        recurrence === opt.value
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-brand-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* 曜日選択（毎週のみ） */}
                {recurrence === "weekly" && (
                  <div className="flex gap-1.5">
                    {["日","月","火","水","木","金","土"].map((label, i) => {
                      const on = weekDays.includes(i);
                      const isSun = i === 0;
                      const isSat = i === 6;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleWeekDay(i)}
                          className={`flex-1 h-9 rounded-lg text-sm font-bold border-2 transition-all duration-150 ${
                            on
                              ? isSun
                                ? "bg-red-500 border-red-500 text-white"
                                : isSat
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "bg-brand-500 border-brand-500 text-white"
                              : "border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Recurrence end date */}
                {recurrence !== "none" && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl overflow-hidden">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSheet("recurrenceEnd")}
                      onKeyDown={(e) => e.key === "Enter" && setSheet("recurrenceEnd")}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      <p className="text-sm text-slate-600 dark:text-slate-300">繰り返し終了日</p>
                      <div className="flex items-center gap-2">
                        {recurrenceEndDate ? (
                          <>
                            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                              {formatDateJa(recurrenceEndDate)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setRecurrenceEndDate(""); }}
                              className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-slate-400">なし（無制限）</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Who is this for */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  誰の予定？
                </p>
                <p className="text-xs text-slate-400 mt-0.5">複数選択できます</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => {
                  const isSel = selectedMemberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setSelectedMemberIds((prev) =>
                          prev.includes(m.id)
                            ? prev.filter((id) => id !== m.id)
                            : [...prev, m.id]
                        )
                      }
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all duration-150 ${
                        isSel
                          ? "border-transparent shadow-sm"
                          : "border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800"
                      }`}
                      style={isSel ? { backgroundColor: AVATAR_BG[m.color] ?? "#6366f1" } : {}}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isSel ? "bg-white/25 text-white" : "text-white"
                        }`}
                        style={!isSel ? { backgroundColor: AVATAR_BG[m.color] ?? "#6366f1" } : {}}
                      >
                        {m.displayName.charAt(0)}
                      </span>
                      <span className={`text-sm font-semibold ${isSel ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>
                        {m.displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                場所
                <span className="ml-1.5 text-xs text-slate-400 font-normal">任意</span>
              </p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="場所を入力"
                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              />
            </div>

            {/* Delete */}
            {(isEditing || isException) && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full py-3.5 text-red-500 border-2 border-red-100 dark:border-red-900/40 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 text-sm font-semibold transition-colors"
              >
                {isException ? "この日の予定を削除" : "この予定を削除"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Date picker dialog */}
      <DateSheet />
    </>
  );
}
