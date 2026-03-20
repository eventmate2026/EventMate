import axios from "axios";
import SummaryApi from "../api/SummaryApi";
import { clearAuth, getStoredRefreshToken, getStoredToken, storeAuth } from "./auth";
import { API_BASE_URL } from "./backendUrl";
import { sanitizeApiPayload } from "./safeMessage";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const GET_CACHE_TTL_MS = 60000;
const NETWORK_RETRY_DELAY_MS = 1200;
const MAX_AUTO_RETRY_ATTEMPTS = 2;
const BACKEND_WARM_TTL_MS = 45000;
const TOKEN_EXPIRY_SKEW_SECONDS = 15;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const RETRYABLE_NETWORK_ERROR_CODES = new Set(["ECONNABORTED", "ERR_NETWORK"]);
const responseCache = new Map();
const pendingGetRequests = new Map();
let backendWarmupPromise = null;
let backendWarmedAt = 0;
let refreshPromise = null;

const decodeJwtPayload = (token) => {
  const parts = String(token || "").trim().split(".");
  if (parts.length < 2) return null;

  let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = base64.length % 4;
  if (paddingLength) {
    base64 += "=".repeat(4 - paddingLength);
  }

  try {
    if (typeof globalThis?.atob === "function") {
      const binary = globalThis.atob(base64);
      const utf8 = Array.from(binary, (char) =>
        `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
      ).join("");
      return JSON.parse(decodeURIComponent(utf8));
    }
  } catch {
    return null;
  }

  return null;
};

const isJwtExpired = (token, skewSeconds = TOKEN_EXPIRY_SKEW_SECONDS) => {
  const exp = Number(decodeJwtPayload(token)?.exp || 0);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  return Date.now() + Math.max(0, Number(skewSeconds) || 0) * 1000 >= exp * 1000;
};

const pause = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(durationMs) || 0));
  });

const getRequestMethod = (config) => String(config?.method || "get").toLowerCase();
const isRefreshRequest = (config) => {
  const refreshUrl = SummaryApi.refresh_token?.url;
  if (!refreshUrl || !config?.url) return false;
  return config.url.includes(refreshUrl);
};

const isRetryableMethod = (config) => {
  const method = getRequestMethod(config);
  return method === "get" || config?.retryable === true;
};

const getRetryAttemptCount = (config) => Math.max(0, Number(config?.__retryAttempt || 0));

const getMaxAutoRetryAttempts = (config) => {
  if (config?.skipRetry) return 0;

  const configured = Number(config?.maxRetries);
  if (Number.isFinite(configured)) {
    return Math.max(0, configured);
  }

  return isRetryableMethod(config) ? MAX_AUTO_RETRY_ATTEMPTS : 0;
};

const isRetryableStatus = (status) => RETRYABLE_STATUS_CODES.has(Number(status));

const isRetryableNetworkError = (error) => {
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").trim();

  return (
    !error?.response &&
    (RETRYABLE_NETWORK_ERROR_CODES.has(code) ||
      /network error|failed to fetch|load failed|connection.*closed|socket hang up|timeout/i.test(message))
  );
};

const resetDerivedRequestState = (config) => {
  const nextConfig = {
    ...config,
    headers: { ...(config?.headers || {}) },
  };

  delete nextConfig.adapter;
  delete nextConfig.__cacheHit;
  delete nextConfig.__cacheKey;
  delete nextConfig.__cacheTTL;
  delete nextConfig.__dedupeHit;
  delete nextConfig.__dedupeKey;

  return nextConfig;
};

const resolveWarmupUrl = () => {
  const base = String(API_BASE_URL || "").trim();
  if (!base) return "";

  try {
    return new URL("/", `${base.replace(/\/+$/, "")}/`).toString();
  } catch {
    return `${base.replace(/\/+$/, "")}/`;
  }
};

export const primeBackendConnection = async ({ force = false } = {}) => {
  if (typeof window === "undefined" || !API_BASE_URL) {
    return false;
  }

  if (!force && backendWarmupPromise) {
    return backendWarmupPromise;
  }

  if (!force && backendWarmedAt && Date.now() - backendWarmedAt < BACKEND_WARM_TTL_MS) {
    return true;
  }

  const warmupUrl = resolveWarmupUrl();
  if (!warmupUrl) {
    return false;
  }

  backendWarmupPromise = axios
    .get(warmupUrl, {
      timeout: 25000,
      validateStatus: (status) => Number(status) >= 200 && Number(status) < 500,
    })
    .then(() => {
      backendWarmedAt = Date.now();
      return true;
    })
    .catch(() => false)
    .finally(() => {
      backendWarmupPromise = null;
    });

  return backendWarmupPromise;
};

const retryRequestIfRecoverable = async (error) => {
  const original = error?.config;
  if (!original) return null;

  const attemptCount = getRetryAttemptCount(original);
  const maxAttempts = getMaxAutoRetryAttempts(original);
  if (attemptCount >= maxAttempts) {
    return null;
  }

  const status = Number(error?.response?.status || 0);
  const shouldRetry = isRetryableStatus(status) || isRetryableNetworkError(error);
  if (!shouldRetry) {
    return null;
  }

  // Wake sleeping backends like Render before retrying the original GET.
  if (isRetryableNetworkError(error) || status >= 502) {
    await primeBackendConnection({ force: true });
  }

  await pause(NETWORK_RETRY_DELAY_MS * (attemptCount + 1));

  const retryConfig = resetDerivedRequestState(original);
  retryConfig.__retryAttempt = attemptCount + 1;
  return api(retryConfig);
};

const shouldCacheRequest = (config) => {
  const method = getRequestMethod(config);
  if (method !== "get") return false;
  if (config?.skipCache) return false;
  if (config?.responseType === "blob" || config?.responseType === "arraybuffer") return false;
  return true;
};

const shouldDedupeRequest = (config) => {
  if (!shouldCacheRequest(config)) return false;
  if (config?.skipDedupe) return false;
  return true;
};

const buildCacheKey = (config) => {
  const token = getStoredToken() || "";
  const method = getRequestMethod(config);
  const url = String(config?.url || "");
  const params = config?.params ? JSON.stringify(config.params) : "";
  return `${token}::${method}::${url}::${params}`;
};

const resolveAdapter = (config) => {
  if (typeof config?.adapter === "function") return config.adapter;
  if (typeof axios.getAdapter === "function") {
    return axios.getAdapter(config?.adapter || api.defaults.adapter || axios.defaults.adapter);
  }
  if (typeof api.defaults.adapter === "function") return api.defaults.adapter;
  if (typeof axios.defaults.adapter === "function") return axios.defaults.adapter;
  return null;
};

const refreshAccessTokenIfPossible = async () => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (isJwtExpired(refreshToken, 0)) {
    clearAuth();
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = api({
      ...SummaryApi.refresh_token,
      data: { refreshToken },
      skipAuth: true,
      skipRetry: true,
    })
      .then((response) => {
        const nextAccess = response.data?.accessToken;
        const nextRefresh = response.data?.refreshToken;
        if (!nextAccess) {
          throw new Error("Missing access token.");
        }
        storeAuth({ accessToken: nextAccess, refreshToken: nextRefresh });
        return nextAccess;
      })
      .catch((error) => {
        const refreshStatus = Number(error?.response?.status || 0);
        if (refreshStatus === 401 || refreshStatus === 403 || isJwtExpired(refreshToken, 0)) {
          clearAuth();
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.request.use(async (config) => {
  const refreshRequest = isRefreshRequest(config);
  let token = getStoredToken();
  config.headers = config.headers || {};

  if (!config.skipAuth && !refreshRequest) {
    if ((!token || isJwtExpired(token)) && getStoredRefreshToken()) {
      try {
        token = await refreshAccessTokenIfPossible();
      } catch {
        token = null;
      }
    }

    if (token && !isJwtExpired(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
  } else if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.skipAuth && config.headers?.Authorization) {
    delete config.headers.Authorization;
  }

  const timezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  if (timezone) {
    config.headers["X-Client-Timezone"] = timezone;
  }

  if (shouldCacheRequest(config)) {
    const key = buildCacheKey(config);
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      config.adapter = async () => ({
        data: cached.data,
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
        config,
        request: null,
      });
      config.__cacheHit = true;
      return config;
    }
    config.__cacheKey = key;
    config.__cacheTTL = Number(config?.cacheTTL) > 0 ? Number(config.cacheTTL) : GET_CACHE_TTL_MS;
  }

  if (shouldDedupeRequest(config)) {
    const dedupeKey = config.__cacheKey || buildCacheKey(config);
    const pending = pendingGetRequests.get(dedupeKey);

    if (pending) {
      config.adapter = async () => {
        const sharedResponse = await pending;
        return {
          data: sharedResponse.data,
          status: sharedResponse.status,
          statusText: sharedResponse.statusText,
          headers: sharedResponse.headers,
          config,
          request: null,
        };
      };
      config.__dedupeHit = true;
      return config;
    }

    const networkAdapter = resolveAdapter(config);
    if (networkAdapter) {
      config.adapter = async (requestConfig) => {
        const pendingPromise = Promise.resolve(networkAdapter(requestConfig));
        pendingGetRequests.set(dedupeKey, pendingPromise);
        try {
          return await pendingPromise;
        } finally {
          pendingGetRequests.delete(dedupeKey);
        }
      };
      config.__dedupeKey = dedupeKey;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    sanitizeApiPayload(response?.data, {
      status: Number(response?.status || 0),
      kind: "success",
    });

    const method = getRequestMethod(response?.config);

    if (method !== "get") {
      responseCache.clear();
      return response;
    }

    if (
      response?.config?.__cacheKey &&
      !response?.config?.__cacheHit &&
      shouldCacheRequest(response.config) &&
      response.status >= 200 &&
      response.status < 300
    ) {
      responseCache.set(response.config.__cacheKey, {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        expiresAt: Date.now() + response.config.__cacheTTL,
      });
    }

    return response;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const contentType = String(error.response?.headers?.["content-type"] || "").toLowerCase();

    if (original?.__dedupeKey) {
      pendingGetRequests.delete(original.__dedupeKey);
    }

    const retryResponse = await retryRequestIfRecoverable(error);
    if (retryResponse) {
      return retryResponse;
    }

    if (
      status >= 500 &&
      typeof error.response?.data === "string" &&
      contentType.includes("text/html")
    ) {
      error.response.data = {
        success: false,
        message: "",
      };
    }

    sanitizeApiPayload(error?.response?.data, {
      status: Number(status || 0),
      kind: "error",
    });

    if (!original || original.skipAuth || original._retry || isRefreshRequest(original) || status !== 401) {
      throw error;
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearAuth();
      throw error;
    }

    try {
      const newAccessToken = await refreshAccessTokenIfPossible();
      if (!newAccessToken) {
        clearAuth();
        throw error;
      }
      original._retry = true;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);
    } catch (refreshError) {
      const refreshStatus = Number(refreshError?.response?.status || 0);
      if (refreshStatus === 401 || refreshStatus === 403) {
        clearAuth();
      }
      throw refreshError;
    }
  }
);

export default api;
