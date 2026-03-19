const PENDING_VERIFICATION_EMAIL_KEY = "eventmate:pending-verification-email";

export const storePendingVerificationEmail = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return;
  localStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, normalizedEmail);
};

export const getPendingVerificationEmail = () =>
  String(localStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY) || "").trim().toLowerCase();

export const clearPendingVerificationEmail = () => {
  localStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
};
