const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");

const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

const expandLoopbackAliases = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return [];

  try {
    const parsed = new URL(normalizedOrigin);
    const hostname = String(parsed.hostname || "").trim().toLowerCase();

    if (!LOOPBACK_HOSTNAMES.includes(hostname)) {
      return [normalizedOrigin];
    }

    return LOOPBACK_HOSTNAMES.map((aliasHostname) => {
      const aliasUrl = new URL(parsed.toString());
      aliasUrl.hostname = aliasHostname;
      return normalizeOrigin(aliasUrl.toString());
    });
  } catch {
    return [normalizedOrigin];
  }
};

const collectOrigins = (...values) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => String(value || "").split(","))
        .flatMap(expandLoopbackAliases)
        .filter(Boolean)
    )
  );

export const getAllowedFrontendOrigins = () =>
  collectOrigins(process.env.FRONTEND_URLS, process.env.FRONTEND_URL);

export const getPrimaryFrontendUrl = () => getAllowedFrontendOrigins()[0] || "";

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

    callback(new Error("Origin not allowed by CORS"));
  };
};
