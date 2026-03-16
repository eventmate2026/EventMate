import PDFDocument from "pdfkit";
import { v2 as cloudinary } from "cloudinary";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import Certificate from "../models/Certificate.model.js";
import CertificateAuditLog from "../models/CertificateAuditLog.model.js";
import ParticipantQR from "../models/ParticipantQR.model.js";
import Event from "../models/Event.model.js";
import EventRegistration from "../models/EventRegistration.model.js";
import Feedback from "../models/Feedback.model.js";
import sendEmail from "../config/sendEmail.js";
import { sendNotification } from "./notification.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const buildCertificateEmailSlug = (email) =>
  String(email || "").trim().toLowerCase().replace(/[@.]/g, "_");

const normalizeVerificationCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const createVerificationCodeCandidate = () => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `EM-${year}-${random.slice(0, 4)}-${random.slice(4, 8)}`;
};

const generateUniqueVerificationCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = createVerificationCodeCandidate();
    const normalized = normalizeVerificationCode(candidate);
    const existing = await Certificate.exists({
      verificationCodeNormalized: normalized
    });

    if (!existing) {
      return candidate;
    }
  }

  const fallback = `EM-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
  return fallback;
};

const isMongoDuplicateKeyError = (error) => Number(error?.code) === 11000;

const isDuplicateVerificationCodeError = (error) =>
  isMongoDuplicateKeyError(error) &&
  (Boolean(error?.keyPattern?.verificationCodeNormalized) ||
    String(error?.message || "").includes("verificationCodeNormalized"));

const isDuplicateParticipantCertificateError = (error) =>
  isMongoDuplicateKeyError(error) &&
  Boolean(error?.keyPattern?.eventId) &&
  Boolean(error?.keyPattern?.participantEmail);

const createCertificateAuditLog = async (payload) => {
  try {
    await CertificateAuditLog.create(payload);
  } catch (error) {
    console.error("Certificate audit log failed:", error.message);
  }
};

const createDefaultCertificateLayout = () => ({
  logo: { x: 50, y: 8, width: 120, anchor: "center" },
  issuerName: { x: 50, y: 20, anchor: "center" },
  title: { x: 50, y: 25, anchor: "center" },
  introText: { x: 50, y: 34, anchor: "center" },
  participantName: { x: 50, y: 38, anchor: "center" },
  actionText: { x: 50, y: 46, anchor: "center" },
  eventName: { x: 50, y: 50, anchor: "center" },
  dateVenue: { x: 50, y: 55, anchor: "center" },
  coordinatorLabel: { x: 9, y: 87, anchor: "left" },
  principalLabel: { x: 91, y: 87, anchor: "right" },
  footerText: { x: 50, y: 93, anchor: "center" }
});

const createDefaultCertificateCustomization = () => ({
  issuerName: "BAJAJ CHANDRAPUR POLYTECHNIC, CHANDRAPUR",
  participationTitle: "Certificate of Participation",
  winnerTitle: "Certificate of Excellence",
  introText: "This is to certify that",
  participationActionText: "has successfully participated in",
  winnerActionText: "has achieved {position} Place in",
  footerText: "Issued by EventMate - Bajaj Chandrapur Polytechnic, Chandrapur",
  coordinatorLabel: "Coordinator",
  principalLabel: "Principal",
  backgroundImageUrl: "",
  layout: createDefaultCertificateLayout()
});

export const DEFAULT_CERTIFICATE_CUSTOMIZATION = Object.freeze(
  createDefaultCertificateCustomization()
);

const CERTIFICATE_CUSTOMIZATION_LIMITS = Object.freeze({
  issuerName: 120,
  participationTitle: 90,
  winnerTitle: 90,
  introText: 120,
  participationActionText: 160,
  winnerActionText: 180,
  footerText: 180,
  coordinatorLabel: 50,
  principalLabel: 50,
  backgroundImageUrl: 800
});

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const sanitizeCustomizationField = (value, fallback, maxLength) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;
  if (!Number.isFinite(maxLength) || maxLength <= 0) return normalized;
  return normalized.slice(0, maxLength);
};

const sanitizePercent = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clampNumber(numeric, 0, 100);
};

const sanitizeAnchor = (value, fallback) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "left" || normalized === "center" || normalized === "right") {
    return normalized;
  }
  return fallback;
};

const sanitizeLogoWidth = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clampNumber(numeric, 60, 320);
};

const sanitizeBackgroundImageUrl = (value) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  if (!/^https?:\/\//i.test(normalized)) return "";
  return normalized.slice(0, CERTIFICATE_CUSTOMIZATION_LIMITS.backgroundImageUrl);
};

const normalizeLayoutNode = (layoutNode, fallbackNode) => ({
  x: sanitizePercent(layoutNode?.x, fallbackNode.x),
  y: sanitizePercent(layoutNode?.y, fallbackNode.y),
  anchor: sanitizeAnchor(layoutNode?.anchor, fallbackNode.anchor)
});

const normalizeCertificateLayout = (layout = {}) => {
  const fallback = createDefaultCertificateLayout();
  return {
    logo: {
      ...normalizeLayoutNode(layout?.logo, fallback.logo),
      width: sanitizeLogoWidth(layout?.logo?.width, fallback.logo.width)
    },
    issuerName: normalizeLayoutNode(layout?.issuerName, fallback.issuerName),
    title: normalizeLayoutNode(layout?.title, fallback.title),
    introText: normalizeLayoutNode(layout?.introText, fallback.introText),
    participantName: normalizeLayoutNode(layout?.participantName, fallback.participantName),
    actionText: normalizeLayoutNode(layout?.actionText, fallback.actionText),
    eventName: normalizeLayoutNode(layout?.eventName, fallback.eventName),
    dateVenue: normalizeLayoutNode(layout?.dateVenue, fallback.dateVenue),
    coordinatorLabel: normalizeLayoutNode(layout?.coordinatorLabel, fallback.coordinatorLabel),
    principalLabel: normalizeLayoutNode(layout?.principalLabel, fallback.principalLabel),
    footerText: normalizeLayoutNode(layout?.footerText, fallback.footerText)
  };
};

export const normalizeCertificateCustomization = (customization = {}) => {
  const safeCustomization =
    customization && typeof customization === "object" ? customization : {};

  return {
    issuerName: sanitizeCustomizationField(
      safeCustomization.issuerName,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.issuerName,
      CERTIFICATE_CUSTOMIZATION_LIMITS.issuerName
    ),
    participationTitle: sanitizeCustomizationField(
      safeCustomization.participationTitle,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.participationTitle,
      CERTIFICATE_CUSTOMIZATION_LIMITS.participationTitle
    ),
    winnerTitle: sanitizeCustomizationField(
      safeCustomization.winnerTitle,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.winnerTitle,
      CERTIFICATE_CUSTOMIZATION_LIMITS.winnerTitle
    ),
    introText: sanitizeCustomizationField(
      safeCustomization.introText,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.introText,
      CERTIFICATE_CUSTOMIZATION_LIMITS.introText
    ),
    participationActionText: sanitizeCustomizationField(
      safeCustomization.participationActionText,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.participationActionText,
      CERTIFICATE_CUSTOMIZATION_LIMITS.participationActionText
    ),
    winnerActionText: sanitizeCustomizationField(
      safeCustomization.winnerActionText,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.winnerActionText,
      CERTIFICATE_CUSTOMIZATION_LIMITS.winnerActionText
    ),
    footerText: sanitizeCustomizationField(
      safeCustomization.footerText,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.footerText,
      CERTIFICATE_CUSTOMIZATION_LIMITS.footerText
    ),
    coordinatorLabel: sanitizeCustomizationField(
      safeCustomization.coordinatorLabel,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.coordinatorLabel,
      CERTIFICATE_CUSTOMIZATION_LIMITS.coordinatorLabel
    ),
    principalLabel: sanitizeCustomizationField(
      safeCustomization.principalLabel,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.principalLabel,
      CERTIFICATE_CUSTOMIZATION_LIMITS.principalLabel
    ),
    backgroundImageUrl: sanitizeBackgroundImageUrl(safeCustomization.backgroundImageUrl),
    layout: normalizeCertificateLayout(safeCustomization.layout)
  };
};

const buildWinnerActionText = (template, position) => {
  const safePosition = String(position || "Winning").trim() || "Winning";
  if (!template.includes("{position}")) {
    return `${template} ${safePosition}`.trim();
  }
  return template.replace(/\{position\}/gi, safePosition);
};

const normalizeCertificateType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "participation" || normalized === "winner") return normalized;
  return null;
};

const normalizeWinnerPosition = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "1" || normalized === "1st" || normalized === "first") return "1st";
  if (normalized === "2" || normalized === "2nd" || normalized === "second") return "2nd";
  if (normalized === "3" || normalized === "3rd" || normalized === "third") return "3rd";
  return null;
};

const normalizeParticipantEmail = (value) => String(value || "").trim().toLowerCase();
const WINNER_POSITIONS = ["1st", "2nd", "3rd"];

const buildTeamParticipantsFromRegistration = (registration) => {
  const members = [
    registration?.teamLeader,
    ...(Array.isArray(registration?.teamMembers) ? registration.teamMembers : [])
  ].filter(Boolean);

  const unique = new Map();
  for (const member of members) {
    const email = normalizeParticipantEmail(member?.email);
    if (!email) continue;
    const name = String(member?.name || member?.fullName || "Participant").trim() || "Participant";
    if (!unique.has(email)) {
      unique.set(email, { name, email });
    }
  }

  return Array.from(unique.values());
};

const hasTeamLeaderFeedback = async (eventId, registrationId) => {
  if (!eventId || !registrationId) return false;
  const existing = await Feedback.exists({
    event: eventId,
    registration: registrationId
  });
  return Boolean(existing);
};

export const isEventWinnerRankingComplete = async (eventId) => {
  if (!eventId) return false;

  const confirmedCount = await EventRegistration.countDocuments({
    event: eventId,
    status: "Confirmed"
  });

  if (confirmedCount === 0) return false;

  const requiredCount = Math.min(WINNER_POSITIONS.length, confirmedCount);

  const winners = await EventRegistration.find({
    event: eventId,
    "winner.position": { $in: WINNER_POSITIONS }
  }).select("winner.position");

  const assigned = new Set(
    winners.map((row) => row?.winner?.position).filter(Boolean)
  );

  return assigned.size >= requiredCount;
};

// Logo path stored in backend root
const LOGO_PATH = path.join(__dirname, "../../logo.png");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const resolveBackgroundImageBuffer = async (backgroundImageUrl) => {
  if (!backgroundImageUrl) return null;

  try {
    const response = await fetch(backgroundImageUrl);
    if (!response.ok) return null;

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) return null;

    const imageData = await response.arrayBuffer();
    if (!imageData || imageData.byteLength === 0) return null;

    return Buffer.from(imageData);
  } catch {
    return null;
  }
};

const computeAnchoredX = ({ x, width, anchor, pageWidth }) => {
  if (anchor === "center") return clampNumber(x - width / 2, 0, pageWidth - width);
  if (anchor === "right") return clampNumber(x - width, 0, pageWidth - width);
  return clampNumber(x, 0, pageWidth - width);
};

const drawAnchoredText = (
  doc,
  {
    text,
    pageWidth,
    pageHeight,
    layoutNode,
    fontSize,
    font,
    color,
    maxWidth,
    lineBreak = false,
    characterSpacing = 0
  }
) => {
  if (!text) return;

  const x = (layoutNode.x / 100) * pageWidth;
  const y = (layoutNode.y / 100) * pageHeight;
  const width = clampNumber(Number(maxWidth || pageWidth * 0.8), 40, pageWidth);

  doc.fontSize(fontSize).fillColor(color).font(font);

  const measuredWidth = Math.min(
    Number(doc.widthOfString(text, { characterSpacing })) || 0,
    width
  );
  const drawWidth = Math.max(measuredWidth, width * 0.5);
  const drawX = computeAnchoredX({
    x,
    width: drawWidth,
    anchor: layoutNode.anchor,
    pageWidth
  });

  doc.text(text, drawX, y, {
    width: drawWidth,
    align: layoutNode.anchor,
    lineBreak,
    characterSpacing
  });
};

/* ================================================
   GENERATE PDF BUFFER
   Creates the actual certificate PDF in memory
================================================ */

const generateCertificatePDF = async (data) => {
  const {
    participantName,
    eventName,
    eventDate,
    venue,
    certificateType,
    position,
    customization,
    verificationCode
  } = data;

  const resolvedCustomization = normalizeCertificateCustomization(customization);
  const layout = resolvedCustomization.layout;
  const isWinner = certificateType === "winner";
  const typeLabel = isWinner
    ? resolvedCustomization.winnerTitle
    : resolvedCustomization.participationTitle;
  const actionText = isWinner
    ? buildWinnerActionText(resolvedCustomization.winnerActionText, position)
    : resolvedCustomization.participationActionText;

  const backgroundBuffer = await resolveBackgroundImageBuffer(
    resolvedCustomization.backgroundImageUrl
  );

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      layout: "landscape",
      size: "A4",
      margin: 0
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;

    doc.rect(0, 0, W, H).fill("#ffffff");

    if (backgroundBuffer) {
      try {
        doc.image(backgroundBuffer, 0, 0, { width: W, height: H });
      } catch {
        // Ignore invalid image buffers and continue with default background.
      }
    }

    doc.rect(20, 20, W - 40, H - 40).lineWidth(3).stroke("#7C3AED");
    doc.rect(28, 28, W - 56, H - 56).lineWidth(1).stroke("#EC4899");
    doc.rect(20, 20, W - 40, 6).fill("#7C3AED");
    doc.rect(20, H - 26, W - 40, 6).fill("#EC4899");

    const logoCenterX = (layout.logo.x / 100) * W;
    const logoTopY = (layout.logo.y / 100) * H;
    const logoWidth = layout.logo.width;
    const logoX = computeAnchoredX({
      x: logoCenterX,
      width: logoWidth,
      anchor: layout.logo.anchor,
      pageWidth: W
    });

    try {
      doc.image(LOGO_PATH, logoX, logoTopY, { width: logoWidth });
    } catch {
      drawAnchoredText(doc, {
        text: "EventMate",
        pageWidth: W,
        pageHeight: H,
        layoutNode: { ...layout.logo, y: layout.logo.y + 2 },
        fontSize: 20,
        font: "Helvetica-Bold",
        color: "#7C3AED",
        maxWidth: 220
      });
    }

    drawAnchoredText(doc, {
      text: resolvedCustomization.issuerName,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.issuerName,
      fontSize: 9,
      font: "Helvetica",
      color: "#9ca3af",
      maxWidth: W * 0.92,
      characterSpacing: 1.2
    });

    drawAnchoredText(doc, {
      text: typeLabel,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.title,
      fontSize: 24,
      font: "Helvetica-Bold",
      color: "#111827",
      maxWidth: W * 0.8
    });

    drawAnchoredText(doc, {
      text: resolvedCustomization.introText,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.introText,
      fontSize: 12,
      font: "Helvetica",
      color: "#6b7280",
      maxWidth: W * 0.82
    });

    drawAnchoredText(doc, {
      text: participantName,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.participantName,
      fontSize: 34,
      font: "Helvetica-Bold",
      color: "#7C3AED",
      maxWidth: W * 0.86
    });

    drawAnchoredText(doc, {
      text: actionText,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.actionText,
      fontSize: 12,
      font: "Helvetica",
      color: "#6b7280",
      maxWidth: W * 0.82
    });

    drawAnchoredText(doc, {
      text: eventName,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.eventName,
      fontSize: 22,
      font: "Helvetica-Bold",
      color: "#111827",
      maxWidth: W * 0.86
    });

    drawAnchoredText(doc, {
      text: `${eventDate} - ${venue}`,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.dateVenue,
      fontSize: 10,
      font: "Helvetica",
      color: "#9ca3af",
      maxWidth: W * 0.82
    });

    drawAnchoredText(doc, {
      text: resolvedCustomization.coordinatorLabel,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.coordinatorLabel,
      fontSize: 11,
      font: "Helvetica",
      color: "#4b5563",
      maxWidth: W * 0.28
    });

    drawAnchoredText(doc, {
      text: resolvedCustomization.principalLabel,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.principalLabel,
      fontSize: 11,
      font: "Helvetica",
      color: "#4b5563",
      maxWidth: W * 0.28
    });

    drawAnchoredText(doc, {
      text: resolvedCustomization.footerText,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.footerText,
      fontSize: 9,
      font: "Helvetica",
      color: "#9ca3af",
      maxWidth: W * 0.95
    });

    if (verificationCode) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6b7280")
        .text(`Verification Code: ${verificationCode}`, W - 300, H - 34, {
          width: 260,
          align: "right"
        });
    }

    doc.end();
  });
};

export const generateDemoCertificateBuffer = async (event, participantName) => {
  if (!event) {
    throw new Error("Event not found");
  }

  const displayName = String(participantName || "Organizer").trim() || "Organizer";
  const eventDate = event.schedule?.startDate
    ? new Date(event.schedule.startDate).toDateString()
    : "TBA";
  const venue = event.venue?.location || event.venue?.mode || "TBA";
  const customization = normalizeCertificateCustomization(event?.certificate?.customization);

  return generateCertificatePDF({
    participantName: displayName,
    eventName: event.title || "Event",
    eventDate,
    venue,
    certificateType: "participation",
    position: null,
    customization,
    verificationCode: null
  });
};

/* ================================================
   UPLOAD PDF BUFFER TO CLOUDINARY
================================================ */
const uploadCertificateToCloudinary = (pdfBuffer, fileName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "eventmate/certificates",
        public_id: fileName,
        resource_type: "image",  // PDF is a raw file, not image
        format: "pdf"
      },
      (error, result) => {
        if (error) return reject(error);
  // Add fl_attachment flag so PDF downloads directly instead of browser trying to open it
  const downloadUrl = result.secure_url.replace("/upload/", "/upload/fl_attachment/");
  resolve(downloadUrl);
      }
    );
    uploadStream.end(pdfBuffer);
  });
};

/* ================================================
   CERTIFICATE EMAIL TEMPLATE
================================================ */

const certificateEmailTemplate = ({
  participantName,
  eventName,
  certificateType,
  position,
  certificateUrl,
  verificationCode
}) => {
  const isWinner = certificateType === "winner";
  const subject = isWinner
    ? `Congratulations! Your Winner Certificate - ${eventName}`
    : `Your Certificate of Participation - ${eventName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9f9f9;">
      
      <div style="background: linear-gradient(135deg, #7C3AED, #EC4899); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">
          ${isWinner ? "Congratulations!" : "Certificate Issued!"}
        </h1>
      </div>

      <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        
        <p style="font-size: 16px; color: #374151;">Hi <strong>${participantName}</strong>,</p>
        
        <p style="font-size: 15px; color: #374151;">
          ${isWinner
            ? `Congratulations on achieving <strong>${position} Place</strong> in <strong>${eventName}</strong>! Your certificate of excellence is ready.`
            : `Thank you for participating in <strong>${eventName}</strong>! Your certificate of participation is ready.`
          }
        </p>

        <p style="font-size: 13px; color: #4b5563; margin-top: 8px;">
          Verification Code: <strong>${verificationCode || "N/A"}</strong>
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${certificateUrl}" 
             download
             style="
               display: inline-block;
               padding: 14px 32px;
               background: linear-gradient(135deg, #7C3AED, #EC4899);
               color: white;
               text-decoration: none;
               border-radius: 8px;
               font-weight: bold;
               font-size: 15px;
             ">
            Download Certificate
          </a>
        </div>

        <p style="font-size: 13px; color: #9ca3af; text-align: center;">
          You can also view and download your certificate anytime from your EventMate dashboard.
        </p>

      </div>

      <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">
        EventMate Team, Bajaj Chandrapur Polytechnic, Chandrapur
      </p>

    </div>
  `;

  return { subject, html };
};

const issueCertificateForParticipant = async ({
  participant,
  registration,
  event,
  certificateType,
  position,
  customization
}) => {
  const participantEmail = normalizeParticipantEmail(participant?.email);
  const participantName = String(participant?.name || participant?.fullName || "Participant").trim() || "Participant";

  if (!participantEmail) {
    return { status: "skipped", reason: "Participant email missing." };
  }

  const existing = await Certificate.findOne({
    eventId: event._id,
    participantEmail
  });
  if (existing) {
    return { status: "exists", reason: "Certificate already issued." };
  }

  const resolvedType = normalizeCertificateType(certificateType) || "participation";
  const resolvedPosition = resolvedType === "winner" ? position || null : null;
  const eventDate = event.schedule?.startDate
    ? new Date(event.schedule.startDate).toDateString()
    : "TBA";
  const venue = event.venue?.location || event.venue?.mode || "TBA";
  const backendBaseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  const certificateUrl = `${backendBaseUrl}/api/certificates/download/${event._id}/${buildCertificateEmailSlug(participantEmail)}`;
  let certificateRecord = null;
  let verificationCode = null;
  let duplicateParticipantCertificate = false;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    verificationCode = await generateUniqueVerificationCode();
    const pdfBuffer = await generateCertificatePDF({
      participantName,
      eventName: event.title,
      eventDate,
      venue,
      certificateType: resolvedType,
      position: resolvedPosition,
      customization,
      verificationCode
    });

    const base64PDF = pdfBuffer.toString("base64");

    try {
      certificateRecord = await Certificate.create({
        eventId: event._id,
        eventName: event.title,
        eventDate,
        registrationId: registration._id,
        participantName,
        participantEmail,
        certificateType: resolvedType,
        position: resolvedPosition,
        certificateUrl,
        certificateData: base64PDF,
        verificationCode
      });
      break;
    } catch (creationError) {
      if (isDuplicateParticipantCertificateError(creationError)) {
        duplicateParticipantCertificate = true;
        break;
      }
      if (isDuplicateVerificationCodeError(creationError)) {
        continue;
      }
      throw creationError;
    }
  }

  if (duplicateParticipantCertificate || !certificateRecord) {
    if (duplicateParticipantCertificate) {
      return { status: "exists", reason: "Certificate already issued." };
    }
    throw new Error("Unable to generate a unique verification code for certificate.");
  }

  const { subject, html } = certificateEmailTemplate({
    participantName,
    eventName: event.title,
    certificateType: resolvedType,
    position: resolvedPosition,
    certificateUrl,
    verificationCode: certificateRecord.verificationCode
  });

  let emailDeliveryFailed = false;
  try {
    await sendEmail(participantEmail, subject, html);
  } catch (emailError) {
    emailDeliveryFailed = true;
    console.error(
      `Certificate email failed for ${participantEmail}: ${emailError?.message || "Unknown error"}`
    );
  }

  await sendNotification({
    recipientId: registration.registeredBy,
    recipientName: participantName,
    recipientRole: "STUDENT",
    title: "Certificate Issued! ðŸŽ“",
    message: emailDeliveryFailed
      ? `Your certificate for ${event.title} is ready. Download it from your dashboard.`
      : `Your certificate for ${event.title} is ready. Check your email!`,
    type: "CERTIFICATE",
    refId: event._id
  });

  await createCertificateAuditLog({
    certificateId: certificateRecord._id,
    eventId: event._id,
    action: "ISSUED",
    outcome: "SUCCESS",
    verificationCode: certificateRecord.verificationCode,
    certificateStatus: certificateRecord.verificationStatus || "VALID",
    participantName,
    participantEmail,
    eventName: event.title,
    actorId: null,
    actorName: "System",
    actorRole: "SYSTEM",
    source: "SYSTEM",
    message: emailDeliveryFailed
      ? "Certificate issued, but email delivery failed."
      : "Certificate issued and delivered to participant.",
    metadata: {
      registrationId: registration._id,
      certificateType: resolvedType,
      position: resolvedPosition || null,
      emailDeliveryFailed
    }
  });

  return { status: "issued", certificateId: certificateRecord._id };
};

/* ================================================
   MAIN EXPORT
   Called from feedback.service.js after feedback submitted
================================================ */

export const generateCertificatesForRegistration = async (registration, event) => {
  try {
    if (!event?.certificate?.isEnabled) {
      return 0;
    }
    const rankingComplete = await isEventWinnerRankingComplete(event?._id);
    if (!rankingComplete) {
      return 0;
    }

    if (event?.isTeamEvent) {
      const feedbackExists = await hasTeamLeaderFeedback(event._id, registration._id);
      if (!feedbackExists) {
        return 0;
      }
    }

    let issuedCount = 0;
    const isWinner = registration.winner?.isWinner || false;
    const position = registration.winner?.position || null;

    const customization = normalizeCertificateCustomization(event?.certificate?.customization);
    let participants = [];

    if (!event.isTeamEvent) {
      const leaderQR = await ParticipantQR.findOne({
        registration: registration._id,
        email: registration.teamLeader.email,
        attendanceMarked: true
      });

      if (leaderQR) {
        participants = [{
          name: registration.teamLeader.name,
          email: registration.teamLeader.email
        }];
      }
    } else {
      if (isWinner) {
        participants = buildTeamParticipantsFromRegistration(registration);
      } else {
        const allQRs = await ParticipantQR.find({
          registration: registration._id,
          attendanceMarked: true
        });

        participants = allQRs.map((qr) => ({
          name: qr.name,
          email: qr.email
        }));
      }
    }

    if (participants.length === 0) {
      return 0;
    }

    const certificateType = isWinner ? "winner" : "participation";

    for (const participant of participants) {
      const result = await issueCertificateForParticipant({
        participant,
        registration,
        event,
        certificateType,
        position,
        customization
      });

      if (result?.status === "issued") {
        issuedCount += 1;
      }
    }

    return issuedCount;
  } catch (error) {
    console.error("Certificate generation failed:", error.message);
    throw error;
  }
};

export const generateCertificatesForEvent = async (eventId) => {
  const event = await Event.findById(eventId);
  if (!event) throw new Error("Event not found");

  if (!event?.certificate?.isEnabled) {
    throw new Error("Certificate template is not saved for this event");
  }

  const rankingComplete = await isEventWinnerRankingComplete(event._id);
  if (!rankingComplete) {
    throw new Error("Winner ranks must be assigned before issuing certificates");
  }

  if (event.status !== "Completed") {
    throw new Error("Certificates can only be generated after event is completed");
  }

  const registrations = await EventRegistration.find({
    event: eventId,
    status: "Confirmed"
  });

  let generatedCertificates = 0;
  let failedRegistrations = 0;
  const failures = [];

  for (const registration of registrations) {
    try {
      if (event.isTeamEvent) {
        const feedbackExists = await hasTeamLeaderFeedback(event._id, registration._id);
        if (!feedbackExists) {
          failedRegistrations += 1;
          failures.push({
            registrationId: registration?._id || null,
            participantEmail: registration?.teamLeader?.email || null,
            reason: "Team leader feedback is required before issuing group certificates."
          });
          continue;
        }
      }

      const generatedNow = await generateCertificatesForRegistration(registration, event);
      generatedCertificates += Number(generatedNow || 0);
    } catch (error) {
      failedRegistrations += 1;
      failures.push({
        registrationId: registration?._id || null,
        participantEmail: registration?.teamLeader?.email || null,
        reason: error?.message || "Unknown certificate generation error"
      });
    }
  }

  return {
    totalRegistrations: registrations.length,
    generatedCertificates,
    failedRegistrations,
    failures
  };
};

export const generateCertificatesForSelection = async (event, selections = []) => {
  if (!event) throw new Error("Event not found");

  if (!event?.certificate?.isEnabled) {
    throw new Error("Certificate template is not saved for this event");
  }

  const rankingComplete = await isEventWinnerRankingComplete(event._id);
  if (!rankingComplete) {
    throw new Error("Winner ranks must be assigned before issuing certificates");
  }

  if (event.status !== "Completed") {
    throw new Error("Certificates can only be generated after event is completed");
  }

  const requests = Array.isArray(selections) ? selections : [];
  const results = {
    totalRequested: requests.length,
    issued: 0,
    skipped: 0,
    failed: 0,
    failures: []
  };

  const customization = normalizeCertificateCustomization(event?.certificate?.customization);

  const recordFailure = (selection, reason) => {
    results.failed += 1;
    results.failures.push({
      registrationId: selection?.registrationId || null,
      participantEmail: normalizeParticipantEmail(selection?.participantEmail) || null,
      reason
    });
  };

  const recordSkipped = (selection, reason) => {
    results.skipped += 1;
    results.failures.push({
      registrationId: selection?.registrationId || null,
      participantEmail: normalizeParticipantEmail(selection?.participantEmail) || null,
      reason
    });
  };

  for (const selection of requests) {
    const registrationId = String(selection?.registrationId || "").trim();
    const participantEmail = normalizeParticipantEmail(selection?.participantEmail);

    if (!registrationId || !participantEmail) {
      recordFailure(selection, "Registration and participant email are required.");
      continue;
    }

    const registration = await EventRegistration.findById(registrationId);
    if (!registration) {
      recordFailure(selection, "Registration not found.");
      continue;
    }

    if (String(registration.event || "") !== String(event._id || "")) {
      recordFailure(selection, "Registration does not belong to this event.");
      continue;
    }

    if (registration.status !== "Confirmed") {
      recordFailure(selection, "Only confirmed registrations can receive certificates.");
      continue;
    }

    if (event.isTeamEvent) {
      const feedbackExists = await hasTeamLeaderFeedback(event._id, registration._id);
      if (!feedbackExists) {
        recordFailure(selection, "Team leader feedback is required before issuing group certificates.");
        continue;
      }
    }

    const participantQr = await ParticipantQR.findOne({
      registration: registration._id,
      email: participantEmail,
      attendanceMarked: true
    });

    if (!participantQr) {
      recordFailure(selection, "Attendance not marked for this participant.");
      continue;
    }

    const certificateType = normalizeCertificateType(selection?.certificateType);
    if (!certificateType) {
      recordFailure(selection, "Certificate type must be participation or winner.");
      continue;
    }

    let position = null;
    if (certificateType === "winner") {
      position =
        normalizeWinnerPosition(selection?.position) ||
        normalizeWinnerPosition(registration?.winner?.position);
      if (!position) {
        recordFailure(selection, "Winner position must be 1st, 2nd, or 3rd.");
        continue;
      }
    }

    try {
      const result = await issueCertificateForParticipant({
        participant: { name: participantQr.name, email: participantEmail },
        registration,
        event,
        certificateType,
        position,
        customization
      });

      if (result?.status === "issued") {
        results.issued += 1;
      } else if (result?.status === "exists" || result?.status === "skipped") {
        recordSkipped(selection, result.reason || "Certificate already issued.");
      } else {
        recordFailure(selection, result?.reason || "Unable to issue certificate.");
      }
    } catch (error) {
      recordFailure(selection, error?.message || "Unable to issue certificate.");
    }
  }

  return results;
};



