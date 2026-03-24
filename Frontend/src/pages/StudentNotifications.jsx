import NotificationInbox from "../components/NotificationInbox";

export default function StudentNotifications() {
  return (
    <NotificationInbox
      title="Student Notifications"
      subtitle="All your backend notifications are listed here."
      unreadEventName="eventmate:student-unread-count"
    />
  );
}
