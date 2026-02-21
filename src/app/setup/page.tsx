"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFamilyGroup, joinFamilyGroup } from "@/lib/actions/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "select" | "create" | "join";
type Step = 1 | 2 | 3;

const ROLES = [
  { value: "papa", label: "パパ", emoji: "🔵", borderColor: "border-papa-500", bgColor: "bg-papa-50" },
  { value: "mama", label: "ママ", emoji: "🩷", borderColor: "border-mama-500", bgColor: "bg-mama-50" },
  { value: "daughter", label: "娘", emoji: "💛", borderColor: "border-daughter-500", bgColor: "bg-daughter-50" },
  { value: "son", label: "息子", emoji: "💚", borderColor: "border-son-500", bgColor: "bg-son-50" },
] as const;

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i + 1 <= current ? "bg-brand-500" : "bg-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode>("select");
  const [inviteCode, setInviteCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [role, setRole] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleComplete = async () => {
    if (!role || !displayName.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      if (mode === "create") {
        await createFamilyGroup(groupName || "我が家", role, displayName);
      } else {
        await joinFamilyGroup(inviteCode, role, displayName);
      }
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-6">
      <div className="w-full max-w-sm">
        <ProgressDots current={step} total={3} />

        {/* Step 1: Group Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">ファミリーセットアップ</h1>
              <p className="text-muted-foreground text-sm">
                グループを作成するか、招待コードで参加してください
              </p>
            </div>

            {mode === "select" && (
              <div className="space-y-3">
                <Button
                  className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-3 w-full h-auto text-base"
                  onClick={() => setMode("create")}
                >
                  グループを作成
                </Button>
                <Button
                  variant="outline"
                  className="rounded-lg py-3 w-full h-auto text-base"
                  onClick={() => setMode("join")}
                >
                  招待コードで参加
                </Button>
              </div>
            )}

            {mode === "create" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">グループ名</label>
                  <Input
                    placeholder="我が家"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <Button
                  className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-3 w-full h-auto text-base"
                  onClick={() => setStep(2)}
                >
                  次へ
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMode("select")}
                >
                  戻る
                </Button>
              </div>
            )}

            {mode === "join" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">招待コード</label>
                  <Input
                    placeholder="ABC123"
                    value={inviteCode}
                    onChange={(e) =>
                      setInviteCode(e.target.value.toUpperCase().slice(0, 6))
                    }
                    maxLength={6}
                    className="text-center text-lg tracking-widest uppercase"
                  />
                </div>
                <Button
                  className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-3 w-full h-auto text-base"
                  disabled={inviteCode.length < 6}
                  onClick={() => setStep(2)}
                >
                  次へ
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setMode("select")}
                >
                  戻る
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Profile Setup */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">プロフィール設定</h1>
              <p className="text-muted-foreground text-sm">
                あなたの役割と表示名を設定してください
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`p-4 rounded-lg border-2 text-center transition-all ${
                    role === r.value
                      ? `${r.borderColor} ${r.bgColor}`
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl block mb-1">{r.emoji}</span>
                  <span className="text-sm font-medium">{r.label}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">表示名</label>
              <Input
                placeholder="名前を入力"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-3 w-full h-auto text-base"
              disabled={!role || !displayName.trim() || isLoading}
              onClick={handleComplete}
            >
              {isLoading ? "設定中..." : "設定する"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setStep(1)}
              disabled={isLoading}
            >
              戻る
            </Button>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold">
              ファミリーグループに参加しました!
            </h1>
            <p className="text-muted-foreground text-sm">
              さっそくカレンダーを使い始めましょう
            </p>
            <Button
              className="bg-brand-500 hover:bg-brand-600 text-white rounded-lg py-3 w-full h-auto text-base"
              onClick={() => router.push("/dashboard")}
            >
              はじめる
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
