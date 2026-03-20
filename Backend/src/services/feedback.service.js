import Event from "../models/Event.model.js";
import EventRegistration from "../models/EventRegistration.model.js";
import ParticipantQR from "../models/ParticipantQR.model.js";
import Feedback from "../models/Feedback.model.js";
import { generateCertificatesForRegistration } from "./certificate.service.js";
import { sendNotification } from "./notification.service.js";

/* ================================================
   SUBMIT FEEDBACK
================================================ */

export const submitFeedback = async (eventId, userId, payload) => {
  const { rating, comment } = payload;

  if (!rating || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const event = await Event.findById(eventId);
  if (!event) throw new Error("Event not found");

  if (event.status !== "Completed") {
    throw new Error("Feedback can only be submitted after event is completed");
  }

  const registration = await EventRegistration.findOne({
    event: eventId,
    registeredBy: userId,
    status: "Confirmed"
  });

  if (!registration) {
    throw new Error("No confirmed registration found for this event");
  }

  if (event.isTeamEvent) {
    if (registration.registeredBy.toString() !== userId.toString()) {
      throw new Error("Only the team leader can submit feedback");
    }
  }

  const leaderQR = await ParticipantQR.findOne({
    registration: registration._id,
    email: registration.teamLeader.email
  });

  if (!leaderQR || !leaderQR.attendanceMarked) {
    throw new Error("Only participants who attended can submit feedback");
  }

  const existing = await Feedback.findOne({
    event: eventId,
    registration: registration._id
  });

  if (existing) {
    throw new Error("Feedback already submitted for this event");
  }

  const feedback = await Feedback.create({
    event: eventId,
    eventName: event.title,
    registration: registration._id,
    participantName: registration.teamLeader.name,
    participantEmail: registration.teamLeader.email,
    submittedBy: userId,
    rating,
    comment: comment || null
  });

  await sendNotification({
    recipientId: event.createdBy,
    recipientName: event.organizer.name,
    recipientRole: "ORGANIZER",
    title: "New Feedback Received",
    message: `${registration.teamLeader.name} submitted feedback for ${event.title} - ${rating}/5`,
    type: "FEEDBACK",
    refId: event._id
  });

  for (const coordinator of event.studentCoordinators || []) {
    if (!coordinator?.coordinatorId) continue;
    await sendNotification({
      recipientId: coordinator.coordinatorId,
      recipientName: coordinator.name || "Coordinator",
      recipientRole: "STUDENT_COORDINATOR",
      title: "New Feedback Received",
      message: `${registration.teamLeader.name} submitted feedback for ${event.title}`,
      type: "FEEDBACK",
      refId: event._id
    });
  }

  const certificateEnabled = Boolean(event?.certificate?.isEnabled);
  const certificatePendingReason =
    !certificateEnabled
      ? "template-missing"
      : registration?.winner?.isWinner && !registration?.winner?.position
        ? "winner-ranking-pending"
        : null;
  const certificateReady = certificatePendingReason === null;

  if (certificateReady) {
    generateCertificatesForRegistration(registration, event).catch((err) =>
      console.error("Certificate generation error:", err.message)
    );
  }

  return {
    feedback,
    certificateEnabled,
    certificateReady,
    certificatePendingReason
  };
};

/* ================================================
   GET FEEDBACK FOR EVENT
================================================ */

export const getEventFeedback = async (eventId, requester) => {
  const event = await Event.findById(eventId);
  if (!event) throw new Error("Event not found");

  const isAdmin = requester.role === "MAIN_ADMIN";
  const isOrganizer = event.createdBy.toString() === requester._id.toString();
  const isAssignedCoordinator = event.studentCoordinators.some(
    (coordinator) =>
      coordinator.coordinatorId?.toString() === requester._id.toString()
  );

  if (!isAdmin && !isOrganizer && !isAssignedCoordinator) {
    throw new Error("Not authorized to view feedback for this event");
  }

  const feedbacks = await Feedback.find({ event: eventId }).sort({ createdAt: -1 });
  const avgRating =
    feedbacks.reduce((sum, row) => sum + row.rating, 0) / feedbacks.length || 0;

  return {
    totalFeedbacks: feedbacks.length,
    averageRating: Math.round(avgRating * 10) / 10,
    feedbacks
  };
};
