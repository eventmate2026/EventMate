import ContactAdminWorkspace from "../components/ContactAdminWorkspace";

export default function OrganizerContactAdmin() {
  return (
    <ContactAdminWorkspace
      title="Contact Admin"
      subtitle="Send approval requests, operational issues, or policy queries to the admin team."
      dashboardPath="/organizer-dashboard"
    />
  );
}
