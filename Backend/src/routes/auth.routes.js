import express from "express";
import {
  registerUserController,
  resendVerificationOtpController,
  verifyEmailController,
  loginController,
  logoutController,
} from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rateLimit.middleware.js";
import { refreshTokenController } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", authLimiter, registerUserController);
router.post("/resend-verification-otp", authLimiter, resendVerificationOtpController);
router.post("/verify-email", verifyEmailController);
router.post("/login", authLimiter, loginController);
router.post("/logout", authMiddleware, logoutController);
router.post("/refresh-token", refreshTokenController);

export default router;
