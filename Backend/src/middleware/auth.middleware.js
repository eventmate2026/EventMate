import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { getSecuritySettings } from "../services/securitySettings.service.js";
import {
  extractBearerToken,
  SESSION_EXPIRED_MESSAGE,
  validateSessionState
} from "../utils/sessionValidation.js";
import {
  getActiveUserSession,
  touchUserSession,
} from "../services/session.service.js";

export default async function authMiddleware(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const settings = await getSecuritySettings();
    const user = await User.findById(decoded.userId);
    const validation = validateSessionState({
      user,
      settings,
      issuedAtSeconds: decoded?.iat
    });
    if (!validation.valid) {
      return res.status(validation.statusCode).json({
        success: false,
        message: validation.message
      });
    }

    const sessionId = String(decoded?.sessionId || "").trim();
    if (sessionId) {
      const session = await getActiveUserSession({
        userId: user._id,
        sessionId,
      });

      if (!session) {
        return res.status(401).json({
          success: false,
          message: SESSION_EXPIRED_MESSAGE,
        });
      }

      req.currentSession = session;
      req.sessionId = sessionId;
      await touchUserSession({ sessionId, req });
    } else {
      req.currentSession = null;
      req.sessionId = null;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: SESSION_EXPIRED_MESSAGE });
  }
}
