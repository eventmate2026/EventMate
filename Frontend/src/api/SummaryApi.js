import { API_BASE_URL } from "../lib/backendUrl";

export const baseURL = API_BASE_URL;

const SummaryApi = {
  /* ================= AUTH ================= */
  register: {
    url: "/api/auth/register",
    method: "post",
  },

  verify_email: {
    url: "/api/auth/verify-email",
    method: "post",
  },

  resend_verification_otp: {
    url: "/api/auth/resend-verification-otp",
    method: "post",
  },

  login: {
    url: "/api/auth/login",
    method: "post",
  },

  logout: {
    url: "/api/auth/logout",
    method: "post",
  },

  refresh_token: {
    url: "/api/auth/refresh-token",
    method: "post",
  },

  /* ================= USER ================= */
  get_profile: {
    url: "/api/user/profile",
    method: "get",
  },

  update_profile: {
    url: "/api/user/profile",
    method: "put",
  },

  upload_avatar: {
    url: "/api/user/avatar",
    method: "post",
  },

  forgot_password: {
    url: "/api/user/forgot-password",
    method: "post",
  },

  reset_password: {
    url: "/api/user/reset-password",
    method: "post",
  },

  /* ================= CONTACT ================= */
  submit_contact: {
    url: "/api/contact",
    method: "post",
  },

  get_contacts: {
    url: "/api/contact",
    method: "get",
  },

  /* ================= NOTIFICATIONS ================= */
  get_my_notifications: {
    url: "/api/notifications/my",
    method: "get",
  },

  mark_all_notifications_read: {
    url: "/api/notifications/read-all",
    method: "patch",
  },

  mark_notification_read: {
    url: "/api/notifications/:notificationId/read",
    method: "patch",
  },

  admin_send_notification: {
    url: "/api/notifications/admin-send",
    method: "post",
  },

  organizer_send_notification: {
    url: "/api/notifications/organizer-send",
    method: "post",
  },

  organizer_sent_groups: {
    url: "/api/notifications/organizer-sent",
    method: "get",
  },

  organizer_receipts: {
    url: "/api/notifications/organizer-receipts",
    method: "get",
  },

  admin_sent_groups: {
    url: "/api/notifications/admin-sent",
    method: "get",
  },

  admin_receipts: {
    url: "/api/notifications/admin-receipts",
    method: "get",
  },

  /* ================= EVENTS ================= */
  create_event: {
    url: "/api/events",
    method: "post",
  },

  update_event: {
    url: "/api/events/:eventId",
    method: "patch",
  },

  get_my_events: {
    url: "/api/events/myEvents",
    method: "get",
  },

  get_my_assigned_events: {
    url: "/api/events/assigned-to-me",
    method: "get",
  },

  get_my_registered_events: {
    url: "/api/registrations/my",
    method: "get",
  },

  get_public_events: {
    url: "/api/events",
    method: "get",
  },

  get_public_event_details: {
    url: "/api/events/:eventId",
    method: "get",
  },

  publish_event: {
    url: "/api/events/:eventId/publish",
    method: "patch",
  },

  cancel_event: {
    url: "/api/events/:eventId/cancel",
    method: "patch",
  },

  complete_event: {
    url: "/api/events/:eventId/complete",
    method: "patch",
  },

  register_for_event: {
    url: "/api/registrations/:eventId/draft",
    method: "post",
  },

  get_team_registration_status: {
    url: "/api/registrations/team/:registrationId/status",
    method: "get",
  },

  confirm_team_registration: {
    url: "/api/registrations/team/:registrationId/confirm",
    method: "post",
  },

  resend_team_invites: {
    url: "/api/registrations/team/:registrationId/resend-invites",
    method: "post",
  },
  lookup_team_member_profile: {
    url: "/api/registrations/team/:eventId/member-lookup",
    method: "get",
  },
  update_team_member_email: {
    url: "/api/registrations/team/:registrationId/member-email",
    method: "patch",
  },

  get_team_invite: {
    url: "/api/registrations/invite/:token",
    method: "get",
  },

  respond_team_invite: {
    url: "/api/registrations/invite/:token/:action",
    method: "post",
  },

  assign_coordinator_to_event: {
    url: "/api/events/:eventId/coordinators/assign",
    method: "patch",
  },

  mark_attendance_by_token: {
    url: "/api/registrations/attendance/:token",
    method: "patch",
  },

  get_event_registrations: {
    url: "/api/registrations/:eventId/all",
    method: "get",
  },
  tag_registration_winner: {
    url: "/api/registrations/:registrationId/winner",
    method: "patch",
  },
  untag_registration_winner: {
    url: "/api/registrations/:registrationId/winner/clear",
    method: "patch",
  },

  /* ================= FEEDBACK ================= */
  submit_feedback: {
    url: "/api/feedback/:eventId",
    method: "post",
  },

  get_event_feedback: {
    url: "/api/feedback/:eventId",
    method: "get",
  },

  /* ================= CERTIFICATES ================= */
  get_my_certificates: {
    url: "/api/certificates/my",
    method: "get",
  },

  get_event_certificates: {
    url: "/api/certificates/:eventId",
    method: "get",
  },

  generate_event_certificates: {
    url: "/api/certificates/:eventId/generate",
    method: "post",
  },

  issue_selected_certificates: {
    url: "/api/certificates/:eventId/issue",
    method: "post",
  },

  update_event_certificate_customization: {
    url: "/api/certificates/:eventId/customization",
    method: "patch",
  },

  upload_event_certificate_background: {
    url: "/api/certificates/:eventId/background",
    method: "patch",
  },
  upload_event_certificate_logo: {
    url: "/api/certificates/:eventId/logo",
    method: "patch",
  },
  upload_event_certificate_accreditation_logo: {
    url: "/api/certificates/:eventId/accreditation-logo",
    method: "patch",
  },
  upload_event_certificate_signature: {
    url: "/api/certificates/:eventId/signature/:role",
    method: "patch",
  },

  download_demo_certificate: {
    url: "/api/certificates/:eventId/demo",
    method: "get",
  },

  download_certificate: {
    url: "/api/certificates/download/:eventId/:emailSlug",
    method: "get",
  },

  verify_certificate_code: {
    url: "/api/certificates/verify",
    method: "post",
  },

  get_event_coordinators: {
    url: "/api/admin/coordinators",
    method: "get",
  },

  create_event_coordinator: {
    url: "/api/user/create-coordinator",
    method: "post",
  },

  promote_event_coordinator: {
    url: "/api/user/promote-coordinator",
    method: "post",
  },

  update_event_coordinator: {
    url: "/api/admin/users/:id",
    method: "put",
  },

  get_organizer_coordinator_activity: {
    url: "/api/admin/coordinators",
    method: "get",
  },

  /* ================= ADMIN ================= */
  get_all_users: {
    url: "/api/admin/users",
    method: "get",
  },

  update_user: {
    url: "/api/admin/users/:id",
    method: "put",
  },

  delete_user: {
    url: "/api/admin/users/:id",
    method: "delete",
  },

  get_organizers: {
    url: "/api/admin/organizers",
    method: "get",
  },

  get_organizer_event_counts: {
    url: "/api/admin/organizers/event-counts",
    method: "get",
  },

  get_admin_certificates_registry: {
    url: "/api/admin/certificates/registry",
    method: "get",
  },

  get_admin_certificate_audit_logs: {
    url: "/api/admin/certificates/audit-logs",
    method: "get",
  },

  revoke_admin_certificate: {
    url: "/api/admin/certificates/:certificateId/revoke",
    method: "patch",
  },

  get_security_settings: {
    url: "/api/admin/security-settings",
    method: "get",
  },

  update_security_settings: {
    url: "/api/admin/security-settings",
    method: "patch",
  },

  rotate_security_secret: {
    url: "/api/admin/security-settings/rotate-secret",
    method: "post",
  },

  force_logout_all: {
    url: "/api/admin/security-settings/force-logout",
    method: "post",
  },

  create_organizer: {
    url: "/api/user/create-organizer",
    method: "post",
  },

  update_organizer: {
    url: "/api/admin/users/:id",
    method: "put",
  },

  delete_organizer: {
    url: "/api/admin/users/:id",
    method: "delete",
  },

  get_coordinators: {
    url: "/api/admin/coordinators",
    method: "get",
  },

  create_coordinator: {
    url: "/api/user/create-coordinator",
    method: "post",
  },

  update_coordinator: {
    url: "/api/admin/users/:id",
    method: "put",
  },

  delete_coordinator: {
    url: "/api/admin/users/:id",
    method: "delete",
  },
};

export default SummaryApi;
