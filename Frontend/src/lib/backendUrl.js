const trimTrailingSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const isLoopbackHostname = (value) => LOOPBACK_HOSTNAMES.has(String(value || "").trim().toLowerCase());

const resolveConfiguredBaseUrl = (value) => {
  const normalizedValue = trimTrailingSlash(value);
  if (!normalizedValue || typeof window === "undefined") {
    return normalizedValue;
  }

  try {
    const configuredUrl = new URL(normalizedValue);
    const currentUrl = new URL(window.location.origin);

    if (!isLoopbackHostname(configuredUrl.hostname) || !isLoopbackHostname(currentUrl.hostname)) {
      return normalizedValue;
    }

    configuredUrl.hostname = currentUrl.hostname;
    return trimTrailingSlash(configuredUrl.toString());
  } catch {
    return normalizedValue;
  }
};

const configuredBaseUrl = resolveConfiguredBaseUrl(import.meta.env.VITE_API_URL);

export const API_BASE_URL = configuredBaseUrl;

// In dev, same-origin socket requests are forwarded by the Vite proxy.
export const SOCKET_BASE_URL = configuredBaseUrl || (import.meta.env.DEV ? undefined : null);
