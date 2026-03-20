const TECHNICAL_MESSAGE_PATTERNS = [
  /<!doctype html|<html|<body|<script/i,
  /\b(?:reference|type|syntax|range)error\b/i,
  /\b(?:mongodb|mongoose|casterror|validationerror|cloudinary|sendgrid|nodemailer|smtp|dmarc|cors|stack trace|exception|duplicate key|e11000|mongo_uri|api[_ -]?secret|backend_url)\b/i,
  /\b(?:errno|econnreset|ecconnaborted|enotfound|socket hang up|server selection)\b/i,
  /(?:[A-Za-z]:\\|\/(?:usr|var|home|app|srv)\/)/,
  /(?:^|\n)\s*at\s+[A-Za-z0-9_$.[\]]+\s+\((?:[A-Za-z]:\\|\/)/,
];

const normalizeMessage = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const isTechnicalMessage = (value) => {
  const normalized = normalizeMessage(value);
  if (!normalized) return false;
  return TECHNICAL_MESSAGE_PATTERNS.some((pattern) => pattern.test(normalized));
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
  const statusCode = isJsonSyntaxError
    ? 400
    : Number(err.statusCode || err.status) || 500;

  const message = isJsonSyntaxError
    ? "Invalid request payload. Please send valid JSON."
    : err.message || "Server Error";

  if (statusCode >= 500) {
    console.error(err.stack || err);
  } else {
    console.warn(`[${statusCode}] ${message}`);
  }

  res.status(statusCode).json({ success: false, message: getPublicErrorMessage(message, statusCode) });
};
