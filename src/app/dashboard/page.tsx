import { getServerSession } from "@/lib/auth-session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await getServerSession();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">ダッシュボード</h1>
      <Card>
        <CardHeader>
          <CardTitle>プロフィール</CardTitle>
          <CardDescription>アカウント情報</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p>
            <span className="text-muted-foreground">名前:</span>{" "}
            {session?.user.name}
          </p>
          <p>
            <span className="text-muted-foreground">メール:</span>{" "}
            {session?.user.email}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
