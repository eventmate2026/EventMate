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
  /\bmongodb(?:\+srv)?:\/\/\S+/i,
  /\bSG\.[A-Za-z0-9._-]{20,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}/,
  /\b[a-f0-9]{48,}\b/i,
];

const BUSINESS_STATUS_RULES = [
  { pattern: /\b(?:maintenance|temporarily unavailable|couldn't deliver)\b/i, status: 503 },
  { pattern: /\bunauthorized\b/i, status: 401 },
  { pattern: /\b(?:not authorized|access denied|forbidden)\b/i, status: 403 },
  { pattern: /\bnot found\b/i, status: 404 },
  { pattern: /\b(?:already|duplicate|exists)\b/i, status: 409 },
  {
    pattern:
      /\b(?:invalid|required|missing|must|cannot|can't|closed|expired|pending|waiting|full|locked|only|restricted|deadline)\b/i,
    status: 400,
  },
];

const normalizeMessage = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const isTechnicalMessage = (value) => {
  const normalized = normalizeMessage(value);
  if (!normalized) return false;
  return [...TECHNICAL_MESSAGE_PATTERNS, ...SECRET_VALUE_PATTERNS].some((pattern) =>
    pattern.test(normalized)
  );
};

const inferStatusCode = (message) => {
  const normalized = normalizeMessage(message);
  if (!normalized) return 0;

  const matchedRule = BUSINESS_STATUS_RULES.find(({ pattern }) => pattern.test(normalized));
  return matchedRule?.status || 0;
};

const getPublicErrorMessage = (message, statusCode) => {
  const normalized = normalizeMessage(message);
  if (!normalized) {
    return statusCode === 503
      ? "This service is temporarily unavailable. Please try again."
      : "Something went wrong. Please try again.";
  }

  if (statusCode >= 500 || statusCode === 503 || isTechnicalMessage(normalized)) {
    return statusCode === 503
      ? "This service is temporarily unavailable. Please try again."
      : "Something went wrong. Please try again.";
  }

  return normalized;
};

export default (err, req, res, next) => {
  const isJsonSyntaxError = err instanceof SyntaxError && Object.prototype.hasOwnProperty.call(err, "body");
  const message = isJsonSyntaxError
    ? "Invalid request payload. Please send valid JSON."
    : err.message || "Server Error";
  const statusCode = isJsonSyntaxError
    ? 400
    : Number(err.statusCode || err.status) || inferStatusCode(message) || 500;

  if (statusCode >= 500) {
    console.error(err.stack || err);
  } else {
    console.warn(`[${statusCode}] ${message}`);
  }

  res.status(statusCode).json({ success: false, message: getPublicErrorMessage(message, statusCode) });
};
