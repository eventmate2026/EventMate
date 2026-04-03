export const SESSION_EXPIRED_MESSAGE = "Session expired. Please log in again.";
export const MAINTENANCE_MODE_MESSAGE =
  "System is under maintenance. Please try again later.";
export const ACCOUNT_INACTIVE_MESSAGE =
  "Your account is inactive. Please contact support.";

const toIssuedAtSeconds = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const extractBearerToken = (value = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  const match = normalized.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ? String(match[1]).trim() : normalized;
};

export const wasTokenIssuedBefore = (dateValue, issuedAtSeconds) => {
  if (!dateValue || !issuedAtSeconds) return false;

  const parsed = new Date(dateValue);
  const timestamp = parsed.getTime();
  if (Number.isNaN(timestamp)) return false;

  return toIssuedAtSeconds(issuedAtSeconds) < Math.floor(timestamp / 1000);
};

export const validateSessionState = ({ user, settings, issuedAtSeconds }) => {
  if (!user) {
    return { valid: false, statusCode: 401, message: "User not found" };
  }

  if (user?.isActive === false) {
    return {
      valid: false,
      statusCode: 403,
      message: ACCOUNT_INACTIVE_MESSAGE
    };
  }

  if (
    wasTokenIssuedBefore(settings?.tokenInvalidBefore, issuedAtSeconds) ||
    wasTokenIssuedBefore(user?.passwordChangedAt, issuedAtSeconds)
  ) {
    return {
      valid: false,
      statusCode: 401,
      message: SESSION_EXPIRED_MESSAGE
    };
  }

  if (settings?.maintenanceMode && user.role !== "MAIN_ADMIN") {
    return {
      valid: false,
      statusCode: 503,
      message: MAINTENANCE_MODE_MESSAGE
    };
  }

  return { valid: true };
};
