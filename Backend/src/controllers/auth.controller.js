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
import {
  SESSION_EXPIRED_MESSAGE,
  validateSessionState
} from "../utils/sessionValidation.js";

const VERIFICATION_OTP_TTL_MS = 10 * 60 * 1000;

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const MOBILE_REGEX = /^[6-9]\d{9}$/;

const normalizeMobileDigits = (value) =>
  String(value || "").replace(/\D/g, "");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

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

const buildVerificationOtpPayload = () => ({
  otp: generateOtp(),
  otpExpiry: new Date(Date.now() + VERIFICATION_OTP_TTL_MS),
});

const buildEmailDeliveryError = (
  message = "We couldn't deliver the verification OTP right now. Please try again."
) => {
  const error = new Error(message);
  error.statusCode = 503;
  return error;
};

const buildEmailDeliveryLogDetails = (error) => {
  const cause = error?.cause || error;
  const details = {
    message: cause?.message || error?.message || "Unknown email delivery error",
  };

  if (cause?.code) details.code = cause.code;
  if (cause?.command) details.command = cause.command;
  if (cause?.responseCode) details.responseCode = cause.responseCode;
  if (cause?.provider) details.provider = cause.provider;
  if (cause?.statusCode) details.statusCode = cause.statusCode;
  if (cause?.smtpFallbackError) details.smtpFallbackError = cause.smtpFallbackError;
  if (typeof cause?.details === "string" && cause.details.trim()) {
    details.details = cause.details.trim().slice(0, 400);
  }

  return details;
};

const logVerificationOtpEmailFailure = (email, error) => {
  console.error("Verification OTP email delivery failed:", {
    email,
    ...buildEmailDeliveryLogDetails(error),
  });
};

const buildOtpStateSnapshot = (user) => ({
  otp: user?.otp ?? null,
  otpExpiry: user?.otpExpiry ?? null,
});

const restoreOtpState = async (user, snapshot) => {
  if (!user) return;
  user.otp = snapshot?.otp ?? null;
  user.otpExpiry = snapshot?.otpExpiry ?? null;
  await persistAuthUser(user);
};

const sendVerificationOtpEmail = async ({ email, fullName, otp, failureMessage }) => {
  try {
    await sendEmail(email, "Verify Email - EventMate", verifyEmailTemplate({ name: fullName, otp }));
  } catch (error) {
    logVerificationOtpEmailFailure(email, error);
    const deliveryError = buildEmailDeliveryError(failureMessage);
    deliveryError.cause = error;
    throw deliveryError;
  }
};

const isSelfRegisteredStudent = (user) =>
  !user?.createdBy && String(user?.role || "STUDENT").trim().toUpperCase() === "STUDENT";
const GENERIC_VERIFICATION_RESEND_MESSAGE =
  "If an unverified account exists for that email, a new OTP has been sent.";

// ---------------- REGISTER ----------------
export const registerUserController = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;
  const errors = validateRegister({ fullName, email, password });
  if (errors.length) return res.status(400).json({ success: false, errors });

  const normalizedEmail = normalizeEmail(email);
  const normalizedFullName = String(fullName || "").trim();
  const existingUser = await User.findOne({ email: normalizedEmail }).select("+otp +otpExpiry");
  const hashedPassword = await bcrypt.hash(password, 10);
  const { otp, otpExpiry } = buildVerificationOtpPayload();

  if (existingUser) {
    if (existingUser.emailVerified) {
      return res.status(409).json({ success: false, message: "Email already registered" });
    }

    if (!isSelfRegisteredStudent(existingUser)) {
      return res.status(409).json({
        success: false,
        message: "Email already registered. Please verify the account or contact admin.",
      });
    }

    existingUser.fullName = normalizedFullName;
    existingUser.email = normalizedEmail;
    existingUser.password = hashedPassword;
    const previousOtpState = buildOtpStateSnapshot(existingUser);
    existingUser.otp = otp;
    existingUser.otpExpiry = otpExpiry;
    await persistAuthUser(existingUser);

    try {
      await sendVerificationOtpEmail({
        email: normalizedEmail,
        fullName: normalizedFullName,
        otp,
        failureMessage:
          "Account exists but we couldn't deliver a new verification OTP right now. Please try again.",
      });
    } catch (error) {
      await restoreOtpState(existingUser, previousOtpState);
      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Account already exists but isn't verified. A new OTP has been sent to your email.",
    });
  }

  const user = await User.create({
    fullName: normalizedFullName,
    email: normalizedEmail,
    password: hashedPassword,
    otp,
    otpExpiry,
  });

  try {
    await sendVerificationOtpEmail({
      email: normalizedEmail,
      fullName: normalizedFullName,
      otp,
      failureMessage:
        "We couldn't deliver the verification OTP right now. Please try signing up again in a moment.",
    });
  } catch (error) {
    return res.status(202).json({
      success: true,
      otpSent: false,
      message:
        "Account created, but we couldn't deliver the verification OTP right now. Open Verify Email and use Resend OTP in a moment.",
    });
  }

  res.status(201).json({
    success: true,
    otpSent: true,
    message: "Registered successfully. OTP sent to email."
  });
});

export const resendVerificationOtpController = asyncHandler(async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  if (!normalizedEmail) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const user = await User.findOne({ email: normalizedEmail }).select("+otp +otpExpiry");
  if (!user || user.emailVerified) {
    return res.json({
      success: true,
      message: GENERIC_VERIFICATION_RESEND_MESSAGE
    });
  }

  const { otp, otpExpiry } = buildVerificationOtpPayload();
  const previousOtpState = buildOtpStateSnapshot(user);
  user.otp = otp;
  user.otpExpiry = otpExpiry;
  await persistAuthUser(user);

  try {
    await sendVerificationOtpEmail({
      email: normalizedEmail,
      fullName: user.fullName || "User",
      otp,
      failureMessage:
        "We couldn't resend the verification OTP right now. Please try again in a moment.",
    });
  } catch (error) {
    await restoreOtpState(user, previousOtpState);
    throw error;
  }

  res.json({
    success: true,
    message: GENERIC_VERIFICATION_RESEND_MESSAGE
  });
});

// ---------------- VERIFY EMAIL ----------------
export const verifyEmailController = asyncHandler(async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const submittedOtp = String(req.body?.otp || "").trim();
  const user = await User.findOne({ email: normalizedEmail }).select("+otp +otpExpiry");
  if (!user) return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

  if (!submittedOtp || String(user.otp || "") !== submittedOtp || user.otpExpiry < Date.now())
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

  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email before signing in.",
    });
  }

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
    return res.status(401).json({ success: false, message: SESSION_EXPIRED_MESSAGE });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select("+refreshToken");

    if (!user || user.refreshToken?.trim() !== refreshToken?.trim()) {
      return res.status(403).json({ success: false, message: SESSION_EXPIRED_MESSAGE });
    }

    const settings = await getSecuritySettings();
    const validation = validateSessionState({
      user,
      settings,
      issuedAtSeconds: decoded?.iat
    });
    if (!validation.valid) {
      if (validation.statusCode !== 503) {
        user.refreshToken = null;
        await persistAuthUser(user);
      }
      return res.status(validation.statusCode).json({
        success: false,
        message: validation.message
      });
    }
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
    return res.status(403).json({ success: false, message: SESSION_EXPIRED_MESSAGE });
  }
});
