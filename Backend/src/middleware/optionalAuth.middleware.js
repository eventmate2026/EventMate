import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { getSecuritySettings } from "../services/securitySettings.service.js";
import { extractBearerToken, validateSessionState } from "../utils/sessionValidation.js";
import {
  getActiveUserSession,
  touchUserSession,
} from "../services/session.service.js";

export default async function optionalAuthMiddleware(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const settings = await getSecuritySettings();
    const user = await User.findById(decoded.userId);
    const validation = validateSessionState({
      user,
      settings,
      issuedAtSeconds: decoded?.iat
    });
    if (!validation.valid) {
      if (validation.statusCode === 503) {
        return res.status(503).json({
          success: false,
          message: validation.message,
        });
      }
      return next();
    }

    const sessionId = String(decoded?.sessionId || "").trim();
    if (sessionId) {
      const session = await getActiveUserSession({
        userId: user._id,
        sessionId,
      });

      if (!session) {
        return next();
      }

      req.currentSession = session;
      req.sessionId = sessionId;
      await touchUserSession({ sessionId, req });
    } else {
      req.currentSession = null;
      req.sessionId = null;
    }

    req.user = user;
  } catch {
    // Ignore auth errors for optional auth
  }
  next();
}
