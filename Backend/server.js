import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import { createCorsOriginValidator } from "./src/config/clientOrigins.js";
import startCronJobs from "./src/utils/cronJobs.js";
import {
  initSocket,
  isNotificationEmailWorkerEnabled,
  startNotificationEmailWorker
} from "./src/services/notification.service.js";

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

// Socket connection handler
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // User joins their own private room
  socket.on("join", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`✅ User ${userId} joined their room`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// Pass io instance to notification service
initSocket(io);

const bootstrap = async () => {
  await connectDB();
  startCronJobs();
  if (isNotificationEmailWorkerEnabled()) {
    startNotificationEmailWorker();
  } else {
    console.log("Notification email worker disabled for this backend instance.");
  }

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

bootstrap();
