import Notification from "../models/Notification.model.js";

let io = null;

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
  groupId = null
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

    // Save to DB so offline users still receive notifications
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

    return notification;
  } catch (error) {
    console.error("Notification error:", error.message);
  }
};
