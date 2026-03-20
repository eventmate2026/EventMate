import Notification from "../models/Notification.model.js";
import sendEmail from "../config/sendEmail.js";
import { getPrimaryFrontendUrl } from "../config/clientOrigins.js";

let io = null;
let workerIntervalId = null;
let workerBusy = false;
let scheduledFlushId = null;

export const EMAIL_DELIVERY_STATUS = {
  NOT_REQUESTED: "NOT_REQUESTED",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED"
};

export const EMAIL_TRACKING_MODE = {
  PROVIDER_ACCEPTANCE: "PROVIDER_ACCEPTANCE",
  WEBHOOK_DELIVERY: "WEBHOOK_DELIVERY"
};

export const isNotificationEmailWorkerEnabled = () =>
  !["false", "0", "no"].includes(
    String(process.env.NOTIFICATION_EMAIL_WORKER_ENABLED || "")
      .trim()
      .toLowerCase()
  );

const NOTIFICATION_ROUTE_BY_ROLE = {
  MAIN_ADMIN: "/admin-dashboard/notifications",
  ORGANIZER: "/organizer-dashboard/notifications",
  STUDENT_COORDINATOR: "/coordinator-dashboard/notifications",
  STUDENT: "/student-dashboard/notifications"
};

const buildNotificationInboxUrl = (role) => {
  const baseUrl = String(getPrimaryFrontendUrl() || "").trim().replace(/\/+$/, "");
  const route =
    NOTIFICATION_ROUTE_BY_ROLE[String(role || "").trim().toUpperCase()] ||
    "/student-dashboard/notifications";

  return baseUrl ? `${baseUrl}${route}` : "";
};

const buildNotificationEmailTemplate = ({
  recipientName,
  title,
  message,
  senderName,
  senderRole,
  inboxUrl
}) => `
  <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8fafc;">
    <div style="background: #0f172a; border-radius: 18px 18px 0 0; padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px;">EventMate Announcement</h1>
    </div>
    <div style="background: #ffffff; border-radius: 0 0 18px 18px; padding: 28px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
      <p style="margin: 0 0 14px; color: #334155; font-size: 15px;">Hi <strong>${recipientName || "there"}</strong>,</p>
      <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 22px;">${title}</h2>
      <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.7; white-space: pre-line;">${message}</p>
      <div style="margin-top: 24px; padding: 16px; border-radius: 12px; background: #eef2ff; color: #3730a3; font-size: 14px;">
        Sent by: <strong>${senderName || "EventMate"}</strong>${senderRole ? ` (${senderRole})` : ""}
      </div>
      ${
        inboxUrl
          ? `<div style="margin-top: 28px;">
              <a href="${inboxUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #4f46e5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700;">
                Open Notifications
              </a>
            </div>`
          : ""
      }
      <p style="margin-top: 24px; color: #94a3b8; font-size: 12px;">
        This announcement is also available in your EventMate notifications inbox.
      </p>
    </div>
  </div>
`;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const normalizeEmailAttachments = (attachments = []) =>
  (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => ({
      filename: String(attachment?.filename || "").trim(),
      content: String(attachment?.content || "").trim(),
      type: String(attachment?.type || "").trim(),
      disposition: String(attachment?.disposition || "").trim(),
      contentId: String(attachment?.contentId || "").trim()
    }))
    .filter((attachment) => attachment.filename && attachment.content);

const resolveProviderMessageId = (response) =>
  String(
    response?.headers?.["x-message-id"] ||
      response?.headers?.["X-Message-Id"] ||
      response?.messageId ||
      ""
  ).trim();

export const getNotificationEmailTrackingMode = () => {
  const configured = String(process.env.EMAIL_DELIVERY_TRACKING_MODE || "")
    .trim()
    .toUpperCase();

  if (configured === EMAIL_TRACKING_MODE.WEBHOOK_DELIVERY) {
    return EMAIL_TRACKING_MODE.WEBHOOK_DELIVERY;
  }

  return EMAIL_TRACKING_MODE.PROVIDER_ACCEPTANCE;
};

export const buildNotificationEmailDeliveryState = ({
  sendEmailCopy = false,
  recipientEmail = ""
} = {}) => {
  const normalizedEmail = normalizeEmail(recipientEmail);
  const trackingMode = getNotificationEmailTrackingMode();

  if (!sendEmailCopy) {
    return {
      requested: false,
      trackingMode,
      status: EMAIL_DELIVERY_STATUS.NOT_REQUESTED,
      attempts: 0,
      queuedAt: null,
      lastAttemptAt: null,
      nextAttemptAt: null,
      acceptedAt: null,
      deliveredAt: null,
      lastError: ""
    };
  }

  const queuedAt = new Date();
  if (!normalizedEmail) {
    return {
      requested: true,
      trackingMode,
      status: EMAIL_DELIVERY_STATUS.SKIPPED,
      attempts: 0,
      queuedAt,
      lastAttemptAt: null,
      nextAttemptAt: null,
      acceptedAt: null,
      deliveredAt: null,
      lastError: "Recipient email missing."
    };
  }

  return {
    requested: true,
    trackingMode,
    status: EMAIL_DELIVERY_STATUS.PENDING,
    attempts: 0,
    queuedAt,
    lastAttemptAt: null,
    nextAttemptAt: queuedAt,
    acceptedAt: null,
    deliveredAt: null,
    lastError: ""
  };
};

const dispatchNotificationEmail = async (notification) => {
  const recipientEmail = normalizeEmail(notification?.recipient?.email);
  if (!recipientEmail) {
    throw new Error("Recipient email missing.");
  }

  const customSubject = String(notification?.emailPayload?.subject || "").trim();
  const customHtml = String(notification?.emailPayload?.html || "").trim();
  const customText = String(notification?.emailPayload?.text || "").trim();
  const customAttachments = normalizeEmailAttachments(notification?.emailPayload?.attachments);
  const inboxUrl = buildNotificationInboxUrl(notification?.recipient?.role);
  return sendEmail(
    recipientEmail,
    customSubject || `EventMate Announcement: ${notification?.title || "Notification"}`,
    customHtml ||
      buildNotificationEmailTemplate({
        recipientName: notification?.recipient?.name,
        title: notification?.title,
        message: notification?.message,
        senderName: notification?.sender?.name,
        senderRole: notification?.sender?.role,
        inboxUrl
      }),
    {
      text: customText,
      attachments: customAttachments,
      sendGridCustomArgs:
        notification?._id &&
        notification?.emailDelivery?.trackingMode === EMAIL_TRACKING_MODE.WEBHOOK_DELIVERY
          ? { notificationId: String(notification._id) }
          : undefined
    }
  );
};

const isRetryableEmailFailure = (error) => {
  if (String(error?.code || "").trim().toUpperCase() === "EEMAILALIGNMENT") {
    return false;
  }

  const text = String(error?.message || "")
    .trim()
    .toLowerCase();

  if (!text) return false;

  if (text.includes("dmarc alignment") || text.includes("cannot be used as a sendgrid from address")) {
    return false;
  }

  return [
    "421",
    "4.7.32",
    "rate limit",
    "rate limited",
    "temporarily unavailable",
    "temporary",
    "timeout",
    "timed out",
    "too many requests",
    "try again later",
    "connection reset",
    "econnreset",
    "etimedout",
    "ehostunreach",
    "econnrefused",
    "service unavailable"
  ].some((pattern) => text.includes(pattern));
};

const getRetryDelayMs = (attempts, error) => {
  const safeAttempts = Math.max(1, Number(attempts || 1));
  const retryable = isRetryableEmailFailure(error);
  if (!retryable) return null;

  const message = String(error?.message || "").toLowerCase();
  if (message.includes("4.7.32") || message.includes("dmarc") || message.includes("rate limited")) {
    const dmarcBackoffMinutes = [30, 60, 180, 360, 720];
    return (dmarcBackoffMinutes[Math.min(safeAttempts - 1, dmarcBackoffMinutes.length - 1)] || 720) * 60 * 1000;
  }

  const genericBackoffMinutes = [5, 15, 30, 60, 180];
  return (genericBackoffMinutes[Math.min(safeAttempts - 1, genericBackoffMinutes.length - 1)] || 180) * 60 * 1000;
};

export const processPendingNotificationEmails = async ({
  batchSize = 20,
  maxAttempts = 8
} = {}) => {
  if (workerBusy) return { processed: 0 };
  workerBusy = true;

  try {
    const candidates = await Notification.find({
      "emailDelivery.requested": true,
      "emailDelivery.status": {
        $in: [EMAIL_DELIVERY_STATUS.PENDING, EMAIL_DELIVERY_STATUS.FAILED]
      },
      "emailDelivery.attempts": { $lt: maxAttempts },
      $or: [
        { "emailDelivery.nextAttemptAt": null },
        { "emailDelivery.nextAttemptAt": { $lte: new Date() } }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(batchSize);

    let processed = 0;

    for (const candidate of candidates) {
      const claimed = await Notification.findOneAndUpdate(
        {
          _id: candidate._id,
          "emailDelivery.requested": true,
          "emailDelivery.status": {
            $in: [EMAIL_DELIVERY_STATUS.PENDING, EMAIL_DELIVERY_STATUS.FAILED]
          },
          "emailDelivery.attempts": { $lt: maxAttempts },
          $or: [
            { "emailDelivery.nextAttemptAt": null },
            { "emailDelivery.nextAttemptAt": { $lte: new Date() } }
          ]
        },
        {
          $set: {
            "emailDelivery.status": EMAIL_DELIVERY_STATUS.PROCESSING,
            "emailDelivery.lastAttemptAt": new Date(),
            "emailDelivery.nextAttemptAt": null
          },
          $inc: {
            "emailDelivery.attempts": 1
          }
        },
        { new: true }
      );

      if (!claimed) continue;

      try {
        const providerResponse = await dispatchNotificationEmail(claimed);
        await Notification.updateOne(
          { _id: claimed._id },
          {
            $set: {
              "emailDelivery.status": EMAIL_DELIVERY_STATUS.SENT,
              "emailDelivery.acceptedAt": new Date(),
              "emailDelivery.providerMessageId": resolveProviderMessageId(providerResponse),
              "emailDelivery.lastError": "",
              "emailDelivery.nextAttemptAt": null
            }
          }
        );
      } catch (emailError) {
        const attemptCount = Number(claimed?.emailDelivery?.attempts || 0);
        const nextRetryDelayMs = getRetryDelayMs(attemptCount, emailError);
        const nextAttemptAt =
          Number.isFinite(nextRetryDelayMs) && nextRetryDelayMs > 0
            ? new Date(Date.now() + nextRetryDelayMs)
            : null;

        await Notification.updateOne(
          { _id: claimed._id },
          {
            $set: {
              "emailDelivery.status": EMAIL_DELIVERY_STATUS.FAILED,
              "emailDelivery.lastError": String(emailError?.message || "Unknown error").slice(0, 500),
              "emailDelivery.nextAttemptAt": nextAttemptAt
            }
          }
        );
        console.error(
          `Notification email failed for ${claimed?.recipient?.email || "unknown-recipient"}: ${
            emailError?.message || "Unknown error"
          }`
        );
      }

      processed += 1;
    }

    return { processed };
  } finally {
    workerBusy = false;
  }
};

const schedulePendingNotificationEmailProcessing = (delayMs = 250) => {
  if (scheduledFlushId) return;

  scheduledFlushId = setTimeout(() => {
    scheduledFlushId = null;
    processPendingNotificationEmails().catch((error) => {
      console.error("Notification email worker flush error:", error?.message || error);
    });
  }, delayMs);

  if (typeof scheduledFlushId?.unref === "function") {
    scheduledFlushId.unref();
  }
};

export const startNotificationEmailWorker = ({
  intervalMs = 5000,
  batchSize = 20,
  maxAttempts = 8
} = {}) => {
  if (workerIntervalId) return workerIntervalId;

  workerIntervalId = setInterval(() => {
    processPendingNotificationEmails({ batchSize, maxAttempts }).catch((error) => {
      console.error("Notification email worker interval error:", error?.message || error);
    });
  }, intervalMs);

  if (typeof workerIntervalId?.unref === "function") {
    workerIntervalId.unref();
  }

  schedulePendingNotificationEmailProcessing(100);
  return workerIntervalId;
};

export const stopNotificationEmailWorker = () => {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
  }
  if (scheduledFlushId) {
    clearTimeout(scheduledFlushId);
    scheduledFlushId = null;
  }
};

// Called once from server.js to attach socket.io instance
export const initSocket = (socketIo) => {
  io = socketIo;
};

/* ================================================
   SEND NOTIFICATION
   Saves to DB + emits via socket if user is online
================================================ */

export const sendNotification = async ({
  recipientId,
  recipientName,
  recipientRole,
  recipientEmail,
  senderId,
  senderName,
  senderRole,
  title,
  message,
  type,
  refId = null,
  groupId = null,
  sendEmailCopy = false,
  emailPayload = null
}) => {
  try {
    const normalizedEmailPayload =
      emailPayload && typeof emailPayload === "object"
        ? {
            subject: String(emailPayload.subject || "").trim(),
            html: String(emailPayload.html || "").trim(),
            text: String(emailPayload.text || "").trim(),
            attachments: normalizeEmailAttachments(emailPayload.attachments)
          }
        : null;

    const payload = {
      recipient: {
        userId: recipientId,
        name: recipientName,
        role: recipientRole,
        email: recipientEmail || ""
      },
      title,
      message,
      type,
      refId,
      groupId: groupId || null,
      emailDelivery: buildNotificationEmailDeliveryState({
        sendEmailCopy,
        recipientEmail
      }),
      emailPayload: normalizedEmailPayload || undefined
    };

    if (senderId) {
      payload.sender = {
        userId: senderId,
        name: senderName || "User",
        role: senderRole || "USER"
      };
    }

    // Save to DB — works for offline users too
    const notification = await Notification.create(payload);

    // Emit to socket if user is online
    if (io && recipientId) {
      io.to(`user_${recipientId}`).emit("notification", {
        _id: notification._id,
        title,
        message,
        type,
        isRead: false,
        createdAt: notification.createdAt
      });
    }

    if (notification?.emailDelivery?.status === EMAIL_DELIVERY_STATUS.PENDING) {
      schedulePendingNotificationEmailProcessing();
    }

    return notification;
  } catch (error) {
    console.error("❌ Notification error:", error.message);
  }
};
