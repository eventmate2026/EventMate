import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { createCorsOriginValidator } from "./src/config/clientOrigins.js";
import startCronJobs from "./src/utils/cronJobs.js";
import { initSocket } from "./src/services/notification.service.js";
import User from "./src/models/User.model.js";
import { getSecuritySettings } from "./src/services/securitySettings.service.js";
import {
  extractBearerToken,
  validateSessionState
} from "./src/utils/sessionValidation.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP server from Express app
const httpServer = createServer(app);
const corsOriginValidator = createCorsOriginValidator();

// Setup Socket.io on top of HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginValidator,
    credentials: true
  }
});

io.use(async (socket, next) => {
  try {
    const rawAuthToken =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization || "";
    const token = extractBearerToken(rawAuthToken);
    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [user, settings] = await Promise.all([
      User.findById(decoded.userId),
      getSecuritySettings()
    ]);
    const validation = validateSessionState({
      user,
      settings,
      issuedAtSeconds: decoded?.iat
    });

    if (!validation.valid) {
      return next(new Error(validation.message));
    }

    socket.data.userId = String(user._id);
    socket.data.userRole = user.role;
    socket.data.userName = user.fullName || "User";
    return next();
  } catch (error) {
    return next(new Error(error?.message || "Unauthorized"));
  }
});

// Socket connection handler
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  const roomName = `user_${socket.data.userId}`;
  socket.join(roomName);

  // Backward-compatible rejoin; room identity always comes from the verified socket session.
  socket.on("join", () => {
    socket.join(roomName);
    console.log(`User ${socket.data.userId} joined their room`);
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Pass io instance to notification service
initSocket(io);

const startServer = async () => {
  await connectDB();
  startCronJobs();

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Server startup failed:", error?.message || error);
  process.exit(1);
});
