import axios from "axios";
import SummaryApi from "../api/SummaryApi";
import { clearAuth, getStoredRefreshToken, getStoredToken, storeAuth } from "./auth";
import { API_BASE_URL } from "./backendUrl";
import { getSafeApiMessage, getSafeSuccessMessage } from "./safeMessage";
import { emitToast } from "./toastBus";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const GET_CACHE_TTL_MS = 60000;
const responseCache = new Map();
const pendingGetRequests = new Map();
const isPlainObject = (value) => Object.prototype.toString.call(value) === "[object Object]";

const shouldCacheRequest = (config) => {
  const method = String(config?.method || "get").toLowerCase();
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
  const method = String(config?.method || "get").toLowerCase();
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

const shouldShowSuccessToast = (config, response) => {
  const method = String(config?.method || response?.config?.method || "get").toLowerCase();
  if (method === "get") return false;
  if (config?.skipSuccessToast) return false;
  const candidate = config?.successToastMessage ?? response?.data?.message;
  return Boolean(getSafeSuccessMessage(candidate, ""));
};

const shouldShowErrorToast = (config) => !config?.skipErrorToast;

const sanitizeErrorPayload = (error, fallbackMessage) => {
  const safeMessage = getSafeApiMessage(error, fallbackMessage);
  error.message = safeMessage;

  if (error.response) {
    const data = error.response.data;
    if (Array.isArray(data?.errors)) {
      data.errors = data.errors.map((item) =>
        typeof item === "string" ? getSafeSuccessMessage(item, safeMessage) : item
      );
    }

    if (data && typeof data === "object" && !Array.isArray(data)) {
      error.response.data = {
        ...data,
        message: safeMessage,
      };
    } else {
      error.response.data = {
        success: false,
        message: safeMessage,
      };
    }
  }

  return safeMessage;
};

const sanitizeResponsePayload = (response) => {
  if (!isPlainObject(response?.data)) return response;

  const nextData = { ...response.data };

  if (typeof nextData.message === "string") {
    nextData.message = getSafeSuccessMessage(nextData.message, "");
  }

  if (Array.isArray(nextData.errors)) {
    nextData.errors = nextData.errors
      .map((item) => (typeof item === "string" ? getSafeSuccessMessage(item, "") : item))
      .filter((item) => item !== "");
  }

  response.data = nextData;
  return response;
};

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.skipAuth && config.headers?.Authorization) {
    delete config.headers.Authorization;
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

let refreshPromise = null;

const isRefreshRequest = (config) => {
  const refreshUrl = SummaryApi.refresh_token?.url;
  if (!refreshUrl || !config?.url) return false;
  return config.url.includes(refreshUrl);
};

api.interceptors.response.use(
  (response) => {
    sanitizeResponsePayload(response);
    const method = String(response?.config?.method || "get").toLowerCase();

    if (method !== "get") {
      responseCache.clear();
      if (shouldShowSuccessToast(response.config, response)) {
        emitToast({
          type: "success",
          text: getSafeSuccessMessage(
            response.config?.successToastMessage ?? response.data?.message,
            ""
          ),
        });
      }
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

    if (
      status >= 500 &&
      typeof error.response?.data === "string" &&
      contentType.includes("text/html")
    ) {
      error.response.data = {
        success: false,
        message: "The service is unavailable right now. Please try again.",
      };
    }

    if (original?.__dedupeKey) {
      pendingGetRequests.delete(original.__dedupeKey);
    }

    if (!original || original.skipAuth || original._retry || isRefreshRequest(original) || status !== 401) {
      const safeMessage = sanitizeErrorPayload(error);
      if (shouldShowErrorToast(original)) {
        emitToast({ type: "error", text: safeMessage });
      }
      throw error;
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearAuth();
      const safeMessage = sanitizeErrorPayload(error);
      if (shouldShowErrorToast(original)) {
        emitToast({ type: "error", text: safeMessage });
      }
      throw error;
    }

    try {
      if (!refreshPromise) {
        refreshPromise = api({
          ...SummaryApi.refresh_token,
          data: { refreshToken },
          skipAuth: true,
          skipErrorToast: true,
          skipSuccessToast: true,
        })
          .then((response) => {
            const nextAccess = response.data?.accessToken;
            const nextRefresh = response.data?.refreshToken;
            if (!nextAccess) throw new Error("Missing access token.");
            storeAuth({ accessToken: nextAccess, refreshToken: nextRefresh });
            return nextAccess;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      const newAccessToken = await refreshPromise;
      original._retry = true;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(original);
    } catch (refreshError) {
      clearAuth();
      const safeMessage = sanitizeErrorPayload(refreshError);
      if (shouldShowErrorToast(original)) {
        emitToast({ type: "error", text: safeMessage });
      }
      throw refreshError;
    }
  }
);

export default api;
