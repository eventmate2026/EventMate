const USER_KEY = "user";
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const LAST_AUTH_ACTIVITY_KEY = "lastAuthActivityAt";
const AUTH_UPDATED_EVENT = "eventmate:auth-updated";
const AUTH_ACTIVITY_WRITE_THROTTLE_MS = 15000;

export const AUTH_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

const getStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readStorage = (key) => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage write failures and keep the in-memory UI responsive.
  }
};

const removeStorage = (key) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage removal failures and keep the in-memory UI responsive.
  }
};

const emitAuthUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT));
};

const normalizeUser = (user) => {
  if (!user) return null;
  const fullName = user.fullName || user.name || "";
  const role =
    typeof user.role === "string" ? user.role.trim().toUpperCase() : user.role;
  return {
    ...user,
    role,
    fullName,
    name: fullName,
    isLoggedIn: true,
  };
};

export const getLastAuthActivityAt = () => {
  const value = Number(readStorage(LAST_AUTH_ACTIVITY_KEY) || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export const touchAuthActivity = (force = false) => {
  const storage = getStorage();
  if (!storage) return 0;

  const now = Date.now();
  const previous = getLastAuthActivityAt();
  if (!force && previous && now - previous < AUTH_ACTIVITY_WRITE_THROTTLE_MS) {
    return previous;
  }

  writeStorage(LAST_AUTH_ACTIVITY_KEY, String(now));
  return now;
};

export const storeAuth = ({ accessToken, refreshToken, token, user }) => {
  const finalAccessToken = accessToken || token;
  if (finalAccessToken) {
    writeStorage(ACCESS_TOKEN_KEY, finalAccessToken);
  } else if (accessToken === null || token === null) {
    removeStorage(ACCESS_TOKEN_KEY);
  }

  if (refreshToken) {
    writeStorage(REFRESH_TOKEN_KEY, refreshToken);
  } else if (refreshToken === null) {
    removeStorage(REFRESH_TOKEN_KEY);
  }

  const normalized = normalizeUser(user);
  if (normalized) {
    writeStorage(USER_KEY, JSON.stringify(normalized));
    if (finalAccessToken) {
      touchAuthActivity(true);
    }
  } else if (user === null) {
    removeStorage(USER_KEY);
  }

  emitAuthUpdated();
};

export const getStoredUser = () => {
  try {
    const parsed = JSON.parse(readStorage(USER_KEY) || "null");
    return normalizeUser(parsed);
  } catch {
    return null;
  }
};

export const getStoredToken = () => readStorage(ACCESS_TOKEN_KEY);
export const getStoredRefreshToken = () => readStorage(REFRESH_TOKEN_KEY);

export const clearAuth = () => {
  removeStorage(ACCESS_TOKEN_KEY);
  removeStorage(REFRESH_TOKEN_KEY);
  removeStorage(USER_KEY);
  removeStorage(LAST_AUTH_ACTIVITY_KEY);
  emitAuthUpdated();
};

export const subscribeAuthUpdates = (listener) => {
  if (typeof window === "undefined") return () => {};

  const onAuthUpdated = () => listener();
  const onStorage = (event) => {
    if (event.key === null || [USER_KEY, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY].includes(event.key)) {
      listener();
    }
  };

  window.addEventListener(AUTH_UPDATED_EVENT, onAuthUpdated);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(AUTH_UPDATED_EVENT, onAuthUpdated);
    window.removeEventListener("storage", onStorage);
  };
};
