import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-session";
import { getCurrentMember } from "@/lib/actions/family";
import { AppLayout } from "@/components/layout/app-layout";

export default async function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const member = await getCurrentMember();
  if (!member) redirect("/setup");

  return <AppLayout>{children}</AppLayout>;
}
