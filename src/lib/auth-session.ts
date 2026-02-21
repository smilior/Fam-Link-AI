import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export async function getServerSession() {
  const auth = getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}
