import NotificationInbox from "../components/NotificationInbox";

export default function OrganizerNotifications() {
  return (
    <NotificationInbox
      title="Organizer Notifications"
      subtitle="Track event updates, participant activity, and important organizer alerts."
      unreadEventName="eventmate:organizer-unread-count"
      backPath="/organizer-dashboard"
      backLabel="Back to Dashboard"
    />
  );
}
