import NotificationInbox from "../components/NotificationInbox";

export default function StudentNotifications() {
  return (
    <NotificationInbox
      title="Student Notifications"
      subtitle="Stay updated with your event alerts, certificates, and account activity."
      unreadEventName="eventmate:student-unread-count"
      backPath="/student-dashboard"
      backLabel="Back to Dashboard"
    />
  );
}
