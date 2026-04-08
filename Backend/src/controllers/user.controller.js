import bcrypt from "bcryptjs";
import User from "../models/User.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import generateOtp from "../utils/generateOtp.js";
import sendEmail from "../config/sendEmail.js";
import forgotPasswordTemplate from "../utils/forgotPasswordTemplate.js";
import uploadImageCloudinary from "../utils/uploadImageCloudinary.js";
import verifyEmailTemplate from "../utils/verifyEmailTemplate.js";
import {
  countUserLoginsSince,
  listUserSessions,
  revokeAllUserSessions,
  revokeUserSession,
} from "../services/session.service.js";

const VERIFICATION_OTP_TTL_MS = 10 * 60 * 1000;
const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, a password reset OTP has been sent.";

const resolveDepartment = (user) =>
  String(user?.professionalProfile?.department || user?.academicProfile?.branch || "").trim();
const normalizeText = (value = "") => String(value || "").trim();
const normalizeMobileDigits = (value = "") => String(value || "").replace(/\D/g, "");

const buildSafeUserResponse = (user) => ({
  _id: user?._id || null,
  fullName: normalizeText(user?.fullName),
  email: normalizeText(user?.email).toLowerCase(),
  role: user?.role || "STUDENT",
  mobileNumber: normalizeMobileDigits(user?.mobileNumber),
  collegeName: normalizeText(user?.collegeName),
  educationLevel: normalizeText(user?.educationLevel),
  academicProfile: {
    branch: normalizeText(user?.academicProfile?.branch),
    year: normalizeText(user?.academicProfile?.year),
  },
  professionalProfile: {
    department: normalizeText(user?.professionalProfile?.department),
    occupation: normalizeText(user?.professionalProfile?.occupation),
  },
  avatar: user?.avatar || null,
  emailVerified: Boolean(user?.emailVerified),
  lastLoginAt: user?.lastLoginAt || null,
  passwordChangedAt: user?.passwordChangedAt || null,
  isLoggedIn: true,
});

const ACTIVE_SESSION_WINDOW_MS = 15 * 60 * 1000;

const toSessionDto = (session, currentSessionId) => {
  const sessionId = String(session?.sessionId || "");
  const isCurrent = Boolean(currentSessionId) && sessionId === String(currentSessionId);
  const lastActiveAt = session?.lastActiveAt || session?.updatedAt || session?.createdAt || null;
  const lastActiveTime = new Date(lastActiveAt || 0).getTime();
  const isActive = !Number.isNaN(lastActiveTime) && Date.now() - lastActiveTime <= ACTIVE_SESSION_WINDOW_MS;

  return {
    id: sessionId,
    device: session?.deviceLabel || "Unknown device",
    browser: session?.browser || "Browser",
    os: session?.os || "Unknown OS",
    deviceType: session?.deviceType || "Unknown",
    ipAddress: session?.ipAddress || "Unknown",
    location: session?.ipAddress ? `IP ${session.ipAddress}` : "Unknown network",
    createdAt: session?.createdAt || null,
    lastActiveAt,
    current: isCurrent,
    status: isActive ? "active" : "idle",
  };
};

const buildProfileUpdateDoc = (payload = {}) => {
  const set = {};
  const unset = {};

  if (Object.prototype.hasOwnProperty.call(payload, "fullName")) {
    const fullName = normalizeText(payload.fullName);
    if (fullName) set.fullName = fullName;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "mobileNumber")) {
    const digits = normalizeMobileDigits(payload.mobileNumber);
    if (digits) {
      set.mobileNumber = digits;
    } else {
      unset.mobileNumber = "";
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "collegeName")) {
    const collegeName = normalizeText(payload.collegeName);
    if (collegeName) {
      set.collegeName = collegeName;
    } else {
      unset.collegeName = "";
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "educationLevel")) {
    set.educationLevel = normalizeText(payload.educationLevel);
  }

  if (
    payload.academicProfile &&
    typeof payload.academicProfile === "object" &&
    !Array.isArray(payload.academicProfile)
  ) {
    if (Object.prototype.hasOwnProperty.call(payload.academicProfile, "branch")) {
      const branch = normalizeText(payload.academicProfile.branch);
      if (branch) {
        set["academicProfile.branch"] = branch;
      } else {
        unset["academicProfile.branch"] = "";
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload.academicProfile, "year")) {
      const year = normalizeText(payload.academicProfile.year);
      if (year) {
        set["academicProfile.year"] = year;
      } else {
        unset["academicProfile.year"] = "";
      }
    }
  }

  if (
    payload.professionalProfile &&
    typeof payload.professionalProfile === "object" &&
    !Array.isArray(payload.professionalProfile)
  ) {
    if (Object.prototype.hasOwnProperty.call(payload.professionalProfile, "department")) {
      const department = normalizeText(payload.professionalProfile.department);
      if (department) {
        set["professionalProfile.department"] = department;
      } else {
        unset["professionalProfile.department"] = "";
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload.professionalProfile, "occupation")) {
      const occupation = normalizeText(payload.professionalProfile.occupation);
      if (occupation) {
        set["professionalProfile.occupation"] = occupation;
      } else {
        unset["professionalProfile.occupation"] = "";
      }
    }
  }

  const updateDoc = {};
  if (Object.keys(set).length) updateDoc.$set = set;
  if (Object.keys(unset).length) updateDoc.$unset = unset;
  return updateDoc;
};

// ---------------- PROFILE ----------------
export const getProfileController = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: buildSafeUserResponse(req.user),
    currentSessionId: req.sessionId || null,
  });
});

export const getMySessionsController = asyncHandler(async (req, res) => {
  const [sessions, loginsLast30] = await Promise.all([
    listUserSessions(req.user?._id),
    countUserLoginsSince(
      req.user?._id,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ),
  ]);

  return res.status(200).json({
    success: true,
    currentSessionId: req.sessionId || null,
    summary: {
      activeSessions: sessions.length,
      loginsLast30,
      lastLoginAt: req.user?.lastLoginAt || null,
    },
    data: sessions.map((session) => toSessionDto(session, req.sessionId)),
  });
});

export const terminateMySessionController = asyncHandler(async (req, res) => {
  const targetSessionId = String(req.params?.sessionId || "").trim();
  if (!targetSessionId) {
    return res.status(400).json({
      success: false,
      message: "Session id is required.",
    });
  }

  if (req.sessionId && targetSessionId === String(req.sessionId)) {
    return res.status(400).json({
      success: false,
      message: "Use logout to end your current session.",
    });
  }

  const session = await revokeUserSession({
    sessionId: targetSessionId,
    userId: req.user?._id,
    reason: "TERMINATED_BY_USER",
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Session not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Session terminated successfully.",
  });
});

// ---------------- UPDATE PROFILE ----------------
export const updateProfileController = asyncHandler(async (req, res) => {
  const updateDoc = buildProfileUpdateDoc(req.body);
  if (!Object.keys(updateDoc).length) {
    return res.status(400).json({
      success: false,
      message: "No valid profile fields were provided."
    });
  }

  const user = await User.findByIdAndUpdate(req.user._id, updateDoc, {
    new: true,
    runValidators: true,
    context: "query",
  });
  res.json({
    success: true,
    message: "Profile updated",
    user: buildSafeUserResponse(user)
  });
});

// ---------------- UPLOAD AVATAR ----------------
export const uploadAvatarController = asyncHandler(async (req, res) => {
  const result = await uploadImageCloudinary(req.file);
  req.user.avatar = result.url;
  await req.user.save();
  res.json({ success: true, message: "Avatar uploaded", avatar: result.url });
});

// ---------------- FORGOT PASSWORD ----------------
export const forgotPasswordController = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ success: true, message: GENERIC_FORGOT_PASSWORD_MESSAGE });
  }

  const otp = generateOtp();
  user.otp = otp;
  user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
  await user.save();

  try {
    await sendEmail(email, "Reset Password OTP", forgotPasswordTemplate({ name: user.fullName, otp }));
  } catch (error) {
    user.otp = null;
    user.otpExpiry = null;
    await user.save({ validateBeforeSave: false });
    error.statusCode = Number(error.statusCode) || 503;
    error.message = "We couldn't deliver the password reset OTP right now. Please try again.";
    throw error;
  }

  res.json({ success: true, message: GENERIC_FORGOT_PASSWORD_MESSAGE });
});

// ---------------- RESET PASSWORD ----------------
export const resetPasswordController = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const otp = String(req.body?.otp || "").trim();
  const newPassword = req.body?.newPassword;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP are required" });
  }

  const user = await User.findOne({ email }).select("+otp +otpExpiry +refreshToken");
  if (!user) return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

  if (!user.otp || !user.otpExpiry || String(user.otp) !== otp || user.otpExpiry < Date.now())
    return res.status(400).json({ success: false, message: "Invalid or expired OTP" });

  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });

  user.password = await bcrypt.hash(newPassword, 10);
  user.otp = null;
  user.otpExpiry = null;
  user.refreshToken = null;
  user.passwordChangedAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;
  await user.save();
  await revokeAllUserSessions({
    userId: user._id,
    reason: "PASSWORD_RESET",
  });

  res.json({ success: true, message: "Password reset successful" });
});

// Admin creates Organizer
export const createOrganizer = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    const organizerDepartment = String(
      req.body?.professionalProfile?.department || req.body?.department || ""
    ).trim();

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const organizer = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: "ORGANIZER",
      createdBy: req.user._id,
      emailVerified: true, // optional to skip OTP for admin-created users
      professionalProfile: organizerDepartment ? { department: organizerDepartment } : undefined
    });

    res.status(201).json({
      success: true,
      message: "Organizer created successfully",
      data: {
        _id: organizer._id,
        fullName: organizer.fullName,
        email: organizer.email,
        role: organizer.role,
        professionalProfile: organizer.professionalProfile,
        department: organizer.professionalProfile?.department || ""
      }
    });

  } catch (error) {
    next(error);
  }
};

// MAIN_ADMIN or ORGANIZER creates Student Coordinator
export const createCoordinator = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body;
    const requestedDepartment = String(
      req.body?.professionalProfile?.department || req.body?.department || ""
    ).trim();

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const organizerDepartment = req.user.role === "ORGANIZER" ? resolveDepartment(req.user) : "";
    if (req.user.role === "ORGANIZER" && !organizerDepartment) {
      return res.status(400).json({
        success: false,
        message: "Organizer department is required to create coordinators"
      });
    }
    const coordinatorDepartment =
      req.user.role === "ORGANIZER" ? organizerDepartment : requestedDepartment;

    const requiresVerification = req.user.role === "ORGANIZER";
    const otp = requiresVerification ? generateOtp() : null;
    const otpExpiry = requiresVerification ? new Date(Date.now() + VERIFICATION_OTP_TTL_MS) : null;

    const coordinator = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: "STUDENT_COORDINATOR",
      createdBy: req.user._id,
      emailVerified: !requiresVerification,
      otp,
      otpExpiry,
      professionalProfile: coordinatorDepartment ? { department: coordinatorDepartment } : undefined,
    });

    if (requiresVerification) {
      try {
        await sendEmail(email, "Verify Email - EventMate", verifyEmailTemplate({ name: fullName, otp }));
      } catch (error) {
        await User.deleteOne({ _id: coordinator._id });
        error.statusCode = Number(error.statusCode) || 503;
        error.message =
          "Coordinator was not created because the verification OTP could not be delivered.";
        throw error;
      }
    }

    res.status(201).json({
      success: true,
      message: requiresVerification
        ? "Coordinator created. Verification OTP sent to email."
        : "Coordinator created successfully",
      data: {
        _id: coordinator._id,
        fullName: coordinator.fullName,
        email: coordinator.email,
        role: coordinator.role,
        createdBy: coordinator.createdBy,
        professionalProfile: coordinator.professionalProfile,
        department: coordinator.professionalProfile?.department || ""
      }
    });

  } catch (error) {
    next(error);
  }
};

// Organizer/Main admin promotes a student to coordinator
export const promoteCoordinator = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const targetId = userId || req.params.userId;
    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: "User id is required"
      });
    }

    const target = await User.findById(targetId);
    if (!target) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (req.user.role === "ORGANIZER") {
      const organizerDepartment = resolveDepartment(req.user);
      const targetDepartment = resolveDepartment(target);
      if (!organizerDepartment) {
        return res.status(400).json({
          success: false,
          message: "Organizer department is required to promote coordinators"
        });
      }
      if (!targetDepartment || organizerDepartment.toLowerCase() !== targetDepartment.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: "Student must belong to your department"
        });
      }
    }

    if (target.role === "STUDENT_COORDINATOR") {
      return res.status(200).json({
        success: true,
        message: "User is already a coordinator",
        user: target
      });
    }

    if (target.role !== "STUDENT") {
      return res.status(400).json({
        success: false,
        message: "Only students can be promoted to coordinator"
      });
    }

    const departmentFallback = resolveDepartment(target) || resolveDepartment(req.user);
    target.role = "STUDENT_COORDINATOR";
    target.professionalProfile = {
      ...(target.professionalProfile || {}),
      department: departmentFallback || target.professionalProfile?.department || ""
    };

    await target.save();

    return res.status(200).json({
      success: true,
      message: "Student promoted to coordinator",
      user: target
    });
  } catch (error) {
    next(error);
  }
};
