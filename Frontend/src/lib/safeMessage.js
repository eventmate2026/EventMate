const FRIENDLY_MESSAGE_MAP = new Map([
  ["verify email first", "Please verify your email before logging in."],
  ["unauthorized", "Please log in again to continue."],
  ["invalid or expired token", "Please log in again to continue."],
  ["refresh token missing", "Please log in again to continue."],
  ["invalid refresh token", "Please log in again to continue."],
  ["invalid or expired refresh token", "Please log in again to continue."],
  ["session expired. please log in again.", "Please log in again to continue."],
  ["access denied", "You do not have permission to do that."],
  ["not authorized", "You do not have permission to do that."],
  [
    "jwt secret rotated. current sessions now require fresh login.",
    "Security settings updated. Everyone will need to sign in again.",
  ],
]);

const TECHNICAL_MESSAGE_PATTERNS = [
  /<!doctype html|<html|<body|<script/i,
  /\b(?:reference|type|syntax|range)error\b/i,
  /\b(?:mongodb|mongoose|casterror|validationerror|cloudinary|sendgrid|nodemailer|smtp|dmarc|cors|stack trace|exception|duplicate key|e11000|mongo_uri|api[_ -]?secret|backend_url)\b/i,
  /\b(?:errno|econnreset|ecconnaborted|enotfound|socket hang up|server selection)\b/i,
  /(?:[A-Za-z]:\\|\/(?:usr|var|home|app|srv)\/)/,
  /(?:^|\n)\s*at\s+[A-Za-z0-9_$.[\]]+\s+\((?:[A-Za-z]:\\|\/)/,
];

const SECRET_VALUE_PATTERNS = [
  /\b(?:access|refresh)[ -]?token\s*[:=]\s*\S+/i,
  /\bsecret\s*[:=]\s*\S+/i,
  /\btoken=\S+/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}/,
  /\b[a-f0-9]{48,}\b/i,
];

const normalizeMessage = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const mapFriendlyMessage = (value) => {
  const normalized = normalizeMessage(value);
  if (!normalized) return "";

  const direct = FRIENDLY_MESSAGE_MAP.get(normalized.toLowerCase());
  if (direct) return direct;

  if (/^not authorized\b/i.test(normalized) || /^access denied\b/i.test(normalized)) {
    return "You do not have permission to do that.";
  }

  return normalized;
};

const isTechnicalOrSensitiveMessage = (value) => {
  const normalized = normalizeMessage(value);
  if (!normalized) return false;

  if (normalized.length > 220 && /error|failed|exception|token|secret|stack|trace/i.test(normalized)) {
    return true;
  }

  return [...TECHNICAL_MESSAGE_PATTERNS, ...SECRET_VALUE_PATTERNS].some((pattern) =>
    pattern.test(normalized)
  );
};

export const sanitizeApiMessage = (value, { status = 0, kind = "error" } = {}) => {
  const normalized = normalizeMessage(value);
  if (!normalized) return "";

  const friendly = mapFriendlyMessage(normalized);
  const safeSuccessMessage =
    kind === "success" &&
    friendly === "Security settings updated. Everyone will need to sign in again.";

  if (safeSuccessMessage) {
    return friendly;
  }

  if (status >= 500 || status === 503) {
    return "";
  }

  if (isTechnicalOrSensitiveMessage(friendly)) {
    return "";
  }

  return friendly;
};

export const sanitizeApiPayload = (payload, options = {}) => {
  if (!payload || typeof payload !== "object") return payload;

  if (typeof payload.message === "string") {
    payload.message = sanitizeApiMessage(payload.message, options);
  }

  if (typeof payload.warning === "string") {
    payload.warning = sanitizeApiMessage(payload.warning, { ...options, kind: "error" });
  }

  if (Array.isArray(payload.errors)) {
    payload.errors = payload.errors
      .map((entry) => sanitizeApiMessage(entry, { ...options, kind: "error" }))
      .filter(Boolean);
  }

  return payload;
};

export const getSafeApiErrorText = (error, fallback) => {
  const responseStatus = Number(error?.response?.status || 0);
  const responseMessage = sanitizeApiMessage(error?.response?.data?.message, {
    status: responseStatus,
    kind: "error",
  });

  return responseMessage || normalizeMessage(fallback);
};
