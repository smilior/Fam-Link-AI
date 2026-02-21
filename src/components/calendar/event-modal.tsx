"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/lib/actions/calendar";
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
  const [date, setDate] = useState(
    event ? toDateStr(event.startAt) : defaultDateStr
  );
  const [startTime, setStartTime] = useState(
    event ? toTimeStr(event.startAt) : "10:00"
  );
  const [endTime, setEndTime] = useState(
    event ? toTimeStr(event.endAt) : "11:00"
  );
  const [isAllDay, setIsAllDay] = useState(event ? !!event.isAllDay : false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    event?.memberIds ?? [currentMember.id]
  );
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (selectedMemberIds.length === 0) {
      setError("参加者を選択してください");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      let startAt: number;
      let endAt: number;

      if (isAllDay) {
        startAt = new Date(`${date}T00:00:00`).getTime();
        endAt = new Date(`${date}T23:59:59`).getTime();
      } else {
        startAt = new Date(`${date}T${startTime}:00`).getTime();
        endAt = new Date(`${date}T${endTime}:00`).getTime();
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold">
          {isEditing ? "予定を編集" : "予定を追加"}
        </h2>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="text-brand-500 font-medium disabled:opacity-50"
        >
          {isLoading ? "保存中..." : "保存"}
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル（必須）"
          className="w-full text-lg font-medium border-0 border-b-2 border-slate-200 dark:border-slate-700 focus:border-brand-500 outline-none pb-2 bg-transparent"
        />

        {/* All day toggle */}
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isAllDay}
            onChange={(e) => setIsAllDay(e.target.checked)}
            className="w-5 h-5 rounded accent-brand-500"
          />
          <span className="text-sm">終日</span>
        </label>

        {/* Date */}
        <div className="space-y-2">
          <label className="text-sm text-slate-500">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-12 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        {/* Time */}
        {!isAllDay && (
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-sm text-slate-500">開始</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-12 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm text-slate-500">終了</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-12 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Members */}
        <div className="space-y-2">
          <label className="text-sm text-slate-500">参加者</label>
          <div className="flex gap-2 flex-wrap">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() =>
                  setSelectedMemberIds((prev) =>
                    prev.includes(m.id)
                      ? prev.filter((id) => id !== m.id)
                      : [...prev, m.id]
                  )
                }
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 transition-all ${selectedMemberIds.includes(m.id) ? `${COLOR_MAP[m.color] || "bg-slate-500"} border-transparent text-white` : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}
              >
                <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold">
                  {m.displayName.charAt(0)}
                </span>
                <span className="text-sm font-medium">{m.displayName}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <label className="text-sm text-slate-500">場所（任意）</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="場所を入力"
            className="w-full h-12 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        {/* Delete button (edit mode only) */}
        {isEditing && (
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="w-full py-3 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 mt-4"
          >
            予定を削除
          </button>
        )}
      </div>
    </div>
  );
}
