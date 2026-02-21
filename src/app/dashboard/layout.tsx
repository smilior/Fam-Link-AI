import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-session";
import { SignInButton } from "@/components/sign-in-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center justify-between px-5">
          <span className="font-bold text-lg bg-gradient-to-r from-brand-500 to-brand-600 bg-clip-text text-transparent">
            Fam-Link
          </span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.name}
            </span>
            <SignInButton />
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
