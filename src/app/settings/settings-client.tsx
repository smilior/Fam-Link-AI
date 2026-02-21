"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member/member-avatar";
import { Copy, Check, LogOut } from "lucide-react";

type Member = {
  id: string;
  familyGroupId: string;
  userId: string;
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

export function SettingsClient({
  member,
  familyData,
}: {
  member: Member;
  familyData: FamilyData;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(familyData.group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const ROLE_LABELS: Record<string, string> = {
    papa: "パパ",
    mama: "ママ",
    daughter: "娘",
    son: "息子",
  };

  return (
    <div className="max-w-lg mx-auto p-5 space-y-6">
      {/* Profile Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          プロフィール
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 flex items-center gap-4">
          <MemberAvatar
            displayName={member.displayName}
            color={member.color}
            size="xl"
          />
          <div>
            <p className="font-bold text-lg">{member.displayName}</p>
            <p className="text-sm text-muted-foreground">
              {ROLE_LABELS[member.role] || member.role}
            </p>
          </div>
        </div>
      </section>

      {/* Family Group Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          ファミリーグループ
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">グループ名</p>
            <p className="font-medium">{familyData.group.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">招待コード</p>
            <div className="flex items-center gap-2">
              <code className="bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-md text-lg font-mono tracking-widest">
                {familyData.group.inviteCode}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCopyCode}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Members Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          メンバー
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
          {familyData.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-4">
              <MemberAvatar
                displayName={m.displayName}
                color={m.color}
                size="md"
              />
              <div>
                <p className="font-medium text-sm">{m.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABELS[m.role] || m.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Account Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          アカウント
        </h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </Button>
        </div>
      </section>
    </div>
  );
}
