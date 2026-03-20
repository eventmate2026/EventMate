const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");
const getOriginHostname = (value) => {
  const normalized = normalizeOrigin(value);
  if (!normalized) return "";

  try {
    return new URL(normalized).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
};

const isLocalOrigin = (value) => {
  const hostname = getOriginHostname(value);
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
};

const isHttpsOrigin = (value) => /^https:\/\//i.test(normalizeOrigin(value));

const normalizeDeployUrl = (value) => {
  const normalized = normalizeOrigin(value);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `https://${normalized}`;
};

const collectOrigins = (...values) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => String(value || "").split(","))
        .map(normalizeOrigin)
        .filter(Boolean)
    )
  );

export const getAllowedFrontendOrigins = () =>
  collectOrigins(
    process.env.FRONTEND_URLS,
    process.env.FRONTEND_URL,
    normalizeDeployUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    normalizeDeployUrl(process.env.VERCEL_BRANCH_URL),
    normalizeDeployUrl(process.env.VERCEL_URL)
  );

export const getPrimaryFrontendUrl = () => {
  const allowedOrigins = getAllowedFrontendOrigins();

  return (
    allowedOrigins.find((origin) => isHttpsOrigin(origin) && !isLocalOrigin(origin)) ||
    allowedOrigins.find((origin) => !isLocalOrigin(origin)) ||
    allowedOrigins[0] ||
    ""
  );
};

export const createCorsOriginValidator = () => {
  const allowedOrigins = getAllowedFrontendOrigins();

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    const corsError = new Error("Origin not allowed by CORS");
    corsError.statusCode = 403;
    callback(corsError);
  };
};
