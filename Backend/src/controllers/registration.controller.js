import * as registrationService from "../services/registration.service.js";

export const initiateRegistration = async (req, res, next) => {
  try {
    const registration = await registrationService.initiateRegistration(
      req.params.eventId,
      req.user._id,
      req.body
    );
    return res.status(201).json({
      success: true,
      message: "Registration initiated successfully",
      data: registration
    });
  } catch (error) {
    next(error);
  }
};

export const verifyMember = async (req, res, next) => {
  try {
    const result = await registrationService.verifyMember(req.params.token);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

// Student — see their own registrations
export const getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await registrationService.getMyRegistrations(
      req.user._id
    );
    return res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

// Organizer — see all registrations for their event
export const getEventRegistrations = async (req, res, next) => {
  try {
    const registrations = await registrationService.getEventRegistrations(
      req.params.eventId,
      req.user
    );
    return res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

// Organizer/Coordinator — preview QR token before marking attendance
export const previewAttendance = async (req, res, next) => {
  try {
    const result = await registrationService.previewAttendance(
      req.params.token,
      req.user
    );
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Organizer/Coordinator — scan QR token
export const markAttendance = async (req, res, next) => {
  try {
    const result = await registrationService.markAttendance(
      req.params.token,
      req.user
    );
    return res.status(200).json({
      success: true,
      message: `Attendance marked for ${result.participantName}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Admin — mark attendance manually
export const markAttendanceManual = async (req, res, next) => {
  try {
    const result = await registrationService.markAttendanceManual(
      req.params.registrationId,
      req.body.email,
      req.user._id
    );
    return res.status(200).json({
      success: true,
      message: `Attendance marked for ${result.participantName}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Tag winner
export const tagWinner = async (req, res, next) => {
  try {
    const result = await registrationService.tagWinner(
      req.params.registrationId,
      req.body.position,
      req.user
    );
    return res.status(200).json({
      success: true,
      message: `${result.position} place assigned to ${result.name}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Team leader - view team invitation status
export const getTeamRegistrationStatus = async (req, res, next) => {
  try {
    const result = await registrationService.getTeamRegistrationStatus(
      req.params.registrationId,
      req.user._id
    );
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Team leader - confirm team registration
export const confirmTeamRegistration = async (req, res, next) => {
  try {
    const result = await registrationService.confirmTeamRegistration(
      req.params.registrationId,
      req.user._id
    );
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Public - get team invitation details
export const getTeamInvitationDetails = async (req, res, next) => {
  try {
    const result = await registrationService.getTeamInvitationDetails(req.params.token);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Public - accept/reject team invitation
export const respondToTeamInvitation = async (req, res, next) => {
  try {
    const action = req.params.action;
    const result = await registrationService.respondToTeamInvitation(req.params.token, action);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Team leader - resend team invitations
export const resendTeamInvites = async (req, res, next) => {
  try {
    const result = await registrationService.resendTeamInvites(
      req.params.registrationId,
      req.user._id
    );
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Team leader - lookup existing member profile by email
export const lookupTeamMemberProfile = async (req, res, next) => {
  try {
    const result = await registrationService.lookupTeamMemberProfile(
      req.params.eventId,
      req.user._id,
      req.query?.email
    );
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Team leader - update team member email
export const updateTeamMemberEmail = async (req, res, next) => {
  try {
    const result = await registrationService.updateTeamMemberEmail(
      req.params.registrationId,
      req.user._id,
      req.body
    );
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

// Remove winner tag (one-time undo)
export const untagWinner = async (req, res, next) => {
  try {
    const result = await registrationService.untagWinner(
      req.params.registrationId,
      req.user
    );
    return res.status(200).json({
      success: true,
      message: `Winner selection removed for ${result.name}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
