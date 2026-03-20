import { isRegistrationEventCompleted } from "./eventSchedule";

const normalizeId = (value) => String(value || "").trim();

export const canSubmitRegistrationFeedback = (registration, options = {}) => {
  const submittedEventIds = options.submittedEventIds instanceof Set ? options.submittedEventIds : new Set();
  const eventId = normalizeId(registration?.eventId);
  const registrationStatus = String(registration?.status || "").trim().toLowerCase();

  if (!eventId || submittedEventIds.has(eventId)) return false;
  if (!isRegistrationEventCompleted(registration)) return false;
  if (registrationStatus !== "confirmed") return false;
  if (!Boolean(registration?.qr?.attendanceMarked)) return false;
  if (!Boolean(registration?.isTeamLeader)) return false;
  if (Boolean(registration?.feedbackSubmitted)) return false;

  return true;
};

export const getEligibleFeedbackRegistrations = (rows, options = {}) =>
  (Array.isArray(rows) ? rows : []).filter((row) => canSubmitRegistrationFeedback(row, options));

export const countEligibleFeedbackRegistrations = (rows, options = {}) =>
  getEligibleFeedbackRegistrations(rows, options).length;
