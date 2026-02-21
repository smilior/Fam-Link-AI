"use client";

import { X, Pencil, MapPin, Clock } from "lucide-react";
import { MemberAvatar } from "@/components/member/member-avatar";
import type { FamilyMember } from "@/lib/db/types";

type EventData = {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  isAllDay: number | null;
  memberIds: string[];
  description?: string | null;
  location?: string | null;
};

type Props = {
  event: EventData;
  members: FamilyMember[];
  onClose: () => void;
  onEdit: () => void;
};

const STAMPS = [
  { type: "thanks", emoji: "\u{1F64F}", label: "ありがとう" },
  { type: "ok", emoji: "\u{1F44C}", label: "OK" },
  { type: "cheer", emoji: "\u{1F389}", label: "がんばれ" },
  { type: "tired", emoji: "\u{1F62B}", label: "おつかれ" },
  { type: "like", emoji: "\u{2764}\u{FE0F}", label: "いいね" },
] as const;

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isSameDay(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

export function EventDetailModal({ event, members, onClose, onEdit }: Props) {
  const eventMembers = members.filter((m) => event.memberIds.includes(m.id));
  const isAllDay = !!event.isAllDay;
  const multiDay = !isSameDay(event.startAt, event.endAt);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold">予定の詳細</h2>
        <button
          onClick={onEdit}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Pencil className="w-5 h-5 text-brand-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Title */}
        <h3 className="text-xl font-bold">{event.title}</h3>

        {/* Date/Time */}
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
          <div className="text-sm space-y-0.5">
            {isAllDay ? (
              multiDay ? (
                <p>{formatDate(event.startAt)}（終日）〜 {formatDate(event.endAt)}（終日）</p>
              ) : (
                <p>{formatDate(event.startAt)}（終日）</p>
              )
            ) : (
              multiDay ? (
                <>
                  <p>{formatDate(event.startAt)} {formatTime(event.startAt)}</p>
                  <p className="text-slate-500">〜 {formatDate(event.endAt)} {formatTime(event.endAt)}</p>
                </>
              ) : (
                <>
                  <p>{formatDate(event.startAt)} {formatTime(event.startAt)}</p>
                  <p className="text-slate-500">〜 {formatTime(event.endAt)}</p>
                </>
              )
            )}
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-sm">{event.location}</p>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
            {event.description}
          </p>
        )}

        {/* Members */}
        <div className="space-y-2">
          <p className="text-sm text-slate-500">参加メンバー</p>
          <div className="flex gap-3 flex-wrap">
            {eventMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <MemberAvatar displayName={m.displayName} color={m.color} size="md" />
                <span className="text-sm font-medium">{m.displayName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stamps */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500">スタンプ</p>
          <div className="flex gap-3">
            {STAMPS.map((stamp) => (
              <button
                key={stamp.type}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="text-2xl">{stamp.emoji}</span>
                <span className="text-[10px] text-slate-500">
                  {stamp.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
