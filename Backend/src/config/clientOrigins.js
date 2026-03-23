const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");

const DEFAULT_LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

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

const isVercelHostname = (hostname) => hostname.endsWith(".vercel.app");

const getVercelSubdomain = (value) => {
  const hostname = getOriginHostname(value);
  if (!isVercelHostname(hostname)) return "";
  return String(hostname.split(".")[0] || "").trim().toLowerCase();
};

const extractVercelProjectPrefix = (value) => {
  const subdomain = getVercelSubdomain(value);
  if (!subdomain) return "";
  const gitPreviewPrefix = subdomain.split("-git-")[0];
  return gitPreviewPrefix.trim().toLowerCase();
};

const getAllowedVercelProjectPrefixes = (origins) =>
  Array.from(
    new Set(
      origins
        .map(extractVercelProjectPrefix)
        .filter(Boolean)
    )
  );

const getAllowedVercelTeamScopeMappings = (origins) => {
  const subdomains = Array.from(
    new Set(
      origins
        .map(getVercelSubdomain)
        .filter(Boolean)
    )
  );
  const mappings = [];

  for (const base of subdomains) {
    for (const candidate of subdomains) {
      if (candidate === base || !candidate.startsWith(`${base}-`)) continue;
      const scope = candidate.slice(base.length + 1).trim().toLowerCase();
      if (!scope) continue;
      mappings.push({
        basePrefix: base,
        baseRoot: String(base.split("-")[0] || "").trim().toLowerCase(),
        scope,
      });
    }
  }

  return Array.from(
    new Map(
      mappings.map((mapping) => [`${mapping.basePrefix}::${mapping.scope}`, mapping])
    ).values()
  );
};

const isMatchingScopedVercelPreviewOrigin = (origin, allowedOrigins) => {
  const subdomain = getVercelSubdomain(origin);
  if (!subdomain) return false;

  const scopeMappings = getAllowedVercelTeamScopeMappings(allowedOrigins);
  if (!scopeMappings.length) return false;

  return scopeMappings.some(({ basePrefix, baseRoot, scope }) => {
    if (!subdomain.endsWith(`-${scope}`)) return false;
    const previewPrefix = subdomain.slice(0, -(scope.length + 1)).trim().toLowerCase();
    if (!previewPrefix) return false;
    return (
      previewPrefix === basePrefix ||
      previewPrefix.startsWith(`${basePrefix}-`) ||
      (baseRoot &&
        (previewPrefix === baseRoot || previewPrefix.startsWith(`${baseRoot}-`)))
    );
  });
};

const isMatchingVercelPreviewOrigin = (origin, allowedOrigins) => {
  const hostname = getOriginHostname(origin);
  if (!isVercelHostname(hostname)) return false;

  const allowedPrefixes = getAllowedVercelProjectPrefixes(allowedOrigins);
  if (!allowedPrefixes.length) return false;

  return allowedPrefixes.some((prefix) =>
    hostname === `${prefix}.vercel.app` || hostname.startsWith(`${prefix}-`)
  ) || isMatchingScopedVercelPreviewOrigin(origin, allowedOrigins);
};

const isCorsDebugEnabled = () =>
  /^true$/i.test(String(process.env.CORS_DEBUG || "").trim());

const logCorsDebug = (message) => {
  if (!isCorsDebugEnabled()) return;
  console.log(`[CORS] ${message}`);
};

export const getAllowedFrontendOrigins = () =>
  collectOrigins(
    DEFAULT_LOCAL_ORIGINS,
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
      logCorsDebug("Allowing request without Origin header.");
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
      logCorsDebug(`Allowing exact origin: ${normalizedOrigin}`);
      callback(null, true);
      return;
    }

    if (isMatchingVercelPreviewOrigin(normalizedOrigin, allowedOrigins)) {
      logCorsDebug(`Allowing Vercel preview origin: ${normalizedOrigin}`);
      callback(null, true);
      return;
    }

    logCorsDebug(`Rejecting origin: ${normalizedOrigin}`);
    callback(new Error("Origin not allowed by CORS"));
  };
};   
}
