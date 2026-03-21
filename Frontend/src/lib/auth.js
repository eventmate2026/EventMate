const USER_KEY = "user";
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const AUTH_UPDATED_EVENT = "eventmate:auth-updated";
const USER_COOKIE_KEY = "eventmate_user";
const ACCESS_TOKEN_COOKIE_KEY = "eventmate_access_token";
const REFRESH_TOKEN_COOKIE_KEY = "eventmate_refresh_token";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

const readCookie = (key) => {
  if (typeof document === "undefined") return null;
  const pattern = `${encodeURIComponent(key)}=`;
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(pattern));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(pattern.length));
  } catch {
    return cookie.slice(pattern.length);
  }
};

const writeCookie = (key, value, maxAgeSeconds = COOKIE_MAX_AGE_SECONDS) => {
  if (typeof document === "undefined") return;
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(value);
  document.cookie = `${encodedKey}=${encodedValue}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
};

const removeCookie = (key) => {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; SameSite=Lax`;
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

export const storeAuth = ({ accessToken, refreshToken, token, user }) => {
  const finalAccessToken = accessToken || token;
  if (finalAccessToken) {
    writeStorage(ACCESS_TOKEN_KEY, finalAccessToken);
    removeCookie(ACCESS_TOKEN_COOKIE_KEY);
  } else if (accessToken === null || token === null) {
    removeStorage(ACCESS_TOKEN_KEY);
    removeCookie(ACCESS_TOKEN_COOKIE_KEY);
  }

  if (refreshToken) {
    writeStorage(REFRESH_TOKEN_KEY, refreshToken);
    removeCookie(REFRESH_TOKEN_COOKIE_KEY);
  } else if (refreshToken === null) {
    removeStorage(REFRESH_TOKEN_KEY);
    removeCookie(REFRESH_TOKEN_COOKIE_KEY);
  }

  const normalized = normalizeUser(user);
  if (normalized) {
    const serializedUser = JSON.stringify(normalized);
    writeStorage(USER_KEY, serializedUser);
    removeCookie(USER_COOKIE_KEY);
  } else if (user === null) {
    removeStorage(USER_KEY);
    removeCookie(USER_COOKIE_KEY);
  }

  emitAuthUpdated();
};

const migrateLegacyCookieToStorage = (storageKey, cookieKey) => {
  const storageValue = readStorage(storageKey);
  if (storageValue) return storageValue;

  const cookieValue = readCookie(cookieKey);
  if (!cookieValue) return null;

  writeStorage(storageKey, cookieValue);
  removeCookie(cookieKey);
  return cookieValue;
};

export const getStoredUser = () => {
  try {
    const raw =
      readStorage(USER_KEY) || migrateLegacyCookieToStorage(USER_KEY, USER_COOKIE_KEY) || "null";
    const parsed = JSON.parse(raw);
    const normalized = normalizeUser(parsed);
    if (normalized && !readStorage(USER_KEY)) {
      writeStorage(USER_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return null;
  }
};

export const getStoredToken = () => {
  const value =
    readStorage(ACCESS_TOKEN_KEY) ||
    migrateLegacyCookieToStorage(ACCESS_TOKEN_KEY, ACCESS_TOKEN_COOKIE_KEY);
  if (value && !readStorage(ACCESS_TOKEN_KEY)) {
    writeStorage(ACCESS_TOKEN_KEY, value);
  }
  return value;
};

export const getStoredRefreshToken = () => {
  const value =
    readStorage(REFRESH_TOKEN_KEY) ||
    migrateLegacyCookieToStorage(REFRESH_TOKEN_KEY, REFRESH_TOKEN_COOKIE_KEY);
  if (value && !readStorage(REFRESH_TOKEN_KEY)) {
    writeStorage(REFRESH_TOKEN_KEY, value);
  }
  return value;
};

export const clearAuth = () => {
  removeStorage(ACCESS_TOKEN_KEY);
  removeStorage(REFRESH_TOKEN_KEY);
  removeStorage(USER_KEY);
  removeCookie(ACCESS_TOKEN_COOKIE_KEY);
  removeCookie(REFRESH_TOKEN_COOKIE_KEY);
  removeCookie(USER_COOKIE_KEY);
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
