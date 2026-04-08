import crypto from "crypto";
import UserSession from "../models/UserSession.model.js";

const TOUCH_INTERVAL_MS = 60 * 1000;

const readHeader = (headers, name) => {
  const value = headers?.[name];
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
};

const detectBrowser = (userAgent = "") => {
  if (!userAgent) return "Browser";
  if (/Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) return "Opera";
  if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) return "Chrome";
  if (/Firefox\//i.test(userAgent)) return "Firefox";
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "Safari";
  if (/SamsungBrowser\//i.test(userAgent)) return "Samsung Internet";
  return "Browser";
};

const detectOs = (userAgent = "") => {
  if (!userAgent) return "Unknown OS";
  if (/Windows NT/i.test(userAgent)) return "Windows";
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPhone|iPod/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Mac OS X|Macintosh/i.test(userAgent)) return "macOS";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown OS";
};

const detectDeviceType = (userAgent = "") => {
  if (!userAgent) return "Unknown";
  if (/iPad|Tablet/i.test(userAgent)) return "Tablet";
  if (/Mobile|Android|iPhone|iPod/i.test(userAgent)) return "Mobile";
  return "Desktop";
};

const normalizeIpAddress = (value = "") =>
  String(value || "")
    .split(",")[0]
    .trim()
    .replace(/^::ffff:/i, "");

export const hashSessionToken = (value = "") =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

export const getRequestIpAddress = (req) => {
  const forwardedFor = readHeader(req?.headers, "x-forwarded-for");
  if (forwardedFor) return normalizeIpAddress(forwardedFor);
  return normalizeIpAddress(req?.ip || req?.socket?.remoteAddress || "");
};

export const buildSessionSnapshot = (req) => {
  const userAgent = readHeader(req?.headers, "user-agent").slice(0, 500);
  const browser = detectBrowser(userAgent);
  const os = detectOs(userAgent);
  const deviceType = detectDeviceType(userAgent);
  return {
    ipAddress: getRequestIpAddress(req),
    userAgent,
    browser,
    os,
    deviceType,
    deviceLabel: `${browser} on ${os}`,
  };
};

export const createUserSession = async ({
  userId,
  sessionId,
  refreshToken,
  expiresAt,
  req,
}) => {
  const snapshot = buildSessionSnapshot(req);
  return UserSession.create({
    userId,
    sessionId,
    refreshTokenHash: hashSessionToken(refreshToken),
    expiresAt,
    lastActiveAt: new Date(),
    ...snapshot,
  });
};

export const getActiveUserSession = async ({ userId, sessionId, includeRefreshTokenHash = false }) => {
  if (!userId || !sessionId) return null;

  const query = UserSession.findOne({
    userId,
    sessionId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (includeRefreshTokenHash) query.select("+refreshTokenHash");
  return query;
};

export const touchUserSession = async ({ sessionId, req, force = false }) => {
  if (!sessionId) return null;

  const existing = await UserSession.findOne({ sessionId, revokedAt: null });
  if (!existing) return null;

  const now = Date.now();
  const lastActiveAt = new Date(existing.lastActiveAt || 0).getTime();
  if (!force && now - lastActiveAt < TOUCH_INTERVAL_MS) {
    return existing;
  }

  const snapshot = buildSessionSnapshot(req);
  existing.lastActiveAt = new Date(now);
  existing.ipAddress = snapshot.ipAddress;
  existing.userAgent = snapshot.userAgent;
  existing.browser = snapshot.browser;
  existing.os = snapshot.os;
  existing.deviceType = snapshot.deviceType;
  existing.deviceLabel = snapshot.deviceLabel;
  await existing.save();
  return existing;
};

export const rotateUserSession = async ({ sessionId, refreshToken, expiresAt, req }) => {
  if (!sessionId || !refreshToken) return null;
  const snapshot = buildSessionSnapshot(req);
  return UserSession.findOneAndUpdate(
    {
      sessionId,
      revokedAt: null,
    },
    {
      $set: {
        refreshTokenHash: hashSessionToken(refreshToken),
        expiresAt,
        lastActiveAt: new Date(),
        ...snapshot,
      },
    },
    { new: true }
  ).select("+refreshTokenHash");
};

export const revokeUserSession = async ({ sessionId, userId = null, reason = "SIGNED_OUT" }) => {
  if (!sessionId) return null;

  const filter = {
    sessionId,
    revokedAt: null,
  };
  if (userId) filter.userId = userId;

  return UserSession.findOneAndUpdate(
    filter,
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: String(reason || "SIGNED_OUT").slice(0, 160),
        lastActiveAt: new Date(),
      },
    },
    { new: true }
  );
};

export const revokeAllUserSessions = async ({ userId, reason = "FORCED_LOGOUT" }) => {
  if (!userId) return { modifiedCount: 0 };
  return UserSession.updateMany(
    {
      userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: String(reason || "FORCED_LOGOUT").slice(0, 160),
        lastActiveAt: new Date(),
      },
    }
  );
};

export const revokeEverySession = async ({ reason = "SECURITY_RESET" } = {}) =>
  UserSession.updateMany(
    { revokedAt: null },
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: String(reason || "SECURITY_RESET").slice(0, 160),
        lastActiveAt: new Date(),
      },
    }
  );

export const listUserSessions = async (userId) => {
  if (!userId) return [];
  return UserSession.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ lastActiveAt: -1, createdAt: -1 });
};

export const countUserLoginsSince = async (userId, since) => {
  if (!userId || !since) return 0;
  return UserSession.countDocuments({
    userId,
    createdAt: { $gte: since },
  });
};
