import axios from "axios";
import SummaryApi from "../api/SummaryApi";
import { clearAuth, getStoredRefreshToken, getStoredToken, storeAuth } from "./auth";
import { API_BASE_URL } from "./backendUrl";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const GET_CACHE_TTL_MS = 60000;
const responseCache = new Map();
const pendingGetRequests = new Map();

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
    const method = String(response?.config?.method || "get").toLowerCase();

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

    if (
      status >= 500 &&
      typeof error.response?.data === "string" &&
      contentType.includes("text/html")
    ) {
      error.response.data = {
        success: false,
        message: "Backend is unreachable. Start the backend server and try again.",
      };
    }

    if (original?.__dedupeKey) {
      pendingGetRequests.delete(original.__dedupeKey);
    }

    if (!original || original.skipAuth || original._retry || isRefreshRequest(original) || status !== 401) {
      throw error;
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearAuth();
      throw error;
    }

    try {
      if (!refreshPromise) {
        refreshPromise = api({
          ...SummaryApi.refresh_token,
          data: { refreshToken },
          skipAuth: true,
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
      throw refreshError;
    }
  }
);

export default api;
