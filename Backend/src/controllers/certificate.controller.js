import Certificate from "../models/Certificate.model.js";
import CertificateAuditLog from "../models/CertificateAuditLog.model.js";
import Event from "../models/Event.model.js";
import uploadImageCloudinary from "../utils/uploadImageCloudinary.js";
import {
  buildCertificateEmailSlug,
  generateCertificatesForEvent,
  generateCertificatesForSelection,
  generateDemoCertificateBuffer,
  normalizeCertificateCustomization
} from "../services/certificate.service.js";

const normalizeVerificationCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const resolveAuditActorContext = (req) => {
  const role = req?.user?.role || "PUBLIC";
  const source =
    role === "MAIN_ADMIN" ? "ADMIN" : role === "ORGANIZER" ? "ORGANIZER" : "PUBLIC";

  return {
    actorId: req?.user?._id || null,
    actorName: req?.user?.fullName || req?.user?.name || "Public User",
    actorRole: role,
    source,
    ipAddress: req.ip || null,
    userAgent: String(req.headers?.["user-agent"] || "").slice(0, 300) || null
  };
};

const writeCertificateAuditLog = async (payload) => {
  try {
    await CertificateAuditLog.create(payload);
  } catch (error) {
    console.error("Failed to write certificate audit log:", error.message);
  }
};

const triggerBackgroundCertificateSync = (event) => {
  if (!event?._id) return;
  if (String(event?.status || "").trim() !== "Completed") return;
  if (!event?.certificate?.isEnabled) return;

  generateCertificatesForEvent(event._id).catch((error) => {
    console.error("Certificate sync trigger failed:", error.message);
  });
};

const sanitizeFileName = (value, fallback) => {
  const normalized = String(value || "").trim();
  const safe = normalized.replace(/[^a-z0-9-_]+/gi, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return safe || fallback;
};

const clampCertificatePercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));
const AUTO_SIGNATURE_Y_OFFSET = 12.4;
const DEFAULT_SIGNATURE_WIDTH = 130;
const normalizeDemoCertificateType = (value) =>
  String(value || "").trim().toLowerCase() === "winner" ? "winner" : "participation";
const normalizeDemoWinnerPosition = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "1" || normalized === "1st" || normalized === "first") return "1st";
  if (normalized === "2" || normalized === "2nd" || normalized === "second") return "2nd";
  if (normalized === "3" || normalized === "3rd" || normalized === "third") return "3rd";
  return null;
};

const autoArrangeCertificateSignatures = (customizationValue) => {
  const normalized = normalizeCertificateCustomization(customizationValue);
  const layout = normalized.layout || {};
  const nextLayout = {
    ...layout
  };
  const signatureLabelPairs = [
    { signatureKey: "organizerSignature", labelKey: "coordinatorLabel" },
    { signatureKey: "hodSignature", labelKey: "hodLabel" },
    { signatureKey: "principalSignature", labelKey: "principalLabel" }
  ];

  for (const { signatureKey, labelKey } of signatureLabelPairs) {
    const labelNode = layout[labelKey];
    const signatureNode = layout[signatureKey];
    if (!labelNode || !signatureNode) continue;

    nextLayout[signatureKey] = {
      ...signatureNode,
      x: clampCertificatePercent(labelNode.x),
      y: clampCertificatePercent(labelNode.y - AUTO_SIGNATURE_Y_OFFSET),
      width: Math.max(Number(signatureNode.width) || 0, DEFAULT_SIGNATURE_WIDTH),
      anchor: labelNode.anchor
    };
  }

  return {
    ...normalized,
    layout: nextLayout
  };
};

/* ================================================
   GET MY CERTIFICATES
   Student views their own certificates
================================================ */
export const getMyCertificates = async (req, res, next) => {
  try {
    const participantEmail = String(req.user?.email || "").trim().toLowerCase();
    if (!participantEmail) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const certificates = await Certificate.find({
      participantEmail
    }).sort({ issuedAt: -1 });

    return res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   GET EVENT CERTIFICATES
   Organizer/Admin views all certificates for an event
================================================ */
export const getEventCertificates = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select("_id createdBy");
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view certificates for this event"
      });
    }

    const certificates = await Certificate.find({
      eventId: req.params.eventId
    }).sort({ issuedAt: -1 });

    return res.status(200).json({
      success: true,
      count: certificates.length,
      data: certificates
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   GENERATE CERTIFICATES FOR EVENT
================================================ */
export const generateEventCertificates = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select("_id createdBy");
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to generate certificates for this event"
      });
    }

    const result = await generateCertificatesForEvent(req.params.eventId);

    return res.status(200).json({
      success: true,
      message: "Certificate generation completed",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   GENERATE SELECTED CERTIFICATES
   Organizer/Admin issues for selected attendees
================================================ */
export const generateSelectedCertificates = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select(
      "_id createdBy status title schedule venue certificate isTeamEvent"
    );
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to generate certificates for this event"
      });
    }

    const selections = Array.isArray(req.body?.selections) ? req.body.selections : [];
    if (selections.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Select at least one attendee to issue certificates."
      });
    }

    const result = await generateCertificatesForSelection(event, selections);

    return res.status(200).json({
      success: true,
      message: "Selected certificate generation completed",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   UPDATE EVENT CERTIFICATE CUSTOMIZATION
================================================ */
export const updateEventCertificateCustomization = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).select("_id createdBy status certificate");
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to customize certificates for this event"
      });
    }

    const customization = normalizeCertificateCustomization(req.body?.customization);
    if (!event.certificate || typeof event.certificate !== "object") {
      event.certificate = { isEnabled: true, customization };
    } else {
      event.certificate.isEnabled = true;
      event.certificate.customization = customization;
    }

    await event.save();
    triggerBackgroundCertificateSync(event);

    return res.status(200).json({
      success: true,
      message: "Certificate customization saved",
      data: {
        eventId: event._id,
        customization
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   UPLOAD EVENT CERTIFICATE BACKGROUND
================================================ */
export const uploadEventCertificateBackground = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).select("_id createdBy status certificate");
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to customize certificates for this event"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Background image file is required"
      });
    }

    const uploaded = await uploadImageCloudinary(req.file, {
      folder: "eventmate/certificate-backgrounds"
    });

    const customization = normalizeCertificateCustomization({
      ...(event?.certificate?.customization || {}),
      backgroundImageUrl: uploaded.url
    });

    if (!event.certificate || typeof event.certificate !== "object") {
      event.certificate = { isEnabled: true, customization };
    } else {
      event.certificate.isEnabled = true;
      event.certificate.customization = customization;
    }

    await event.save();
    triggerBackgroundCertificateSync(event);

    return res.status(200).json({
      success: true,
      message: "Certificate background image updated",
      data: {
        eventId: event._id,
        backgroundImageUrl: customization.backgroundImageUrl,
        customization
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   UPLOAD EVENT CERTIFICATE LOGO
================================================ */
export const uploadEventCertificateLogo = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).select("_id createdBy status certificate");
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to customize certificates for this event"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Logo image file is required"
      });
    }

    const uploaded = await uploadImageCloudinary(req.file, {
      folder: "eventmate/certificate-logos",
      format: "png"
    });

    const customization = normalizeCertificateCustomization({
      ...(event?.certificate?.customization || {}),
      logoUrl: uploaded.url
    });

    if (!event.certificate || typeof event.certificate !== "object") {
      event.certificate = { isEnabled: true, customization };
    } else {
      event.certificate.isEnabled = true;
      event.certificate.customization = customization;
    }

    await event.save();
    triggerBackgroundCertificateSync(event);

    return res.status(200).json({
      success: true,
      message: "Certificate logo updated",
      data: {
        eventId: event._id,
        logoUrl: customization.logoUrl,
        customization
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   UPLOAD EVENT CERTIFICATE ACCREDITATION LOGO
================================================ */
export const uploadEventCertificateAccreditationLogo = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).select("_id createdBy status certificate");
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to customize certificates for this event"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Accreditation logo image file is required"
      });
    }

    const uploaded = await uploadImageCloudinary(req.file, {
      folder: "eventmate/certificate-accreditation-logos",
      format: "png"
    });

    const customization = normalizeCertificateCustomization({
      ...(event?.certificate?.customization || {}),
      accreditationLogoUrl: uploaded.url
    });

    if (!event.certificate || typeof event.certificate !== "object") {
      event.certificate = { isEnabled: true, customization };
    } else {
      event.certificate.isEnabled = true;
      event.certificate.customization = customization;
    }

    await event.save();
    triggerBackgroundCertificateSync(event);

    return res.status(200).json({
      success: true,
      message: "Accreditation logo updated",
      data: {
        eventId: event._id,
        accreditationLogoUrl: customization.accreditationLogoUrl,
        customization
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   UPLOAD EVENT CERTIFICATE SIGNATURE
================================================ */
export const uploadEventCertificateSignature = async (req, res, next) => {
  try {
    const { eventId, role } = req.params;
    const event = await Event.findById(eventId).select("_id createdBy status certificate");
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to customize certificates for this event"
      });
    }

    const normalizedRole = String(role || "").trim().toLowerCase();
    const roleFieldMap = {
      organizer: "organizerSignatureUrl",
      hod: "hodSignatureUrl",
      principal: "principalSignatureUrl"
    };
    const signatureField = roleFieldMap[normalizedRole];
    if (!signatureField) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature role. Use organizer, hod, or principal."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Signature image file is required"
      });
    }

    if (req.file.mimetype !== "image/png") {
      return res.status(400).json({
        success: false,
        message: "Signature must be a PNG file"
      });
    }

    const uploaded = await uploadImageCloudinary(req.file, {
      folder: "eventmate/certificate-signatures",
      format: "png"
    });

    const customization = autoArrangeCertificateSignatures({
      ...(event?.certificate?.customization || {}),
      [signatureField]: uploaded.url
    });

    if (!event.certificate || typeof event.certificate !== "object") {
      event.certificate = { isEnabled: true, customization };
    } else {
      event.certificate.isEnabled = true;
      event.certificate.customization = customization;
    }

    await event.save();
    triggerBackgroundCertificateSync(event);

    return res.status(200).json({
      success: true,
      message: "Certificate signature updated and auto-arranged",
      data: {
        eventId: event._id,
        role: normalizedRole,
        signatureUrl: customization[signatureField],
        customization
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   VERIFY CERTIFICATE (PUBLIC)
================================================ */
export const verifyCertificate = async (req, res, next) => {
  try {
    const submittedCode = req.body?.verificationCode ?? req.body?.code ?? req.query?.code ?? "";
    const normalizedCode = normalizeVerificationCode(submittedCode);

    if (!normalizedCode) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required"
      });
    }

    const certificate = await Certificate.findOne({
      verificationCodeNormalized: normalizedCode
    }).select(
      "_id eventId eventName eventDate participantName participantEmail certificateType position issuedAt verificationCode verificationStatus revokedAt revokeReason certificateUrl"
    );

    const auditActor = resolveAuditActorContext(req);

    if (!certificate) {
      await writeCertificateAuditLog({
        action: "VERIFIED",
        outcome: "FAILED",
        verificationCode: submittedCode,
        certificateStatus: "NOT_FOUND",
        message: "Certificate verification failed: code not found.",
        ...auditActor
      });

      return res.status(404).json({
        success: false,
        message: "Certificate not found",
        data: {
          isValid: false,
          verificationStatus: "NOT_FOUND"
        }
      });
    }

    const isRevoked = certificate.verificationStatus === "REVOKED";

    await writeCertificateAuditLog({
      certificateId: certificate._id,
      eventId: certificate.eventId,
      action: "VERIFIED",
      outcome: isRevoked ? "FAILED" : "SUCCESS",
      verificationCode: certificate.verificationCode || submittedCode,
      certificateStatus: isRevoked ? "REVOKED" : "VALID",
      participantName: certificate.participantName,
      participantEmail: certificate.participantEmail,
      eventName: certificate.eventName,
      message: isRevoked
        ? "Verification attempted on a revoked certificate."
        : "Certificate verified successfully.",
      ...auditActor
    });

    return res.status(200).json({
      success: true,
      message: isRevoked
        ? "Certificate is revoked"
        : "Certificate is valid",
      data: {
        isValid: !isRevoked,
        verificationStatus: certificate.verificationStatus,
        certificate
      }
    });
  } catch (error) {
    next(error);
  }
};

/* ================================================
   DOWNLOAD CERTIFICATE (PUBLIC)
================================================ */
export const downloadCertificate = async (req, res, next) => {
  try {
    const { eventId, emailSlug } = req.params;
    const normalizedSlug = String(emailSlug || "").trim().toLowerCase();

    if (!normalizedSlug) {
      return res.status(400).json({
        success: false,
        message: "Invalid certificate link"
      });
    }

    const certificates = await Certificate.find({ eventId }).select(
      "_id participantEmail participantName certificateData"
    );

    const certificate = certificates.find(
      (item) => buildCertificateEmailSlug(item.participantEmail) === normalizedSlug
    );

    if (!certificate || !certificate.certificateData) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }

    const pdfBuffer = Buffer.from(certificate.certificateData, "base64");

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate_${certificate.participantName.replace(/\s/g, "_")}.pdf"`,
      "Content-Length": pdfBuffer.length
    });

    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/* ================================================
   DOWNLOAD DEMO CERTIFICATE (ORGANIZER/ADMIN)
================================================ */
export const downloadDemoCertificate = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select(
      "_id createdBy title schedule venue certificate"
    );

    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const isAdmin = req.user.role === "MAIN_ADMIN";
    const isOwner = event.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to download demo certificate for this event"
      });
    }

    if (!event?.certificate?.isEnabled) {
      return res.status(400).json({
        success: false,
        message: "Save certificate template before downloading a demo certificate."
      });
    }

    const participantName = req.user.fullName || req.user.name || "Organizer";
    const certificateType = normalizeDemoCertificateType(req.query?.type);
    const position =
      certificateType === "winner"
        ? normalizeDemoWinnerPosition(req.query?.position) || "1st"
        : null;
    const pdfBuffer = await generateDemoCertificateBuffer(event, participantName, {
      certificateType,
      position
    });
    const safeTitle = sanitizeFileName(event.title, "event");
    const filePrefix = certificateType === "winner" ? "winner_certificate" : "demo_certificate";

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filePrefix}_${safeTitle}.pdf\"`,
      "Content-Length": pdfBuffer.length
    });

    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
