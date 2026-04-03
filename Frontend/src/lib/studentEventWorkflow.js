const normalizeId = (value) => String(value || "").trim();
const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

export const isStudentEventWorkflowCompleted = (value) =>
  normalizeStatus(value) === "completed";

export const isFeedbackPendingForRegistration = (registration) => {
  const confirmed = String(registration?.status || "").trim() === "Confirmed";
  const attendanceMarked = Boolean(registration?.qr?.attendanceMarked);
  const feedbackSubmitted = Boolean(registration?.feedbackSubmitted);
  const hasEventId = Boolean(normalizeId(registration?.eventId));
  return (
    hasEventId &&
    isStudentEventWorkflowCompleted(registration?.eventStatus) &&
    confirmed &&
    attendanceMarked &&
    !feedbackSubmitted
  );
};

export const resolveStudentEventAction = ({
  eventId,
  registration,
  registrationOpen = false,
  isCompletedEvent = false,
} = {}) => {
  const normalizedEventId = normalizeId(eventId || registration?.eventId);
  const registrationId = normalizeId(registration?.id);
  const registrationStatus = String(registration?.status || "").trim();
  const hasRegistration = Boolean(registrationId || registration);
  const hasQrAccess = Boolean(registrationId);
  const attendanceMarked = Boolean(registration?.qr?.attendanceMarked);
  const feedbackSubmitted = Boolean(registration?.feedbackSubmitted);
  const certificateReady = Boolean(registration?.certificateIssued || registration?.certificateUrl);

  if (hasRegistration && certificateReady) {
    return {
      key: "certificate",
      label: "Download Certificate",
      disabled: false,
    };
  }

  if (hasRegistration && feedbackSubmitted) {
    return {
      key: "feedback-submitted",
      label: "Feedback Submitted",
      disabled: true,
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
