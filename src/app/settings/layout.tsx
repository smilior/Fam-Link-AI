import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-session";
import { AppLayout } from "@/components/layout/app-layout";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  return <AppLayout title="設定">{children}</AppLayout>;
}
