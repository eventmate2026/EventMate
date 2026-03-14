import Notification from "../models/Notification.model.js";
import User from "../models/User.model.js";
import Event from "../models/Event.model.js";
import EventRegistration from "../models/EventRegistration.model.js";
import { sendNotification } from "../services/notification.service.js";
import crypto from "crypto";
import mongoose from "mongoose";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Get all unread notifications for logged in user
export const getMyNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const includeAll = String(req.query.all || "").toLowerCase() === "true";
    const baseFilter = { "recipient.userId": req.user._id };

    const query = Notification.find(baseFilter).sort({ createdAt: -1 });
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
    const normalizeId = (value) => String(value || "").trim();
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
          groupId
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
    const normalizeId = (value) => String(value || "").trim();
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

    const registrations = await EventRegistration.find({ event: eventId }).select("registeredBy teamLeader.email");

    if (event?.isTeamEvent) {
      const leaderEmailSet = new Set();
      registrations.forEach((reg) => {
        const regId = normalizeId(reg?.registeredBy);
        if (regId) allowedIds.add(regId);
        const email = String(reg?.teamLeader?.email || "").trim().toLowerCase();
        if (email) leaderEmailSet.add(email);
      });

      if (leaderEmailSet.size) {
        const leaderEmails = Array.from(leaderEmailSet);
        const leaderUsers = await User.find({ email: { $in: leaderEmails } }).select("_id");
        leaderUsers.forEach((user) => allowedIds.add(normalizeId(user?._id)));
      }
    } else {
      registrations.forEach((reg) => {
        const regId = normalizeId(reg?.registeredBy);
        if (regId) allowedIds.add(regId);
      });
    }

    if (requesterId) allowedIds.delete(requesterId);

    const validRecipientIds = uniqueIds.filter((id) => allowedIds.has(id));
    if (!validRecipientIds.length) {
      return res.status(404).json({
        success: false,
        message: "No valid recipients found for this event"
      });
    }

    const recipients = await User.find({ _id: { $in: validRecipientIds } }).select(
      "_id fullName role email"
    );

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
          senderName: req.user?.fullName || "Organizer",
          senderRole: req.user?.role || "ORGANIZER",
          title,
          message,
          type: mode,
          refId: event._id,
          groupId
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
          readCount: { $sum: { $cond: ["$isRead", 1, 0] } }
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
        readCount: group.readCount
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
      .select("recipient isRead readAt createdAt")
      .sort({ "recipient.name": 1 });

    const receipts = notifications.map((item) => ({
      userId: item.recipient?.userId,
      name: item.recipient?.name || "User",
      email: item.recipient?.email || "",
      role: item.recipient?.role || "USER",
      isRead: Boolean(item.isRead),
      readAt: item.readAt || null,
      sentAt: item.createdAt || null
    }));

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
          readCount: { $sum: { $cond: ["$isRead", 1, 0] } }
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
        readCount: group.readCount
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
      .select("recipient isRead readAt createdAt")
      .sort({ "recipient.name": 1 });

    const receipts = notifications.map((item) => ({
      userId: item.recipient?.userId,
      name: item.recipient?.name || "User",
      email: item.recipient?.email || "",
      role: item.recipient?.role || "USER",
      isRead: Boolean(item.isRead),
      readAt: item.readAt || null,
      sentAt: item.createdAt || null
    }));

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
