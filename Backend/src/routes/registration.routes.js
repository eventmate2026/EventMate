import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import {
  initiateRegistration,
  verifyMember,
  getTeamRegistrationStatus,
  confirmTeamRegistration,
  getTeamInvitationDetails,
  respondToTeamInvitation,
  resendTeamInvites,
  lookupTeamMemberProfile,
  updateTeamMemberEmail,
  getMyRegistrations,
  getEventRegistrations,
  markAttendanceManual,
  markAttendance,
  tagWinner,
  untagWinner
} from "../controllers/registration.controller.js";

const router = express.Router();

// Student initiates registration
router.post("/:eventId/draft", authMiddleware, initiateRegistration);

// Member verifies email via token — public
router.get("/verify/:token", verifyMember);

// Team invitation details (public)
router.get("/invite/:token", getTeamInvitationDetails);
router.post("/invite/:token/:action", respondToTeamInvitation);

// Team leader - view team invitation status
router.get("/team/:registrationId/status", authMiddleware, getTeamRegistrationStatus);

// Team leader - confirm team registration after all accepted
router.post("/team/:registrationId/confirm", authMiddleware, confirmTeamRegistration);

// Team leader - resend team invitations
router.post("/team/:registrationId/resend-invites", authMiddleware, resendTeamInvites);

// Team leader - lookup member profile by email
router.get("/team/:eventId/member-lookup", authMiddleware, lookupTeamMemberProfile);

// Team leader - update team member email
router.patch("/team/:registrationId/member-email", authMiddleware, updateTeamMemberEmail);

// Student sees their own registrations + QRs
router.get("/my", authMiddleware, getMyRegistrations);

// Organizer sees all registrations for their event
router.get(
  "/:eventId/all",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER", "STUDENT_COORDINATOR", "STUDENT"),
  getEventRegistrations
);

// Organizer/Coordinator scans QR
router.patch(
  "/attendance/:token",
  authMiddleware,
  roleMiddleware("ORGANIZER", "STUDENT_COORDINATOR", "STUDENT"),
  markAttendance
);

// Admin marks attendance manually
router.patch(
  "/:registrationId/attendance/manual",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN"),
  markAttendanceManual
);

// Tag winner — organizer or admin only
router.patch(
  "/:registrationId/winner",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  tagWinner
);

// Remove winner tag (one-time undo)
router.patch(
  "/:registrationId/winner/clear",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  untagWinner
);

export default router;
