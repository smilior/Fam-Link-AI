"use client";

import { signOut } from "@/lib/auth-client";
import {
  addNonUserMember,
  updateFamilyGroupName,
  updateMemberDisplayName,
  updateMemberRole,
  deleteMyAccount,
} from "@/lib/actions/family";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member/member-avatar";
import { Copy, Check, LogOut, Plus, X, Smartphone, Pencil, Mail, AlertTriangle, Bell, BellOff } from "lucide-react";

type Member = {
  id: string;
  familyGroupId: string;
  userId: string | null;
  role: string;
  displayName: string;
  color: string;
  avatarUrl: string | null;
  createdAt: number;
};

type FamilyData = {
  group: {
    id: string;
    name: string;
    inviteCode: string;
    createdAt: number;
  };
  members: Member[];
};

const ROLE_LABELS: Record<string, string> = {
  papa: "パパ",
  mama: "ママ",
  daughter: "娘",
  son: "息子",
};

const ROLE_OPTIONS = [
  { value: "daughter", label: "娘" },
  { value: "son", label: "息子" },
];

const ALL_ROLES = [
  { value: "papa",     label: "パパ" },
  { value: "mama",     label: "ママ" },
  { value: "daughter", label: "娘" },
  { value: "son",      label: "息子" },
];

// ── Inline edit field ──────────────────────────────────────────────────────────
function InlineEdit({
  value,
  onSave,
  onCancel,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!val.trim()) { setErr("入力してください"); return; }
    setSaving(true);
    setErr("");
    try { await onSave(val.trim()); }
    catch (e) { setErr(e instanceof Error ? e.message : "エラーが発生しました"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-2">
      <input
        autoFocus
        type="text"
        value={val}
        onChange={(e) => { setVal(e.target.value); setErr(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
        placeholder={placeholder}
        maxLength={30}
        className="w-full h-10 px-3 rounded-lg border border-brand-400 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="flex-1">
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="flex-1">
          キャンセル
        </Button>
      </div>
    </div>
  );
}

// ── Member edit (name + role) ─────────────────────────────────────────────────
function MemberEdit({
  memberId,
  initialName,
  initialRole,
  onSave,
  onCancel,
}: {
  memberId: string;
  initialName: string;
  initialRole: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [role, setRole] = useState(initialRole);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    if (!name.trim()) { setErr("名前を入力してください"); return; }
    setSaving(true);
    setErr("");
    try {
      const tasks: Promise<void>[] = [];
      if (name.trim() !== initialName) {
        tasks.push(updateMemberDisplayName(memberId, name.trim()));
      }
      if (role !== initialRole) {
        tasks.push(updateMemberRole(memberId, role));
      }
      await Promise.all(tasks);
      onSave();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
      {/* Role selector */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">続柄</p>
        <div className="grid grid-cols-4 gap-1.5">
          {ALL_ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={`py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                role === r.value
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                  : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {/* Name input */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">名前・ニックネーム</p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
          maxLength={20}
          className="w-full h-10 px-3 rounded-lg border border-brand-400 bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="flex-1">
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="flex-1">
          キャンセル
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

// ── Push Notification Toggle ───────────────────────────────────────────────────
function PushNotificationToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check current state on mount
  const checkState = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setEnabled(false);
      return;
    }
    if (Notification.permission !== "granted") {
      setEnabled(false);
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setEnabled(!!sub);
  };

  useEffect(() => { checkState(); }, []);

  const handleEnable = async () => {
    setLoading(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("通知の許可が必要です");
        setLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });
      setEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch("/api/push/subscribe", { method: "DELETE" });
      setEnabled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (enabled === null) return null; // still loading

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        通知
      </h2>
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {enabled ? (
              <Bell className="w-5 h-5 text-brand-500" />
            ) : (
              <BellOff className="w-5 h-5 text-slate-400" />
            )}
            <div>
              <p className="text-sm font-medium">プッシュ通知</p>
              <p className="text-xs text-muted-foreground">
                {enabled ? "有効" : "無効"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={enabled ? "outline" : "default"}
            onClick={enabled ? handleDisable : handleEnable}
            disabled={loading}
          >
            {loading ? "処理中..." : enabled ? "無効にする" : "有効にする"}
          </Button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </section>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function SettingsClient({
  member,
  familyData,
  email,
}: {
  member: Member;
  familyData: FamilyData;
  email: string;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "退会する") return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteMyAccount();
      await signOut();
      router.push("/login");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "エラーが発生しました");
      setDeleting(false);
    }
  };

  // Inline edit states
  const [editMyName, setEditMyName] = useState(false);
  const [editGroupName, setEditGroupName] = useState(false);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);

  // Add child modal
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childRole, setChildRole] = useState<"daughter" | "son">("daughter");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(familyData.group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleAddChild = async () => {
    if (!childName.trim()) { setAddError("名前を入力してください"); return; }
    setAdding(true);
    setAddError("");
    try {
      await addNonUserMember(childRole, childName.trim());
      setShowAddChild(false);
      setChildName("");
      setChildRole("daughter");
      router.refresh();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-5 space-y-6">

      {/* ── Profile ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          プロフィール
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <MemberAvatar displayName={member.displayName} color={member.color} size="xl" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-0.5">{ROLE_LABELS[member.role] || member.role}</p>
              {editMyName ? null : (
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg truncate">{member.displayName}</p>
                  <button
                    onClick={() => setEditMyName(true)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                </div>
              )}
            </div>
          </div>
          {editMyName && (
            <MemberEdit
              memberId={member.id}
              initialName={member.displayName}
              initialRole={member.role}
              onSave={() => { setEditMyName(false); router.refresh(); }}
              onCancel={() => setEditMyName(false)}
            />
          )}
        </div>
      </section>

      {/* ── Family Group ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          ファミリーグループ
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">グループ名</p>
            {editGroupName ? (
              <InlineEdit
                value={familyData.group.name}
                placeholder="グループ名"
                onSave={async (v) => {
                  await updateFamilyGroupName(familyData.group.id, v);
                  setEditGroupName(false);
                  router.refresh();
                }}
                onCancel={() => setEditGroupName(false)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className="font-medium">{familyData.group.name}</p>
                <button
                  onClick={() => setEditGroupName(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">招待コード</p>
            <div className="flex items-center gap-2">
              <code className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-md text-lg font-mono tracking-widest">
                {familyData.group.inviteCode}
              </code>
              <Button variant="ghost" size="icon-sm" onClick={handleCopyCode}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Members ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            メンバー
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-brand-500 font-medium gap-1.5"
            onClick={() => setShowAddChild(true)}
          >
            <Plus className="w-4 h-4" />
            子どもを追加
          </Button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
          {familyData.members.map((m) => (
            <div key={m.id} className="p-4">
              <div className="flex items-center gap-3">
                <MemberAvatar displayName={m.displayName} color={m.color} size="md" />
                <div className="flex-1 min-w-0">
                  {editMemberId === m.id ? null : (
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{m.displayName}</p>
                      <button
                        onClick={() => setEditMemberId(m.id)}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0"
                      >
                        <Pencil className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[m.role] || m.role}
                  </p>
                </div>
                {!m.userId && editMemberId !== m.id && (
                  <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full flex-shrink-0">
                    <Smartphone className="w-3 h-3" />
                    <span>アカウントなし</span>
                  </div>
                )}
              </div>
              {editMemberId === m.id && (
                <div className="mt-3">
                  <MemberEdit
                    memberId={m.id}
                    initialName={m.displayName}
                    initialRole={m.role}
                    onSave={() => { setEditMemberId(null); router.refresh(); }}
                    onCancel={() => setEditMemberId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Child Modal */}
        {showAddChild && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
            onClick={() => setShowAddChild(false)}
          >
            <div
              className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-base">子どものメンバーを追加</h3>
                <button
                  onClick={() => setShowAddChild(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  スマホを持っていない子どものメンバーを追加します。
                  予定はパパ・ママが代わりに入力できます。
                </p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">続柄</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setChildRole(opt.value as "daughter" | "son")}
                        className={`py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                          childRole === opt.value
                            ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                            : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">名前・ニックネーム</label>
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => { setChildName(e.target.value); setAddError(""); }}
                    placeholder="例: はなこ"
                    maxLength={20}
                    className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    onKeyDown={(e) => e.key === "Enter" && handleAddChild()}
                  />
                  {addError && <p className="text-xs text-red-500">{addError}</p>}
                </div>
              </div>
              <div className="px-5 pb-5">
                <Button className="w-full" onClick={handleAddChild} disabled={adding}>
                  {adding ? "追加中..." : "追加する"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Push Notifications ───────────────────────────────────── */}
      <PushNotificationToggle />

      {/* ── Account ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          アカウント
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
          <div className="p-4">
            <Button variant="destructive" className="w-full" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
              ログアウト
            </Button>
          </div>
          <div className="p-4 space-y-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-sm text-red-500 hover:text-red-600 font-medium py-2 transition-colors"
            >
              退会する
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center leading-relaxed">
              退会するとGoogleアカウントとの連携が解除され、<br />
              新しく招待コードで参加できるようになります。
            </p>
          </div>
        </div>
      </section>

      {/* ── Delete account confirmation modal ────────────────────── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
          onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleteError(""); }}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-6 pb-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">退会の確認</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Googleアカウントとの連携を解除します。<br />
                  家族の予定データは引き続き残ります。<br />
                  退会後は新しく招待コードで参加できます。
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-3">
              <div className="space-y-1.5">
                <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
                  確認のため <span className="font-bold text-red-500">退会する</span> と入力してください
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => { setDeleteConfirmText(e.target.value); setDeleteError(""); }}
                  placeholder="退会する"
                  className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                {deleteError && <p className="text-xs text-red-500 text-center">{deleteError}</p>}
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "退会する" || deleting}
              >
                {deleting ? "処理中..." : "退会する"}
              </Button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleteError(""); }}
                className="w-full text-sm text-slate-500 py-2 hover:text-slate-700 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
