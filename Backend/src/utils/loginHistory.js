const DAY_MS = 24 * 60 * 60 * 1000;
const LOGIN_HISTORY_RETENTION_DAYS = 120;
const MAX_LOGIN_HISTORY_ITEMS = 200;

const toValidDate = (value) => {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeEntries = (user) =>
  (Array.isArray(user?.loginHistory) ? user.loginHistory : [])
    .map(toValidDate)
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());

const trimEntries = (entries, now = new Date()) => {
  const threshold = now.getTime() - LOGIN_HISTORY_RETENTION_DAYS * DAY_MS;
  return entries
    .filter((entry) => entry.getTime() >= threshold)
    .slice(-MAX_LOGIN_HISTORY_ITEMS);
};

export const recordLoginHistoryEntry = (user, timestamp = new Date()) => {
  const now = toValidDate(timestamp) || new Date();
  const entries = trimEntries(normalizeEntries(user), now);
  entries.push(now);
  user.loginHistory = trimEntries(entries, now);
  return user.loginHistory;
};

export const countRecentLogins = (user, days = 30) => {
  const threshold = Date.now() - Math.max(1, Number(days) || 30) * DAY_MS;
  const recentEntries = normalizeEntries(user).filter((entry) => entry.getTime() >= threshold);
  if (recentEntries.length) return recentEntries.length;

  const legacyLastLogin = toValidDate(user?.lastLoginAt);
  return legacyLastLogin && legacyLastLogin.getTime() >= threshold ? 1 : 0;
};
