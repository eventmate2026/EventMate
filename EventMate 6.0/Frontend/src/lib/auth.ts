const USER_KEY = "user";
const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const AUTH_UPDATED_EVENT = "eventmate:auth-updated";

const emitAuthUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT));
};

const normalizeUser = (user) => {
  if (!user) return null;
  const fullName = user.fullName || user.name || "";
  return {
    ...user,
    fullName,
    name: fullName,
    isLoggedIn: true,
  };
};

export const storeAuth = ({ accessToken, refreshToken, token, user }) => {
  const finalAccessToken = accessToken || token;
  if (finalAccessToken) localStorage.setItem(ACCESS_TOKEN_KEY, finalAccessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

  const normalized = normalizeUser(user);
  if (normalized) {
    localStorage.setItem(USER_KEY, JSON.stringify(normalized));
  }

  emitAuthUpdated();
};

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};

export const getStoredToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const clearAuth = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthUpdated();
};

export const subscribeAuthUpdates = (listener) => {
  if (typeof window === "undefined") return () => {};

  const onAuthUpdated = () => listener();
  const onStorage = (event) => {
    if ([USER_KEY, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY].includes(event.key)) {
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
