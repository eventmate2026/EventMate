import mongoose from "mongoose";

const DB_READY_STATE_LABELS = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

const resolvePositiveNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const DB_SERVER_SELECTION_TIMEOUT_MS = resolvePositiveNumber(
  process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
  15000
);
const DB_SOCKET_TIMEOUT_MS = resolvePositiveNumber(
  process.env.MONGO_SOCKET_TIMEOUT_MS,
  45000
);
const DB_CONNECT_TIMEOUT_MS = resolvePositiveNumber(
  process.env.MONGO_CONNECT_TIMEOUT_MS,
  15000
);
const DB_RETRY_DELAY_MS = resolvePositiveNumber(
  process.env.MONGO_RETRY_DELAY_MS,
  10000
);
const DB_MAX_POOL_SIZE = resolvePositiveNumber(process.env.MONGO_MAX_POOL_SIZE, 10);
const DB_FAMILY = resolvePositiveNumber(process.env.MONGO_FAMILY, 0);

let connectPromise = null;
let reconnectTimer = null;

mongoose.set("bufferCommands", false);

const getReadyStateLabel = (readyState = mongoose.connection.readyState) =>
  DB_READY_STATE_LABELS[Number(readyState)] || "unknown";

const clearReconnectTimer = () => {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
};

const scheduleReconnect = (delayMs = DB_RETRY_DELAY_MS) => {
  if (connectPromise || reconnectTimer || isDatabaseReady()) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectDB({ retryOnFailure: true }).catch(() => {
      // Connection helper already logged the failure and rescheduled the retry.
    });
  }, delayMs);

  if (typeof reconnectTimer?.unref === "function") {
    reconnectTimer.unref();
  }
};

mongoose.connection.on("connected", () => {
  clearReconnectTimer();
  console.log("MongoDB connected");
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
  scheduleReconnect();
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error?.message || error);
});

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

export const getDatabaseStatus = () => ({
  ready: isDatabaseReady(),
  readyState: mongoose.connection.readyState,
  state: getReadyStateLabel(),
  host: mongoose.connection.host || "",
  name: mongoose.connection.name || "",
});

export const connectDB = async ({ retryOnFailure = true } = {}) => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  if (isDatabaseReady()) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: DB_SERVER_SELECTION_TIMEOUT_MS,
      socketTimeoutMS: DB_SOCKET_TIMEOUT_MS,
      connectTimeoutMS: DB_CONNECT_TIMEOUT_MS,
      maxPoolSize: DB_MAX_POOL_SIZE,
      ...(DB_FAMILY > 0 ? { family: DB_FAMILY } : {}),
    })
    .then(() => mongoose.connection)
    .catch((error) => {
      console.error("Initial MongoDB connection failed:", error?.message || error);
      if (retryOnFailure) {
        scheduleReconnect();
      }
      throw error;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export default connectDB;
