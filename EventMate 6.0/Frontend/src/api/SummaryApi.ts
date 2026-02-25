export const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000"; // EventMate backend

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
    url: "/api/events",
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

  register_for_event: {
    url: "/api/registrations/:eventId/draft",
    method: "post",
  },

  get_event_coordinators: {
    url: "/api/admin/users",
    method: "get",
  },

  create_event_coordinator: {
    url: "/api/user/create-coordinator",
    method: "post",
  },

  update_event_coordinator: {
    url: "/api/admin/users/:id",
    method: "put",
  },

  get_organizer_coordinator_activity: {
    url: "/api/admin/users",
    method: "get",
  },

  get_coordinator_event_registrations: {
    url: "/api/registrations/coordinator",
    method: "get",
  },

  send_contact_admin: {
    url: "/api/user/contact-admin",
    method: "post",
  },

  get_my_contact_messages: {
    url: "/api/user/contact-admin",
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
    url: "/api/admin/users",
    method: "get",
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
    url: "/api/admin/users",
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

  get_admin_contact_messages: {
    url: "/api/admin/contact-messages",
    method: "get",
  },

  get_admin_unread_contact_count: {
    url: "/api/admin/contact-messages/unread-count",
    method: "get",
  },

  mark_admin_contact_message_read: {
    url: "/api/admin/contact-messages/:id/read",
    method: "patch",
  },

  mark_all_admin_contact_messages_read: {
    url: "/api/admin/contact-messages/read-all",
    method: "patch",
  },
};

export default SummaryApi;
