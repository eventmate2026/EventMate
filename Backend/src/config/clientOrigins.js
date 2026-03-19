const normalizeOrigin = (value) => String(value || "").trim().replace(/\/+$/, "");

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
