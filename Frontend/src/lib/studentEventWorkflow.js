const normalizeId = (value) => String(value || "").trim();
const normalizeStatus = (value) => String(value || "").trim().toLowerCase();
const isConfirmedRegistration = (registration) =>
  String(registration?.status || "").trim() === "Confirmed";
const canTeamRegistrationSubmitFeedback = (registration) =>
  !Boolean(registration?.eventIsTeamEvent) || Boolean(registration?.isTeamLeader);
const isWinnerRankingReadyForFeedback = (registration) => {
  if (!isStudentEventWorkflowCompleted(registration?.eventStatus)) return false;
  return registration?.winnerRankingComplete === true;
};

const isFeedbackEligibleWithoutWinnerRanking = (registration) => {
  const attendanceMarked = Boolean(registration?.qr?.attendanceMarked);
  const feedbackSubmitted = Boolean(registration?.feedbackSubmitted);
  const hasEventId = Boolean(normalizeId(registration?.eventId));
  return (
    hasEventId &&
    isStudentEventWorkflowCompleted(registration?.eventStatus) &&
    isConfirmedRegistration(registration) &&
    attendanceMarked &&
    !feedbackSubmitted &&
    canTeamRegistrationSubmitFeedback(registration)
  );
};

export const isStudentEventWorkflowCompleted = (value) =>
  normalizeStatus(value) === "completed";

export const isFeedbackPendingForRegistration = (registration) => {
  return (
    isFeedbackEligibleWithoutWinnerRanking(registration) &&
    isWinnerRankingReadyForFeedback(registration)
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
  const feedbackEligibleWithoutWinnerRanking = isFeedbackEligibleWithoutWinnerRanking(registration);
  const winnerRankingReady = isWinnerRankingReadyForFeedback(registration);

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

  if (hasRegistration && feedbackEligibleWithoutWinnerRanking && !winnerRankingReady) {
    return {
      key: "winner-pending",
      label: "Winner Results Pending",
      disabled: true,
    };
  }

  if (hasRegistration && attendanceMarked && isCompletedEvent && winnerRankingReady) {
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
