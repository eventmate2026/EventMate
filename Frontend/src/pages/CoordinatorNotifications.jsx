import NotificationInbox from "../components/NotificationInbox";

export default function CoordinatorNotifications() {
  return (
    <NotificationInbox
      title="Coordinator Notifications"
      subtitle="Your backend notifications are listed here."
      unreadEventName="eventmate:coordinator-unread-count"
    />
  );
}
