import { randomUUID } from "crypto";

const FALLBACK_BROWSER = "Browser";
const FALLBACK_PLATFORM = "Unknown Device";
const FALLBACK_LOCATION = "Unknown";
const FALLBACK_NETWORK = "Unknown network";

const BROWSER_MATCHERS = [
  { pattern: /edg\//i, label: "Edge" },
  { pattern: /opr\//i, label: "Opera" },
  { pattern: /chrome\//i, label: "Chrome" },
  { pattern: /firefox\//i, label: "Firefox" },
  { pattern: /safari\//i, label: "Safari" },
];

const PLATFORM_MATCHERS = [
  { pattern: /iphone/i, label: "iPhone" },
  { pattern: /ipad/i, label: "iPad" },
  { pattern: /android/i, label: "Android" },
  { pattern: /windows/i, label: "Windows" },
  { pattern: /mac os|macintosh/i, label: "macOS" },
  { pattern: /linux/i, label: "Linux" },
];

const normalizeText = (value, fallback = null, maxLength = 300) => {
  const next = String(value || "").trim();
  if (!next) return fallback;
  return next.slice(0, maxLength);
};

const detectLabel = (value, matchers, fallback) => {
  const source = String(value || "");
  const match = matchers.find((entry) => entry.pattern.test(source));
  return match?.label || fallback;
};

export const getRequestIpAddress = (req) => {
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim().slice(0, 100);
  }
  return normalizeText(req.ip || req.socket?.remoteAddress, null, 100);
};

export const getRequestTimezone = (req) =>
  normalizeText(req.headers?.["x-client-timezone"], null, 120);

export const getRequestUserAgent = (req) =>
  normalizeText(req.headers?.["user-agent"], null, 300);

export const buildDeviceLabel = (userAgent) => {
  const browser = detectLabel(userAgent, BROWSER_MATCHERS, FALLBACK_BROWSER);
  const platform = detectLabel(userAgent, PLATFORM_MATCHERS, FALLBACK_PLATFORM);
  return `${browser} on ${platform}`;
};

export const createRefreshSessionRecord = (req, refreshToken, sessionId = randomUUID()) => {
  const now = new Date();
  const userAgent = getRequestUserAgent(req);
  return {
    sessionId,
    refreshToken,
    userAgent,
    ipAddress: getRequestIpAddress(req),
    timezone: getRequestTimezone(req),
    deviceLabel: buildDeviceLabel(userAgent),
    createdAt: now,
    lastActiveAt: now,
  };
};

export const ensureRefreshSessions = (user) => {
  if (!Array.isArray(user.refreshSessions)) {
    user.refreshSessions = [];
  }
  return user.refreshSessions;
};

export const findRefreshSession = (user, sessionId) => {
  if (!sessionId) return null;
  return ensureRefreshSessions(user).find((session) => session.sessionId === sessionId) || null;
};

export const removeRefreshSession = (user, sessionId) => {
  const sessions = ensureRefreshSessions(user);
  const nextSessions = sessions.filter((session) => session.sessionId !== sessionId);
  user.refreshSessions = nextSessions;
  return nextSessions.length !== sessions.length;
};

export const upsertRefreshSession = (user, record) => {
  const sessions = ensureRefreshSessions(user);
  const existingIndex = sessions.findIndex((session) => session.sessionId === record.sessionId);
  if (existingIndex >= 0) {
    sessions[existingIndex] = {
      ...sessions[existingIndex].toObject?.(),
      ...record,
    };
    user.refreshSessions = sessions;
    return sessions[existingIndex];
  }
  sessions.push(record);
  user.refreshSessions = sessions;
  return record;
};

export const touchRefreshSession = (user, sessionId, req, { refreshToken } = {}) => {
  const session = findRefreshSession(user, sessionId);
  if (!session) return null;
  const userAgent = getRequestUserAgent(req) || session.userAgent || null;
  session.userAgent = userAgent;
  session.deviceLabel = buildDeviceLabel(userAgent);
  session.ipAddress = getRequestIpAddress(req) || session.ipAddress || null;
  session.timezone = getRequestTimezone(req) || session.timezone || null;
  session.lastActiveAt = new Date();
  if (typeof refreshToken === "string" && refreshToken.trim()) {
    session.refreshToken = refreshToken;
  }
  return session;
};

export const serializeActiveSessions = (user, currentSessionId = null, req = null) => {
  const sessions = [...ensureRefreshSessions(user)]
    .map((session) => ({
      id: session.sessionId,
      device: session.deviceLabel || buildDeviceLabel(session.userAgent),
      app: session.sessionId === currentSessionId ? "Current Session" : "Tracked Session",
      ip: session.ipAddress || FALLBACK_NETWORK,
      location: session.timezone || FALLBACK_LOCATION,
      lastActiveAt: session.lastActiveAt || session.createdAt || null,
      createdAt: session.createdAt || null,
      current: session.sessionId === currentSessionId,
      canTerminate: session.sessionId !== currentSessionId,
    }))
    .sort((left, right) => {
      const leftTime = new Date(left.lastActiveAt || 0).getTime();
      const rightTime = new Date(right.lastActiveAt || 0).getTime();
      return rightTime - leftTime;
    });

  if (sessions.length || !user?.refreshToken) {
    return sessions;
  }

  const userAgent = getRequestUserAgent(req);
  return [
    {
      id: currentSessionId || "legacy-current-session",
      device: buildDeviceLabel(userAgent),
      app: "Current Session",
      ip: getRequestIpAddress(req) || FALLBACK_NETWORK,
      location: getRequestTimezone(req) || FALLBACK_LOCATION,
      lastActiveAt: user?.lastLoginAt || user?.updatedAt || user?.createdAt || null,
      createdAt: user?.lastLoginAt || user?.createdAt || null,
      current: true,
      canTerminate: false,
    },
  ];
};
