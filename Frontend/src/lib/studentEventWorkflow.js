const normalizeId = (value) => String(value || "").trim();

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
