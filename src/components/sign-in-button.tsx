"use client";

import { useSession, signIn, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <Button variant="ghost" size="sm" disabled>Loading...</Button>;
  }

  if (session) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
      >
        サインアウト
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signIn.social({ provider: "google" })}
    >
      サインイン
    </Button>
  );
}
