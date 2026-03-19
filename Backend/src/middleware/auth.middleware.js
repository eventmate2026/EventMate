import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { getSecuritySettings } from "../services/securitySettings.service.js";
import { findRefreshSession, touchRefreshSession } from "../utils/sessionTracker.js";

export default async function authMiddleware(req, res, next) {
  try {
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
    const user = await User.findById(decoded.userId).select("+refreshSessions");
    if (!user) return res.status(401).json({ success: false, message: "User not found" });

    const sessionId = String(decoded?.sessionId || "").trim() || null;
    req.authSessionId = sessionId;

    if (sessionId) {
      const session = findRefreshSession(user, sessionId);
      if (!session) {
        return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
      }

      const lastActiveAt = session.lastActiveAt ? new Date(session.lastActiveAt).getTime() : 0;
      if (!lastActiveAt || Date.now() - lastActiveAt > 60 * 1000) {
        touchRefreshSession(user, sessionId, req);
        await user.save({ validateBeforeSave: false });
      }
    }

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
