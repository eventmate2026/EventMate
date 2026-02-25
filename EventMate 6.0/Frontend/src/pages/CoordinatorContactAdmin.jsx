import ContactAdminWorkspace from "../components/ContactAdminWorkspace";

export default function CoordinatorContactAdmin() {
  return (
    <ContactAdminWorkspace
      title="Contact Admin"
      subtitle="Report coordination issues, event scope blockers, or support requests for assigned events."
      dashboardPath="/coordinator-dashboard"
    />
  );
}
