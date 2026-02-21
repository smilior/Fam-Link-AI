"use client";

import { useState } from "react";
import { X, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { ja } from "date-fns/locale";
import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { createEvent, updateEvent, deleteEvent } from "@/lib/actions/calendar";
import type { FamilyMember } from "@/lib/db/types";

type EventData = {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  isAllDay: number | null;
  memberIds: string[];
};

type Props = {
  event?: EventData | null;
  members: FamilyMember[];
  currentMember: FamilyMember;
  defaultDate?: Date;
  onClose: () => void;
  onSaved: () => void;
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

const COLOR_MAP: Record<string, string> = {
  blue: "bg-papa-500",
  pink: "bg-mama-500",
  yellow: "bg-daughter-500",
  green: "bg-son-500",
};

const AVATAR_BG: Record<string, string> = {
  blue: "#3B82F6", pink: "#EC4899", yellow: "#EAB308", green: "#22C55E",
};

type DatePickerSheet = "none" | "start" | "end";

export function EventModal({
  event,
  members,
  currentMember,
  defaultDate,
  onClose,
  onSaved,
}: Props) {
  const isEditing = !!event;
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
  const [location, setLocation] = useState("");
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

      if (isEditing && event) {
        await updateEvent(event.id, { title: title.trim(), startAt, endAt, isAllDay, location: location || undefined, memberIds: selectedMemberIds });
      } else {
        await createEvent({ title: title.trim(), startAt, endAt, isAllDay, location: location || undefined, memberIds: selectedMemberIds });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm("この予定を削除しますか？")) return;
    setIsLoading(true);
    try { await deleteEvent(event.id); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "削除に失敗しました"); }
    finally { setIsLoading(false); }
  };

  const isMultiDay = startDate !== endDate;

  // ── Date picker dialog (centered) ────────────────────────────────────────
  const DateSheet = () => {
    if (sheet === "none") return null;
    const isStart = sheet === "start";
    const currentVal = isStart ? startDate : endDate;
    const selected   = parseISO(currentVal);

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center px-4"
          onClick={() => setSheet("none")}
        >
        {/* Dialog */}
        <div
          className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <span className="text-base font-bold text-slate-800 dark:text-slate-100">
              {isStart ? "開始日" : "終了日"}を選択
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
                else {
                  if (str >= startDate) setEndDate(str);
                  else { setStartDate(str); setEndDate(str); }
                }
              }}
              disabled={isStart ? undefined : { before: parseISO(startDate) }}
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
      </>
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
          <h2 className="text-base font-bold">{isEditing ? "予定を編集" : "予定を追加"}</h2>
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
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full py-3.5 text-red-500 border-2 border-red-100 dark:border-red-900/40 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 text-sm font-semibold transition-colors"
              >
                この予定を削除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Date picker sheet */}
      <DateSheet />
    </>
  );
}
