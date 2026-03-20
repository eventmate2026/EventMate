import Notification from "../models/Notification.model.js";
import sendEmail from "../config/sendEmail.js";
import { getPrimaryFrontendUrl } from "../config/clientOrigins.js";

let io = null;

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
  emailSubject = "",
  emailHtml = ""
}) => {
  try {
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
      groupId: groupId || null
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
    if (io) {
      io.to(`user_${recipientId}`).emit("notification", {
        _id: notification._id,
        title,
        message,
        type,
        isRead: false,
        createdAt: notification.createdAt
      });
    }

    if (sendEmailCopy && recipientEmail) {
      try {
        const inboxUrl = buildNotificationInboxUrl(recipientRole);
        await sendEmail(
          recipientEmail,
          emailSubject || `EventMate Announcement: ${title}`,
          emailHtml ||
            buildNotificationEmailTemplate({
              recipientName,
              title,
              message,
              senderName,
              senderRole,
              inboxUrl
            })
        );
      } catch (emailError) {
        console.error(
          `Notification email failed for ${recipientEmail}: ${emailError?.message || "Unknown error"}`
        );
      }
    }

    return notification;
  } catch (error) {
    console.error("❌ Notification error:", error.message);
  }
};
