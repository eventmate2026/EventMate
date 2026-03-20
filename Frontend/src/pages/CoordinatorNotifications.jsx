import NotificationInbox from "../components/NotificationInbox";

export default function CoordinatorNotifications() {
  return (
    <NotificationInbox
      title="Coordinator Notifications"
      subtitle="Review attendance updates, event notices, and coordinator alerts."
      unreadEventName="eventmate:coordinator-unread-count"
      backPath="/coordinator-dashboard"
      backLabel="Back to Dashboard"
    />
  );
}
