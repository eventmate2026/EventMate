import { getAllowedFrontendOrigins, getPrimaryFrontendUrl } from "./clientOrigins.js";

const normalizeValue = (value) => String(value || "").trim();
const hasValue = (value) => Boolean(normalizeValue(value));
const normalizeDeployUrl = (value) => {
  const normalized = normalizeValue(value).replace(/\/+$/, "");
  if (!normalized) return "";
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
};

const CONSUMER_MAILBOX_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

const getEmailDomain = (value) => {
  const normalized = normalizeValue(value).toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  return atIndex >= 0 ? normalized.slice(atIndex + 1) : "";
};

const getExplicitEmailProvider = () => {
  const configured = normalizeValue(process.env.EMAIL_PROVIDER).toLowerCase();
  if (["smtp", "gmail", "googlemail", "outlook", "hotmail"].includes(configured)) return "smtp";
  if (configured === "sendgrid") return "sendgrid";
  return "";
};

const getResolvedEmailProvider = () => {
  const explicit = getExplicitEmailProvider();
  if (explicit) return explicit;

  const hasSmtpConfig =
    (hasValue(process.env.SMTP_HOST) || hasValue(process.env.SMTP_SERVICE)) &&
    hasValue(process.env.SMTP_USER) &&
    hasValue(process.env.SMTP_PASS);

  if (hasSmtpConfig) return "smtp";
  if (hasValue(process.env.SENDGRID_API_KEY)) return "sendgrid";
  return "";
};

const getNotificationTrackingMode = () =>
  String(process.env.EMAIL_DELIVERY_TRACKING_MODE || "")
    .trim()
    .toUpperCase();

export const validateRuntimeEnv = () => {
  const errors = [];
  const warnings = [];

  if (!hasValue(process.env.MONGO_URI)) {
    errors.push("MONGO_URI is required.");
  }
  if (!hasValue(process.env.JWT_SECRET)) {
    errors.push("JWT_SECRET is required.");
  }
  if (!hasValue(process.env.JWT_REFRESH_SECRET)) {
    errors.push("JWT_REFRESH_SECRET is required.");
  }

  const allowedOrigins = getAllowedFrontendOrigins();
  const primaryFrontendUrl = getPrimaryFrontendUrl();
  if (!allowedOrigins.length) {
    warnings.push(
      "No frontend origin is configured. Set FRONTEND_URL or FRONTEND_URLS on Render so CORS stays stable."
    );
  }

  const backendPublicUrl = normalizeDeployUrl(
    process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL
  );
  if (!backendPublicUrl) {
    warnings.push(
      "BACKEND_URL is not configured. Public certificate links and backend-origin references may be incomplete."
    );
  }

  if (!hasValue(process.env.CERTIFICATE_DOWNLOAD_SECRET)) {
    warnings.push(
      "CERTIFICATE_DOWNLOAD_SECRET is not set. Signed certificate links will fall back to JWT secrets. Set a dedicated secret for cleaner rotation."
    );
  }

  const emailProvider = getResolvedEmailProvider();
  if (!emailProvider) {
    warnings.push(
      "No email provider is fully configured. OTP, password reset, and contact emails can fail until SMTP or SendGrid is configured."
    );
  } else if (emailProvider === "smtp") {
    const missingSmtp = ["SMTP_USER", "SMTP_PASS"].filter((name) => !hasValue(process.env[name]));
    if (missingSmtp.length) {
      warnings.push(`SMTP provider selected but missing: ${missingSmtp.join(", ")}.`);
    }
  } else if (emailProvider === "sendgrid") {
    const fromEmail = normalizeValue(
      process.env.EMAIL_FROM_EMAIL ||
        process.env.SMTP_FROM_EMAIL ||
        process.env.SMTP_USER
    );
    if (!hasValue(process.env.SENDGRID_API_KEY)) {
      warnings.push("EMAIL_PROVIDER=sendgrid is set but SENDGRID_API_KEY is missing.");
    }
    if (CONSUMER_MAILBOX_DOMAINS.has(getEmailDomain(fromEmail))) {
      warnings.push(
        "SendGrid is configured with a consumer mailbox sender. Without a verified custom sender domain, delivery can be rejected."
      );
    }
  }

  if (
    getNotificationTrackingMode() === "WEBHOOK_DELIVERY" &&
    !hasValue(process.env.EMAIL_EVENT_WEBHOOK_SECRET)
  ) {
    warnings.push(
      "EMAIL_DELIVERY_TRACKING_MODE=WEBHOOK_DELIVERY is set but EMAIL_EVENT_WEBHOOK_SECRET is missing. Notification webhook updates will stay disabled."
    );
  }

  if (errors.length) {
    throw new Error(`[Config] Invalid runtime configuration: ${errors.join(" ")}`);
  }

  console.log(
    `[Config] Frontend origin: ${primaryFrontendUrl || "not configured"} | Backend URL: ${
      backendPublicUrl || "not configured"
    } | Email provider: ${emailProvider || "not configured"}`
  );

  if (allowedOrigins.length) {
    console.log(`[Config] Allowed frontend origins: ${allowedOrigins.join(", ")}`);
  }

  warnings.forEach((warning) => {
    console.warn(`[Config] ${warning}`);
  });

  return {
    warnings,
    frontendOrigins: allowedOrigins,
    primaryFrontendUrl,
    backendPublicUrl,
    emailProvider,
  };
};
