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
  createRefreshSessionRecord,
  ensureRefreshSessions,
  removeRefreshSession,
  touchRefreshSession,
  upsertRefreshSession,
} from "../utils/sessionTracker.js";
import { countRecentLogins, recordLoginHistoryEntry } from "../utils/loginHistory.js";

const VERIFICATION_OTP_TTL_MS = 10 * 60 * 1000;
const INTERACTIVE_EMAIL_OPTIONS = Object.freeze({ deliveryProfile: "interactive" });

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
    avatar: user.avatar || null,
    lastLoginAt: user.lastLoginAt || null,
    loginCount30d: countRecentLogins(user, 30),
  };
};

const AUTH_SELECT_FIELDS = "+password +refreshToken +refreshSessions +loginHistory";

const findSessionByRefreshToken = (user, token) => {
  const submittedToken = String(token || "").trim();
  if (!submittedToken) return null;
  return (
    ensureRefreshSessions(user).find(
      (session) => String(session.refreshToken || "").trim() === submittedToken
    ) || null
  );
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

const sendVerificationOtpEmail = async ({ email, fullName, otp, failureMessage }) => {
  try {
    await sendEmail(
      email,
      "Verify Email - EventMate",
      verifyEmailTemplate({ name: fullName, otp }),
      INTERACTIVE_EMAIL_OPTIONS
    );
  } catch (error) {
    const deliveryError = buildEmailDeliveryError(failureMessage);
    deliveryError.cause = error;
    throw deliveryError;
  }
};

const logOtpDeliveryIssue = (context, error) => {
  const rootCause = error?.cause?.message || error?.message || "Unknown email error";
  console.error(`${context}: ${rootCause}`);
};

const isSelfRegisteredStudent = (user) =>
  !user?.createdBy && String(user?.role || "STUDENT").trim().toUpperCase() === "STUDENT";

// ---------------- REGISTER ----------------
export const registerUserController = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;
  const errors = validateRegister({ fullName, email, password });
  if (errors.length) return res.status(400).json({ success: false, errors });

  const normalizedEmail = normalizeEmail(email);
  const normalizedFullName = String(fullName || "").trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  const hashedPassword = await bcrypt.hash(password, 10);
  const { otp, otpExpiry } = buildVerificationOtpPayload();

  if (existingUser) {
    if (existingUser.emailVerified) {
      return res.status(200).json({
        success: true,
        message: "This email is already registered. Please log in to continue.",
        nextStep: "login",
      });
    }

    if (!isSelfRegisteredStudent(existingUser)) {
      return res.status(200).json({
        success: true,
        message: "This email is already linked to an invited account. Please verify it or contact the admin.",
        nextStep: "verify_email",
      });
    }

    existingUser.fullName = normalizedFullName;
    existingUser.email = normalizedEmail;
    existingUser.password = hashedPassword;
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

      return res.status(200).json({
        success: true,
        message: "Your account already exists. A new OTP has been sent to your email.",
        nextStep: "verify_email",
      });
    } catch (error) {
      logOtpDeliveryIssue("Existing account OTP delivery delayed", error);
      return res.status(202).json({
        success: true,
        message:
          "Your account already exists, but the OTP could not be delivered right now. Please use resend OTP in a few minutes.",
        nextStep: "verify_email",
        deliveryPending: true,
      });
    }
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

    return res.status(201).json({
      success: true,
      message: "Registered successfully. OTP sent to email.",
      nextStep: "verify_email",
    });
  } catch (error) {
    logOtpDeliveryIssue("New account OTP delivery delayed", error);
    return res.status(202).json({
      success: true,
      message:
        "Your account was created, but the OTP could not be delivered right now. Please use resend OTP in a few minutes.",
      nextStep: "verify_email",
      deliveryPending: true,
    });
  }
});

export const resendVerificationOtpController = asyncHandler(async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  if (!normalizedEmail) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (user.emailVerified) {
    return res.status(400).json({ success: false, message: "Email is already verified" });
  }

  const { otp, otpExpiry } = buildVerificationOtpPayload();
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

    return res.json({ success: true, message: "A new OTP has been sent to your email." });
  } catch (error) {
    logOtpDeliveryIssue("Verification OTP resend delayed", error);
    return res.status(202).json({
      success: true,
      message: "We couldn't send a new OTP right now. Please try again in a few minutes.",
      nextStep: "verify_email",
      deliveryPending: true,
    });
  }
});

// ---------------- VERIFY EMAIL ----------------
export const verifyEmailController = asyncHandler(async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const submittedOtp = String(req.body?.otp || "").trim();
  const user = await User.findOne({ email: normalizedEmail }).select("+otp +otpExpiry");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

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

  const user = await User.findOne({ email }).select(AUTH_SELECT_FIELDS);
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

  const sessionRecord = createRefreshSessionRecord(req, "", undefined);
  const tokenPayload = { userId: user._id, sessionId: sessionRecord.sessionId };
  const accessToken = generateAccessToken(tokenPayload, `${accessMinutes}m`);
  const refreshToken = generateRefreshToken(tokenPayload, `${refreshDays}d`);

  sessionRecord.refreshToken = refreshToken;
  upsertRefreshSession(user, sessionRecord);
  user.refreshToken = null;
  user.lastLoginAt = new Date();
  recordLoginHistoryEntry(user, user.lastLoginAt);
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

  const user = await User.findById(userId).select(AUTH_SELECT_FIELDS);
  if (user) {
    const removedCurrentSession = removeRefreshSession(user, req.authSessionId);
    if (!removedCurrentSession) {
      user.refreshToken = null;
    }
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
    const user = await User.findById(decoded.userId).select(AUTH_SELECT_FIELDS);

    if (!user) {
      return res.status(403).json({ success: false, message: "Invalid refresh token" });
    }

    let session = findSessionByRefreshToken(user, refreshToken);
    if (!session && user.refreshToken?.trim() === refreshToken?.trim()) {
      const migratedSession = createRefreshSessionRecord(
        req,
        refreshToken,
        decoded.sessionId || undefined
      );
      session = upsertRefreshSession(user, migratedSession);
      user.refreshToken = null;
    }

    if (!session) {
      return res.status(403).json({ success: false, message: "Invalid refresh token" });
    }

    const settings = await getSecuritySettings();
    const accessMinutes = clampNumber(settings?.accessTokenLifetimeMinutes, 5, 120, 15);
    const refreshDays = clampNumber(settings?.refreshTokenLifetimeDays, 1, 30, 7);

    const tokenPayload = { userId: user._id, sessionId: session.sessionId };
    const newAccessToken = generateAccessToken(tokenPayload, `${accessMinutes}m`);
    const newRefreshToken = generateRefreshToken(tokenPayload, `${refreshDays}d`);

    touchRefreshSession(user, session.sessionId, req, { refreshToken: newRefreshToken });
    user.refreshToken = null;
    await persistAuthUser(user);

    res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: buildAuthUser(user),
    });
  } catch (err) {
    return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
  }
});
