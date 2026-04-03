export const FEEDBACK_SUBMITTED_KEY = "eventmate:feedback-submitted-events";

const normalizeId = (value) => String(value || "").trim();

export const loadSubmittedFeedbackEventIds = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEEDBACK_SUBMITTED_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map((item) => normalizeId(item)).filter(Boolean) : []);
  } catch {
    return new Set();
  }
};

export const saveSubmittedFeedbackEventIds = (ids) => {
  localStorage.setItem(FEEDBACK_SUBMITTED_KEY, JSON.stringify(Array.from(ids)));
};

export const resolveStudentEventAction = ({
  eventId,
  registration,
  registrationOpen = false,
  isCompletedEvent = false,
  feedbackSubmittedIds = new Set(),
} = {}) => {
  const normalizedEventId = normalizeId(eventId || registration?.eventId);
  const registrationId = normalizeId(registration?.id);
  const registrationStatus = String(registration?.status || "").trim();
  const hasRegistration = Boolean(registrationId || registration);
  const hasQrAccess = Boolean(registrationId);
  const attendanceMarked = Boolean(registration?.qr?.attendanceMarked);
  const feedbackSubmitted =
    Boolean(registration?.feedbackSubmitted) ||
    (normalizedEventId ? feedbackSubmittedIds.has(normalizedEventId) : false);
  const certificateReady = Boolean(registration?.certificateIssued || registration?.certificateUrl);

  if (hasRegistration && (certificateReady || feedbackSubmitted)) {
    return {
      key: "certificate",
      label: "Download Certificate",
      disabled: false,
    };
  }

  if (hasRegistration && attendanceMarked && isCompletedEvent) {
    return {
      key: "feedback",
      label: "Give Feedback",
      disabled: !normalizedEventId,
    };
  }

  if (hasRegistration) {
    const qrReadyLike =
      registrationStatus === "Confirmed" ||
      Boolean(registration?.qr?.qrImageUrl) ||
      hasQrAccess;

    if (qrReadyLike) {
      return {
        key: "qr",
        label: "View QR",
        disabled: !hasQrAccess,
      };
    }

    return {
      key: "registered",
      label: registrationStatus || "Registered",
      disabled: true,
    };
  }

  if (registrationOpen) {
    return {
      key: "register",
      label: "Register",
      disabled: false,
    };
  }

  return {
    key: "closed",
    label: "Closed",
    disabled: true,
  };
};
