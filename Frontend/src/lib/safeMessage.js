const NETWORK_FALLBACK_MESSAGE = "The service is unavailable right now. Please try again.";
const REQUEST_FALLBACK_MESSAGE = "We couldn't complete your request right now. Please try again.";
const SESSION_FALLBACK_MESSAGE = "Your session has expired. Please log in again.";

const TECHNICAL_PATTERNS = [
  /<!doctype html/i,
  /<html/i,
  /\b(axios|mongoose|mongodb|jwt|econnrefused|etimedout|econnreset|socket hang up)\b/i,
  /\b(referenceerror|syntaxerror|typeerror|validationerror)\b/i,
  /\b(start the backend server|missing access token|stack trace|cast to objectid)\b/i,
];

const OTP_PATTERN = /\bOTP\s*:\s*[A-Z0-9-]{4,12}\b/gi;

const collapseWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();

const stripHtml = (value) => String(value || "").replace(/<[^>]*>/g, " ");

const sanitizeCoreMessage = (value, fallback) => {
  const normalized = collapseWhitespace(stripHtml(value)).replace(OTP_PATTERN, "").trim();
  if (!normalized) return fallback;
  if (normalized.length > 220) return fallback;
  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(normalized))) return fallback;
  return normalized;
};

export const sanitizeUserMessage = (
  value,
  fallback = REQUEST_FALLBACK_MESSAGE
) => {
  const normalized = sanitizeCoreMessage(value, fallback);

  if (/invalid (or expired )?(refresh )?token/i.test(normalized)) {
    return SESSION_FALLBACK_MESSAGE;
  }

  if (/refresh token missing/i.test(normalized)) {
    return SESSION_FALLBACK_MESSAGE;
  }

  if (/backend is unreachable|backend not reachable|start the backend server/i.test(normalized)) {
    return NETWORK_FALLBACK_MESSAGE;
  }

  return normalized;
};

export const getSafeApiMessage = (
  error,
  fallback = REQUEST_FALLBACK_MESSAGE
) => {
  const status = Number(error?.response?.status || 0);
  const retryAfterSeconds = Number(error?.response?.data?.retryAfterSeconds || 0);

  if (!status) {
    return NETWORK_FALLBACK_MESSAGE;
  }

  if (status === 429 && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return `Too many requests. Please try again in ${retryAfterSeconds} seconds.`;
  }

  if (status === 429) {
    return "Too many requests. Please try again shortly.";
  }

  if (status >= 500) {
    return REQUEST_FALLBACK_MESSAGE;
  }

  const apiMessage =
    error?.response?.data?.message ||
    (Array.isArray(error?.response?.data?.errors)
      ? error.response.data.errors[0]
      : error?.message);

  return sanitizeUserMessage(apiMessage, fallback);
};

export const getSafeSuccessMessage = (value, fallback = "") =>
  sanitizeUserMessage(value, fallback);

export const safeMessageFallbacks = {
  network: NETWORK_FALLBACK_MESSAGE,
  request: REQUEST_FALLBACK_MESSAGE,
  session: SESSION_FALLBACK_MESSAGE,
};
