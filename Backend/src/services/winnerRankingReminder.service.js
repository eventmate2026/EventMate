import Event from "../models/Event.model.js";
import User from "../models/User.model.js";
import sendEmail from "../config/sendEmail.js";
import { getPrimaryFrontendUrl } from "../config/clientOrigins.js";
import { isEventWinnerRankingComplete } from "./certificate.service.js";
import { sendNotification } from "./notification.service.js";

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const normalizeStatus = (value = "") => String(value || "").trim().toLowerCase();

const winnerRankingReminderEmailTemplate = ({
  organizerName,
  eventName,
  manageEventUrl
}) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111827;">Hi ${organizerName},</h2>
    <p>Your completed event <strong>${eventName}</strong> still needs winner positions to be marked.</p>
    <p>Students cannot submit feedback until winner ranking is finished for this event.</p>
    <div style="margin: 24px 0;">
      <a href="${manageEventUrl}" style="
        display: inline-block;
        padding: 12px 22px;
        background-color: #4f46e5;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
      ">Open Winner Management</a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">
      Mark the final winner positions to unlock the feedback workflow for students.
    </p>
  </div>
`;

const ensureEventDocument = async (eventInput) => {
  if (!eventInput) return null;
  if (typeof eventInput === "string") {
    return Event.findById(eventInput).select("title status createdBy organizer feedback");
  }

  if (eventInput?._id) {
    return eventInput;
  }

  return null;
};

export const clearWinnerRankingReminder = async (eventId) => {
  if (!eventId) return;
  await Event.findByIdAndUpdate(eventId, {
    $set: { "feedback.winnerReminderSentAt": null }
  });
};

export const ensureWinnerRankingReadyForFeedback = async (eventInput) => {
  const event = await ensureEventDocument(eventInput);
  if (!event?._id) {
    return { rankingComplete: false, reminded: false };
  }

  if (normalizeStatus(event?.status) !== "completed") {
    return { rankingComplete: false, reminded: false };
  }

  const rankingComplete = await isEventWinnerRankingComplete(event._id);
  if (rankingComplete) {
    await clearWinnerRankingReminder(event._id);
    return { rankingComplete: true, reminded: false };
  }

  const claimedEvent = await Event.findOneAndUpdate(
    {
      _id: event._id,
      $or: [
        { "feedback.winnerReminderSentAt": { $exists: false } },
        { "feedback.winnerReminderSentAt": null }
      ]
    },
    {
      $set: { "feedback.winnerReminderSentAt": new Date() }
    },
    { new: true }
  );

  if (!claimedEvent) {
    return { rankingComplete: false, reminded: false };
  }

  const organizerUser = event.createdBy
    ? await User.findById(event.createdBy).select("fullName email")
    : null;
  const organizerId =
    event?.createdBy || event?.organizer?.organizerId || organizerUser?._id || null;
  const organizerName =
    String(event?.organizer?.name || organizerUser?.fullName || "Organizer").trim() ||
    "Organizer";
  const organizerEmail = normalizeEmail(
    event?.organizer?.contactEmail || organizerUser?.email
  );
  const eventName = String(event?.title || "your event").trim() || "your event";
  const manageEventUrl = `${getPrimaryFrontendUrl()}/organizer-dashboard/event/${encodeURIComponent(
    String(event._id)
  )}/view-list`;

  let emailSent = false;
  if (organizerEmail) {
    try {
      await sendEmail(
        organizerEmail,
        `Winner marking required for ${eventName}`,
        winnerRankingReminderEmailTemplate({
          organizerName,
          eventName,
          manageEventUrl
        })
      );
      emailSent = true;
    } catch (error) {
      console.error("Winner ranking reminder email error:", error.message);
    }
  }

  let notificationSent = false;
  if (organizerId) {
    const notification = await sendNotification({
      recipientId: organizerId,
      recipientName: organizerName,
      recipientRole: "ORGANIZER",
      recipientEmail: organizerEmail,
      title: "Winner Marking Required",
      message: `${eventName} is completed, but winner positions are still pending. Student feedback will unlock after you mark the winners.`,
      type: "WINNER",
      refId: event._id
    });
    notificationSent = Boolean(notification);
  }

  if (!emailSent && !notificationSent) {
    await clearWinnerRankingReminder(event._id);
  }

  return {
    rankingComplete: false,
    reminded: emailSent || notificationSent
  };
};
