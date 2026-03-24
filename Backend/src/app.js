import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import morgan from "morgan";
import { createCorsOriginValidator } from "./config/clientOrigins.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import errorMiddleware from "./middleware/error.middleware.js";
import eventRoutes from "./routes/event.routes.js";
import registrationRoutes from "./routes/registration.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import certificateRoutes from "./routes/certificate.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

dotenv.config();

const app = express();
app.use(morgan("dev"));
const corsOriginValidator = createCorsOriginValidator();


// Middleware
app.use(helmet());
app.use(cors({ origin: corsOriginValidator, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/notifications", notificationRoutes);

// Root route
app.get("/", (req, res) => res.json({ success: true, message: "EventMate Backend Running" }));

// Error Middleware
app.use(errorMiddleware);

export default app;
