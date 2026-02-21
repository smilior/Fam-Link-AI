import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const auth = getAuth();
  const handler = toNextJsHandler(auth);
  return handler.GET(request);
};

export const POST = async (request: Request) => {
  const auth = getAuth();
  const handler = toNextJsHandler(auth);
  return handler.POST(request);
};
