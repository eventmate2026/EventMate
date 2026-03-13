import User from "../models/User.model.js";
import Event from "../models/Event.model.js";
import Certificate from "../models/Certificate.model.js";
import CertificateAuditLog from "../models/CertificateAuditLog.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeVerificationCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const resolveDepartment = (user) =>
  String(user?.professionalProfile?.department || user?.academicProfile?.branch || "").trim();

const buildAdminAuditActor = (req) => ({
  actorId: req.user?._id || null,
  actorName: req.user?.fullName || "Main Admin",
  actorRole: req.user?.role || "MAIN_ADMIN",
  source: "ADMIN",
  ipAddress: req.ip || null,
  userAgent: String(req.headers?.["user-agent"] || "").slice(0, 300) || null
});

const writeCertificateAuditLog = async (payload) => {
  try {
    await CertificateAuditLog.create(payload);
  } catch (error) {
    console.error("Certificate audit log write failed:", error.message);
  }
};

// ---------------- GET ALL USERS ----------------
export const getAllUsersController = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken");
  res.json({ success: true, users });
});

// ---------------- UPDATE USER ----------------
export const updateUserController = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, message: "User updated", user });
});

// ---------------- DELETE USER ----------------
export const deleteUserController = asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "User deleted" });
});


// Get all coordinators only
export const getCoordinators = async (req, res, next) => {
  try {
    const includeStudents = ["1", "true", "yes"].includes(String(req.query.includeStudents || "").toLowerCase());
    const scope = String(req.query.scope || "").trim().toUpperCase();
    const roles = includeStudents ? ["STUDENT_COORDINATOR", "STUDENT"] : ["STUDENT_COORDINATOR"];
    const query = { role: { $in: roles } };

    if (req.user.role === "ORGANIZER") {
      if (scope !== "COLLEGE") {
        const department = resolveDepartment(req.user);
        if (!department) {
          return res.status(400).json({
            success: false,
            message: "Organizer department is required"
          });
        }
        const regex = new RegExp(`^${escapeRegex(department)}$`, "i");
        query.$or = [
          { "professionalProfile.department": regex },
          { "academicProfile.branch": regex },
        ];
      }
    }

    const coordinators = await User.find(query, { password: 0, otp: 0, otpExpiry: 0 });
    return res.status(200).json({
      success: true,
      count: coordinators.length,
      data: coordinators
    });
  } catch (error) {
    next(error);
  }
};

// Get all organizers only
export const getOrganizers = async (req, res, next) => {
  try {
    const organizers = await User.find(
      { role: "ORGANIZER" },
      { password: 0, otp: 0, otpExpiry: 0 }
    );
    return res.status(200).json({
      success: true,
      count: organizers.length,
      data: organizers
    });
  } catch (error) {
    next(error);
  }
};

// Get organizer-wise total events (all statuses)
export const getOrganizerEventCounts = async (req, res, next) => {
  try {
    const counts = await Event.aggregate([
      {
        $match: {
          "organizer.organizerId": { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$organizer.organizerId",
          totalEvents: { $sum: 1 }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      count: counts.length,
      data: counts.map((item) => ({
        organizerId: item._id,
        totalEvents: item.totalEvents
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Certificate registry for admin authority page
export const getCertificatesRegistry = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "ALL").trim().toUpperCase();

    const filter = {};
    if (status === "VALID" || status === "REVOKED") {
      filter.verificationStatus = status;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const normalizedCode = normalizeVerificationCode(search);
      const codeRegex = normalizedCode
        ? new RegExp(escapeRegex(normalizedCode), "i")
        : null;

      filter.$or = [
        { participantName: regex },
        { participantEmail: regex },
        { eventName: regex },
        { verificationCode: regex },
        ...(codeRegex ? [{ verificationCodeNormalized: codeRegex }] : [])
      ];
    }

    const [rows, filteredCount, totalIssued, validCount, revokedCount, verificationAttempts, failedVerifications, lastAuditLog] =
      await Promise.all([
        Certificate.find(filter)
          .sort({ issuedAt: -1 })
          .skip(skip)
          .limit(limit)
          .select(
            "_id eventId eventName eventDate participantName participantEmail certificateType position verificationCode verificationStatus revokedAt revokedBy revokeReason issuedAt certificateUrl"
          )
          .populate("revokedBy", "_id fullName email"),
        Certificate.countDocuments(filter),
        Certificate.countDocuments(),
        Certificate.countDocuments({ verificationStatus: "VALID" }),
        Certificate.countDocuments({ verificationStatus: "REVOKED" }),
        CertificateAuditLog.countDocuments({ action: "VERIFIED" }),
        CertificateAuditLog.countDocuments({ action: "VERIFIED", outcome: "FAILED" }),
        CertificateAuditLog.findOne({})
          .sort({ createdAt: -1 })
          .select("createdAt")
      ]);

    const verificationSuccessCount = Math.max(
      0,
      Number(verificationAttempts || 0) - Number(failedVerifications || 0)
    );
    const verificationSuccessRate =
      verificationAttempts > 0
        ? Number((verificationSuccessCount / verificationAttempts) * 100).toFixed(2)
        : "100.00";
    const revocationRate =
      totalIssued > 0
        ? Number((Number(revokedCount || 0) / totalIssued) * 100).toFixed(2)
        : "0.00";

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
      pagination: {
        page,
        limit,
        total: filteredCount,
        totalPages: Math.ceil(filteredCount / limit) || 1
      },
      summary: {
        totalIssued,
        validCount,
        revokedCount,
        revocationRate: Number(revocationRate),
        verificationAttempts,
        verificationSuccessCount,
        failedVerifications,
        verificationSuccessRate: Number(verificationSuccessRate),
        lastAuditAt: lastAuditLog?.createdAt || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// Certificate verification/revocation audit log feed
export const getCertificateAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const action = String(req.query.action || "ALL").trim().toUpperCase();
    const outcome = String(req.query.outcome || "ALL").trim().toUpperCase();

    const filter = {};

    if (["ISSUED", "VERIFIED", "REVOKED"].includes(action)) {
      filter.action = action;
    }
    if (["SUCCESS", "FAILED"].includes(outcome)) {
      filter.outcome = outcome;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const normalizedCode = normalizeVerificationCode(search);
      const codeRegex = normalizedCode
        ? new RegExp(escapeRegex(normalizedCode), "i")
        : null;

      filter.$or = [
        { verificationCode: regex },
        ...(codeRegex ? [{ verificationCodeNormalized: codeRegex }] : []),
        { participantName: regex },
        { participantEmail: regex },
        { eventName: regex },
        { actorName: regex },
        { actorRole: regex },
        { message: regex }
      ];
    }

    const [rows, total] = await Promise.all([
      CertificateAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id action outcome verificationCode certificateStatus participantName participantEmail eventName actorName actorRole source ipAddress message metadata createdAt"
        ),
      CertificateAuditLog.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

// Revoke a previously issued certificate
export const revokeCertificate = async (req, res, next) => {
  try {
    const { certificateId } = req.params;
    const reason = String(req.body?.reason || "").trim().slice(0, 300);
    const certificate = await Certificate.findById(certificateId);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }

    const actor = buildAdminAuditActor(req);

    if (certificate.verificationStatus === "REVOKED") {
      await writeCertificateAuditLog({
        certificateId: certificate._id,
        eventId: certificate.eventId,
        action: "REVOKED",
        outcome: "FAILED",
        verificationCode: certificate.verificationCode,
        certificateStatus: "REVOKED",
        participantName: certificate.participantName,
        participantEmail: certificate.participantEmail,
        eventName: certificate.eventName,
        message: "Revocation skipped because certificate is already revoked.",
        ...actor
      });

      return res.status(200).json({
        success: true,
        message: "Certificate already revoked",
        data: certificate
      });
    }

    certificate.verificationStatus = "REVOKED";
    certificate.revokedAt = new Date();
    certificate.revokedBy = req.user?._id || null;
    certificate.revokeReason = reason || "Revoked by administrator";
    await certificate.save();

    await writeCertificateAuditLog({
      certificateId: certificate._id,
      eventId: certificate.eventId,
      action: "REVOKED",
      outcome: "SUCCESS",
      verificationCode: certificate.verificationCode,
      certificateStatus: "REVOKED",
      participantName: certificate.participantName,
      participantEmail: certificate.participantEmail,
      eventName: certificate.eventName,
      message: "Certificate revoked by administrator.",
      metadata: {
        reason: certificate.revokeReason
      },
      ...actor
    });

    return res.status(200).json({
      success: true,
      message: "Certificate revoked successfully",
      data: certificate
    });
  } catch (error) {
    next(error);
  }
};
