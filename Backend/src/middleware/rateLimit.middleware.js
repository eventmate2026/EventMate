import rateLimit from "express-rate-limit";

const normalizeIp = (value) => {
  const input = String(value || "").trim();
  if (!input) return "";

  const withoutIpv4MappedPrefix = input.replace(/^::ffff:/i, "");

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(withoutIpv4MappedPrefix)) {
    return withoutIpv4MappedPrefix.replace(/:\d+$/, "");
  }

  if (withoutIpv4MappedPrefix.startsWith("[") && withoutIpv4MappedPrefix.includes("]")) {
    return withoutIpv4MappedPrefix.slice(1, withoutIpv4MappedPrefix.indexOf("]"));
  }

  return withoutIpv4MappedPrefix;
};

const getForwardedIp = (value) => {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const next = getForwardedIp(entry);
      if (next) return next;
    }
    return "";
  }

  return String(value || "")
    .split(",")
    .map((entry) => normalizeIp(entry))
    .find(Boolean);
};

const getRateLimitKey = (req) => {
  const headerIp =
    getForwardedIp(req.headers?.["x-forwarded-for"]) ||
    normalizeIp(req.headers?.["x-real-ip"]) ||
    normalizeIp(req.headers?.["cf-connecting-ip"]);

  return (
    normalizeIp(req.ip) ||
    headerIp ||
    normalizeIp(req.socket?.remoteAddress) ||
    "unknown-client"
  );
};

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: { success: false, message: "Too many requests, try later" },
  keyGenerator: (req) => getRateLimitKey(req),
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    keyGenerator: (req) => getRateLimitKey(req),
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      trustProxy: false,
      xForwardedForHeader: false,
    },
  });

export const refreshLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: "Too many session refresh attempts. Try again shortly.",
});

export const otpVerificationLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many verification attempts. Please try again shortly.",
});

export const passwordRecoveryLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password recovery attempts. Please try again later.",
});

export const contactLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many contact requests. Please try again later.",
});

export const certificatePublicLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 80,
  message: "Too many certificate requests. Please try again later.",
});

export const emailWebhookLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 300,
  message: "Too many webhook requests. Please try again later.",
});
