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
