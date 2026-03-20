import crypto from "crypto";
import Event from "../models/Event.model.js";
import EventRegistration from "../models/EventRegistration.model.js";
import MemberVerification from "../models/MemberVerification.model.js";
import TeamInvitation from "../models/TeamInvitation.model.js";
import ParticipantQR from "../models/ParticipantQR.model.js";
import User from "../models/User.model.js";
import Feedback from "../models/Feedback.model.js";
import Certificate from "../models/Certificate.model.js";
import sendEmail from "../config/sendEmail.js";
import { getPrimaryFrontendUrl } from "../config/clientOrigins.js";
import { buildEventEndDateTime, buildEventStartDateTime } from "../utils/eventTime.js";
import uploadImageCloudinary from "../utils/uploadImageCloudinary.js";
import { generateQRsForRegistration } from "./qr.service.js";
import { sendNotification } from "./notification.service.js";
import { generateCertificatesForRegistration } from "./certificate.service.js";

const notifyAssignedCoordinators = async (event, payloadBuilder) => {
  const coordinators = event?.studentCoordinators || [];
  for (const coordinator of coordinators) {
    if (!coordinator?.coordinatorId) continue;
    const payload = payloadBuilder(coordinator);
    await sendNotification({
      recipientId: coordinator.coordinatorId,
      recipientName: coordinator.name || "Coordinator",
      recipientRole: "STUDENT_COORDINATOR",
      ...payload
    });
  }
};

const refreshEventAttendanceTotal = async (eventId) => {
  if (!eventId) return;
  const totalPresent = await ParticipantQR.countDocuments({
    eventId,
    attendanceMarked: true
  });
  await Event.findByIdAndUpdate(eventId, {
    $set: { "attendance.totalPresent": totalPresent }
  });
};

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const normalizeDepartment = (value = "") => String(value || "").trim().toLowerCase();
const normalizeId = (value = "") => String(value || "").trim();
const isMidnightUtc = (date) =>
  date.getUTCHours() === 0 &&
  date.getUTCMinutes() === 0 &&
  date.getUTCSeconds() === 0 &&
  date.getUTCMilliseconds() === 0;
const resolveRegistrationDeadline = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (isMidnightUtc(parsed)) {
    return new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
      23,
      59,
      59,
      999
    );
  }
  return parsed;
};
const isEventOver = (event) => {
  const status = String(event?.status || "").trim().toLowerCase();
  if (status === "completed" || status === "cancelled" || status === "canceled") return true;
  const endDateTime = buildEventEndDateTime(
    event?.schedule?.endDate || event?.schedule?.startDate,
    event?.schedule?.endTime
  );
  if (!endDateTime) return false;
  return Date.now() > endDateTime.getTime();
};

const formatEventDate = (event) => {
  const dateValue = event?.schedule?.startDate || event?.schedule?.endDate || null;
  if (!dateValue) return "TBA";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "TBA";
  return parsed.toDateString();
};

const eventRequiresPayment = (event) => Number(event?.registration?.fee || 0) > 0;

const getEventPaymentConfig = (event) => ({
  method:
    String(event?.registration?.paymentConfig?.method || "").trim().toUpperCase() === "PHONEPE_QR"
      ? "PHONEPE_QR"
      : "FREE",
  accountName: String(event?.registration?.paymentConfig?.accountName || "").trim(),
  upiId: String(event?.registration?.paymentConfig?.upiId || "").trim(),
  qrImageUrl: String(event?.registration?.paymentConfig?.qrImageUrl || "").trim(),
  instructions: String(event?.registration?.paymentConfig?.instructions || "").trim()
});

const ensureEventPaymentConfigured = (event) => {
  if (!eventRequiresPayment(event)) return;
  const config = getEventPaymentConfig(event);
  if (!config.accountName || (!config.upiId && !config.qrImageUrl)) {
    throw new Error("Organizer has not configured payment details for this paid event yet");
  }
};

const applyEventPaymentDefaults = (registration, event) => {
  registration.payment = registration.payment || {};
  registration.payment.amount = Number(event?.registration?.fee || 0);

  if (!eventRequiresPayment(event)) {
    registration.payment.method = "FREE";
    registration.payment.paymentStatus = "NotRequired";
    registration.payment.rejectionReason = "";
    return;
  }

  const config = getEventPaymentConfig(event);
  registration.payment.method = config.method === "PHONEPE_QR" ? "PHONEPE_QR" : "PHONEPE_QR";
  if (
    !registration.payment.paymentStatus ||
    registration.payment.paymentStatus === "NotRequired"
  ) {
    registration.payment.paymentStatus = "Pending";
  }
};

const canReviewPaymentForEvent = (event, requester) => {
  const requesterId = normalizeId(requester?._id);
  const requesterRole = String(requester?.role || "").trim().toUpperCase();
  if (!requesterId) return false;
  if (requesterRole === "MAIN_ADMIN") return true;
  return normalizeId(event?.createdBy) === requesterId;
};

const isRegistrationViewer = (registration, requesterId, requesterEmail) => {
  const normalizedRequesterId = normalizeId(requesterId);
  const normalizedRequesterEmail = normalizeEmail(requesterEmail);
  if (!registration) return false;

  if (normalizedRequesterId && normalizeId(registration?.registeredBy) === normalizedRequesterId) {
    return true;
  }

  if (!normalizedRequesterEmail) return false;
  if (normalizeEmail(registration?.teamLeader?.email) === normalizedRequesterEmail) return true;

  return Array.isArray(registration?.teamMembers)
    ? registration.teamMembers.some(
        (member) => normalizeEmail(member?.email) === normalizedRequesterEmail
      )
    : false;
};

const finalizeRegistrationConfirmation = async (registration, event, verifiedBy = null) => {
  applyEventPaymentDefaults(registration, event);
  registration.status = "Confirmed";
  registration.allMembersVerified = true;

  if (eventRequiresPayment(event)) {
    registration.payment.paymentStatus = "Verified";
    registration.payment.rejectionReason = "";
    registration.payment.verifiedBy = verifiedBy || registration.payment.verifiedBy || null;
    registration.payment.verifiedAt = registration.payment.verifiedAt || new Date();
  } else {
    registration.payment.verifiedBy = null;
    registration.payment.verifiedAt = null;
  }

  await registration.save();
  await generateQRsForRegistration(registration, event);
  return registration;
};

const moveRegistrationToPendingPayment = async (
  registration,
  event,
  { paymentStatus = "Pending", rejectionReason = "" } = {}
) => {
  ensureEventPaymentConfigured(event);
  applyEventPaymentDefaults(registration, event);
  registration.status = "PendingPayment";
  registration.allMembersVerified = true;
  registration.payment.paymentStatus = paymentStatus;
  registration.payment.rejectionReason = String(rejectionReason || "").trim();
  registration.payment.verifiedBy = null;
  registration.payment.verifiedAt = null;
  await registration.save();
  return registration;
};

const advanceRegistrationAfterAcceptance = async (registration, event) => {
  if (eventRequiresPayment(event)) {
    await moveRegistrationToPendingPayment(registration, event);
    return {
      status: registration.status,
      message:
        "All team members accepted. Complete payment to receive the event QR pass."
    };
  }

  await finalizeRegistrationConfirmation(registration, event);
  return {
    status: registration.status,
    message: "Registration confirmed. QR codes have been sent."
  };
};

const ensureAttendanceWindowOpen = (event) => {
  const eventStartDateTime = buildEventStartDateTime(
    event?.schedule?.startDate,
    event?.schedule?.startTime
  );
  const eventEndDateTime = buildEventEndDateTime(
    event?.schedule?.endDate || event?.schedule?.startDate,
    event?.schedule?.endTime
  );

  if (!eventStartDateTime || !eventEndDateTime) {
    throw new Error("Event schedule is incomplete for attendance marking");
  }

  const now = Date.now();
  if (now < eventStartDateTime.getTime() || now > eventEndDateTime.getTime()) {
    throw new Error("Attendance can only be marked between the event start and end time");
  }
};

const canManageAttendanceForEvent = (event, requester) => {
  const requesterId = normalizeId(requester?._id);
  if (!requesterId) return false;

  const isOrganizer = normalizeId(event?.createdBy) === requesterId;
  const isAssignedCoordinator = Array.isArray(event?.studentCoordinators)
    ? event.studentCoordinators.some(
        (coordinator) => normalizeId(coordinator?.coordinatorId) === requesterId
      )
    : false;

  return isOrganizer || isAssignedCoordinator;
};

const resolveParticipantMetaFromRegistration = (registration, email, fallbackName = "") => {
  const participantEmail = normalizeEmail(email);
  const participants = [
    registration?.teamLeader,
    ...(Array.isArray(registration?.teamMembers) ? registration.teamMembers : [])
  ].filter(Boolean);

  const match = participants.find(
    (participant) => normalizeEmail(participant?.email) === participantEmail
  );

  return {
    participantName:
      String(match?.name || fallbackName || "Participant").trim() || "Participant",
    participantEmail,
    participantDepartment: String(match?.branch || match?.department || "").trim(),
    participantCollege: String(match?.college || "").trim(),
    participantYear: String(match?.year || "").trim()
  };
};

const loadAttendanceContext = async (token) => {
  const qr = await ParticipantQR.findOne({ token });
  if (!qr) throw new Error("Invalid QR code");

  const event = await Event.findById(qr.eventId);
  if (!event) throw new Error("Event not found");

  const registration = await EventRegistration.findById(qr.registration);

  return { qr, event, registration };
};

const buildTeamInviteLink = (token, action) => {
  const baseUrl = getPrimaryFrontendUrl();
  return `${baseUrl}/team-invite?token=${token}&action=${action}`;
};

const formatTeamRoleLabel = (role) =>
  String(role || "").trim().toLowerCase() === "leader" ? "Team Leader" : "Team Member";

const buildTeamParticipants = (registration) => {
  const participants = [];
  const leaderEmail = normalizeEmail(registration?.teamLeader?.email);
  const leaderName = String(registration?.teamLeader?.name || "").trim();

  if (leaderEmail) {
    participants.push({
      name: leaderName || "Team Leader",
      email: leaderEmail,
      role: "leader"
    });
  }

  const teamMembers = Array.isArray(registration?.teamMembers) ? registration.teamMembers : [];
  teamMembers.forEach((member) => {
    const email = normalizeEmail(member?.email);
    if (!email) return;
    participants.push({
      name: member?.name || "Member",
      email,
      role: "member"
    });
  });

  const uniqueParticipants = new Map();
  for (const participant of participants) {
    const existing = uniqueParticipants.get(participant.email);
    if (!existing || (participant.role === "leader" && existing.role !== "leader")) {
      uniqueParticipants.set(participant.email, participant);
    }
  }

  return Array.from(uniqueParticipants.values());
};

const teamInviteEmailTemplate = ({
  recipientName,
  eventName,
  teamName,
  leaderName,
  roleLabel,
  acceptLink,
  rejectLink
}) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111827;">Hi ${recipientName},</h2>
    <p>You have been invited to join a team for the event <strong>${eventName}</strong>.</p>
    <p><strong>Team:</strong> ${teamName || "Team"}<br/>
       <strong>Team Leader:</strong> ${leaderName || "Team Leader"}<br/>
       <strong>Your Role:</strong> ${roleLabel || "Team Member"}</p>
    <p>Please accept or reject the invitation:</p>
    <div style="margin: 24px 0;">
      <a href="${acceptLink}" style="
        display: inline-block;
        padding: 12px 22px;
        background-color: #16a34a;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
        margin-right: 12px;
      ">Accept</a>
      <a href="${rejectLink}" style="
        display: inline-block;
        padding: 12px 22px;
        background-color: #dc2626;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
      ">Reject</a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">
      This invitation was sent to ${recipientName} (${eventName}). If this was a mistake, you can safely ignore this email.
    </p>
  </div>
`;

const teamSignupEmailTemplate = ({
  recipientName,
  eventName,
  teamName,
  leaderName,
  roleLabel,
  signupLink,
  loginLink
}) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111827;">Hi ${recipientName},</h2>
    <p>You have been listed as a team member for the event <strong>${eventName}</strong>.</p>
    <p><strong>Team:</strong> ${teamName || "Team"}<br/>
       <strong>Team Leader:</strong> ${leaderName || "Team Leader"}<br/>
       <strong>Your Role:</strong> ${roleLabel || "Team Member"}</p>
    <p>
      Please sign up (or log in) with this email address to receive your invitation link and respond.
    </p>
    <div style="margin: 24px 0;">
      <a href="${signupLink}" style="
        display: inline-block;
        padding: 12px 22px;
        background-color: #4f46e5;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
      ">Create Account</a>
      <a href="${loginLink}" style="
        display: inline-block;
        padding: 12px 22px;
        background-color: #0f172a;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        font-weight: bold;
        margin-left: 10px;
      ">Log In</a>
    </div>
    <p style="color: #6b7280; font-size: 13px;">
      After you log in, you will receive the accept or reject invitation email.
    </p>
  </div>
`;

const teamLeaderPendingEmailTemplate = ({
  recipientName,
  eventName,
  teamName,
  memberCount
}) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111827;">Hi ${recipientName},</h2>
    <p>Your team registration for <strong>${eventName}</strong> has been created.</p>
    <p><strong>Team:</strong> ${teamName || "Team"}<br/>
       <strong>Members:</strong> ${memberCount}</p>
    <p>We are waiting for your team members to accept their invitations.</p>
    <p style="color: #6b7280; font-size: 13px;">
      Once all members accept, registration will be confirmed and everyone will receive a confirmation email.
    </p>
  </div>
`;

const sendTeamInvitationEmail = async ({ invite, event, registration }) => {
  const email = normalizeEmail(invite?.email);
  if (!email) return;
  if (String(invite?.role || "").trim().toLowerCase() === "leader") return;
  const displayName = String(invite?.name || "Participant").trim() || "Participant";
  const eventName = String(event?.title || "Event").trim() || "Event";
  const teamName = String(registration?.teamName || "").trim();
  const leaderName = String(registration?.teamLeader?.name || "").trim();
  const roleLabel = formatTeamRoleLabel(invite?.role);
  const acceptLink = buildTeamInviteLink(invite.token, "accept");
  const rejectLink = buildTeamInviteLink(invite.token, "reject");

  await sendEmail(
    email,
    `Team Invitation - ${eventName}`,
    teamInviteEmailTemplate({
      recipientName: displayName,
      eventName,
      teamName,
      leaderName,
      roleLabel,
      acceptLink,
      rejectLink
    })
  );
};

const sendTeamLeaderPendingEmail = async ({ registration, event }) => {
  const email = normalizeEmail(registration?.teamLeader?.email);
  if (!email) return;
  const displayName = String(registration?.teamLeader?.name || "Team Leader").trim() || "Team Leader";
  const eventName = String(event?.title || "Event").trim() || "Event";
  const teamName = String(registration?.teamName || "").trim();
  const memberCount = Array.isArray(registration?.teamMembers) ? registration.teamMembers.length : 0;

  await sendEmail(
    email,
    `Team Registration Started - ${eventName}`,
    teamLeaderPendingEmailTemplate({
      recipientName: displayName,
      eventName,
      teamName,
      memberCount
    })
  );
};

const sendTeamSignupEmail = async ({ invite, event, registration }) => {
  const email = normalizeEmail(invite?.email);
  if (!email) return;
  const baseUrl = getPrimaryFrontendUrl();
  const signupLink = `${baseUrl}/signup?email=${encodeURIComponent(email)}`;
  const loginLink = `${baseUrl}/login?email=${encodeURIComponent(email)}`;
  const displayName = String(invite?.name || "Participant").trim() || "Participant";
  const eventName = String(event?.title || "Event").trim() || "Event";
  const teamName = String(registration?.teamName || "").trim();
  const leaderName = String(registration?.teamLeader?.name || "").trim();
  const roleLabel = formatTeamRoleLabel(invite?.role);

  await sendEmail(
    email,
    `Complete Signup to Join ${eventName}`,
    teamSignupEmailTemplate({
      recipientName: displayName,
      eventName,
      teamName,
      leaderName,
      roleLabel,
      signupLink,
      loginLink
    })
  );
};

const createTeamInvitations = async (registration, event, { sendNotifications = true } = {}) => {
  const participants = buildTeamParticipants(registration);
  if (!participants.length) return [];

  const participantEmails = participants.map((participant) => participant.email);
  const existingInvites = await TeamInvitation.find({
    registration: registration._id,
    email: { $in: participantEmails }
  });
  const inviteByEmail = new Map(
    existingInvites.map((invite) => [normalizeEmail(invite?.email), invite])
  );

  const existingUsers = await User.find({ email: { $in: participantEmails } }).select(
    "_id email lastLoginAt"
  );
  const userByEmail = new Map(
    existingUsers.map((user) => [normalizeEmail(user?.email), user])
  );

  const registeredByUser = registration?.registeredBy
    ? await User.findById(registration.registeredBy).select("_id email lastLoginAt")
    : null;
  const registeredByEmail = normalizeEmail(registeredByUser?.email);

  const inviteDocs = [];
  const updatedInvites = [];

  for (const participant of participants) {
    const existingInvite = inviteByEmail.get(participant.email);
    const existingUser = userByEmail.get(participant.email);
    const isLeader = participant.role === "leader";
    const leaderSignedIn =
      isLeader || (registeredByEmail && participant.email === registeredByEmail);
    const hasSignedIn = leaderSignedIn || Boolean(existingUser?.lastLoginAt);
    const userId = existingUser?._id || (leaderSignedIn ? registeredByUser?._id : null);

    if (existingInvite) {
      const updates = {};
      if (isLeader && existingInvite.role !== "leader") {
        updates.role = "leader";
      }
      if (isLeader && existingInvite.status !== "ACCEPTED") {
        updates.status = "ACCEPTED";
        updates.respondedAt = existingInvite.respondedAt || new Date();
        updates.inviteSentAt = null;
        if (userId) updates.user = userId;
      } else if (!isLeader && leaderSignedIn && existingInvite.status === "AWAITING_SIGNUP") {
        updates.status = "PENDING";
        updates.inviteSentAt = new Date();
        if (userId) updates.user = userId;
      }

      if (Object.keys(updates).length) {
        await TeamInvitation.updateOne({ _id: existingInvite._id }, { $set: updates });
        updatedInvites.push({ ...existingInvite.toObject(), ...updates });
      }
      continue;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const status = isLeader ? "ACCEPTED" : hasSignedIn ? "PENDING" : "AWAITING_SIGNUP";
    inviteDocs.push({
      registration: registration._id,
      email: participant.email,
      name: participant.name,
      role: participant.role,
      token,
      status,
      user: userId,
      inviteSentAt: status === "PENDING" ? new Date() : null,
      respondedAt: status === "ACCEPTED" ? new Date() : null
    });
  }

  const createdInvites = inviteDocs.length ? await TeamInvitation.insertMany(inviteDocs) : [];

  if (sendNotifications) {
    for (const invite of [...createdInvites, ...updatedInvites]) {
      try {
        if (invite.status === "PENDING") {
          await sendTeamInvitationEmail({ invite, event, registration });
        } else if (invite.status === "AWAITING_SIGNUP") {
          await sendTeamSignupEmail({ invite, event, registration });
        }
      } catch (error) {
        console.error("Team invitation email error:", error.message);
      }
    }
  }

  return createdInvites;
};

/* ================================================
   INITIATE REGISTRATION
================================================ */

export const initiateRegistration = async (eventId, userId, payload) => {
  const { teamName, teamLeader, teamMembers = [] } = payload;
  const normalizedTeamMembers = Array.isArray(teamMembers) ? teamMembers : [];

  const event = await Event.findById(eventId);
  if (!event) throw new Error("Event not found");

  const isTeam = Boolean(event?.isTeamEvent);
  const visibilityScope = String(event?.visibility?.scope || "COLLEGE").toUpperCase();
  const requester = await User.findById(userId);
  if (!requester) throw new Error("User not found");
  const requesterEmail = normalizeEmail(requester?.email);
  if (!requesterEmail) throw new Error("Your account email is required to register");

  if (isTeam && String(requester?.role || "").toUpperCase() === "STUDENT_COORDINATOR") {
    throw new Error("Coordinators cannot participate in team events");
  }
  if (visibilityScope === "DEPARTMENT") {
    const userDepartment = String(
      requester?.academicProfile?.branch || requester?.professionalProfile?.department || ""
    ).trim();
    const eventDepartment = String(event?.visibility?.department || "").trim();
    const normalizedEventDepartment = normalizeDepartment(eventDepartment);
    if (
      !userDepartment ||
      !eventDepartment ||
      userDepartment.toLowerCase() !== eventDepartment.toLowerCase()
    ) {
      throw new Error("This event is restricted to a specific department");
    }

    if (isTeam && normalizedEventDepartment) {
      const leaderDepartment = normalizeDepartment(teamLeader?.branch || teamLeader?.department);
      if (!leaderDepartment || leaderDepartment !== normalizedEventDepartment) {
        throw new Error("Team leader must belong to the event department");
      }

      for (const member of normalizedTeamMembers) {
        const memberDepartment = normalizeDepartment(member?.branch || member?.department);
        if (!memberDepartment || memberDepartment !== normalizedEventDepartment) {
          throw new Error("All team members must belong to the event department");
        }
      }
    }
  }

  const assignedCoordinators = Array.isArray(event?.studentCoordinators) ? event.studentCoordinators : [];
  const normalizedUserId = String(userId || "").trim();
  const isAssignedCoordinator = assignedCoordinators.some(
    (coordinator) => coordinator?.coordinatorId?.toString() === normalizedUserId
  );
  if (isAssignedCoordinator) {
    throw new Error("Coordinators cannot register for their own event");
  }

  const coordinatorEmails = new Set(
    assignedCoordinators.map((coordinator) => normalizeEmail(coordinator?.email)).filter(Boolean)
  );
  const leaderEmail = normalizeEmail(teamLeader?.email);
  if (leaderEmail && leaderEmail !== requesterEmail) {
    throw new Error("Please use your account email for registration");
  }
  const effectiveLeaderEmail = requesterEmail;
  const memberEmails = normalizedTeamMembers.map((member) => normalizeEmail(member?.email)).filter(Boolean);
  const participantEmails = [effectiveLeaderEmail, ...memberEmails].filter(Boolean);
  if (effectiveLeaderEmail && coordinatorEmails.has(effectiveLeaderEmail)) {
    throw new Error("Coordinators cannot register for their own event");
  }

  if (normalizedTeamMembers.length > 0) {
    const memberIsCoordinator = normalizedTeamMembers.some((member) => {
      const memberEmail = normalizeEmail(member?.email);
      return memberEmail && coordinatorEmails.has(memberEmail);
    });
    if (memberIsCoordinator) {
      throw new Error("Coordinators cannot participate in their own event");
    }
  }

  if (isTeam && participantEmails.length > 0) {
    const restrictedUsers = await User.find({
      role: { $in: ["STUDENT_COORDINATOR", "ORGANIZER", "MAIN_ADMIN"] },
      email: { $in: participantEmails }
    }).select("email role");

    if (restrictedUsers.length > 0) {
      throw new Error("Admin, organizer, or coordinator accounts cannot be added as team participants");
    }
  }

  if (event.status !== "Published")
    throw new Error("Event is not open for registration");

  if (!event.registration?.isOpen)
    throw new Error("Registration is closed");

  const registrationDeadline = resolveRegistrationDeadline(event.registration?.lastDate);
  if (registrationDeadline && Date.now() > registrationDeadline.getTime())
    throw new Error("Registration deadline has passed");

  const activeRegistrations = await EventRegistration.find({
    event: eventId,
    status: {
      $in: [
        "PendingMemberVerification",
        "PendingPayment",
        "PendingPaymentVerification",
        "Confirmed"
      ]
    }
  });

  const totalOccupied = activeRegistrations.reduce(
    (sum, reg) => sum + reg.totalParticipants,
    0
  );

  const incomingCount = 1 + normalizedTeamMembers.length;

  if (totalOccupied + incomingCount > event.registration.maxParticipants)
    throw new Error("Event is full");

  const existing = await EventRegistration.findOne({
    event: eventId,
    registeredBy: userId,
    status: {
      $in: [
        "PendingMemberVerification",
        "PendingPayment",
        "PendingPaymentVerification",
        "Confirmed"
      ]
    }
  });

  if (existing)
    throw new Error("You already have an active registration for this event");

  let initialStatus;
  if (!isTeam) {
    initialStatus = "Confirmed";
  } else {
    initialStatus = "PendingMemberVerification";
  }

  const sanitizedTeamLeader = {
    ...(teamLeader || {}),
    email: requester.email,
    emailVerified: isTeam ? true : Boolean(teamLeader?.emailVerified)
  };
  const sanitizedTeamMembers = isTeam
    ? normalizedTeamMembers.map((member) => ({ ...(member || {}), emailVerified: false }))
    : [];

  const registration = await EventRegistration.create({
    event: eventId,
    teamName: isTeam ? teamName : null,
    teamLeader: sanitizedTeamLeader,
    teamMembers: sanitizedTeamMembers,
    registeredBy: userId,
    status: initialStatus,
    allMembersVerified: !isTeam
  });

  if (!isTeam && initialStatus === "Confirmed") {
    await generateQRsForRegistration(registration, event);
  }
  
  // Notify student
await sendNotification({
  recipientId: userId,
  recipientName: registration.teamLeader.name,
  recipientRole: "STUDENT",
  title: isTeam ? "Team Registration Started" : "Registration Confirmed!",
  message: isTeam
    ? `Team registration for ${event.title} is pending member acceptance.`
    : `You're registered for ${event.title}`,
  type: "REGISTRATION",
  refId: registration._id
});

// Notify organizer
await sendNotification({
  recipientId: event.createdBy,
  recipientName: event.organizer.name,
  recipientRole: "ORGANIZER",
  title: "New Registration",
  message: `${registration.teamLeader.name} registered for ${event.title}`,
  type: "REGISTRATION",
  refId: registration._id
});

await notifyAssignedCoordinators(event, () => ({
  title: "New Registration",
  message: `${registration.teamLeader.name} registered for ${event.title}`,
  type: "REGISTRATION",
  refId: registration._id
}));

  if (isTeam) {
    await createTeamInvitations(registration, event);
    try {
      await sendTeamLeaderPendingEmail({ registration, event });
    } catch (error) {
      console.error("Team leader pending email error:", error.message);
    }
  }

  return registration;
};

/* ================================================
   VERIFY MEMBER EMAIL
================================================ */

export const verifyMember = async (token) => {
  const verification = await MemberVerification.findOne({ token });

  if (!verification) throw new Error("Invalid verification link");
  const alreadyVerified = Boolean(verification.verified);
  if (!alreadyVerified && verification.expiresAt < new Date())
    throw new Error("Verification link has expired");

  if (!alreadyVerified) {
    verification.verified = true;
    await verification.save();
  }

  const registration = await EventRegistration.findById(verification.registration);

  if (!registration) throw new Error("Registration not found");

  if (registration.status === "Cancelled" || registration.status === "Rejected")
    throw new Error("This registration is no longer active");

  const member = registration.teamMembers.find(
    (m) => m.email === verification.email
  );

  if (member) {
    member.emailVerified = true;
  } else if (
    normalizeEmail(registration?.teamLeader?.email) === normalizeEmail(verification.email)
  ) {
    registration.teamLeader.emailVerified = true;
  } else {
    throw new Error("Member not found in this registration");
  }

  const allVerified =
    Boolean(registration.teamLeader?.emailVerified) &&
    registration.teamMembers.every((m) => m.emailVerified === true);

  if (allVerified) {
    registration.allMembersVerified = true;
    const event = await Event.findById(registration.event);
    if (!event) throw new Error("Event not found");
    registration.status = "Confirmed";
    await registration.save();
    await generateQRsForRegistration(registration, event);
  } else {
    await registration.save();
  }

  return {
    message: allVerified
      ? "Email verified! Registration confirmed. Check your email for your QR code."
      : "Email verified successfully. Waiting for other members to verify."
  };
};

/* ================================================
   TEAM INVITATION STATUS
   Team leader views invitation progress
================================================ */

export const getTeamRegistrationStatus = async (registrationId, requesterId) => {
  const registration = await EventRegistration.findById(registrationId).populate(
    "event",
    "title schedule venue status isTeamEvent"
  );

  if (!registration) throw new Error("Registration not found");
  if (registration.registeredBy.toString() !== requesterId.toString())
    throw new Error("Not authorized to view this registration");

  const event = registration.event;
  if (!event?.isTeamEvent) throw new Error("This registration is not a team registration");

  const invites = await TeamInvitation.find({ registration: registration._id }).sort({ createdAt: 1 });
  const inviteByEmail = new Map(
    invites.map((invite) => [normalizeEmail(invite?.email), invite])
  );

  const members = buildTeamParticipants(registration).map((member) => {
    const email = normalizeEmail(member?.email);
    const invite = inviteByEmail.get(email);
    const isLeader = member?.role === "leader";
    const inviteStatus = String(invite?.status || "PENDING").trim();
    return {
      name: String(member?.name || "Member").trim() || "Member",
      email: String(member?.email || "").trim(),
      role: member?.role || "member",
      status: isLeader ? "ACCEPTED" : inviteStatus,
      invitedAt: invite?.inviteSentAt || null,
      respondedAt: invite?.respondedAt || null
    };
  });

  const summary = members.reduce(
    (acc, member) => {
      acc.total += 1;
      if (member.status === "ACCEPTED") acc.accepted += 1;
      else if (member.status === "REJECTED") acc.rejected += 1;
      else if (member.status === "AWAITING_SIGNUP") acc.awaitingSignup += 1;
      else acc.pending += 1;
      return acc;
    },
    { total: 0, accepted: 0, rejected: 0, pending: 0, awaitingSignup: 0 }
  );

  const allAccepted = summary.total > 0 && summary.accepted === summary.total;
  const anyRejected = summary.rejected > 0;
  const canContinue =
    allAccepted &&
    !anyRejected &&
    String(registration.status || "") === "PendingMemberVerification";

  return {
    registrationId: registration._id,
    status: registration.status,
    teamName: registration.teamName,
    leader: {
      name: registration?.teamLeader?.name || "",
      email: registration?.teamLeader?.email || ""
    },
    event: {
      id: event?._id || null,
      title: event?.title || "Event",
      date: formatEventDate(event),
      venue: event?.venue?.location || event?.venue || "TBA"
    },
    members,
    summary,
    allAccepted,
    anyRejected,
    canContinue
  };
};

/* ================================================
   TEAM INVITATION DETAILS (PUBLIC)
================================================ */

export const getTeamInvitationDetails = async (token) => {
  const invite = await TeamInvitation.findOne({ token });
  if (!invite) throw new Error("Invalid invitation link");

  const registration = await EventRegistration.findById(invite.registration);
  if (!registration) throw new Error("Registration not found");

  const event = await Event.findById(registration.event);

  return {
    status: invite.status,
    email: invite.email,
    name: invite.name,
    role: invite.role || "member",
    teamName: registration.teamName,
    leaderName: registration?.teamLeader?.name || "",
    event: {
      title: event?.title || "Event",
      date: formatEventDate(event),
      venue: event?.venue?.location || event?.venue || "TBA"
    }
  };
};

/* ================================================
   TEAM INVITATION RESPONSE (PUBLIC)
================================================ */

export const respondToTeamInvitation = async (token, action) => {
  const invite = await TeamInvitation.findOne({ token });
  if (!invite) throw new Error("Invalid invitation link");

  if (invite.status === "AWAITING_SIGNUP") {
    throw new Error("Please sign up with this email before responding.");
  }

  const normalizedAction = String(action || "").trim().toLowerCase();
  if (normalizedAction !== "accept" && normalizedAction !== "reject") {
    throw new Error("Invalid invitation action");
  }
  const nextStatus = normalizedAction === "accept" ? "ACCEPTED" : "REJECTED";

  if (invite.status === nextStatus) {
    return {
      status: invite.status,
      message: `You have already ${normalizedAction}ed this invitation.`
    };
  }

  if (invite.status === "REJECTED" || invite.status === "ACCEPTED") {
    throw new Error("This invitation has already been responded to.");
  }

  const registration = await EventRegistration.findById(invite.registration);
  if (!registration) throw new Error("Registration not found");

  if (registration.status === "Cancelled" || registration.status === "Rejected") {
    throw new Error("This registration is no longer active");
  }

  invite.status = nextStatus;
  invite.respondedAt = new Date();
  await invite.save();

  const member = registration.teamMembers.find(
    (m) => normalizeEmail(m?.email) === normalizeEmail(invite.email)
  );
  if (member) {
    member.emailVerified = nextStatus === "ACCEPTED";
  } else if (
    normalizeEmail(registration?.teamLeader?.email) === normalizeEmail(invite.email)
  ) {
    registration.teamLeader.emailVerified = nextStatus === "ACCEPTED";
  }

  const invites = await TeamInvitation.find({ registration: registration._id });
  const allAccepted = invites.length > 0 && invites.every((entry) => entry.status === "ACCEPTED");
  const anyRejected = invites.some((entry) => entry.status === "REJECTED");
  registration.allMembersVerified = allAccepted;

  let event = null;
  let autoConfirmed = false;
  if (allAccepted && !anyRejected && String(registration.status || "") === "PendingMemberVerification") {
    event = await Event.findById(registration.event);
    if (!event) throw new Error("Event not found");
    registration.status = "Confirmed";
    autoConfirmed = true;
  }

  await registration.save();

  if (autoConfirmed && event) {
    await generateQRsForRegistration(registration, event);
  }

  try {
    if (!event) event = await Event.findById(registration.event);
    const actionLabel = nextStatus === "ACCEPTED" ? "accepted" : "rejected";
    await sendNotification({
      recipientId: registration.registeredBy,
      recipientName: registration?.teamLeader?.name || "Team Leader",
      recipientRole: "STUDENT",
      title: "Team Invitation Update",
      message: `${invite.name || invite.email} ${actionLabel} the invitation for ${event?.title || "your event"}.`,
      type: "REGISTRATION",
      refId: registration._id
    });
  } catch (error) {
    console.error("Team invitation notification error:", error.message);
  }

  return {
    status: invite.status,
    message:
      nextStatus === "ACCEPTED"
        ? "Invitation accepted. Thanks for confirming."
        : "Invitation rejected. The team leader has been notified."
  };
};

/* ================================================
   CONFIRM TEAM REGISTRATION
   Team leader confirms after all accepted
================================================ */

export const confirmTeamRegistration = async (registrationId, requesterId) => {
  const registration = await EventRegistration.findById(registrationId);
  if (!registration) throw new Error("Registration not found");

  if (registration.registeredBy.toString() !== requesterId.toString())
    throw new Error("Not authorized to confirm this registration");

  const event = await Event.findById(registration.event);
  if (!event) throw new Error("Event not found");
  if (!event.isTeamEvent) throw new Error("This registration is not a team registration");

  if (registration.status === "Cancelled" || registration.status === "Rejected") {
    throw new Error("This registration is no longer active");
  }

  if (registration.status === "Confirmed") {
    return {
      status: registration.status,
      message: "Registration is already confirmed."
    };
  }

  if (
    registration.status === "PendingPayment" ||
    registration.status === "PendingPaymentVerification"
  ) {
    registration.status = "Confirmed";
    registration.allMembersVerified = true;
    await registration.save();
    await generateQRsForRegistration(registration, event);
    return {
      status: registration.status,
      message: "Team accepted. Registration confirmed and QR codes have been sent."
    };
  }

  const invites = await TeamInvitation.find({ registration: registration._id });
  if (invites.length === 0) throw new Error("Team invitations are still pending");

  for (const invite of invites) {
    if (invite.role !== "leader") continue;
    if (invite.status === "ACCEPTED") continue;
    invite.status = "ACCEPTED";
    invite.respondedAt = invite.respondedAt || new Date();
    invite.inviteSentAt = null;
    await invite.save();
  }

  const anyRejected = invites.some((invite) => invite.status === "REJECTED");
  if (anyRejected) throw new Error("A team member rejected the invitation");

  const allAccepted = invites.every((invite) => invite.status === "ACCEPTED");
  if (!allAccepted) throw new Error("Waiting for all team members to accept");

  registration.allMembersVerified = true;
  registration.status = "Confirmed";
  await registration.save();
  await generateQRsForRegistration(registration, event);

  return {
    status: registration.status,
    message: "Team accepted. Registration confirmed and QR codes have been sent."
  };
};

/* ================================================
   RESEND TEAM INVITES
================================================ */

export const resendTeamInvites = async (registrationId, requesterId) => {
  const registration = await EventRegistration.findById(registrationId);
  if (!registration) throw new Error("Registration not found");

  if (registration.registeredBy.toString() !== requesterId.toString())
    throw new Error("Not authorized to resend invites for this registration");

  if (registration.status === "Cancelled" || registration.status === "Rejected") {
    throw new Error("This registration is no longer active");
  }

  const event = await Event.findById(registration.event);
  if (!event) throw new Error("Event not found");
  if (!event.isTeamEvent) throw new Error("This registration is not a team registration");

  await createTeamInvitations(registration, event, { sendNotifications: false });
  const invites = await TeamInvitation.find({ registration: registration._id });

  let sent = 0;

  for (const invite of invites) {
    if (invite.status === "ACCEPTED" || invite.status === "REJECTED") continue;

    try {
      if (invite.status === "PENDING") {
        await sendTeamInvitationEmail({ invite, event, registration });
      } else if (invite.status === "AWAITING_SIGNUP") {
        await sendTeamSignupEmail({ invite, event, registration });
      }
      invite.inviteSentAt = new Date();
      await invite.save();
      sent += 1;
    } catch (error) {
      console.error("Resend team invite error:", error.message);
    }
  }

  return {
    sent,
    message:
      sent > 0
        ? `Invitations resent to ${sent} member${sent === 1 ? "" : "s"}.`
        : "No pending invitations to resend."
  };
};

/* ================================================
   UPDATE TEAM MEMBER EMAIL
   Team leader can fix a member email before acceptance
================================================ */

export const updateTeamMemberEmail = async (registrationId, requesterId, payload) => {
  const currentEmail = normalizeEmail(payload?.currentEmail);
  const nextEmail = normalizeEmail(payload?.nextEmail);

  if (!currentEmail || !nextEmail) {
    throw new Error("Current email and new email are required.");
  }
  if (currentEmail === nextEmail) {
    return {
      message: "Email is unchanged.",
      data: { email: nextEmail }
    };
  }

  const registration = await EventRegistration.findById(registrationId);
  if (!registration) throw new Error("Registration not found");

  if (registration.registeredBy.toString() !== requesterId.toString()) {
    throw new Error("Not authorized to update this registration");
  }

  if (String(registration.status || "") !== "PendingMemberVerification") {
    throw new Error("Team member emails can only be updated while invitations are pending.");
  }

  const event = await Event.findById(registration.event);
  if (!event) throw new Error("Event not found");
  if (!event.isTeamEvent) throw new Error("This registration is not a team registration");

  const leaderEmail = normalizeEmail(registration?.teamLeader?.email);
  if (leaderEmail && nextEmail === leaderEmail) {
    throw new Error("Team leader email cannot be used as a team member.");
  }

  const memberIndex = registration.teamMembers.findIndex(
    (member) => normalizeEmail(member?.email) === currentEmail
  );
  if (memberIndex < 0) throw new Error("Team member not found");

  const duplicateMember = registration.teamMembers.some((member, idx) => {
    if (idx === memberIndex) return false;
    return normalizeEmail(member?.email) === nextEmail;
  });
  if (duplicateMember) {
    throw new Error("This email is already added to the team.");
  }

  const organizerEmail = normalizeEmail(event?.organizer?.contactEmail);
  if (organizerEmail && organizerEmail === nextEmail) {
    throw new Error("Organizer email cannot be used as a team member.");
  }

  const coordinatorEmails = new Set(
    (event?.studentCoordinators || []).map((coordinator) => normalizeEmail(coordinator?.email)).filter(Boolean)
  );
  if (coordinatorEmails.has(nextEmail)) {
    throw new Error("Assigned coordinators cannot be added as team members.");
  }

  const restrictedUser = await User.findOne({
    role: { $in: ["STUDENT_COORDINATOR", "ORGANIZER", "MAIN_ADMIN"] },
    email: nextEmail
  }).select("email role lastLoginAt");
  if (restrictedUser) {
    throw new Error("Admin, organizer, or coordinator accounts cannot be added as team participants");
  }

  const existingInvite = await TeamInvitation.findOne({
    registration: registration._id,
    email: currentEmail
  });
  if (existingInvite && ["ACCEPTED", "REJECTED"].includes(existingInvite.status)) {
    throw new Error("This member has already responded to the invitation.");
  }

  const conflictingInvite = await TeamInvitation.findOne({
    registration: registration._id,
    email: nextEmail
  });
  if (conflictingInvite) {
    throw new Error("This email already has a pending invitation.");
  }

  registration.teamMembers[memberIndex].email = nextEmail;
  registration.teamMembers[memberIndex].emailVerified = false;
  await registration.save();

  if (currentEmail) {
    await MemberVerification.deleteMany({
      registration: registration._id,
      email: currentEmail
    });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const existingUser = await User.findOne({ email: nextEmail }).select("_id email lastLoginAt");
  const hasSignedIn = Boolean(existingUser?.lastLoginAt);
  const inviteStatus = hasSignedIn ? "PENDING" : "AWAITING_SIGNUP";
  const invitePayload = {
    email: nextEmail,
    name: registration.teamMembers[memberIndex]?.name || "Member",
    role: "member",
    token,
    status: inviteStatus,
    user: existingUser?._id || null,
    inviteSentAt: inviteStatus === "PENDING" ? new Date() : null,
    respondedAt: null
  };

  let inviteDoc = null;
  if (existingInvite) {
    await TeamInvitation.updateOne(
      { _id: existingInvite._id },
      { $set: invitePayload }
    );
    inviteDoc = { ...existingInvite.toObject(), ...invitePayload };
  } else {
    inviteDoc = await TeamInvitation.create({
      registration: registration._id,
      ...invitePayload
    });
  }

  if (inviteDoc) {
    try {
      if (inviteStatus === "PENDING") {
        await sendTeamInvitationEmail({ invite: inviteDoc, event, registration });
        await TeamInvitation.updateOne(
          { _id: inviteDoc._id },
          { $set: { inviteSentAt: new Date() } }
        );
      } else if (inviteStatus === "AWAITING_SIGNUP") {
        await sendTeamSignupEmail({ invite: inviteDoc, event, registration });
        await TeamInvitation.updateOne(
          { _id: inviteDoc._id },
          { $set: { inviteSentAt: new Date() } }
        );
      }
    } catch (error) {
      console.error("Team invite email error:", error.message);
    }
  }

  return {
    message: "Team member email updated successfully.",
    data: { email: nextEmail }
  };
};

/* ================================================
   LOOKUP TEAM MEMBER PROFILE (PRE-REGISTRATION)
================================================ */

export const lookupTeamMemberProfile = async (eventId, requesterId, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const requester = await User.findById(requesterId).select("role email");
  if (!requester) throw new Error("User not found");

  const event = await Event.findById(eventId).select(
    "isTeamEvent organizer studentCoordinators visibility"
  );
  if (!event) throw new Error("Event not found");
  if (!event.isTeamEvent) throw new Error("This event is not a team registration");

  const user = await User.findOne({ email: normalizedEmail }).select(
    "fullName email mobileNumber collegeName academicProfile professionalProfile role"
  );
  if (!user) {
    return { exists: false };
  }

  const role = String(user?.role || "").toUpperCase();
  if (role !== "STUDENT") {
    throw new Error("Admin, organizer, or coordinator accounts cannot be added as team participants");
  }

  const profile = {
    fullName: user.fullName || "",
    email: user.email || normalizedEmail,
    mobileNumber: user.mobileNumber || "",
    collegeName: user.collegeName || "",
    branch: user.academicProfile?.branch || user.professionalProfile?.department || "",
    year: user.academicProfile?.year || ""
  };

  return {
    exists: true,
    profile
  };
};

/* ================================================
   SEND PENDING TEAM INVITES AFTER SIGN-IN
================================================ */

export const sendPendingTeamInvitesForUser = async (user) => {
  const email = normalizeEmail(user?.email);
  if (!email || !user?._id) return { sent: 0 };

  const invites = await TeamInvitation.find({
    email,
    status: "AWAITING_SIGNUP"
  });

  if (!invites.length) return { sent: 0 };

  let sentCount = 0;
  let userDepartment = normalizeDepartment(
    user?.academicProfile?.branch || user?.professionalProfile?.department || ""
  );
  const isStudentAccount = String(user?.role || "").toUpperCase() === "STUDENT";

  for (const invite of invites) {
    try {
      const registration = await EventRegistration.findById(invite.registration);
      if (!registration) continue;
      if (registration.status === "Cancelled" || registration.status === "Rejected") continue;

      const event = await Event.findById(registration.event);
      if (!event) continue;

      if (!userDepartment && isStudentAccount) {
        const visibilityScope = String(event?.visibility?.scope || "COLLEGE").toUpperCase();
        if (visibilityScope === "DEPARTMENT") {
          const leaderDepartment = normalizeDepartment(
            registration?.teamLeader?.branch || registration?.teamLeader?.department || ""
          );
          const eventDepartment = normalizeDepartment(event?.visibility?.department || "");
          const nextDepartment = leaderDepartment || eventDepartment;
          if (nextDepartment) {
            user.academicProfile = {
              ...(user.academicProfile || {}),
              branch: nextDepartment
            };
            await user.save();
            userDepartment = nextDepartment;
          }
        }
      }

      if (invite.role === "leader") {
        invite.status = "ACCEPTED";
        invite.respondedAt = invite.respondedAt || new Date();
        invite.inviteSentAt = null;
        invite.user = user._id;
        await invite.save();
        continue;
      }

      invite.status = "PENDING";
      invite.user = user._id;
      invite.inviteSentAt = new Date();
      await invite.save();

      await sendTeamInvitationEmail({ invite, event, registration });
      sentCount += 1;
    } catch (error) {
      console.error("Pending team invite dispatch error:", error.message);
    }
  }

  return { sent: sentCount };
};

/* ================================================
   GET MY REGISTRATIONS
   Student sees their own registrations + QR
================================================ */

export const getMyRegistrations = async (userId) => {
  const user = await User.findById(userId).select("email");
  const userEmail = normalizeEmail(user?.email);

  const registrationQuery = userEmail
    ? {
        $or: [
          { registeredBy: userId },
          { "teamLeader.email": userEmail },
          { "teamMembers.email": userEmail }
        ]
      }
    : { registeredBy: userId };

  const registrations = await EventRegistration.find(registrationQuery)
    .populate("event", "title category schedule venue status posterUrl certificate isTeamEvent")
    .sort({ createdAt: -1 });

  const registrationIds = registrations.map((registration) => registration._id);
  const feedbackRows = registrationIds.length
    ? await Feedback.find({
        registration: { $in: registrationIds }
      }).select("registration")
    : [];
  const feedbackByRegistrationId = new Set(
    feedbackRows.map((feedback) => normalizeId(feedback?.registration))
  );

  const result = await Promise.all(
    registrations.map(async (reg) => {
      const lookupEmail = userEmail || normalizeEmail(reg?.teamLeader?.email);
      const isTeamLeader =
        reg?.registeredBy?.toString() === userId.toString() ||
        (userEmail && normalizeEmail(reg?.teamLeader?.email) === userEmail);
      const qr = lookupEmail
        ? await ParticipantQR.findOne({
            registration: reg._id,
            email: lookupEmail
          }).select("qrImageUrl role attendanceMarked attendanceMarkedAt")
        : null;
      const certificate = lookupEmail
        ? await Certificate.findOne({
            eventId: reg?.event?._id || reg?.event,
            participantEmail: lookupEmail
          }).select("certificateType position certificateUrl issuedAt verificationCode")
        : null;
      const feedbackSubmitted = feedbackByRegistrationId.has(normalizeId(reg?._id));

      return {
        ...reg.toObject(),
        qr: qr || null,
        isTeamLeader,
        feedbackSubmitted,
        certificate: certificate
          ? {
              certificateType: certificate.certificateType,
              position: certificate.position,
              participantEmail: certificate.participantEmail,
              certificateUrl: certificate.certificateUrl,
              issuedAt: certificate.issuedAt,
              verificationCode: certificate.verificationCode
            }
          : null
      };
    })
  );

  return result;
};

/* ================================================
   GET ALL REGISTRATIONS FOR AN EVENT
   Organizer sees everyone registered for their event
================================================ */

export const getEventRegistrations = async (eventId, requester) => {
  // Verify the event exists and requester is allowed for this event
  const event = await Event.findById(eventId);
  if (!event) throw new Error("Event not found");

  const requesterId = requester?._id?.toString();
  const isAdmin = requester?.role === "MAIN_ADMIN";
  const isOrganizer =
    event.organizer?.organizerId?.toString() === requesterId ||
    event.createdBy?.toString() === requesterId;
  const isAssignedCoordinator = event.studentCoordinators.some(
    (coordinator) =>
      coordinator.coordinatorId?.toString() === requesterId
  );
  const canAccessAsCoordinator =
    isAssignedCoordinator &&
    !(requester?.role === "STUDENT" && isEventOver(event));

  if (!isAdmin && !isOrganizer && !canAccessAsCoordinator)
    throw new Error("Not authorized to view these registrations");

  const registrations = await EventRegistration.find({
    event: eventId
  }).sort({ createdAt: -1 });

  // Attach QRs for all participants in each registration
  const result = await Promise.all(
    registrations.map(async (reg) => {
      const qrs = await ParticipantQR.find({
        registration: reg._id
      }).select("name email role token qrImageUrl attendanceMarked attendanceMarkedAt");

      return {
        ...reg.toObject(),
        participants: qrs
      };
    })
  );

  return result;
};

/* ================================================
   HELPER — Send verification emails
================================================ */

const sendMemberVerificationEmails = async (registration, participants) => {
  const seen = new Set();

  for (const participant of participants) {
    const email = normalizeEmail(participant?.email);
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const token = crypto.randomBytes(32).toString("hex");

    await MemberVerification.create({
      registration: registration._id,
      email,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24)
    });

    const verifyLink = `${getPrimaryFrontendUrl()}/verify-registration?token=${token}`;
    const displayName = String(participant?.name || "Participant").trim() || "Participant";
    const roleLabel = participant?.role === "leader" ? "team leader" : "team member";

    await sendEmail(
      email,
      "Verify Your Event Registration - EventMate",
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #4f46e5;">Hi ${displayName},</h2>
          <p>You're listed as the ${roleLabel} for a team event on EventMate.</p>
          <p>Please verify your participation by clicking the button below:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verifyLink}" style="
              display: inline-block;
              padding: 14px 32px;
              background-color: #4f46e5;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              font-size: 15px;
            ">Verify My Participation</a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">
            This link expires in 24 hours. Once all team members verify,
            you'll receive a confirmation email with your unique QR code.
          </p>
        </div>
      `
    );
  }
};

/* ================================================
   PREVIEW ATTENDANCE VIA QR TOKEN
   Resolve participant details before confirming entry
================================================ */

export const previewAttendance = async (token, requester) => {
  const { qr, event, registration } = await loadAttendanceContext(token);

  ensureAttendanceWindowOpen(event);

  if (!canManageAttendanceForEvent(event, requester)) {
    throw new Error("Not authorized to mark attendance for this event");
  }

  const participantMeta = resolveParticipantMetaFromRegistration(
    registration,
    qr.email,
    qr.name
  );

  return {
    participantName: participantMeta.participantName,
    email: participantMeta.participantEmail || qr.email,
    role: qr.role,
    participantDepartment: participantMeta.participantDepartment,
    participantCollege: participantMeta.participantCollege,
    participantYear: participantMeta.participantYear,
    registrationStatus: String(registration?.status || "").trim() || "Pending",
    attendanceMarked: Boolean(qr.attendanceMarked),
    attendanceMarkedAt: qr.attendanceMarkedAt || null,
    eventId: event._id,
    eventName: event.title
  };
};

/* ================================================
   MARK ATTENDANCE VIA QR TOKEN
   Called when organizer/coordinator scans QR
================================================ */

export const markAttendance = async (token, scannedBy) => {
  const { qr, event, registration } = await loadAttendanceContext(token);

  // Already attended check
  if (qr.attendanceMarked)
    throw new Error(`Attendance already marked for ${qr.name}`);

  ensureAttendanceWindowOpen(event);

  if (!canManageAttendanceForEvent(event, scannedBy))
    throw new Error("Not authorized to mark attendance for this event");

  // Mark attendance
  qr.attendanceMarked = true;
  qr.attendanceMarkedAt = new Date();
  qr.attendanceMarkedBy = scannedBy._id;
  await qr.save();
  await refreshEventAttendanceTotal(qr.eventId);
// Notify student
if (registration) {
  await sendNotification({
    recipientId: registration.registeredBy,
    recipientName: qr.name,
    recipientRole: "STUDENT",
    title: "Attendance Marked!",
    message: `Your attendance for ${event.title} has been recorded`,
    type: "ATTENDANCE",
    refId: event._id
  });
}

await sendNotification({
  recipientId: event.createdBy,
  recipientName: event.organizer.name,
  recipientRole: "ORGANIZER",
  title: "Attendance Marked",
  message: `${qr.name}'s attendance was marked for ${event.title}`,
  type: "ATTENDANCE",
  refId: event._id
});

await notifyAssignedCoordinators(event, () => ({
  title: "Attendance Marked",
  message: `${qr.name}'s attendance was marked for ${event.title}`,
  type: "ATTENDANCE",
  refId: event._id
}));
  return {
    participantName: qr.name,
    email: qr.email,
    role: qr.role,
    eventName: event.title,
    markedAt: qr.attendanceMarkedAt
  };
};

/* ================================================
   MARK ATTENDANCE MANUALLY — ADMIN ONLY
   Admin marks directly from participant list
================================================ */

export const markAttendanceManual = async (registrationId, email, adminId) => {

  const qr = await ParticipantQR.findOne({
    registration: registrationId,
    email
  });

  if (!qr) throw new Error("Participant not found");

  if (qr.attendanceMarked)
    throw new Error(`Attendance already marked for ${qr.name}`);

  qr.attendanceMarked = true;
  qr.attendanceMarkedAt = new Date();
  qr.attendanceMarkedBy = adminId;
  await qr.save();
  await refreshEventAttendanceTotal(qr.eventId);
// Notify student
const attendedRegistration = await EventRegistration.findById(registrationId);
if (attendedRegistration) {
  const event = await Event.findById(attendedRegistration.event);
  await sendNotification({
    recipientId: attendedRegistration.registeredBy,
    recipientName: qr.name,
    recipientRole: "STUDENT",
    title: "Attendance Marked!",
    message: `Your attendance for ${event?.title || "the event"} has been recorded`,
    type: "ATTENDANCE",
    refId: attendedRegistration.event
  });

  if (event) {
    await sendNotification({
      recipientId: event.createdBy,
      recipientName: event.organizer.name,
      recipientRole: "ORGANIZER",
      title: "Attendance Marked",
      message: `${qr.name}'s attendance was marked for ${event.title}`,
      type: "ATTENDANCE",
      refId: event._id
    });

    await notifyAssignedCoordinators(event, () => ({
      title: "Attendance Marked",
      message: `${qr.name}'s attendance was marked for ${event.title}`,
      type: "ATTENDANCE",
      refId: event._id
    }));
  }
}
  return {
    participantName: qr.name,
    email: qr.email,
    role: qr.role,
    markedAt: qr.attendanceMarkedAt
  };
};

/* ================================================
   TAG WINNER
   Organizer/Admin tags a registration as winner
================================================ */

export const tagWinner = async (registrationId, position, taggedBy) => {

  const validPositions = ["1st", "2nd", "3rd"];
  if (!validPositions.includes(position))
    throw new Error("Position must be 1st, 2nd or 3rd");

  // Find registration
  const registration = await EventRegistration.findById(registrationId);
  if (!registration) throw new Error("Registration not found");

  // Find event
  const event = await Event.findById(registration.event);
  if (!event) throw new Error("Event not found");

  // Event must not be cancelled
  if (event.status === "Cancelled")
    throw new Error("Cannot tag winners for a cancelled event");

  // Event must have started
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventStart = new Date(event.schedule.startDate);
  eventStart.setHours(0, 0, 0, 0);

  if (today < eventStart)
    throw new Error("Cannot tag winners before event starts");

  // Authorization — only organizer of this event or admin
  const isAdmin = taggedBy.role === "MAIN_ADMIN";
  const isOrganizer =
    event.createdBy.toString() === taggedBy._id.toString();

  if (!isAdmin && !isOrganizer)
    throw new Error("Not authorized to tag winners for this event");

  // Registration must be confirmed
  if (registration.status !== "Confirmed")
    throw new Error("Only confirmed registrations can be tagged as winners");

  const leaderEmail = normalizeEmail(registration?.teamLeader?.email);
  const leaderQr = await ParticipantQR.findOne({
    registration: registration._id,
    email: leaderEmail,
    attendanceMarked: true
  });

  if (!leaderQr)
    throw new Error("Attendance must be marked before tagging winners");

  // Check if this position already taken
  const positionTaken = await EventRegistration.findOne({
    event: event._id,
    "winner.position": position
  });

  if (positionTaken)
    throw new Error(`${position} place already assigned to another team/participant`);

  // Check if this registration already has a position
  if (registration.winner.isWinner)
    throw new Error(`This team/participant is already tagged as ${registration.winner.position} place`);

  const assignmentCount = Number(registration?.winner?.assignmentCount || 0);
  const unassignedOnce = Boolean(registration?.winner?.unassignedOnce);

  if (assignmentCount === 0) {
    registration.winner.assignmentCount = 1;
  } else if (assignmentCount === 1 && unassignedOnce) {
    registration.winner.assignmentCount = 2;
  } else {
    throw new Error("Winner selection can only be changed once");
  }

  // Tag winner
  registration.winner.isWinner = true;
  registration.winner.position = position;
  await registration.save();

  if (event.status === "Completed" && event?.certificate?.isEnabled) {
    generateCertificatesForRegistration(registration, event).catch((error) => {
      console.error("Winner certificate sync error:", error.message);
    });
  }

  return {
    position,
    name: event.isTeamEvent
      ? registration.teamName
      : registration.teamLeader.name,
    isTeam: event.isTeamEvent,
    eventName: event.title
  };
};

export const untagWinner = async (registrationId, taggedBy) => {
  const registration = await EventRegistration.findById(registrationId);
  if (!registration) throw new Error("Registration not found");

  const event = await Event.findById(registration.event);
  if (!event) throw new Error("Event not found");

  if (event.status === "Cancelled")
    throw new Error("Cannot update winners for a cancelled event");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventStart = new Date(event.schedule.startDate);
  eventStart.setHours(0, 0, 0, 0);

  if (today < eventStart)
    throw new Error("Cannot update winners before event starts");

  const isAdmin = taggedBy.role === "MAIN_ADMIN";
  const isOrganizer =
    event.createdBy.toString() === taggedBy._id.toString();

  if (!isAdmin && !isOrganizer)
    throw new Error("Not authorized to update winners for this event");

  if (registration.status !== "Confirmed")
    throw new Error("Only confirmed registrations can be updated");

  if (!registration.winner.isWinner)
    throw new Error("No winner assigned to remove");

  const assignmentCount = Number(registration?.winner?.assignmentCount || 0);
  const unassignedOnce = Boolean(registration?.winner?.unassignedOnce);

  if (unassignedOnce)
    throw new Error("Winner can be removed only once");

  if (assignmentCount >= 2)
    throw new Error("Winner selection is locked");

  registration.winner.isWinner = false;
  registration.winner.position = null;
  registration.winner.unassignedOnce = true;
  if (assignmentCount === 0) {
    registration.winner.assignmentCount = 1;
  }

  await registration.save();

  if (event.status === "Completed" && event?.certificate?.isEnabled) {
    generateCertificatesForRegistration(registration, event).catch((error) => {
      console.error("Certificate downgrade sync error:", error.message);
    });
  }

  return {
    name: event.isTeamEvent
      ? registration.teamName
      : registration.teamLeader.name,
    isTeam: event.isTeamEvent,
    eventName: event.title
  };
};

