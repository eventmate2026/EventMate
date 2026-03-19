const trimTrailingSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const configuredBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_URL);

export const API_BASE_URL = configuredBaseUrl;

// In dev, same-origin socket requests are forwarded by the Vite proxy.
export const SOCKET_BASE_URL = configuredBaseUrl || (import.meta.env.DEV ? undefined : null);
