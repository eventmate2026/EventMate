import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { getSecuritySettings } from "../services/securitySettings.service.js";

export default async function authMiddleware(req, res, next) {
  try {
    console.log("Auth midleware hit");
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const settings = await getSecuritySettings();
    if (settings?.tokenInvalidBefore && decoded?.iat) {
      const invalidBeforeSeconds = Math.floor(settings.tokenInvalidBefore.getTime() / 1000);
      if (decoded.iat < invalidBeforeSeconds) {
        return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
      }
    }
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    if (settings?.maintenanceMode && user.role !== "MAIN_ADMIN") {
      return res.status(503).json({
        success: false,
        message: "System is under maintenance. Please try again later.",
      });
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
