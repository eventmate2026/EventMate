import Notification from "../models/Notification.model.js";
import User from "../models/User.model.js";
import Event from "../models/Event.model.js";
import EventRegistration from "../models/EventRegistration.model.js";
import { sendNotification } from "../services/notification.service.js";
import crypto from "crypto";
import mongoose from "mongoose";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeId = (value) => String(value || "").trim();
const normalizeName = (value, fallback) =>
  String(value || "").trim() || fallback;
const INBOX_NOTIFICATION_FIELDS =
  "_id title message type refId sender recipient.userId recipient.name recipient.role isRead readAt createdAt updatedAt emailDelivery.status emailDelivery.acceptedAt emailDelivery.deliveredAt emailDelivery.lastError";

export const collectOrganizerEventAudience = (registrations = [], isTeamEvent = false) => {
  const allowedIds = new Set();
  const participantEmails = new Set();

  registrations.forEach((reg) => {
    const registrationOwnerId = normalizeId(reg?.registeredBy);
    if (registrationOwnerId) {
      allowedIds.add(registrationOwnerId);
    }

    const leaderEmail = normalizeEmail(reg?.teamLeader?.email);
    if (leaderEmail) {
      participantEmails.add(leaderEmail);
    }

    if (!isTeamEvent) return;

    const teamMembers = Array.isArray(reg?.teamMembers) ? reg.teamMembers : [];
    teamMembers.forEach((member) => {
      const memberEmail = normalizeEmail(member?.email);
      if (memberEmail) {
        participantEmails.add(memberEmail);
      }
    });
  });

  return {
    allowedIds,
    participantEmails
  };
};

export const buildTeamNoticeRecipientMap = (registrations = []) => {
  const recipientMap = new Map();

  registrations.forEach((reg) => {
    const ownerId = normalizeId(reg?.registeredBy);
    if (!ownerId) return;

    const seenEmails = new Set();
    const recipients = [];

    const pushRecipient = (emailValue, nameValue, roleValue) => {
      const email = normalizeEmail(emailValue);
      if (!email || seenEmails.has(email)) return;
      seenEmails.add(email);
      recipients.push({
        email,
        name: normalizeName(nameValue, roleValue === "leader" ? "Team Leader" : "Team Member"),
        role: roleValue
      });
    };

    pushRecipient(reg?.teamLeader?.email, reg?.teamLeader?.name, "leader");

    const teamMembers = Array.isArray(reg?.teamMembers) ? reg.teamMembers : [];
    teamMembers.forEach((member) => {
      pushRecipient(member?.email, member?.name, "member");
    });

    if (recipients.length > 0) {
      recipientMap.set(ownerId, recipients);
    }
  });

  return recipientMap;
};

const buildNotificationReceipt = (item) => ({
  userId: item.recipient?.userId || null,
  name: item.recipient?.name || "User",
  email: item.recipient?.email || "",
  role: item.recipient?.role || "USER",
  isRead: Boolean(item.isRead),
  readAt: item.readAt || null,
  sentAt: item.createdAt || null,
  emailStatus: item.emailDelivery?.status || "NOT_REQUESTED",
  emailTrackingMode: item.emailDelivery?.trackingMode || "PROVIDER_ACCEPTANCE",
  emailAcceptedAt:
    item.emailDelivery?.acceptedAt || item.emailDelivery?.deliveredAt || null,
  emailDeliveredAt: item.emailDelivery?.deliveredAt || null,
  emailOpenedAt: item.emailDelivery?.openedAt || null,
  emailOpenCount: Number(item.emailDelivery?.openCount || 0),
  emailLastAttemptAt: item.emailDelivery?.lastAttemptAt || null,
  emailAttempts: Number(item.emailDelivery?.attempts || 0),
  emailLastError: item.emailDelivery?.lastError || ""
});

const resolveWebhookNotificationId = (event) =>
  String(
    event?.notificationId ||
      event?.custom_args?.notificationId ||
      event?.customArgs?.notificationId ||
      ""
  ).trim();

const getNotificationEmailWebhookSecret = () =>
  String(process.env.EMAIL_EVENT_WEBHOOK_SECRET || "").trim();

const isNotificationEmailWebhookConfigured = () =>
  Boolean(getNotificationEmailWebhookSecret());

const isNotificationEmailWebhookAuthorized = (req) => {
  const configuredSecret = getNotificationEmailWebhookSecret();
  if (!configuredSecret) return false;

  const providedSecret = String(
    req.headers["x-email-webhook-secret"] ||
      req.query?.secret ||
      req.body?.secret ||
      ""
  ).trim();

  return configuredSecret === providedSecret;
};

// Get all unread notifications for logged in user
export const getMyNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const includeAll = String(req.query.all || "").toLowerCase() === "true";
    const baseFilter = { "recipient.userId": req.user._id };

    const query = Notification.find(baseFilter)
      .select(INBOX_NOTIFICATION_FIELDS)
      .sort({ createdAt: -1 })
      .lean();
    if (!includeAll) {
      query.skip((page - 1) * limit).limit(limit);
    }

    const [notifications, unreadCount, totalCount] = await Promise.all([
      query,
      Notification.countDocuments({ ...baseFilter, isRead: false }),
      Notification.countDocuments(baseFilter)
    ]);

    return res.status(200).json({
      success: true,
      unreadCount,
      totalCount,
      page: includeAll ? 1 : page,
      limit: includeAll ? totalCount : limit,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

// Mark all as read
export const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { "recipient.userId": req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    next(error);
  }
};

// Mark single notification as read
export const markOneRead = async (req, res, next) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        "recipient.userId": req.user._id
      },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read"
    });
  } catch (error) {
    next(error);
  }
};

// Admin broadcast/message to users
export const adminSendNotification = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.userIds)
      ? req.body.userIds
      : req.body?.userId
      ? [req.body.userId]
      : [];
    const uniqueIds = Array.from(new Set(ids.map(normalizeId).filter(Boolean)));

    const title = String(req.body?.title || req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();
    const rawMode = String(req.body?.mode || req.body?.type || "MESSAGE").trim().toUpperCase();
    const mode = rawMode === "NOTICE" ? "NOTICE" : "MESSAGE";
    const groupId = crypto.randomUUID();

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required"
      });
    }

    if (!uniqueIds.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one recipient"
      });
    }

    if (mode === "MESSAGE" && uniqueIds.length !== 1) {
      return res.status(400).json({
        success: false,
        message: "Message must be sent to exactly one recipient"
      });
    }

    const users = await User.find({ _id: { $in: uniqueIds } }).select("_id fullName role email");
    const allowedRoles = new Set(["STUDENT", "STUDENT_COORDINATOR", "ORGANIZER", "MAIN_ADMIN"]);
    const recipients = users.filter((user) => allowedRoles.has(String(user?.role || "").toUpperCase()));

    if (!recipients.length) {
      return res.status(404).json({
        success: false,
        message: "No valid recipients found"
      });
    }

    const sendResults = await Promise.all(
      recipients.map((user) =>
        sendNotification({
          recipientId: user._id,
          recipientName: user.fullName || "User",
          recipientRole: user.role,
          recipientEmail: user.email,
          senderId: req.user?._id || null,
          senderName: req.user?.fullName || "Main Admin",
          senderRole: req.user?.role || "MAIN_ADMIN",
          title,
          message,
          type: mode,
          refId: req.user?._id || null,
          groupId,
          sendEmailCopy: mode === "NOTICE"
        })
      )
    );

    const resolvedIds = recipients.map((user) => normalizeId(user?._id));
    const skipped = uniqueIds.filter((id) => !resolvedIds.includes(id));
    const sentCount = sendResults.filter(Boolean).length;

    return res.status(200).json({
      success: true,
      count: sentCount,
      sentTo: resolvedIds,
      skipped,
      groupId
    });
  } catch (error) {
    next(error);
  }
};

// Organizer event-scoped broadcast/message
export const organizerSendNotification = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.userIds)
      ? req.body.userIds
      : req.body?.userId
      ? [req.body.userId]
      : [];
    const uniqueIds = Array.from(new Set(ids.map(normalizeId).filter(Boolean)));

    const eventId = normalizeId(req.body?.eventId);
    const title = String(req.body?.title || req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();
    const rawMode = String(req.body?.mode || req.body?.type || "MESSAGE").trim().toUpperCase();
    const mode = rawMode === "NOTICE" ? "NOTICE" : "MESSAGE";
    const groupId = crypto.randomUUID();

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event id is required"
      });
    }

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required"
      });
    }

    if (!uniqueIds.length) {
      return res.status(400).json({
        success: false,
        message: "Select at least one recipient"
      });
    }

    if (mode === "MESSAGE" && uniqueIds.length !== 1) {
      return res.status(400).json({
        success: false,
        message: "Message must be sent to exactly one recipient"
      });
    }

    const event = await Event.findById(eventId).select("organizer createdBy studentCoordinators isTeamEvent");
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const requesterId = String(req.user?._id || "");
    const isOrganizer =
      event.organizer?.organizerId?.toString() === requesterId ||
      event.createdBy?.toString() === requesterId;

    if (!isOrganizer) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to message this event"
      });
    }

    const allowedIds = new Set();
    const coordinatorEmails = [];

    (event.studentCoordinators || []).forEach((entry) => {
      const coordId = normalizeId(entry?.coordinatorId);
      if (coordId) allowedIds.add(coordId);
      const email = String(entry?.email || "").trim().toLowerCase();
      if (email) coordinatorEmails.push(email);
    });

    if (coordinatorEmails.length) {
      const emailRegexes = coordinatorEmails.map(
        (email) => new RegExp(`^${escapeRegex(email)}$`, "i")
      );
      const emailUsers = await User.find({ email: { $in: emailRegexes } }).select("_id");
      emailUsers.forEach((user) => allowedIds.add(normalizeId(user?._id)));
    }

    const registrations = await EventRegistration.find({ event: eventId }).select(
      "registeredBy teamLeader.name teamLeader.email teamMembers.name teamMembers.email"
    );
    const audience = collectOrganizerEventAudience(
      registrations,
      Boolean(event?.isTeamEvent)
    );

    audience.allowedIds.forEach((id) => allowedIds.add(id));

    if (audience.participantEmails.size) {
      const participantUsers = await User.find({
        email: { $in: Array.from(audience.participantEmails) }
      }).select("_id");
      participantUsers.forEach((user) => allowedIds.add(normalizeId(user?._id)));
    }

    if (requesterId) allowedIds.delete(requesterId);

    const validRecipientIds = uniqueIds.filter((id) => allowedIds.has(id));
    if (!validRecipientIds.length) {
      return res.status(404).json({
        success: false,
        message: "No valid recipients found for this event"
      });
    }

    const directRecipients = await User.find({ _id: { $in: validRecipientIds } }).select(
      "_id fullName role email"
    );
    const notificationTargets = new Map();

    directRecipients.forEach((user) => {
      const key = normalizeId(user?._id);
      if (!key) return;
      notificationTargets.set(key, {
        recipientId: user._id,
        recipientName: user.fullName || "User",
        recipientRole: user.role || "STUDENT",
        recipientEmail: user.email || ""
      });
    });

    if (mode === "NOTICE" && Boolean(event?.isTeamEvent)) {
      const teamRecipientMap = buildTeamNoticeRecipientMap(registrations);
      const expandedEmails = new Map();

      validRecipientIds.forEach((id) => {
        const recipients = teamRecipientMap.get(id);
        if (!recipients) return;
        recipients.forEach((recipient) => {
          if (recipient?.email) {
            expandedEmails.set(recipient.email, recipient);
          }
        });
      });

      const expandedEmailList = Array.from(expandedEmails.keys());
      if (expandedEmailList.length > 0) {
        const expandedUsers = await User.find({
          email: { $in: expandedEmailList }
        }).select("_id fullName role email");
        const userByEmail = new Map(
          expandedUsers.map((user) => [normalizeEmail(user?.email), user])
        );
        const requesterEmail = normalizeEmail(req.user?.email);

        expandedEmails.forEach((recipient, email) => {
          const matchedUser = userByEmail.get(email);
          if (matchedUser?._id) {
            const matchedUserId = normalizeId(matchedUser._id);
            if (!matchedUserId || matchedUserId === requesterId) return;
            notificationTargets.set(matchedUserId, {
              recipientId: matchedUser._id,
              recipientName: matchedUser.fullName || recipient.name || "Participant",
              recipientRole: matchedUser.role || "STUDENT",
              recipientEmail: matchedUser.email || email
            });
            return;
          }

          if (email && email !== requesterEmail) {
            notificationTargets.set(`email:${email}`, {
              recipientId: null,
              recipientName: recipient.name || "Participant",
              recipientRole: "STUDENT",
              recipientEmail: email
            });
          }
        });
      }
    }

    const recipients = Array.from(notificationTargets.values());
    if (!recipients.length) {
      return res.status(404).json({
        success: false,
        message: "No valid recipients found"
      });
    }

    const sendResults = await Promise.all(
      recipients.map((user) =>
        sendNotification({
          recipientId: user.recipientId,
          recipientName: user.recipientName,
          recipientRole: user.recipientRole,
          recipientEmail: user.recipientEmail,
          senderId: req.user?._id || null,
          senderName: req.user?.fullName || "Organizer",
          senderRole: req.user?.role || "ORGANIZER",
          title,
          message,
          type: mode,
          refId: event._id,
          groupId,
          sendEmailCopy: mode === "NOTICE"
        })
      )
    );

    const resolvedIds = recipients
      .map((user) => normalizeId(user?.recipientId))
      .filter(Boolean);
    const emailOnlyCount = recipients.filter((user) => !user?.recipientId).length;
    const skipped = uniqueIds.filter((id) => !resolvedIds.includes(id));
    const sentCount = sendResults.filter(Boolean).length;

    return res.status(200).json({
      success: true,
      count: sentCount,
      sentTo: resolvedIds,
      emailOnlyCount,
      skipped,
      groupId
    });
  } catch (error) {
    next(error);
  }
};

// Organizer - view sent message groups for an event
export const getOrganizerSentGroups = async (req, res, next) => {
  try {
    const eventId = String(req.query?.eventId || "").trim();
    const includeAll = String(req.query?.all || "").toLowerCase() === "true";
    const limit = Math.min(5000, Math.max(1, Number(req.query?.limit) || 50));
    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event id is required"
      });
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id"
      });
    }

    const event = await Event.findById(eventId).select("organizer createdBy");
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const requesterId = String(req.user?._id || "");
    const isOrganizer =
      event.organizer?.organizerId?.toString() === requesterId ||
      event.createdBy?.toString() === requesterId;

    if (!isOrganizer) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this event"
      });
    }

    const senderObjectId = new mongoose.Types.ObjectId(requesterId);
    const eventObjectId = new mongoose.Types.ObjectId(eventId);

    const pipeline = [
      {
        $match: {
          groupId: { $ne: null },
          "sender.userId": senderObjectId,
          refId: eventObjectId
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$groupId",
          title: { $first: "$title" },
          message: { $first: "$message" },
          type: { $first: "$type" },
          createdAt: { $first: "$createdAt" },
          total: { $sum: 1 },
          readCount: { $sum: { $cond: ["$isRead", 1, 0] } },
          emailRequestedCount: {
            $sum: { $cond: [{ $eq: ["$emailDelivery.requested", true] }, 1, 0] }
          },
          emailSentCount: {
            $sum: { $cond: [{ $eq: ["$emailDelivery.status", "SENT"] }, 1, 0] }
          },
          emailFailedCount: {
            $sum: { $cond: [{ $eq: ["$emailDelivery.status", "FAILED"] }, 1, 0] }
          },
          emailPendingCount: {
            $sum: {
              $cond: [
                { $in: ["$emailDelivery.status", ["PENDING", "PROCESSING"]] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    if (!includeAll) {
      pipeline.push({ $limit: limit });
    }

    const groups = await Notification.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      data: groups.map((group) => ({
        groupId: group._id,
        title: group.title,
        message: group.message,
        type: group.type,
        createdAt: group.createdAt,
        total: group.total,
        readCount: group.readCount,
        emailRequestedCount: group.emailRequestedCount || 0,
        emailSentCount: group.emailSentCount || 0,
        emailFailedCount: group.emailFailedCount || 0,
        emailPendingCount: group.emailPendingCount || 0
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Organizer - view read receipts for a message group
export const getOrganizerGroupReceipts = async (req, res, next) => {
  try {
    const eventId = String(req.query?.eventId || "").trim();
    const groupId = String(req.query?.groupId || "").trim();

    if (!eventId || !groupId) {
      return res.status(400).json({
        success: false,
        message: "Event id and group id are required"
      });
    }
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id"
      });
    }

    const event = await Event.findById(eventId).select("organizer createdBy");
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    const requesterId = String(req.user?._id || "");
    const isOrganizer =
      event.organizer?.organizerId?.toString() === requesterId ||
      event.createdBy?.toString() === requesterId;

    if (!isOrganizer) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this event"
      });
    }

    const notifications = await Notification.find({
      groupId,
      "sender.userId": req.user?._id,
      refId: eventId
    })
      .select("recipient isRead readAt createdAt emailDelivery")
      .sort({ "recipient.name": 1 });

    const receipts = notifications.map(buildNotificationReceipt);

    const readCount = receipts.filter((item) => item.isRead).length;

    return res.status(200).json({
      success: true,
      count: receipts.length,
      readCount,
      data: receipts
    });
  } catch (error) {
    next(error);
  }
};

// Admin - view sent message groups
export const getAdminSentGroups = async (req, res, next) => {
  try {
    const includeAll = String(req.query?.all || "").toLowerCase() === "true";
    const limit = Math.min(5000, Math.max(1, Number(req.query?.limit) || 50));

    const senderObjectId = new mongoose.Types.ObjectId(String(req.user?._id || ""));

    const pipeline = [
      {
        $match: {
          groupId: { $ne: null },
          "sender.userId": senderObjectId
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$groupId",
          title: { $first: "$title" },
          message: { $first: "$message" },
          type: { $first: "$type" },
          createdAt: { $first: "$createdAt" },
          total: { $sum: 1 },
          readCount: { $sum: { $cond: ["$isRead", 1, 0] } },
          emailRequestedCount: {
            $sum: { $cond: [{ $eq: ["$emailDelivery.requested", true] }, 1, 0] }
          },
          emailSentCount: {
            $sum: { $cond: [{ $eq: ["$emailDelivery.status", "SENT"] }, 1, 0] }
          },
          emailFailedCount: {
            $sum: { $cond: [{ $eq: ["$emailDelivery.status", "FAILED"] }, 1, 0] }
          },
          emailPendingCount: {
            $sum: {
              $cond: [
                { $in: ["$emailDelivery.status", ["PENDING", "PROCESSING"]] },
                1,
                0
              ]
            }
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    if (!includeAll) {
      pipeline.push({ $limit: limit });
    }

    const groups = await Notification.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      data: groups.map((group) => ({
        groupId: group._id,
        title: group.title,
        message: group.message,
        type: group.type,
        createdAt: group.createdAt,
        total: group.total,
        readCount: group.readCount,
        emailRequestedCount: group.emailRequestedCount || 0,
        emailSentCount: group.emailSentCount || 0,
        emailFailedCount: group.emailFailedCount || 0,
        emailPendingCount: group.emailPendingCount || 0
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Admin - view read receipts for a message group
export const getAdminGroupReceipts = async (req, res, next) => {
  try {
    const groupId = String(req.query?.groupId || "").trim();

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: "Group id is required"
      });
    }

    const notifications = await Notification.find({
      groupId,
      "sender.userId": req.user?._id
    })
      .select("recipient isRead readAt createdAt emailDelivery")
      .sort({ "recipient.name": 1 });

    const receipts = notifications.map(buildNotificationReceipt);

    const readCount = receipts.filter((item) => item.isRead).length;

    return res.status(200).json({
      success: true,
      count: receipts.length,
      readCount,
      data: receipts
    });
  } catch (error) {
    next(error);
  }
};

export const recordNotificationEmailEvents = async (req, res, next) => {
  try {
    if (!isNotificationEmailWebhookConfigured()) {
      return res.status(404).json({
        success: false,
        message: "Not found"
      });
    }

    if (!isNotificationEmailWebhookAuthorized(req)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email webhook secret"
      });
    }

    const events = Array.isArray(req.body) ? req.body : [];
    let updated = 0;

    for (const event of events) {
      const notificationId = resolveWebhookNotificationId(event);
      if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) continue;

      const eventName = String(event?.event || "").trim().toLowerCase();
      const update = {};

      if (eventName === "delivered") {
        update["emailDelivery.deliveredAt"] = new Date();
        update["emailDelivery.status"] = "SENT";
      } else if (eventName === "open") {
        update["emailDelivery.openedAt"] = new Date();
      } else if (eventName === "bounce" || eventName === "dropped" || eventName === "spamreport") {
        update["emailDelivery.status"] = "FAILED";
        update["emailDelivery.lastError"] = String(
          event?.reason || event?.response || eventName
        ).slice(0, 500);
      } else if (eventName === "deferred") {
        update["emailDelivery.status"] = "PROCESSING";
        update["emailDelivery.lastError"] = String(
          event?.reason || event?.response || "Delivery deferred"
        ).slice(0, 500);
      } else {
        continue;
      }

      const updateOperation = { $set: update };
      if (eventName === "open") {
        updateOperation.$inc = { "emailDelivery.openCount": 1 };
      }

      const result = await Notification.updateOne(
        { _id: notificationId },
        updateOperation
      );
      updated += Number(result?.modifiedCount || 0);
    }

    return res.status(200).json({
      success: true,
      updated
    });
  } catch (error) {
    next(error);
  }
};
