import axios from "axios";
import SummaryApi from "../api/SummaryApi";
import { clearAuth, getStoredRefreshToken, getStoredToken, storeAuth } from "./auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.skipAuth && config.headers?.Authorization) {
    delete config.headers.Authorization;
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
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

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
