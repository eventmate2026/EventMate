import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import generateOtp from "../utils/generateOtp.js";
import generateAccessToken from "../utils/generateAccessToken.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";
import sendEmail from "../config/sendEmail.js";
import verifyEmailTemplate from "../utils/verifyEmailTemplate.js";
import { validateRegister } from "../validators/auth.validator.js";
import { getSecuritySettings } from "../services/securitySettings.service.js";
import { sendPendingTeamInvitesForUser } from "../services/registration.service.js";

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const MOBILE_REGEX = /^[6-9]\d{9}$/;

const normalizeMobileDigits = (value) =>
  String(value || "").replace(/\D/g, "");

const getValidMobileNumber = (value) => {
  const digits = normalizeMobileDigits(value);
  return MOBILE_REGEX.test(digits) ? digits : "";
};

const coerceUserMobileNumber = (user) => {
  if (!user) return;
  const next = getValidMobileNumber(user.mobileNumber);
  user.mobileNumber = next || undefined;
};

const persistAuthUser = async (user) => {
  if (!user) return;
  coerceUserMobileNumber(user);
  await user.save({ validateBeforeSave: false });
};

const buildAuthUser = (user) => {
  if (!user) return null;
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    mobileNumber: getValidMobileNumber(user.mobileNumber),
    collegeName: user.collegeName || "",
    educationLevel: user.educationLevel || "",
    academicProfile: user.academicProfile || {},
    professionalProfile: user.professionalProfile || {},
    avatar: user.avatar || null
  };
};

// ---------------- REGISTER ----------------
export const registerUserController = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;
  const errors = validateRegister({ fullName, email, password });
  if (errors.length) return res.status(400).json({ success: false, errors });

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(409).json({ success: false, message: "Email already registered" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = generateOtp();

  const user = await User.create({
    fullName,
    email,
    password: hashedPassword,
    otp,
    otpExpiry: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  await sendEmail(email, "Verify Email - EventMate", verifyEmailTemplate({ name: fullName, otp }));

  res.status(201).json({ success: true, message: "Registered successfully. OTP sent to email." });
});

// ---------------- VERIFY EMAIL ----------------
export const verifyEmailController = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email }).select("+otp +otpExpiry");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  if (user.otp !== otp || user.otpExpiry < Date.now())
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

  user.emailVerified = true;
  user.otp = null;
  user.otpExpiry = null;
  await persistAuthUser(user);

  res.json({ success: true, message: "Email verified successfully" });
});

// ---------------- LOGIN ----------------
export const loginController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: "Email and password required" });

  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

  const settings = await getSecuritySettings();

  if (settings?.maintenanceMode && user.role !== "MAIN_ADMIN") {
    return res.status(503).json({
      success: false,
      message: "System is under maintenance. Please try again later.",
    });
  }

  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 1000)
    );
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      success: false,
      message: "Account locked. Please try again later.",
      retryAfterSeconds,
      lockedUntil: user.lockoutUntil,
    });
  }

  if (!user.emailVerified) return res.status(403).json({ success: false, message: "Verify email first" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const maxFailed = clampNumber(settings?.maxFailedLoginAttempts, 3, 20, 5);
    const lockoutMinutes = clampNumber(settings?.lockoutDurationMinutes, 5, 240, 30);

    const nextFailed = Math.max(0, Number(user.failedLoginAttempts || 0) + 1);
    user.failedLoginAttempts = nextFailed;

    let lockoutUntil = null;
    if (nextFailed >= maxFailed) {
      lockoutUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      user.lockoutUntil = lockoutUntil;
      user.failedLoginAttempts = 0;
    }

    await persistAuthUser(user);

    if (lockoutUntil) {
      const retryAfterSeconds = Math.max(1, Math.ceil(lockoutMinutes * 60));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: "Account locked due to too many failed attempts.",
        retryAfterSeconds,
        lockedUntil: lockoutUntil,
      });
    }

    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  if (user.failedLoginAttempts || user.lockoutUntil) {
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
  }

  const accessMinutes = clampNumber(settings?.accessTokenLifetimeMinutes, 5, 120, 15);
  const refreshDays = clampNumber(settings?.refreshTokenLifetimeDays, 1, 30, 7);

  const accessToken = generateAccessToken(user._id, `${accessMinutes}m`);
  const refreshToken = generateRefreshToken(user._id, `${refreshDays}d`);

  user.refreshToken = refreshToken;
  user.lastLoginAt = new Date();
  await persistAuthUser(user);

  sendPendingTeamInvitesForUser(user).catch((error) => {
    console.error("Pending team invite check failed:", error.message);
  });

  res.json({
    success: true,
    accessToken,
    refreshToken,
    role: user.role,
    user: buildAuthUser(user)
  });
});

// ---------------- LOGOUT ----------------
export const logoutController = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

  const user = await User.findById(userId).select("+refreshToken");
  if (user) {
    user.refreshToken = null;
    await persistAuthUser(user);
  }

  res.json({ success: true, message: "Logged out successfully" });
});

// ---------------- REFRESH TOKEN ----------------
export const refreshTokenController = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ success: false, message: "Refresh token missing" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select("+refreshToken");

    if (!user || user.refreshToken?.trim() !== refreshToken?.trim()) {
      return res.status(403).json({ success: false, message: "Invalid refresh token" });
    }

    const settings = await getSecuritySettings();
    const accessMinutes = clampNumber(settings?.accessTokenLifetimeMinutes, 5, 120, 15);
    const refreshDays = clampNumber(settings?.refreshTokenLifetimeDays, 1, 30, 7);

    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id, `${accessMinutes}m`);
    const newRefreshToken = generateRefreshToken(user._id, `${refreshDays}d`);

    user.refreshToken = newRefreshToken;
    await persistAuthUser(user);

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
  }
});
