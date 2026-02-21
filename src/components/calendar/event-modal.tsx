"use client";

import { useState } from "react";
import { X } from "lucide-react";
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

const COLOR_MAP: Record<string, string> = {
  blue: "bg-papa-500",
  pink: "bg-mama-500",
  yellow: "bg-daughter-500",
  green: "bg-son-500",
};

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

  const [title, setTitle] = useState(event?.title ?? "");
  const [isAllDay, setIsAllDay] = useState(event ? !!event.isAllDay : false);
  const [startDate, setStartDate] = useState(
    event ? toDateStr(event.startAt) : defaultDateStr
  );
  const [endDate, setEndDate] = useState(
    event ? toDateStr(event.endAt) : defaultDateStr
  );
  const [startTime, setStartTime] = useState(
    event ? toTimeStr(event.startAt) : "10:00"
  );
  const [endTime, setEndTime] = useState(
    event ? toTimeStr(event.endAt) : "11:00"
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    event?.memberIds ?? [currentMember.id]
  );
  const [location, setLocation] = useState(
    event
      ? "" // location not stored in EventData type yet; placeholder
      : ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // When start date changes, auto-update end date if end < start
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate < val) setEndDate(val);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError("誰の予定かを選択してください");
      return;
    }
    if (endDate < startDate) {
      setError("終了日は開始日以降にしてください");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      let startAt: number;
      let endAt: number;

      if (isAllDay) {
        startAt = new Date(`${startDate}T00:00:00`).getTime();
        endAt = new Date(`${endDate}T23:59:59`).getTime();
      } else {
        startAt = new Date(`${startDate}T${startTime}:00`).getTime();
        endAt = new Date(`${endDate}T${endTime}:00`).getTime();
        if (endAt <= startAt) {
          setError("終了日時は開始日時より後にしてください");
          setIsLoading(false);
          return;
        }
      }

      if (isEditing && event) {
        await updateEvent(event.id, {
          title: title.trim(),
          startAt,
          endAt,
          isAllDay,
          location: location || undefined,
          memberIds: selectedMemberIds,
        });
      } else {
        await createEvent({
          title: title.trim(),
          startAt,
          endAt,
          isAllDay,
          location: location || undefined,
          memberIds: selectedMemberIds,
        });
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
    try {
      await deleteEvent(event.id);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const isMultiDay = startDate !== endDate;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-base">
          {isEditing ? "予定を編集" : "予定を追加"}
        </h2>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="text-brand-500 font-semibold disabled:opacity-40 min-w-[48px] text-right"
        >
          {isLoading ? "保存中..." : "保存"}
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 space-y-5">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトル（必須）"
            autoFocus
            className="w-full text-lg font-medium border-0 border-b-2 border-slate-200 dark:border-slate-700 focus:border-brand-500 outline-none pb-2 bg-transparent placeholder:text-slate-300 dark:placeholder:text-slate-600"
          />

          {/* All-day toggle */}
          <label className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              終日
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isAllDay}
              onClick={() => setIsAllDay((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                isAllDay ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  isAllDay ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>

          {/* Date & Time */}
          <div className="space-y-3">
            {/* Start row */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 w-10 flex-shrink-0">開始</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="flex-1 h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none text-sm"
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-28 h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-mono"
                />
              )}
            </div>

            {/* End row */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 w-10 flex-shrink-0">終了</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`flex-1 h-11 px-3 rounded-lg border focus:ring-2 focus:ring-brand-500 outline-none text-sm bg-white dark:bg-slate-800 ${
                  isMultiDay
                    ? "border-brand-400 dark:border-brand-500 ring-1 ring-brand-300"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              />
              {!isAllDay && (
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-28 h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-mono"
                />
              )}
            </div>

            {/* Multi-day hint */}
            {isMultiDay && (
              <p className="text-xs text-brand-500 pl-12">
                複数日の予定
              </p>
            )}
          </div>

          {/* Who is this for */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              誰の予定？
              <span className="ml-1 text-xs text-slate-400 font-normal">（複数選択可）</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const isSelected = selectedMemberIds.includes(m.id);
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
                    className={`flex items-center gap-2 pl-2 pr-4 py-2 rounded-full border-2 transition-all ${
                      isSelected
                        ? `${COLOR_MAP[m.color] || "bg-slate-500"} border-transparent text-white`
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isSelected
                          ? "bg-white/25 text-white"
                          : `${COLOR_MAP[m.color] || "bg-slate-300"} text-white`
                      }`}
                    >
                      {m.displayName.charAt(0)}
                    </span>
                    <span className="text-sm font-medium">
                      {m.displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              場所
              <span className="ml-1 text-xs text-slate-400 font-normal">（任意）</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="場所を入力"
              className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none text-sm"
            />
          </div>

          {/* Delete button (edit mode only) */}
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="w-full py-3 text-red-500 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 text-sm font-medium"
            >
              この予定を削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
