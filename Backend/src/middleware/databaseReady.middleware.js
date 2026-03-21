import { isDatabaseReady } from "../config/db.js";

const SERVICE_WARMING_UP_MESSAGE =
  "The service is waking up right now. Please try again in a few moments.";

const databaseReadyMiddleware = (req, res, next) => {
  if (String(req.method || "").toUpperCase() === "OPTIONS") {
    return next();
  }

  if (isDatabaseReady()) {
    return next();
  }

  return res.status(503).json({
    success: false,
    code: "SERVICE_WARMING_UP",
    message: SERVICE_WARMING_UP_MESSAGE,
  });
};

export default databaseReadyMiddleware;
