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
import User from "../models/User.model.js";
import sendEmail from "../config/sendEmail.js";
import { sendNotification } from "./notification.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const buildCertificateEmailSlug = (email) =>
  String(email || "").trim().toLowerCase().replace(/[@.]/g, "_");

const normalizeBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");

const getBackendBaseUrl = ({ required = true } = {}) => {
  const backendBaseUrl = normalizeBaseUrl(
    process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL
  );

  if (!backendBaseUrl && required) {
    throw new Error("BACKEND_URL is required to generate certificate links.");
  }

  return backendBaseUrl;
};

export const buildCertificateDownloadUrl = (
  eventId,
  participantEmail,
  backendBaseUrl = getBackendBaseUrl({ required: false })
) => {
  const normalizedBaseUrl = normalizeBaseUrl(backendBaseUrl);
  const normalizedEventId = String(eventId || "").trim();
  const emailSlug = buildCertificateEmailSlug(participantEmail);

  if (!normalizedBaseUrl || !normalizedEventId || !emailSlug) {
    return "";
  }

  return `${normalizedBaseUrl}/api/certificates/download/${normalizedEventId}/${emailSlug}`;
};

const formatCertificateDate = (value) => {
  const parsed = new Date(value || 0);
  if (Number.isNaN(parsed.getTime())) return "TBA";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parsed);
};

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

const CERTIFICATE_HEADER = {
  trust: "Sarvodaya Mahila Mandal's",
  campus: "Balaji Ward, Chandrapur (M.S.)",
  approvals: "Approved by AICTE, New Delhi, Govt. of Maharashtra DTE, Mumbai & Affiliated to MSBTE",
  estd: "ESTD : 1985"
};
const VERIFICATION_BADGE_WIDTH = 260;
const VERIFICATION_BADGE_HEIGHT = 24;
const SIGNATURE_DISPLAY_MAX_HEIGHT = 34;
const DEMO_WINNER_POSITION = "1st";
const DEFAULT_SIGNATURE_WIDTH = 130;
const LEGACY_SIGNATURE_WIDTH = 90;

const createDefaultCertificateLayout = () => ({
  logo: { x: 5.5, y: 8.5, width: 60, anchor: "left" },
  accreditationLogo: { x: 94.5, y: 6.5, width: 70, anchor: "right" },
  estd: { x: 79.5, y: 6, anchor: "center" },
  trust: { x: 50, y: 6, anchor: "center" },
  campus: { x: 50, y: 18, anchor: "center" },
  approvals: { x: 50, y: 21.5, anchor: "center" },
  issuerName: { x: 50, y: 13, anchor: "center" },
  title: { x: 50, y: 30, anchor: "center" },
  introText: { x: 50, y: 42.5, anchor: "center" },
  participantName: { x: 50, y: 50.5, anchor: "center" },
  actionText: { x: 50, y: 58.5, anchor: "center" },
  eventName: { x: 50, y: 64.5, anchor: "center" },
  dateVenue: { x: 50, y: 71, anchor: "center" },
  organizerSignature: { x: 12, y: 82, width: DEFAULT_SIGNATURE_WIDTH, anchor: "left" },
  hodSignature: { x: 50, y: 82, width: DEFAULT_SIGNATURE_WIDTH, anchor: "center" },
  principalSignature: { x: 88, y: 82, width: DEFAULT_SIGNATURE_WIDTH, anchor: "right" },
  coordinatorLabel: { x: 12, y: 90, anchor: "left" },
  hodLabel: { x: 50, y: 90, anchor: "center" },
  principalLabel: { x: 88, y: 90, anchor: "right" },
  footerText: { x: 50, y: 75, anchor: "center" },
  verificationCode: {
    x: 96,
    y: 92,
    width: VERIFICATION_BADGE_WIDTH,
    height: VERIFICATION_BADGE_HEIGHT,
    anchor: "right"
  }
});

const LEGACY_DEFAULT_BODY_LAYOUT = Object.freeze({
  introText: { x: 12, y: 43, anchor: "left" },
  participantName: { x: 12, y: 50, anchor: "left" },
  actionText: { x: 12, y: 58, anchor: "left" },
  eventName: { x: 12, y: 63, anchor: "left" },
  dateVenue: { x: 12, y: 70, anchor: "left" }
});

const LEGACY_DEFAULT_SIGNATURE_LAYOUT = Object.freeze({
  organizerSignature: { x: 12, y: 82, width: LEGACY_SIGNATURE_WIDTH, anchor: "left" },
  hodSignature: { x: 50, y: 82, width: LEGACY_SIGNATURE_WIDTH, anchor: "center" },
  principalSignature: { x: 88, y: 82, width: LEGACY_SIGNATURE_WIDTH, anchor: "right" }
});

const createDefaultCertificateStyles = () => ({
  issuerName: { fontSize: 24, color: "#b91c1c" },
  title: { fontSize: 20, color: "#ffffff" },
  introText: { fontSize: 12, color: "#334155" },
  participantName: { fontSize: 22, color: "#0f172a" },
  actionText: { fontSize: 12, color: "#334155" },
  eventName: { fontSize: 16, color: "#0f172a" },
  dateVenue: { fontSize: 11, color: "#475569" },
  organizerName: { fontSize: 10, color: "#334155" },
  organizerDepartment: { fontSize: 9, color: "#64748b" },
  hodName: { fontSize: 10, color: "#334155" },
  hodDepartment: { fontSize: 9, color: "#64748b" },
  principalName: { fontSize: 10, color: "#334155" },
  principalDepartment: { fontSize: 9, color: "#64748b" },
  coordinatorLabel: { fontSize: 11, color: "#b91c1c" },
  hodLabel: { fontSize: 11, color: "#b91c1c" },
  principalLabel: { fontSize: 11, color: "#b91c1c" },
  footerText: { fontSize: 11, color: "#1f2937" }
});

const createDefaultCertificateCustomization = () => ({
  issuerName: "BAJAJ CHANDRAPUR POLYTECHNIC",
  participationTitle: "Certificate",
  winnerTitle: "Certificate of Excellence",
  introText: "This is to certify that Mr./Miss",
  participationActionText: "Participated in the Event",
  winnerActionText: "Secured {position} Position in",
  footerText: "We appreciate his/her enthusiasm and wish him/her all the best for future.",
  coordinatorLabel: "Organizer",
  hodLabel: "HOD",
  principalLabel: "Principal",
  organizerName: "",
  organizerDepartment: "",
  hodName: "",
  hodDepartment: "",
  principalName: "",
  principalDepartment: "",
  organizerSignatureUrl: "",
  hodSignatureUrl: "",
  principalSignatureUrl: "",
  accreditationLogoUrl: "",
  logoUrl: "",
  backgroundImageUrl: "",
  layout: createDefaultCertificateLayout(),
  styles: createDefaultCertificateStyles()
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
  hodLabel: 50,
  principalLabel: 50,
  organizerName: 80,
  organizerDepartment: 80,
  hodName: 80,
  hodDepartment: 80,
  principalName: 80,
  principalDepartment: 80,
  backgroundImageUrl: 800,
  accreditationLogoUrl: 800,
  logoUrl: 800,
  organizerSignatureUrl: 800,
  hodSignatureUrl: 800,
  principalSignatureUrl: 800
});

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const sanitizeFontSize = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clampNumber(numeric, 8, 40);
};

const sanitizeCustomizationField = (value, fallback, maxLength) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;
  if (!Number.isFinite(maxLength) || maxLength <= 0) return normalized;
  return normalized.slice(0, maxLength);
};

const sanitizeColor = (value, fallback) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    return normalized.toLowerCase();
  }
  return fallback;
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

const sanitizeSignatureWidth = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clampNumber(numeric, 40, 200);
};

const sanitizeVerificationBadgeWidth = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clampNumber(numeric, 180, 420);
};

const sanitizeVerificationBadgeHeight = (value, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return clampNumber(numeric, 22, 52);
};

const sanitizeImageUrl = (value) => {
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

const matchesLayoutNode = (layoutNode, targetNode) =>
  Number(layoutNode?.x) === targetNode.x &&
  Number(layoutNode?.y) === targetNode.y &&
  String(layoutNode?.anchor || "").trim().toLowerCase() === targetNode.anchor;

const matchesSignatureLayoutNode = (layoutNode, targetNode) =>
  matchesLayoutNode(layoutNode, targetNode) && Number(layoutNode?.width) === targetNode.width;

const normalizeStyleNode = (styleNode, fallbackNode) => ({
  fontSize: sanitizeFontSize(styleNode?.fontSize, fallbackNode.fontSize),
  color: sanitizeColor(styleNode?.color, fallbackNode.color)
});

const normalizeCertificateLayout = (layout = {}) => {
  const fallback = createDefaultCertificateLayout();
  const shouldUpgradeLegacyBodyDefaults =
    Object.keys(LEGACY_DEFAULT_BODY_LAYOUT).length > 0 &&
    Object.entries(LEGACY_DEFAULT_BODY_LAYOUT).every(([fieldKey, legacyNode]) =>
      matchesLayoutNode(layout?.[fieldKey], legacyNode)
    );
  const shouldUpgradeLegacySignatureDefaults =
    Object.keys(LEGACY_DEFAULT_SIGNATURE_LAYOUT).length > 0 &&
    Object.entries(LEGACY_DEFAULT_SIGNATURE_LAYOUT).every(([fieldKey, legacyNode]) =>
      matchesSignatureLayoutNode(layout?.[fieldKey], legacyNode)
    );
  return {
    logo: {
      ...normalizeLayoutNode(layout?.logo, fallback.logo),
      width: sanitizeLogoWidth(layout?.logo?.width, fallback.logo.width)
    },
    accreditationLogo: {
      ...normalizeLayoutNode(layout?.accreditationLogo, fallback.accreditationLogo),
      width: sanitizeLogoWidth(
        layout?.accreditationLogo?.width,
        fallback.accreditationLogo.width
      )
    },
    estd: normalizeLayoutNode(layout?.estd, fallback.estd),
    trust: normalizeLayoutNode(layout?.trust, fallback.trust),
    campus: normalizeLayoutNode(layout?.campus, fallback.campus),
    approvals: normalizeLayoutNode(layout?.approvals, fallback.approvals),
    issuerName: normalizeLayoutNode(layout?.issuerName, fallback.issuerName),
    title: normalizeLayoutNode(layout?.title, fallback.title),
    introText: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.introText : layout?.introText,
      fallback.introText
    ),
    participantName: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.participantName : layout?.participantName,
      fallback.participantName
    ),
    actionText: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.actionText : layout?.actionText,
      fallback.actionText
    ),
    eventName: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.eventName : layout?.eventName,
      fallback.eventName
    ),
    dateVenue: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.dateVenue : layout?.dateVenue,
      fallback.dateVenue
    ),
    organizerSignature: {
      ...normalizeLayoutNode(layout?.organizerSignature, fallback.organizerSignature),
      width: sanitizeSignatureWidth(
        shouldUpgradeLegacySignatureDefaults ? undefined : layout?.organizerSignature?.width,
        fallback.organizerSignature.width
      )
    },
    hodSignature: {
      ...normalizeLayoutNode(layout?.hodSignature, fallback.hodSignature),
      width: sanitizeSignatureWidth(
        shouldUpgradeLegacySignatureDefaults ? undefined : layout?.hodSignature?.width,
        fallback.hodSignature.width
      )
    },
    principalSignature: {
      ...normalizeLayoutNode(layout?.principalSignature, fallback.principalSignature),
      width: sanitizeSignatureWidth(
        shouldUpgradeLegacySignatureDefaults ? undefined : layout?.principalSignature?.width,
        fallback.principalSignature.width
      )
    },
    coordinatorLabel: normalizeLayoutNode(layout?.coordinatorLabel, fallback.coordinatorLabel),
    hodLabel: normalizeLayoutNode(layout?.hodLabel, fallback.hodLabel),
    principalLabel: normalizeLayoutNode(layout?.principalLabel, fallback.principalLabel),
    footerText: normalizeLayoutNode(layout?.footerText, fallback.footerText),
    verificationCode: {
      ...normalizeLayoutNode(layout?.verificationCode, fallback.verificationCode),
      width: sanitizeVerificationBadgeWidth(
        layout?.verificationCode?.width,
        fallback.verificationCode.width
      ),
      height: sanitizeVerificationBadgeHeight(
        layout?.verificationCode?.height,
        fallback.verificationCode.height
      )
    }
  };
};

const normalizeCertificateStyles = (styles = {}) => {
  const fallback = createDefaultCertificateStyles();
  return {
    issuerName: normalizeStyleNode(styles?.issuerName, fallback.issuerName),
    title: normalizeStyleNode(styles?.title, fallback.title),
    introText: normalizeStyleNode(styles?.introText, fallback.introText),
    participantName: normalizeStyleNode(styles?.participantName, fallback.participantName),
    actionText: normalizeStyleNode(styles?.actionText, fallback.actionText),
    eventName: normalizeStyleNode(styles?.eventName, fallback.eventName),
    dateVenue: normalizeStyleNode(styles?.dateVenue, fallback.dateVenue),
    organizerName: normalizeStyleNode(styles?.organizerName, fallback.organizerName),
    organizerDepartment: normalizeStyleNode(styles?.organizerDepartment, fallback.organizerDepartment),
    hodName: normalizeStyleNode(styles?.hodName, fallback.hodName),
    hodDepartment: normalizeStyleNode(styles?.hodDepartment, fallback.hodDepartment),
    principalName: normalizeStyleNode(styles?.principalName, fallback.principalName),
    principalDepartment: normalizeStyleNode(styles?.principalDepartment, fallback.principalDepartment),
    coordinatorLabel: normalizeStyleNode(styles?.coordinatorLabel, fallback.coordinatorLabel),
    hodLabel: normalizeStyleNode(styles?.hodLabel, fallback.hodLabel),
    principalLabel: normalizeStyleNode(styles?.principalLabel, fallback.principalLabel),
    footerText: normalizeStyleNode(styles?.footerText, fallback.footerText)
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
    hodLabel: sanitizeCustomizationField(
      safeCustomization.hodLabel,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.hodLabel,
      CERTIFICATE_CUSTOMIZATION_LIMITS.hodLabel
    ),
    principalLabel: sanitizeCustomizationField(
      safeCustomization.principalLabel,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.principalLabel,
      CERTIFICATE_CUSTOMIZATION_LIMITS.principalLabel
    ),
    organizerName: sanitizeCustomizationField(
      safeCustomization.organizerName,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.organizerName,
      CERTIFICATE_CUSTOMIZATION_LIMITS.organizerName
    ),
    organizerDepartment: sanitizeCustomizationField(
      safeCustomization.organizerDepartment,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.organizerDepartment,
      CERTIFICATE_CUSTOMIZATION_LIMITS.organizerDepartment
    ),
    hodName: sanitizeCustomizationField(
      safeCustomization.hodName,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.hodName,
      CERTIFICATE_CUSTOMIZATION_LIMITS.hodName
    ),
    hodDepartment: sanitizeCustomizationField(
      safeCustomization.hodDepartment,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.hodDepartment,
      CERTIFICATE_CUSTOMIZATION_LIMITS.hodDepartment
    ),
    principalName: sanitizeCustomizationField(
      safeCustomization.principalName,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.principalName,
      CERTIFICATE_CUSTOMIZATION_LIMITS.principalName
    ),
    principalDepartment: sanitizeCustomizationField(
      safeCustomization.principalDepartment,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.principalDepartment,
      CERTIFICATE_CUSTOMIZATION_LIMITS.principalDepartment
    ),
    organizerSignatureUrl: sanitizeImageUrl(safeCustomization.organizerSignatureUrl),
    hodSignatureUrl: sanitizeImageUrl(safeCustomization.hodSignatureUrl),
    principalSignatureUrl: sanitizeImageUrl(safeCustomization.principalSignatureUrl),
    accreditationLogoUrl: sanitizeImageUrl(safeCustomization.accreditationLogoUrl),
    logoUrl: sanitizeImageUrl(safeCustomization.logoUrl),
    backgroundImageUrl: sanitizeImageUrl(safeCustomization.backgroundImageUrl),
    layout: normalizeCertificateLayout(safeCustomization.layout),
    styles: normalizeCertificateStyles(safeCustomization.styles)
  };
};

const buildWinnerActionText = (template, position) => {
  const safePosition = String(position || "Winning").trim() || "Winning";
  if (!/\{position\}/i.test(template)) {
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
const LOGO_PATH = path.join(__dirname, "../../../Frontend/src/assets/logo.png");
const ACCREDITATION_LOGO_PATH = path.join(
  __dirname,
  "../../../Frontend/src/assets/nba-accreditation.png"
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const resolveImageBuffer = async (imageUrl) => {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
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

const offsetLayoutNode = (node, offsetY) => ({
  ...node,
  y: clampNumber(Number(node?.y || 0) + offsetY, 0, 100)
});

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
    characterSpacing = 0,
    singleLine = false,
    minFontSize = 8
  }
) => {
  if (!text) return;

  const x = (layoutNode.x / 100) * pageWidth;
  const y = (layoutNode.y / 100) * pageHeight;
  const width = clampNumber(Number(maxWidth || pageWidth * 0.8), 40, pageWidth);

  doc.fillColor(color).font(font);

  let resolvedFontSize = fontSize;
  doc.fontSize(resolvedFontSize);

  if (singleLine && !String(text).includes("\n")) {
    let measuredSingleLineWidth =
      Number(doc.widthOfString(text, { characterSpacing })) || 0;

    while (measuredSingleLineWidth > width && resolvedFontSize > minFontSize) {
      resolvedFontSize = Math.max(minFontSize, resolvedFontSize - 0.5);
      doc.fontSize(resolvedFontSize);
      measuredSingleLineWidth =
        Number(doc.widthOfString(text, { characterSpacing })) || 0;
      if (resolvedFontSize === minFontSize) break;
    }

    const drawX = computeAnchoredX({
      x,
      width: Math.min(measuredSingleLineWidth, width),
      anchor: layoutNode.anchor,
      pageWidth
    });

    doc.text(text, drawX, y, {
      lineBreak,
      characterSpacing
    });
    return;
  }

  doc.fontSize(resolvedFontSize);

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
  const styles = resolvedCustomization.styles || createDefaultCertificateStyles();
  const isWinner = certificateType === "winner";
  const typeLabel = isWinner
    ? resolvedCustomization.winnerTitle
    : resolvedCustomization.participationTitle;
  const actionText = isWinner
    ? buildWinnerActionText(resolvedCustomization.winnerActionText, position)
    : resolvedCustomization.participationActionText;

  const backgroundBuffer = await resolveImageBuffer(
    resolvedCustomization.backgroundImageUrl
  );
  const logoBuffer = await resolveImageBuffer(resolvedCustomization.logoUrl);
  const accreditationLogoBuffer = await resolveImageBuffer(
    resolvedCustomization.accreditationLogoUrl
  );
  const organizerSignatureBuffer = await resolveImageBuffer(
    resolvedCustomization.organizerSignatureUrl
  );
  const hodSignatureBuffer = await resolveImageBuffer(
    resolvedCustomization.hodSignatureUrl
  );
  const principalSignatureBuffer = await resolveImageBuffer(
    resolvedCustomization.principalSignatureUrl
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

    const showTemplateDecor = !backgroundBuffer;
    if (showTemplateDecor) {
      doc.rect(0, 0, W, H).fill("#f8fafc");
      doc.rect(0, 0, W, H * 0.26).fill("#e5ecf6");
      doc.rect(0, 0, W, H * 0.12).fill("#d9e4f2");

      const sideBandWidth = W * 0.012;
      doc.save();
      doc.opacity(0.6);
      doc.rect(0, 0, sideBandWidth, H).fill("#f2c14e");
      doc.rect(W - sideBandWidth, 0, sideBandWidth, H).fill("#f2c14e");
      doc.restore();

      doc.rect(16, 16, W - 32, H - 32).lineWidth(1.2).stroke("#94a3b8");
      doc.save();
      doc.opacity(0.7);
      doc.rect(24, 24, W - 48, H - 48).lineWidth(0.8).stroke("#f59e0b");
      doc.restore();

      drawAnchoredText(doc, {
        text: CERTIFICATE_HEADER.trust,
        pageWidth: W,
        pageHeight: H,
        layoutNode: layout.trust,
        fontSize: 10,
        font: "Helvetica-Bold",
        color: "#475569",
        maxWidth: W * 0.9,
        characterSpacing: 2.2
      });

      drawAnchoredText(doc, {
        text: CERTIFICATE_HEADER.campus,
        pageWidth: W,
        pageHeight: H,
        layoutNode: layout.campus,
        fontSize: 11,
        font: "Helvetica-Bold",
        color: "#334155",
        maxWidth: W * 0.9
      });

      drawAnchoredText(doc, {
        text: CERTIFICATE_HEADER.approvals,
        pageWidth: W,
        pageHeight: H,
        layoutNode: layout.approvals,
        fontSize: 9,
        font: "Helvetica",
        color: "#64748b",
        maxWidth: W * 0.9
      });

      drawAnchoredText(doc, {
        text: CERTIFICATE_HEADER.estd,
        pageWidth: W,
        pageHeight: H,
        layoutNode: layout.estd,
        fontSize: 8,
        font: "Helvetica-Bold",
        color: "#475569",
        maxWidth: W * 0.2
      });

      doc.save();
      doc.opacity(0.45);
      doc.lineWidth(0.6).stroke("#94a3b8");
      doc.moveTo(W * 0.12, H * 0.25).lineTo(W * 0.88, H * 0.25).stroke();
      doc.restore();

      doc.save();
      doc.opacity(0.05);
      const wmRadius = Math.min(W, H) * 0.15;
      const wmX = W / 2;
      const wmY = H * 0.52;
      doc.circle(wmX, wmY, wmRadius).lineWidth(2).stroke("#64748b");
      doc.circle(wmX, wmY, wmRadius * 0.75).lineWidth(1).stroke("#64748b");
      for (let i = 0; i < 16; i += 1) {
        const angle = (i * Math.PI) / 8;
        const x1 = wmX + Math.cos(angle) * wmRadius * 0.35;
        const y1 = wmY + Math.sin(angle) * wmRadius * 0.35;
        const x2 = wmX + Math.cos(angle) * wmRadius * 0.9;
        const y2 = wmY + Math.sin(angle) * wmRadius * 0.9;
        doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(1).stroke("#64748b");
      }
      doc.restore();

      doc.save();
      doc.opacity(0.14);
      doc
        .moveTo(0, H - 90)
        .lineTo(W * 0.08, H - 105)
        .lineTo(W * 0.18, H - 95)
        .lineTo(W * 0.3, H - 115)
        .lineTo(W * 0.42, H - 95)
        .lineTo(W * 0.56, H - 110)
        .lineTo(W * 0.7, H - 95)
        .lineTo(W * 0.82, H - 110)
        .lineTo(W, H - 100)
        .lineTo(W, H)
        .lineTo(0, H)
        .closePath()
        .fill("#64748b");
      for (let i = 0; i < 18; i += 1) {
        const cx = 40 + i * 60;
        doc.circle(cx, H - 20, 12).fill("#64748b");
      }
      doc.restore();

      doc.save();
      doc.opacity(0.55);
      doc.lineWidth(0.6).stroke("#94a3b8");
      doc.moveTo(W * 0.08, H * 0.84).lineTo(W * 0.28, H * 0.84).stroke();
      doc.moveTo(W * 0.4, H * 0.84).lineTo(W * 0.6, H * 0.84).stroke();
      doc.moveTo(W * 0.72, H * 0.84).lineTo(W * 0.92, H * 0.84).stroke();
      doc.restore();
    }

    const logoCenterX = (layout.logo.x / 100) * W;
    const logoTopY = (layout.logo.y / 100) * H;
    const logoWidth = layout.logo.width;
    const logoX = computeAnchoredX({
      x: logoCenterX,
      width: logoWidth,
      anchor: layout.logo.anchor,
      pageWidth: W
    });

    let logoRendered = false;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, logoX, logoTopY, { width: logoWidth });
        logoRendered = true;
      } catch {
        logoRendered = false;
      }
    }
    if (!logoRendered) {
      try {
        doc.image(LOGO_PATH, logoX, logoTopY, { width: logoWidth });
        logoRendered = true;
      } catch {
        logoRendered = false;
      }
    }

    if (!logoRendered) {
      const centerX = logoX + logoWidth / 2;
      const centerY = logoTopY + logoWidth / 2;
      doc.save();
      doc.circle(centerX, centerY, logoWidth / 2).lineWidth(2).stroke("#b45309");
      doc.circle(centerX, centerY, logoWidth / 2 - 6).lineWidth(1).stroke("#f59e0b");
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#b45309")
        .text("BCP", centerX - logoWidth / 4, centerY - 5, {
          width: logoWidth / 2,
          align: "center"
        });
      doc.restore();
    }
    if (layout.accreditationLogo?.width) {
      const accreditationWidth = layout.accreditationLogo.width;
      const accreditationX = computeAnchoredX({
        x: (layout.accreditationLogo.x / 100) * W,
        width: accreditationWidth,
        anchor: layout.accreditationLogo.anchor,
        pageWidth: W
      });
      const accreditationY = clampNumber(
        (layout.accreditationLogo.y / 100) * H,
        0,
        Math.max(H - accreditationWidth, 0)
      );
      let accreditationLogoRendered = false;
      if (accreditationLogoBuffer) {
        try {
          doc.image(accreditationLogoBuffer, accreditationX, accreditationY, {
            width: accreditationWidth
          });
          accreditationLogoRendered = true;
        } catch {
          accreditationLogoRendered = false;
        }
      }
      if (!accreditationLogoRendered) {
        try {
          doc.image(ACCREDITATION_LOGO_PATH, accreditationX, accreditationY, {
            width: accreditationWidth
          });
        } catch {
          // Ignore missing or invalid accreditation logo assets.
        }
      }
    }

    const ribbonWidth = W * 0.46;
    const ribbonHeight = H * 0.09;
    const ribbonX = computeAnchoredX({
      x: (layout.title.x / 100) * W,
      width: ribbonWidth,
      anchor: layout.title.anchor,
      pageWidth: W
    });
    const ribbonY = (layout.title.y / 100) * H;

    doc.save();
    doc.fillColor("#9F1239");
    doc.roundedRect(ribbonX, ribbonY, ribbonWidth, ribbonHeight, 8).fill();
    doc.polygon(
      [ribbonX - ribbonHeight * 0.6, ribbonY + ribbonHeight / 2],
      [ribbonX, ribbonY + ribbonHeight * 0.1],
      [ribbonX, ribbonY + ribbonHeight * 0.9]
    ).fill("#7F1D1D");
    doc.polygon(
      [ribbonX + ribbonWidth + ribbonHeight * 0.6, ribbonY + ribbonHeight / 2],
      [ribbonX + ribbonWidth, ribbonY + ribbonHeight * 0.1],
      [ribbonX + ribbonWidth, ribbonY + ribbonHeight * 0.9]
    ).fill("#7F1D1D");
    doc.fillColor("#BE123C").rect(ribbonX, ribbonY, ribbonWidth, ribbonHeight * 0.4).fill();
    doc.restore();

    const drawSignatureImage = (buffer, layoutNode) => {
      if (!buffer || !layoutNode?.width) return;
      const width = layoutNode.width;
      const x = computeAnchoredX({
        x: (layoutNode.x / 100) * W,
        width,
        anchor: layoutNode.anchor,
        pageWidth: W
      });
      const y = (layoutNode.y / 100) * H;
      try {
        doc.image(buffer, x, y, {
          fit: [width, SIGNATURE_DISPLAY_MAX_HEIGHT],
          align:
            layoutNode.anchor === "right"
              ? "right"
              : layoutNode.anchor === "center"
                ? "center"
                : "left",
          valign: "bottom"
        });
      } catch {
        // Ignore invalid signature images.
      }
    };

    drawSignatureImage(organizerSignatureBuffer, layout.organizerSignature);
    drawSignatureImage(hodSignatureBuffer, layout.hodSignature);
      drawSignatureImage(principalSignatureBuffer, layout.principalSignature);

    const displayIssuerName = String(resolvedCustomization.issuerName || "").toUpperCase();

    drawAnchoredText(doc, {
      text: displayIssuerName,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.issuerName,
      fontSize: styles.issuerName.fontSize,
      font: "Helvetica-Bold",
      color: styles.issuerName.color,
      maxWidth: W * 0.92,
      characterSpacing: 1.4,
      lineBreak: false,
      singleLine: true,
      minFontSize: 18
    });

    const resolvedTitleSize =
      typeLabel.length > 22
        ? Math.max(styles.title.fontSize - 2, 12)
        : styles.title.fontSize;

    drawAnchoredText(doc, {
      text: typeLabel,
      pageWidth: W,
      pageHeight: H,
      layoutNode: {
        ...layout.title,
        y: (ribbonY + Math.max((ribbonHeight - resolvedTitleSize) / 2 - 1, 0)) / H * 100
      },
      fontSize: resolvedTitleSize,
      font: "Helvetica-Bold",
      color: styles.title.color,
      maxWidth: ribbonWidth * 0.82,
      singleLine: true,
      minFontSize: 14
    });

    drawAnchoredText(doc, {
      text: resolvedCustomization.introText,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.introText,
      fontSize: styles.introText.fontSize,
      font: "Times-Italic",
      color: styles.introText.color,
      maxWidth: W * 0.8
    });

    drawAnchoredText(doc, {
      text: participantName,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.participantName,
      fontSize: styles.participantName.fontSize,
      font: "Times-Bold",
      color: styles.participantName.color,
      maxWidth: W * 0.82,
      singleLine: true,
      minFontSize: 16
    });

    drawAnchoredText(doc, {
      text: actionText,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.actionText,
      fontSize: styles.actionText.fontSize,
      font: "Times-Italic",
      color: styles.actionText.color,
      maxWidth: W * 0.8
    });

    drawAnchoredText(doc, {
      text: eventName,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.eventName,
      fontSize: styles.eventName.fontSize,
      font: "Times-Bold",
      color: styles.eventName.color,
      maxWidth: W * 0.84,
      lineBreak: true
    });

    const organizerLine = `Organized by ${resolvedCustomization.issuerName}, Chandrapur.`;
    const metaText = `${organizerLine}\nDate : ${eventDate}`;

    drawAnchoredText(doc, {
      text: metaText,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.dateVenue,
      fontSize: styles.dateVenue.fontSize,
      font: "Times-Italic",
      color: styles.dateVenue.color,
      maxWidth: W * 0.82,
      lineBreak: true
    });

    const organizerNameNode = offsetLayoutNode(layout.coordinatorLabel, -3.2);
    const organizerDeptNode = offsetLayoutNode(layout.coordinatorLabel, -1.6);
    const hodNameNode = offsetLayoutNode(layout.hodLabel, -3.2);
    const hodDeptNode = offsetLayoutNode(layout.hodLabel, -1.6);
    const principalNameNode = offsetLayoutNode(layout.principalLabel, -3.2);
    const principalDeptNode = offsetLayoutNode(layout.principalLabel, -1.6);

    if (resolvedCustomization.organizerName) {
      drawAnchoredText(doc, {
        text: resolvedCustomization.organizerName,
        pageWidth: W,
        pageHeight: H,
        layoutNode: organizerNameNode,
        fontSize: styles.organizerName.fontSize,
        font: "Helvetica-Bold",
        color: styles.organizerName.color,
        maxWidth: W * 0.28,
        singleLine: true
      });
    }
    if (resolvedCustomization.organizerDepartment) {
      drawAnchoredText(doc, {
        text: resolvedCustomization.organizerDepartment,
        pageWidth: W,
        pageHeight: H,
        layoutNode: organizerDeptNode,
        fontSize: styles.organizerDepartment.fontSize,
        font: "Helvetica",
        color: styles.organizerDepartment.color,
        maxWidth: W * 0.28,
        singleLine: true
      });
    }
    if (resolvedCustomization.hodName) {
      drawAnchoredText(doc, {
        text: resolvedCustomization.hodName,
        pageWidth: W,
        pageHeight: H,
        layoutNode: hodNameNode,
        fontSize: styles.hodName.fontSize,
        font: "Helvetica-Bold",
        color: styles.hodName.color,
        maxWidth: W * 0.28,
        singleLine: true
      });
    }
    if (resolvedCustomization.hodDepartment) {
      drawAnchoredText(doc, {
        text: resolvedCustomization.hodDepartment,
        pageWidth: W,
        pageHeight: H,
        layoutNode: hodDeptNode,
        fontSize: styles.hodDepartment.fontSize,
        font: "Helvetica",
        color: styles.hodDepartment.color,
        maxWidth: W * 0.28,
        singleLine: true
      });
    }
    if (resolvedCustomization.principalName) {
      drawAnchoredText(doc, {
        text: resolvedCustomization.principalName,
        pageWidth: W,
        pageHeight: H,
        layoutNode: principalNameNode,
        fontSize: styles.principalName.fontSize,
        font: "Helvetica-Bold",
        color: styles.principalName.color,
        maxWidth: W * 0.28,
        singleLine: true
      });
    }
    if (resolvedCustomization.principalDepartment) {
      drawAnchoredText(doc, {
        text: resolvedCustomization.principalDepartment,
        pageWidth: W,
        pageHeight: H,
        layoutNode: principalDeptNode,
        fontSize: styles.principalDepartment.fontSize,
        font: "Helvetica",
        color: styles.principalDepartment.color,
        maxWidth: W * 0.28,
        singleLine: true
      });
    }

    drawAnchoredText(doc, {
      text: resolvedCustomization.coordinatorLabel,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.coordinatorLabel,
      fontSize: styles.coordinatorLabel.fontSize,
      font: "Helvetica-Bold",
      color: styles.coordinatorLabel.color,
      maxWidth: W * 0.3,
      singleLine: true
    });

    drawAnchoredText(doc, {
      text: resolvedCustomization.hodLabel,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.hodLabel,
      fontSize: styles.hodLabel.fontSize,
      font: "Helvetica-Bold",
      color: styles.hodLabel.color,
      maxWidth: W * 0.4,
      singleLine: true
    });

    drawAnchoredText(doc, {
      text: resolvedCustomization.principalLabel,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.principalLabel,
      fontSize: styles.principalLabel.fontSize,
      font: "Helvetica-Bold",
      color: styles.principalLabel.color,
      maxWidth: W * 0.3,
      singleLine: true
    });

    drawAnchoredText(doc, {
      text: resolvedCustomization.footerText,
      pageWidth: W,
      pageHeight: H,
      layoutNode: layout.footerText,
      fontSize: styles.footerText.fontSize,
      font: "Times-Italic",
      color: styles.footerText.color,
      maxWidth: W * 0.95
    });

    if (verificationCode) {
      const badgeWidth = layout.verificationCode.width;
      const badgeHeight = layout.verificationCode.height;
      const badgeX = computeAnchoredX({
        x: (layout.verificationCode.x / 100) * W,
        width: badgeWidth,
        anchor: layout.verificationCode.anchor,
        pageWidth: W
      });
      const badgeY = clampNumber((layout.verificationCode.y / 100) * H, 0, H - badgeHeight);
      const badgePaddingX = Math.min(12, badgeWidth * 0.05);
      const labelWidth = clampNumber(badgeWidth * 0.34, 72, 110);
      const codeX = badgeX + badgePaddingX + labelWidth + 8;
      const textY = badgeY + Math.max((badgeHeight - 8) / 2 - 1, 4);

      doc.save();
      doc
        .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 6)
        .fill("#fef3c7");
      doc.lineWidth(0.8).strokeColor("#f59e0b").roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 6).stroke();
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#92400e")
        .text("Verification Code", badgeX + badgePaddingX, textY, {
          width: labelWidth,
          lineBreak: false
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#92400e")
        .text(`: ${verificationCode}`, codeX, textY, {
          width: Math.max(badgeX + badgeWidth - codeX - badgePaddingX, 40),
          lineBreak: false
        });
      doc.restore();
    }

    doc.end();
  });
};

export const generateDemoCertificateBuffer = async (event, participantName, options = {}) => {
  if (!event) {
    throw new Error("Event not found");
  }

  const displayName = String(participantName || "Organizer").trim() || "Organizer";
  const eventDate = event.schedule?.startDate
    ? formatCertificateDate(event.schedule.startDate)
    : "TBA";
  const venue = event.venue?.location || event.venue?.mode || "TBA";
  const customization = normalizeCertificateCustomization(event?.certificate?.customization);
  const certificateType = normalizeCertificateType(options?.certificateType) || "participation";
  const position =
    certificateType === "winner"
      ? normalizeWinnerPosition(options?.position) || DEMO_WINNER_POSITION
      : null;

  const demoYear = new Date().getFullYear();
  const demoVerificationCode = `EM-DEMO-${demoYear}-ABCD`;

  return generateCertificatePDF({
    participantName: displayName,
    eventName: event.title || "Event",
    eventDate,
    venue,
    certificateType,
    position,
    customization,
    verificationCode: demoVerificationCode
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

        ${
          certificateUrl
            ? `<div style="text-align: center; margin: 32px 0;">
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
              </div>`
            : ""
        }

        <p style="font-size: 13px; color: #9ca3af; text-align: center;">
          ${
            certificateUrl
              ? "You can also view and download your certificate anytime from your EventMate dashboard."
              : "Your certificate is ready in EventMate. Open the dashboard to view and download it while your public domain is still being set up."
          }
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
    ? formatCertificateDate(event.schedule.startDate)
    : "TBA";
  const venue = event.venue?.location || event.venue?.mode || "TBA";
  const certificateUrl = buildCertificateDownloadUrl(event._id, participantEmail);
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

  const participantUser = await User.findOne({ email: participantEmail }).select(
    "_id fullName role email"
  );
  const notificationRecipientId = participantUser?._id || registration.registeredBy;
  const notificationRecipientName =
    participantUser?.fullName || participantName || registration?.teamLeader?.name || "Student";
  const notificationRecipientRole = participantUser?.role || "STUDENT";
  const notificationRecipientEmail = participantUser?.email || participantEmail;

  await sendNotification({
    recipientId: notificationRecipientId,
    recipientName: notificationRecipientName,
    recipientRole: notificationRecipientRole,
    recipientEmail: notificationRecipientEmail,
    title: "Certificate Issued!",
    message: emailDeliveryFailed
      ? `Your certificate for ${event.title} is ready on the website. Download it from your dashboard.`
      : `Your certificate for ${event.title} is ready on the website and has also been emailed to you.`,
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

    if (isWinner && !normalizeWinnerPosition(position)) {
      return 0;
    }

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



