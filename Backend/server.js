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

const httpServer = createServer(app);
const corsOriginValidator = createCorsOriginValidator();

const io = new Server(httpServer, {
  cors: {
    origin: corsOriginValidator,
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
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
