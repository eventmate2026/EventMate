import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { getSecuritySettings } from "../services/securitySettings.service.js";

export default async function optionalAuthMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const settings = await getSecuritySettings();
    if (settings?.tokenInvalidBefore && decoded?.iat) {
      const invalidBeforeSeconds = Math.floor(settings.tokenInvalidBefore.getTime() / 1000);
      if (decoded.iat < invalidBeforeSeconds) {
        return next();
      }
    }

    const user = await User.findById(decoded.userId);
    if (!user) return next();

    if (settings?.maintenanceMode && user.role !== "MAIN_ADMIN") {
      return res.status(503).json({
        success: false,
        message: "System is under maintenance. Please try again later.",
      });
    }

    req.user = user;
  } catch {
    // Ignore auth errors for optional auth
  }
  next();
}
