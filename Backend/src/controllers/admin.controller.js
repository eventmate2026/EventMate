import User from "../models/User.model.js";
import Event from "../models/Event.model.js";
import Contact from "../models/Contact.model.js";
import Notification from "../models/Notification.model.js";
import EventRegistration from "../models/EventRegistration.model.js";
import ParticipantQR from "../models/ParticipantQR.model.js";
import Feedback from "../models/Feedback.model.js";
import Certificate from "../models/Certificate.model.js";
import CertificateAuditLog from "../models/CertificateAuditLog.model.js";
import UserSession from "../models/UserSession.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getSecuritySettings } from "../services/securitySettings.service.js";
import { autoCompleteOverdueEvents } from "../services/eventLifecycle.service.js";
import { buildEventEndDateTime } from "../utils/eventTime.js";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeVerificationCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const resolveDepartment = (user) =>
  String(user?.professionalProfile?.department || user?.academicProfile?.branch || "").trim();

const ACTIVE_REGISTRATION_STATUSES = [
  "PendingMemberVerification",
  "PendingPayment",
  "PendingPaymentVerification",
  "Confirmed",
];

const ROLE_LABELS = {
  MAIN_ADMIN: "Main Admin",
  ORGANIZER: "Organizer",
  STUDENT_COORDINATOR: "Coordinator",
  STUDENT: "Student",
};

const formatEventDateLabel = (value) => {
  if (!value) return "Date TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const buildEventTimeline = (event) => ({
  startAt: buildEventEndDateTime(
    event?.schedule?.startDate,
    event?.schedule?.startTime
  ),
  endAt: buildEventEndDateTime(
    event?.schedule?.endDate || event?.schedule?.startDate,
    event?.schedule?.endTime || event?.schedule?.startTime
  ),
});

const deriveEventState = (event, now = new Date()) => {
  const status = String(event?.status || "").trim().toLowerCase();
  if (status === "cancelled" || status === "completed") return "Closed";
  if (status === "draft") return "Pending";

  const { startAt, endAt } = buildEventTimeline(event);
  const nowTime = now.getTime();
  const startTime = startAt?.getTime?.() || NaN;
  const endTime = endAt?.getTime?.() || NaN;

  if (!Number.isNaN(startTime) && nowTime < startTime) return "Pending";
  if (!Number.isNaN(startTime) && (Number.isNaN(endTime) || nowTime <= endTime)) {
    return "Active";
  }

  return "Closed";
};

const toNotificationBadge = (type) => String(type || "SYSTEM").trim().toUpperCase();

const createSummaryMap = (rows = []) =>
  new Map(
    rows
      .filter((row) => row?._id)
      .map((row) => [String(row._id), row])
  );

const getLatestIsoTimestamp = (...values) => {
  const timestamps = values
    .map((value) => new Date(value || 0).getTime())
    .filter((value) => !Number.isNaN(value) && value > 0);

  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
};

const buildEventHistoryMessage = (event, summary = {}) => {
  const status = String(event?.status || "").trim().toLowerCase();
  const registeredParticipants = Number(summary?.registeredParticipants || 0);
  const present = Number(summary?.present || 0);
  const feedbackCount = Number(summary?.feedbackCount || 0);

  if (status === "draft") {
    return registeredParticipants > 0
      ? `${registeredParticipants} participant(s) are queued while this event is still in draft.`
      : "Draft event is awaiting publication to the system feed.";
  }

  if (status === "published") {
    if (present > 0) {
      return `${present} attendee(s) have already checked in from ${registeredParticipants} registered participant(s).`;
    }
    if (registeredParticipants > 0) {
      return `${registeredParticipants} participant(s) are currently registered for this event.`;
    }
    return "Published event is being monitored in the live oversight feed.";
  }

  if (status === "completed") {
    if (feedbackCount > 0) {
      return `${present} attendee(s) checked in and ${feedbackCount} feedback submission(s) were recorded before completion.`;
    }
    return `${present} attendee(s) checked in before the event was marked completed.`;
  }

  if (status === "cancelled") {
    return "Event was cancelled and removed from active operations.";
  }

  return "Event activity was updated in the oversight feed.";
};

const buildEventHistoryType = (event, summary = {}) => {
  const status = String(event?.status || "").trim().toLowerCase();
  if (status === "completed" && Number(summary?.present || 0) > 0) return "ATTENDANCE";
  return "NOTICE";
};

const buildSystemHealthScore = ({
  pendingApprovals,
  lockedUsers,
  staleVerifications,
  maintenanceMode,
}) => {
  let score = 100;
  score -= Math.min(20, Number(pendingApprovals || 0) * 2);
  score -= Math.min(20, Number(lockedUsers || 0) * 8);
  score -= Math.min(15, Number(staleVerifications || 0) * 3);
  if (maintenanceMode) score -= 25;
  return Math.max(0, Math.min(100, score));
};

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
  const update = { ...req.body };
  const unset = {};

  if (Object.prototype.hasOwnProperty.call(update, "mobileNumber")) {
    const digits = String(update.mobileNumber || "").replace(/\D/g, "");
    if (digits) {
      update.mobileNumber = digits;
    } else {
      delete update.mobileNumber;
      unset.mobileNumber = "";
    }
  }

  const updateDoc = {};
  if (Object.keys(update).length) updateDoc.$set = update;
  if (Object.keys(unset).length) updateDoc.$unset = unset;

  const user = await User.findByIdAndUpdate(req.params.id, updateDoc, {
    new: true,
    runValidators: true,
    context: "query",
  });
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

export const getAdminSystemLiveData = asyncHandler(async (req, res) => {
  await autoCompleteOverdueEvents();

  const now = new Date();
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    users,
    events,
    contacts,
    notifications,
    settings,
    activeSessions,
    activeSessionCount,
    pendingContactCount,
    registrationSummaries,
    attendanceSummaries,
    feedbackSummaries,
  ] = await Promise.all([
    User.find().select("-password -refreshToken").lean(),
    Event.find()
      .select(
        "_id title organizer schedule registration attendance status createdAt updatedAt"
      )
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean(),
    Contact.find()
      .select("_id fullName email status createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Notification.find()
      .select("_id title message type createdAt recipient sender")
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
    getSecuritySettings(),
    UserSession.find({
      revokedAt: null,
      expiresAt: { $gt: now },
    })
      .select(
        "userId sessionId deviceLabel ipAddress browser os deviceType createdAt lastActiveAt"
      )
      .sort({ lastActiveAt: -1, createdAt: -1 })
      .limit(40)
      .lean(),
    UserSession.countDocuments({
      revokedAt: null,
      expiresAt: { $gt: now },
    }),
    Contact.countDocuments({ status: "Pending" }),
    EventRegistration.aggregate([
      {
        $group: {
          _id: "$event",
          totalRegistrations: { $sum: 1 },
          activeRegistrations: {
            $sum: {
              $cond: [{ $in: ["$status", ACTIVE_REGISTRATION_STATUSES] }, 1, 0],
            },
          },
          registeredParticipants: {
            $sum: {
              $cond: [
                { $in: ["$status", ACTIVE_REGISTRATION_STATUSES] },
                { $ifNull: ["$totalParticipants", 1] },
                0,
              ],
            },
          },
          confirmedParticipants: {
            $sum: {
              $cond: [
                { $eq: ["$status", "Confirmed"] },
                { $ifNull: ["$totalParticipants", 1] },
                0,
              ],
            },
          },
          pendingMemberVerifications: {
            $sum: {
              $cond: [{ $eq: ["$status", "PendingMemberVerification"] }, 1, 0],
            },
          },
          pendingPaymentReviews: {
            $sum: {
              $cond: [{ $eq: ["$status", "PendingPaymentVerification"] }, 1, 0],
            },
          },
          lastRegistrationAt: { $max: "$updatedAt" },
        },
      },
    ]),
    ParticipantQR.aggregate([
      {
        $group: {
          _id: "$eventId",
          totalQrIssued: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ["$attendanceMarked", true] }, 1, 0],
            },
          },
          lastAttendanceAt: { $max: "$attendanceMarkedAt" },
        },
      },
    ]),
    Feedback.aggregate([
      {
        $group: {
          _id: "$event",
          feedbackCount: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
    ]),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));
  const registrationSummaryByEventId = createSummaryMap(registrationSummaries);
  const attendanceSummaryByEventId = createSummaryMap(attendanceSummaries);
  const feedbackSummaryByEventId = createSummaryMap(feedbackSummaries);
  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const verifiedUsers = users.filter((user) => user.emailVerified).length;
  const blockedUsers = totalUsers - activeUsers;
  const recentlyJoined = users.filter((user) => {
    const createdAt = new Date(user?.createdAt || 0).getTime();
    return !Number.isNaN(createdAt) && createdAt >= last30Days.getTime();
  }).length;

  const roleCounts = users.reduce(
    (acc, user) => {
      if (Object.prototype.hasOwnProperty.call(acc, user?.role)) {
        acc[user.role] += 1;
      }
      return acc;
    },
    { MAIN_ADMIN: 0, ORGANIZER: 0, STUDENT_COORDINATOR: 0, STUDENT: 0 }
  );

  const staleVerificationAlerts = [];
  const securityAlerts = [];
  const lockedUsers = users.filter((user) => {
    const lockoutUntil = new Date(user?.lockoutUntil || 0).getTime();
    return !Number.isNaN(lockoutUntil) && lockoutUntil > now.getTime();
  });

  for (const user of users) {
    const createdAt = new Date(user?.createdAt || 0).getTime();
    const ageInDays = Number.isNaN(createdAt)
      ? 0
      : Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));

    if (!user?.emailVerified && ageInDays > 3) {
      staleVerificationAlerts.push(user);
      securityAlerts.push({
        id: `verify-${user._id}`,
        timestamp: user.createdAt,
        event: `Unverified account older than ${ageInDays} days`,
        source: user.email,
        severity: ageInDays > 14 ? "High" : "Medium",
        action: "Review",
      });
    }

    if (!user?.isActive && user?.emailVerified) {
      securityAlerts.push({
        id: `inactive-${user._id}`,
        timestamp: user.updatedAt || user.createdAt,
        event: "Verified account is currently inactive",
        source: user.email,
        severity: "Info",
        action: "Monitor",
      });
    }
  }

  if (settings?.maintenanceMode) {
    securityAlerts.push({
      id: "maintenance-mode",
      timestamp: settings.updatedAt || now.toISOString(),
      event: "Maintenance mode is enabled",
      source: "Security Settings",
      severity: "High",
      action: "Review",
    });
  }

  for (const user of lockedUsers) {
    securityAlerts.push({
      id: `locked-${user._id}`,
      timestamp: user.lockoutUntil,
      event: "User account is currently locked",
      source: user.email,
      severity: "Medium",
      action: "Monitor",
    });
  }

  const eventRows = events
    .map((event) => {
      const eventId = String(event?._id || "");
      const registrationSummary = registrationSummaryByEventId.get(eventId) || {};
      const attendanceSummary = attendanceSummaryByEventId.get(eventId) || {};
      const feedbackSummary = feedbackSummaryByEventId.get(eventId) || {};
      const capacity = Number(event?.registration?.maxParticipants || 0);
      const registered = Number(registrationSummary?.registeredParticipants || 0);
      const confirmed = Number(registrationSummary?.confirmedParticipants || 0);
      const present = Number(
        attendanceSummary?.present ?? event?.attendance?.totalPresent ?? 0
      );
      const utilization =
        capacity > 0 ? Math.min(100, Math.round((registered / capacity) * 100)) : 0;
      const attendanceRate =
        registered > 0 ? Math.min(100, Math.round((present / registered) * 100)) : 0;
      const feedbackCount = Number(feedbackSummary?.feedbackCount || 0);
      const averageRating =
        feedbackCount > 0 ? Number(feedbackSummary?.averageRating || 0).toFixed(1) : null;
      const pendingQueue =
        Number(registrationSummary?.pendingMemberVerifications || 0) +
        Number(registrationSummary?.pendingPaymentReviews || 0);
      const latestActivityAt = getLatestIsoTimestamp(
        event?.updatedAt,
        registrationSummary?.lastRegistrationAt,
        attendanceSummary?.lastAttendanceAt
      );

      return {
        id: eventId,
        title: String(event?.title || "Untitled Event"),
        organizer: String(event?.organizer?.name || "Organizer"),
        department: String(event?.organizer?.department || "Department not set"),
        status: String(event?.status || ""),
        state: deriveEventState(event, now),
        registered,
        confirmed,
        present,
        capacity,
        utilization,
        attendanceRate,
        activeRegistrations: Number(registrationSummary?.activeRegistrations || 0),
        totalRegistrations: Number(registrationSummary?.totalRegistrations || 0),
        pendingQueue,
        pendingMemberVerifications: Number(
          registrationSummary?.pendingMemberVerifications || 0
        ),
        pendingPaymentReviews: Number(
          registrationSummary?.pendingPaymentReviews || 0
        ),
        totalQrIssued: Number(attendanceSummary?.totalQrIssued || 0),
        feedbackCount,
        averageRating,
        startDate: event?.schedule?.startDate || null,
        dateLabel: formatEventDateLabel(event?.schedule?.startDate),
        updatedAt: latestActivityAt || event?.updatedAt || event?.createdAt || null,
      };
    })
    .sort((a, b) => {
      const rank = { Active: 0, Pending: 1, Closed: 2 };
      const stateDiff = (rank[a.state] ?? 9) - (rank[b.state] ?? 9);
      if (stateDiff !== 0) return stateDiff;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

  const monitoredRows = eventRows.filter((row) => row.status !== "Cancelled");
  const totalAttendance = monitoredRows.reduce((sum, row) => sum + row.present, 0);
  const totalRegisteredParticipants = monitoredRows.reduce(
    (sum, row) => sum + row.registered,
    0
  );
  const totalCapacity = monitoredRows.reduce((sum, row) => sum + row.capacity, 0);
  const liveEvents = eventRows.filter((row) => row.state === "Active").length;
  const draftEvents = eventRows.filter(
    (row) => String(row.status || "").toLowerCase() === "draft"
  ).length;
  const pendingPaymentReviews = eventRows.reduce(
    (sum, row) => sum + Number(row.pendingPaymentReviews || 0),
    0
  );
  const pendingMemberVerifications = eventRows.reduce(
    (sum, row) => sum + Number(row.pendingMemberVerifications || 0),
    0
  );
  const pendingApprovals =
    draftEvents + pendingContactCount + pendingPaymentReviews;
  const avgUtilization =
    totalCapacity > 0
      ? Number(((totalRegisteredParticipants / totalCapacity) * 100).toFixed(1))
      : 0;

  const sessionActivity = activeSessions.map((session) => {
    const user = userById.get(String(session?.userId || ""));
    return {
      id: `login-${session.sessionId}`,
      type: "login",
      name: user?.fullName || "User",
      avatar: user?.avatar || null,
      department: resolveDepartment(user),
      detail: `Successful sign-in on ${session?.deviceLabel || "active device"}`,
      time: session?.lastActiveAt || session?.createdAt || null,
      device: session?.deviceLabel || "Active device",
    };
  });

  const joinedActivity = users.map((user) => ({
    id: `joined-${user._id}`,
    type: "joined",
    name: user.fullName,
    avatar: user.avatar || null,
    department: resolveDepartment(user),
    detail: `${ROLE_LABELS[user.role] || user.role} account created`,
    time: user.createdAt || null,
    device: "",
  }));

  const recentActivity = [...sessionActivity, ...joinedActivity]
    .filter((item) => item.time)
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 8);

  const history = [
    ...notifications.map((item) => ({
      id: String(item?._id || `${item?.type}-${item?.createdAt}`),
      title: String(item?.title || "System update"),
      message: String(item?.message || "No message provided."),
      type: toNotificationBadge(item?.type),
      createdAt: item?.createdAt || null,
    })),
    ...contacts.map((item) => ({
      id: `contact-${item?._id || item?.email || item?.createdAt}`,
      title: `Contact request from ${String(item?.fullName || "Campus user").trim() || "Campus user"}`,
      message: `${String(item?.status || "Pending")} support request received from ${String(item?.email || "unknown email").trim() || "unknown email"}.`,
      type: "CONTACT",
      createdAt: item?.createdAt || null,
    })),
    ...events.slice(0, 8).map((event) => {
      const eventId = String(event?._id || "");
      const registrationSummary = registrationSummaryByEventId.get(eventId) || {};
      const attendanceSummary = attendanceSummaryByEventId.get(eventId) || {};
      const feedbackSummary = feedbackSummaryByEventId.get(eventId) || {};
      const summary = {
        registeredParticipants: Number(
          registrationSummary?.registeredParticipants || 0
        ),
        present: Number(
          attendanceSummary?.present ?? event?.attendance?.totalPresent ?? 0
        ),
        feedbackCount: Number(feedbackSummary?.feedbackCount || 0),
      };

      return {
        id: `event-${eventId}`,
        title: String(event?.title || "Event activity"),
        message: buildEventHistoryMessage(event, summary),
        type: buildEventHistoryType(event, summary),
        createdAt:
          getLatestIsoTimestamp(
            event?.updatedAt,
            registrationSummary?.lastRegistrationAt,
            attendanceSummary?.lastAttendanceAt
          ) || event?.createdAt || null,
      };
    }),
  ]
    .filter((item) => item.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const systemAlerts = [];
  if (settings?.maintenanceMode) {
    systemAlerts.push("Maintenance mode is enabled.");
  }
  if (pendingContactCount > 0) {
    systemAlerts.push(
      `${pendingContactCount} contact request(s) are waiting for admin response.`
    );
  }
  if (pendingPaymentReviews > 0) {
    systemAlerts.push(
      `${pendingPaymentReviews} payment verification request(s) are waiting for review.`
    );
  }
  if (pendingMemberVerifications > 0) {
    systemAlerts.push(
      `${pendingMemberVerifications} registration(s) are still awaiting member verification.`
    );
  }
  if (monitoredRows.length > 0 && avgUtilization < 35) {
    systemAlerts.push("Event capacity utilization is below target threshold.");
  }
  if (liveEvents === 0) {
    systemAlerts.push("No active live events right now.");
  }
  if (lockedUsers.length > 0) {
    systemAlerts.push(`${lockedUsers.length} user account(s) are currently locked.`);
  }
  if (!systemAlerts.length) {
    systemAlerts.push("No critical system alerts detected.");
  }

  const healthScore = buildSystemHealthScore({
    pendingApprovals,
    lockedUsers: lockedUsers.length,
    staleVerifications: staleVerificationAlerts.length,
    maintenanceMode: Boolean(settings?.maintenanceMode),
  });

  return res.status(200).json({
    success: true,
    data: {
      generatedAt: now.toISOString(),
      users,
      userMetrics: {
        totalUsers,
        activeUsers,
        verifiedUsers,
        blockedUsers,
        recentlyJoined,
        verificationRate: totalUsers ? Number(((verifiedUsers / totalUsers) * 100).toFixed(1)) : 0,
        roleCounts,
      },
      securityAlerts: securityAlerts
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 6),
      recentActivity,
      oversight: {
        kpis: {
          liveEvents,
          totalAttendance,
          totalRegisteredParticipants,
          pendingApprovals,
          pendingPaymentReviews,
          pendingMemberVerifications,
          pendingContacts: pendingContactCount,
          avgUtilization,
        },
        events: eventRows,
        history,
        health: {
          score: Number(healthScore.toFixed(1)),
          maintenanceMode: Boolean(settings?.maintenanceMode),
          activeSessions: activeSessionCount,
          lockedUsers: lockedUsers.length,
          pendingContacts: pendingContactCount,
          pendingPaymentReviews,
          pendingMemberVerifications,
          trackedEvents: eventRows.length,
        },
        alerts: systemAlerts,
      },
    },
  });
});

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

    if (["ISSUED", "VERIFIED", "REVOKED", "DOWNLOADED"].includes(action)) {
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
