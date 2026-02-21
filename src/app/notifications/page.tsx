import { getNotifications, markAllRead } from "@/lib/actions/notifications";
import { NotificationsList } from "./notifications-list";

export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <div className="max-w-lg mx-auto p-5">
      <NotificationsList notifications={notifications} markAllRead={markAllRead} />
    </div>
  );
}
