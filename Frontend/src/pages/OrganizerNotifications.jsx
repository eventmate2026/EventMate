import NotificationInbox from "../components/NotificationInbox";

export default function OrganizerNotifications() {
  return (
    <NotificationInbox
      title="Organizer Notifications"
      subtitle="Your backend notifications are listed here."
      unreadEventName="eventmate:organizer-unread-count"
    />
  );
}
