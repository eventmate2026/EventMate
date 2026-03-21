import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { createCorsOriginValidator } from "./src/config/clientOrigins.js";
import User from "./src/models/User.model.js";
import { getSecuritySettings } from "./src/services/securitySettings.service.js";
import startCronJobs from "./src/utils/cronJobs.js";
import { findRefreshSession } from "./src/utils/sessionTracker.js";
import {
  initSocket,
  isNotificationEmailWorkerEnabled,
  startNotificationEmailWorker
} from "./src/services/notification.service.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);
const corsOriginValidator = createCorsOriginValidator();

const resolveSocketToken = (socket) => {
  const authorizationHeader = String(socket?.handshake?.headers?.authorization || "").trim();
  if (/^bearer\s+/i.test(authorizationHeader)) {
    return authorizationHeader.replace(/^bearer\s+/i, "").trim();
  }

  const authToken = String(
    socket?.handshake?.auth?.token || socket?.handshake?.auth?.accessToken || ""
  ).trim();
  if (authToken) return authToken;

  return String(socket?.handshake?.query?.token || "").trim();
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOriginValidator,
    credentials: true
  }
});

io.use(async (socket, next) => {
  const accessToken = resolveSocketToken(socket);
  if (!accessToken) {
    return next(new Error("Unauthorized"));
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    const settings = await getSecuritySettings();
    if (settings?.tokenInvalidBefore && decoded?.iat) {
      const invalidBeforeSeconds = Math.floor(settings.tokenInvalidBefore.getTime() / 1000);
      if (decoded.iat < invalidBeforeSeconds) {
        return next(new Error("Unauthorized"));
      }
    }

    const user = await User.findById(decoded.userId).select("+refreshSessions");
    if (!user) {
      return next(new Error("Unauthorized"));
    }

    const sessionId = String(decoded?.sessionId || "").trim();
    if (sessionId && !findRefreshSession(user, sessionId)) {
      return next(new Error("Unauthorized"));
    }

    if (settings?.maintenanceMode && user.role !== "MAIN_ADMIN") {
      return next(new Error("Service unavailable"));
    }

    socket.data.userId = String(user._id);
    socket.data.userRole = String(user.role || "").trim().toUpperCase();
    socket.data.sessionId = sessionId || null;
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const socketUserId = String(socket.data?.userId || "").trim();
  if (!socketUserId) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user_${socketUserId}`);
  console.log(`Socket connected: ${socket.id} (${socketUserId})`);

  socket.on("join", (userId) => {
    const requestedUserId = String(userId || "").trim();
    if (requestedUserId && requestedUserId !== socketUserId) {
      console.warn(`Socket ${socket.id} attempted to join unauthorized room ${requestedUserId}`);
      return;
    }

    socket.join(`user_${socketUserId}`);
    console.log(`User ${socketUserId} joined their room`);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

initSocket(io);

const bootstrap = async () => {
  startCronJobs();
  if (isNotificationEmailWorkerEnabled()) {
    startNotificationEmailWorker();
  } else {
    console.log("Notification email worker disabled for this backend instance.");
  }

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  try {
    await connectDB({ retryOnFailure: true });
  } catch (error) {
    console.error(
      "MongoDB not ready during boot. The API will return 503 until the background reconnect succeeds.",
      error?.message || error
    );
  }
};

httpServer.on("error", (error) => {
  console.error("HTTP server error:", error?.message || error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

bootstrap().catch((error) => {
  console.error("Server bootstrap failed:", error?.message || error);
});
