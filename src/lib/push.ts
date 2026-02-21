import webpush from "web-push";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let vapidInitialized = false;

function initVapid() {
  if (vapidInitialized) return;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID environment variables are not set");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
}

export interface PushPayload {
  type: string;
  title: string;
  body?: string;
  url?: string;
  relatedId?: string;
}

export async function sendPushToMember(
  memberId: string,
  payload: PushPayload
): Promise<void> {
  initVapid();
  const db = getDb();

  const subs = await db
    .select()
    .from(schema.pushSubscription)
    .where(eq(schema.pushSubscription.memberId, memberId));

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      if (err.statusCode === 410) {
        // Subscription expired — remove it
        await db
          .delete(schema.pushSubscription)
          .where(eq(schema.pushSubscription.id, sub.id));
      }
    }
  }

  // Record in notificationLog regardless of whether any push was sent
  await db.insert(schema.notificationLog).values({
    id: crypto.randomUUID(),
    memberId,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? null,
    relatedId: payload.relatedId ?? null,
    isRead: 0,
    createdAt: Date.now(),
  });
}
