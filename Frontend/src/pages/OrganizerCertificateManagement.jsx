import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Download, Loader2, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventItem } from "../lib/backendAdapters";
import defaultAccreditationLogo from "../assets/nba-accreditation.png";
import defaultCertificateLogo from "../assets/logo.png";

const formatDate = (value) => {
  const parsed = new Date(value || 0);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const PDF_BASE_WIDTH = 841;
const PDF_BASE_HEIGHT = 595;
const PREVIEW_RATIO = PDF_BASE_WIDTH / PDF_BASE_HEIGHT;
const VERIFICATION_BADGE_WIDTH = 260;
const VERIFICATION_BADGE_HEIGHT = 24;
const SIGNATURE_DISPLAY_MAX_HEIGHT = 34;
const DEMO_WINNER_POSITION = "1st";
const DEFAULT_SIGNATURE_WIDTH = 130;
const LEGACY_SIGNATURE_WIDTH = 90;

const CERTIFICATE_HEADER = {
  trust: "Sarvodaya Mahila Mandal's",
  campus: "Balaji Ward, Chandrapur (M.S.)",
  approvals: "Approved by AICTE, New Delhi, Govt. of Maharashtra DTE, Mumbai & Affiliated to MSBTE",
  estd: "ESTD : 1985",
};
const DEMO_VERIFICATION_CODE = `EM-DEMO-${new Date().getFullYear()}-ABCD`;

const CertificateLogo = ({ size, className }) => (
  <img
    src={defaultCertificateLogo}
    alt="Bajaj Chandrapur Polytechnic logo"
    className={`object-contain drop-shadow-[0_6px_14px_rgba(15,23,42,0.15)] ${className || ""}`}
    style={{ width: size, height: size }}
  />
);

const AccreditationLogo = ({ size, className }) => (
  <img
    src={defaultAccreditationLogo}
    alt="NBA accreditation logo"
    className={`object-contain drop-shadow-[0_6px_14px_rgba(15,23,42,0.16)] ${className || ""}`}
    style={{ width: size, height: size }}
  />
);

const CertificateRibbon = ({ title, className, textClassName, textStyle }) => (
  <div className={`relative ${className || ""}`}>
    <svg viewBox="0 0 260 70" className="w-full h-full" aria-hidden="true">
      <polygon points="0,35 30,12 30,58" fill="#7F1D1D" />
      <polygon points="260,35 230,12 230,58" fill="#7F1D1D" />
      <rect x="30" y="12" width="200" height="46" rx="8" fill="#9F1239" />
      <rect x="30" y="12" width="200" height="18" fill="#BE123C" opacity="0.65" />
    </svg>
    <div
      className={`absolute inset-0 flex items-center justify-center text-white font-extrabold uppercase tracking-[0.28em] ${textClassName || ""}`}
      style={textStyle}
    >
      {title}
    </div>
  </div>
);

const buildOrganizerLine = (issuerName) =>
  `Organized by ${issuerName || "Bajaj Chandrapur Polytechnic"}, Chandrapur.`;

const buildWinnerPreviewActionText = (template, position) => {
  const safePosition = String(position || "Winning").trim() || "Winning";
  if (!/\{position\}/i.test(template)) {
    return `${template} ${safePosition}`.trim();
  }
  return template.replace(/\{position\}/gi, safePosition);
};

const SIGNATURE_LAYOUT_ROLE_MAP = Object.freeze([
  {
    signatureKey: "organizerSignature",
    labelKey: "coordinatorLabel",
  },
  {
    signatureKey: "hodSignature",
    labelKey: "hodLabel",
  },
  {
    signatureKey: "principalSignature",
    labelKey: "principalLabel",
  },
]);
const SIGNATURE_ROLE_FIELD_KEY_MAP = Object.freeze({
  organizer: "organizerSignatureUrl",
  hod: "hodSignatureUrl",
  principal: "principalSignatureUrl",
});
const AUTO_SIGNATURE_Y_OFFSET = 12.4;

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
    anchor: "right",
  },
});

const LEGACY_DEFAULT_BODY_LAYOUT = Object.freeze({
  introText: { x: 12, y: 43, anchor: "left" },
  participantName: { x: 12, y: 50, anchor: "left" },
  actionText: { x: 12, y: 58, anchor: "left" },
  eventName: { x: 12, y: 63, anchor: "left" },
  dateVenue: { x: 12, y: 70, anchor: "left" },
});

const LEGACY_DEFAULT_SIGNATURE_LAYOUT = Object.freeze({
  organizerSignature: { x: 12, y: 82, width: LEGACY_SIGNATURE_WIDTH, anchor: "left" },
  hodSignature: { x: 50, y: 82, width: LEGACY_SIGNATURE_WIDTH, anchor: "center" },
  principalSignature: { x: 88, y: 82, width: LEGACY_SIGNATURE_WIDTH, anchor: "right" },
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
  footerText: { fontSize: 11, color: "#1f2937" },
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
  styles: createDefaultCertificateStyles(),
});

const DEFAULT_CERTIFICATE_CUSTOMIZATION = Object.freeze(createDefaultCertificateCustomization());
const DEFAULT_CERTIFICATE_STYLES = Object.freeze(createDefaultCertificateStyles());

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
  principalSignatureUrl: 800,
});

const CUSTOMIZATION_FIELDS = [
  { key: "issuerName", label: "Issuer Name" },
  { key: "participationTitle", label: "Participation Title" },
  { key: "winnerTitle", label: "Winner Title" },
  { key: "introText", label: "Intro Text" },
  { key: "participationActionText", label: "Participation Action Text" },
  { key: "winnerActionText", label: "Winner Action Text", hint: "Use {position} for winners." },
  { key: "footerText", label: "Footer Text" },
];

const SIGNATURE_FIELDS = [
  {
    role: "organizer",
    label: "Organizer",
    labelKey: "coordinatorLabel",
    nameKey: "organizerName",
    deptKey: "organizerDepartment",
    signatureKey: "organizerSignatureUrl",
  },
  {
    role: "hod",
    label: "HOD",
    labelKey: "hodLabel",
    nameKey: "hodName",
    deptKey: "hodDepartment",
    signatureKey: "hodSignatureUrl",
  },
  {
    role: "principal",
    label: "Principal",
    labelKey: "principalLabel",
    nameKey: "principalName",
    deptKey: "principalDepartment",
    signatureKey: "principalSignatureUrl",
  },
];

const LAYOUT_FIELDS = [
  { key: "logo", label: "Logo", hasWidth: true },
  { key: "accreditationLogo", label: "NBA Logo", hasWidth: true },
  { key: "estd", label: "ESTD Text" },
  { key: "trust", label: "Trust Name" },
  { key: "campus", label: "Campus Text" },
  { key: "approvals", label: "Approval Text" },
  { key: "issuerName", label: "Issuer Name" },
  { key: "title", label: "Certificate Title" },
  { key: "introText", label: "Intro Text" },
  { key: "participantName", label: "Student Name" },
  { key: "actionText", label: "Action Text" },
  { key: "eventName", label: "Event Name" },
  { key: "dateVenue", label: "Date & Venue" },
  { key: "organizerSignature", label: "Organizer Signature", hasWidth: true },
  { key: "hodSignature", label: "HOD Signature", hasWidth: true },
  { key: "principalSignature", label: "Principal Signature", hasWidth: true },
  { key: "coordinatorLabel", label: "Coordinator Label" },
  { key: "hodLabel", label: "HOD Label" },
  { key: "principalLabel", label: "Principal Label" },
  { key: "footerText", label: "Footer Text" },
  { key: "verificationCode", label: "Verification Code", hasWidth: true, hasHeight: true },
];

const TEXT_STYLE_FIELDS = [
  { key: "issuerName", label: "Issuer Name" },
  { key: "title", label: "Certificate Title" },
  { key: "introText", label: "Intro Text" },
  { key: "participantName", label: "Student Name" },
  { key: "actionText", label: "Action Text" },
  { key: "eventName", label: "Event Name" },
  { key: "dateVenue", label: "Date & Venue" },
  { key: "organizerName", label: "Organizer Name" },
  { key: "organizerDepartment", label: "Organizer Department" },
  { key: "coordinatorLabel", label: "Organizer Label" },
  { key: "hodName", label: "HOD Name" },
  { key: "hodDepartment", label: "HOD Department" },
  { key: "hodLabel", label: "HOD Label" },
  { key: "principalName", label: "Principal Name" },
  { key: "principalDepartment", label: "Principal Department" },
  { key: "principalLabel", label: "Principal Label" },
  { key: "footerText", label: "Footer Text" },
];

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const scaleValue = (value, scale) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric * scale;
};

const trimTransparentCanvas = (canvas, ctx, padding = 6) => {
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha === 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return canvas;

  const safePadding = Math.max(0, Math.round(padding));
  const cropX = Math.max(0, minX - safePadding);
  const cropY = Math.max(0, minY - safePadding);
  const cropWidth = Math.min(width - cropX, maxX - minX + 1 + safePadding * 2);
  const cropHeight = Math.min(height - cropY, maxY - minY + 1 + safePadding * 2);
  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = Math.max(1, cropWidth);
  trimmedCanvas.height = Math.max(1, cropHeight);
  const trimmedCtx = trimmedCanvas.getContext("2d");
  if (!trimmedCtx) return canvas;

  trimmedCtx.drawImage(
    canvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  return trimmedCanvas;
};

const sampleCornerBackgroundColor = (ctx, width, height, sampleSize = 12) => {
  const safeSample = Math.max(1, Math.min(sampleSize, width, height));
  const points = [
    [0, 0],
    [Math.max(0, width - safeSample), 0],
    [0, Math.max(0, height - safeSample)],
    [Math.max(0, width - safeSample), Math.max(0, height - safeSample)],
  ];
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (const [x, y] of points) {
    const imageData = ctx.getImageData(x, y, safeSample, safeSample).data;
    for (let i = 0; i < imageData.length; i += 4) {
      if (imageData[i + 3] === 0) continue;
      totalR += imageData[i];
      totalG += imageData[i + 1];
      totalB += imageData[i + 2];
      count += 1;
    }
  }

  if (!count) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: totalR / count,
    g: totalG / count,
    b: totalB / count,
  };
};

const getPixelMetrics = (data, pixelIndex, backgroundColor) => {
  const offset = pixelIndex * 4;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const alpha = data[offset + 3];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = (r + g + b) / 3;
  const channelSpread = max - min;
  const backgroundDistance = Math.max(
    Math.abs(r - backgroundColor.r),
    Math.abs(g - backgroundColor.g),
    Math.abs(b - backgroundColor.b)
  );

  return {
    alpha,
    brightness,
    channelSpread,
    backgroundDistance,
  };
};

const isLikelySignatureInk = (metrics) => {
  if (!metrics || metrics.alpha === 0) return false;

  const isDarkStroke = metrics.brightness <= 162 && metrics.backgroundDistance >= 18;
  const isDenseStroke = metrics.brightness <= 190 && metrics.backgroundDistance >= 34;
  const isColoredStroke =
    metrics.brightness <= 220 &&
    metrics.backgroundDistance >= 48 &&
    metrics.channelSpread >= 12;

  return isDarkStroke || isDenseStroke || isColoredStroke;
};

const isLikelyBackgroundPixel = (metrics) => {
  if (!metrics || metrics.alpha === 0) return true;
  if (isLikelySignatureInk(metrics)) return false;

  const isLightNeutral =
    metrics.brightness >= 170 &&
    metrics.channelSpread <= 34 &&
    metrics.backgroundDistance <= 76;
  const isPaperShadow =
    metrics.brightness >= 145 &&
    metrics.channelSpread <= 28 &&
    metrics.backgroundDistance <= 58;
  const isWashedBackground =
    metrics.brightness >= 182 &&
    metrics.backgroundDistance <= 92;

  return isLightNeutral || isPaperShadow || isWashedBackground;
};

const clearEdgeConnectedBackground = (data, width, height, backgroundColor) => {
  const visited = new Uint8Array(width * height);
  const stack = [];

  const tryVisit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;

    const metrics = getPixelMetrics(data, pixelIndex, backgroundColor);
    if (!isLikelyBackgroundPixel(metrics)) return;

    visited[pixelIndex] = 1;
    stack.push(pixelIndex);
  };

  for (let x = 0; x < width; x += 1) {
    tryVisit(x, 0);
    tryVisit(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryVisit(0, y);
    tryVisit(width - 1, y);
  }

  while (stack.length > 0) {
    const pixelIndex = stack.pop();
    data[pixelIndex * 4 + 3] = 0;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    tryVisit(x + 1, y);
    tryVisit(x - 1, y);
    tryVisit(x, y + 1);
    tryVisit(x, y - 1);
  }
};

const cleanupSignatureArtifacts = (data, width, height, backgroundColor) => {
  const nextAlpha = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      const offset = pixelIndex * 4;
      const metrics = getPixelMetrics(data, pixelIndex, backgroundColor);
      const currentAlpha = data[offset + 3];

      if (currentAlpha === 0) {
        nextAlpha[pixelIndex] = 0;
        continue;
      }

      if (isLikelySignatureInk(metrics)) {
        nextAlpha[pixelIndex] = currentAlpha;
        continue;
      }

      let opaqueNeighbors = 0;
      let inkNeighbors = 0;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;

          const neighborIndex = nextY * width + nextX;
          const neighborOffset = neighborIndex * 4;
          if (data[neighborOffset + 3] === 0) continue;

          opaqueNeighbors += 1;
          if (isLikelySignatureInk(getPixelMetrics(data, neighborIndex, backgroundColor))) {
            inkNeighbors += 1;
          }
        }
      }

      const isSoftArtifact =
        metrics.brightness >= 148 &&
        metrics.backgroundDistance <= 90 &&
        metrics.channelSpread <= 42;

      nextAlpha[pixelIndex] =
        isSoftArtifact && (opaqueNeighbors <= 2 || inkNeighbors === 0) ? 0 : currentAlpha;
    }
  }

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    data[pixelIndex * 4 + 3] = nextAlpha[pixelIndex];
  }
};

const removeWhiteBackgroundFromPng = (file, { fileName = "image", trimPadding = 6 } = {}) =>
  new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const backgroundColor = sampleCornerBackgroundColor(ctx, canvas.width, canvas.height);
      clearEdgeConnectedBackground(data, canvas.width, canvas.height, backgroundColor);
      cleanupSignatureArtifacts(data, canvas.width, canvas.height, backgroundColor);
      ctx.putImageData(imageData, 0, 0);

      const outputCanvas = trimTransparentCanvas(canvas, ctx, trimPadding);
      outputCanvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) {
          resolve(file);
          return;
        }
        const safeName = String(file.name || fileName)
          .replace(/\.[^/.]+$/, "")
          .trim();
        resolve(new File([blob], `${safeName || fileName}.png`, { type: "image/png" }));
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });

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
  if (normalized === "left" || normalized === "center" || normalized === "right") return normalized;
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
  anchor: sanitizeAnchor(layoutNode?.anchor, fallbackNode.anchor),
});

const matchesLayoutNode = (layoutNode, targetNode) =>
  Number(layoutNode?.x) === targetNode.x &&
  Number(layoutNode?.y) === targetNode.y &&
  String(layoutNode?.anchor || "").trim().toLowerCase() === targetNode.anchor;

const matchesSignatureLayoutNode = (layoutNode, targetNode) =>
  matchesLayoutNode(layoutNode, targetNode) && Number(layoutNode?.width) === targetNode.width;

const normalizeStyleNode = (styleNode, fallbackNode) => ({
  fontSize: sanitizeFontSize(styleNode?.fontSize, fallbackNode.fontSize),
  color: sanitizeColor(styleNode?.color, fallbackNode.color),
});

const normalizeCertificateLayout = (layoutValue) => {
  const source = layoutValue && typeof layoutValue === "object" ? layoutValue : {};
  const fallback = createDefaultCertificateLayout();
  const shouldUpgradeLegacyBodyDefaults =
    Object.keys(LEGACY_DEFAULT_BODY_LAYOUT).length > 0 &&
    Object.entries(LEGACY_DEFAULT_BODY_LAYOUT).every(([fieldKey, legacyNode]) =>
      matchesLayoutNode(source[fieldKey], legacyNode)
    );
  const shouldUpgradeLegacySignatureDefaults =
    Object.keys(LEGACY_DEFAULT_SIGNATURE_LAYOUT).length > 0 &&
    Object.entries(LEGACY_DEFAULT_SIGNATURE_LAYOUT).every(([fieldKey, legacyNode]) =>
      matchesSignatureLayoutNode(source[fieldKey], legacyNode)
    );

  return {
    logo: {
      ...normalizeLayoutNode(source.logo, fallback.logo),
      width: sanitizeLogoWidth(source.logo?.width, fallback.logo.width),
    },
    accreditationLogo: {
      ...normalizeLayoutNode(source.accreditationLogo, fallback.accreditationLogo),
      width: sanitizeLogoWidth(
        source.accreditationLogo?.width,
        fallback.accreditationLogo.width
      ),
    },
    estd: normalizeLayoutNode(source.estd, fallback.estd),
    trust: normalizeLayoutNode(source.trust, fallback.trust),
    campus: normalizeLayoutNode(source.campus, fallback.campus),
    approvals: normalizeLayoutNode(source.approvals, fallback.approvals),
    issuerName: normalizeLayoutNode(source.issuerName, fallback.issuerName),
    title: normalizeLayoutNode(source.title, fallback.title),
    introText: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.introText : source.introText,
      fallback.introText
    ),
    participantName: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.participantName : source.participantName,
      fallback.participantName
    ),
    actionText: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.actionText : source.actionText,
      fallback.actionText
    ),
    eventName: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.eventName : source.eventName,
      fallback.eventName
    ),
    dateVenue: normalizeLayoutNode(
      shouldUpgradeLegacyBodyDefaults ? fallback.dateVenue : source.dateVenue,
      fallback.dateVenue
    ),
    organizerSignature: {
      ...normalizeLayoutNode(source.organizerSignature, fallback.organizerSignature),
      width: sanitizeSignatureWidth(
        shouldUpgradeLegacySignatureDefaults ? undefined : source.organizerSignature?.width,
        fallback.organizerSignature.width
      ),
    },
    hodSignature: {
      ...normalizeLayoutNode(source.hodSignature, fallback.hodSignature),
      width: sanitizeSignatureWidth(
        shouldUpgradeLegacySignatureDefaults ? undefined : source.hodSignature?.width,
        fallback.hodSignature.width
      ),
    },
    principalSignature: {
      ...normalizeLayoutNode(source.principalSignature, fallback.principalSignature),
      width: sanitizeSignatureWidth(
        shouldUpgradeLegacySignatureDefaults ? undefined : source.principalSignature?.width,
        fallback.principalSignature.width
      ),
    },
    coordinatorLabel: normalizeLayoutNode(source.coordinatorLabel, fallback.coordinatorLabel),
    hodLabel: normalizeLayoutNode(source.hodLabel, fallback.hodLabel),
    principalLabel: normalizeLayoutNode(source.principalLabel, fallback.principalLabel),
    footerText: normalizeLayoutNode(source.footerText, fallback.footerText),
    verificationCode: {
      ...normalizeLayoutNode(source.verificationCode, fallback.verificationCode),
      width: sanitizeVerificationBadgeWidth(
        source.verificationCode?.width,
        fallback.verificationCode.width
      ),
      height: sanitizeVerificationBadgeHeight(
        source.verificationCode?.height,
        fallback.verificationCode.height
      ),
    },
  };
};

const normalizeCertificateStyles = (stylesValue) => {
  const source = stylesValue && typeof stylesValue === "object" ? stylesValue : {};
  const fallback = createDefaultCertificateStyles();

  return {
    issuerName: normalizeStyleNode(source.issuerName, fallback.issuerName),
    title: normalizeStyleNode(source.title, fallback.title),
    introText: normalizeStyleNode(source.introText, fallback.introText),
    participantName: normalizeStyleNode(source.participantName, fallback.participantName),
    actionText: normalizeStyleNode(source.actionText, fallback.actionText),
    eventName: normalizeStyleNode(source.eventName, fallback.eventName),
    dateVenue: normalizeStyleNode(source.dateVenue, fallback.dateVenue),
    organizerName: normalizeStyleNode(source.organizerName, fallback.organizerName),
    organizerDepartment: normalizeStyleNode(source.organizerDepartment, fallback.organizerDepartment),
    hodName: normalizeStyleNode(source.hodName, fallback.hodName),
    hodDepartment: normalizeStyleNode(source.hodDepartment, fallback.hodDepartment),
    principalName: normalizeStyleNode(source.principalName, fallback.principalName),
    principalDepartment: normalizeStyleNode(source.principalDepartment, fallback.principalDepartment),
    coordinatorLabel: normalizeStyleNode(source.coordinatorLabel, fallback.coordinatorLabel),
    hodLabel: normalizeStyleNode(source.hodLabel, fallback.hodLabel),
    principalLabel: normalizeStyleNode(source.principalLabel, fallback.principalLabel),
    footerText: normalizeStyleNode(source.footerText, fallback.footerText),
  };
};

const normalizeCertificateCustomization = (value) => {
  const source = value && typeof value === "object" ? value : {};

  return {
    issuerName: sanitizeCustomizationField(
      source.issuerName,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.issuerName,
      CERTIFICATE_CUSTOMIZATION_LIMITS.issuerName
    ),
    participationTitle: sanitizeCustomizationField(
      source.participationTitle,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.participationTitle,
      CERTIFICATE_CUSTOMIZATION_LIMITS.participationTitle
    ),
    winnerTitle: sanitizeCustomizationField(
      source.winnerTitle,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.winnerTitle,
      CERTIFICATE_CUSTOMIZATION_LIMITS.winnerTitle
    ),
    introText: sanitizeCustomizationField(
      source.introText,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.introText,
      CERTIFICATE_CUSTOMIZATION_LIMITS.introText
    ),
    participationActionText: sanitizeCustomizationField(
      source.participationActionText,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.participationActionText,
      CERTIFICATE_CUSTOMIZATION_LIMITS.participationActionText
    ),
    winnerActionText: sanitizeCustomizationField(
      source.winnerActionText,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.winnerActionText,
      CERTIFICATE_CUSTOMIZATION_LIMITS.winnerActionText
    ),
    footerText: sanitizeCustomizationField(
      source.footerText,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.footerText,
      CERTIFICATE_CUSTOMIZATION_LIMITS.footerText
    ),
    coordinatorLabel: sanitizeCustomizationField(
      source.coordinatorLabel,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.coordinatorLabel,
      CERTIFICATE_CUSTOMIZATION_LIMITS.coordinatorLabel
    ),
    hodLabel: sanitizeCustomizationField(
      source.hodLabel,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.hodLabel,
      CERTIFICATE_CUSTOMIZATION_LIMITS.hodLabel
    ),
    principalLabel: sanitizeCustomizationField(
      source.principalLabel,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.principalLabel,
      CERTIFICATE_CUSTOMIZATION_LIMITS.principalLabel
    ),
    organizerName: sanitizeCustomizationField(
      source.organizerName,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.organizerName,
      CERTIFICATE_CUSTOMIZATION_LIMITS.organizerName
    ),
    organizerDepartment: sanitizeCustomizationField(
      source.organizerDepartment,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.organizerDepartment,
      CERTIFICATE_CUSTOMIZATION_LIMITS.organizerDepartment
    ),
    hodName: sanitizeCustomizationField(
      source.hodName,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.hodName,
      CERTIFICATE_CUSTOMIZATION_LIMITS.hodName
    ),
    hodDepartment: sanitizeCustomizationField(
      source.hodDepartment,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.hodDepartment,
      CERTIFICATE_CUSTOMIZATION_LIMITS.hodDepartment
    ),
    principalName: sanitizeCustomizationField(
      source.principalName,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.principalName,
      CERTIFICATE_CUSTOMIZATION_LIMITS.principalName
    ),
    principalDepartment: sanitizeCustomizationField(
      source.principalDepartment,
      DEFAULT_CERTIFICATE_CUSTOMIZATION.principalDepartment,
      CERTIFICATE_CUSTOMIZATION_LIMITS.principalDepartment
    ),
    organizerSignatureUrl: sanitizeImageUrl(source.organizerSignatureUrl),
    hodSignatureUrl: sanitizeImageUrl(source.hodSignatureUrl),
    principalSignatureUrl: sanitizeImageUrl(source.principalSignatureUrl),
    accreditationLogoUrl: sanitizeImageUrl(source.accreditationLogoUrl),
    logoUrl: sanitizeImageUrl(source.logoUrl),
    backgroundImageUrl: sanitizeImageUrl(source.backgroundImageUrl),
    layout: normalizeCertificateLayout(source.layout),
    styles: normalizeCertificateStyles(source.styles),
  };
};

const getPreviewTransformByAnchor = (anchor) => {
  if (anchor === "left") return "translateX(0)";
  if (anchor === "right") return "translateX(-100%)";
  return "translateX(-50%)";
};

const getPreviewTextAlignByAnchor = (anchor) => {
  if (anchor === "right") return "right";
  if (anchor === "center") return "center";
  return "left";
};

const autoArrangeSignatureLayout = (layoutValue) => {
  const baseLayout = normalizeCertificateLayout(layoutValue);
  const nextLayout = { ...baseLayout };

  for (const { signatureKey, labelKey } of SIGNATURE_LAYOUT_ROLE_MAP) {
    const labelNode = baseLayout[labelKey];
    const signatureNode = baseLayout[signatureKey];
    if (!labelNode || !signatureNode) continue;

    nextLayout[signatureKey] = {
      ...signatureNode,
      x: labelNode.x,
      y: clampNumber(Number(labelNode.y) - AUTO_SIGNATURE_Y_OFFSET, 0, 100),
      width: Math.max(Number(signatureNode.width) || 0, DEFAULT_SIGNATURE_WIDTH),
      anchor: labelNode.anchor,
    };
  }

  return nextLayout;
};

const applyAutoArrangeToCustomization = (customizationValue) => {
  const normalized = normalizeCertificateCustomization(customizationValue);
  return {
    ...normalized,
    layout: autoArrangeSignatureLayout(normalized.layout),
  };
};

const mergePersistedCustomizationIntoDraft = (draftValue, savedValue, fieldKeys = []) => {
  const draftCustomization = normalizeCertificateCustomization(draftValue);
  const savedCustomization = normalizeCertificateCustomization(savedValue);
  const mergedCustomization = { ...draftCustomization };

  for (const fieldKey of fieldKeys) {
    if (!fieldKey) continue;
    mergedCustomization[fieldKey] = savedCustomization[fieldKey];
  }

  return mergedCustomization;
};

const mergeUploadedSignatureIntoDraft = (draftValue, savedValue, role) => {
  const signatureFieldKey = SIGNATURE_ROLE_FIELD_KEY_MAP[role];
  const mergedCustomization = mergePersistedCustomizationIntoDraft(
    draftValue,
    savedValue,
    signatureFieldKey ? [signatureFieldKey] : []
  );

  return applyAutoArrangeToCustomization(mergedCustomization);
};

const offsetLayoutNode = (node, offsetY) => ({
  ...node,
  y: clampNumber(Number(node?.y || 0) + offsetY, 0, 100),
});

const roundToTenth = (value) => Math.round(Number(value || 0) * 10) / 10;

const getEventDateLabel = (eventData) => {
  const start = formatDate(eventData?.schedule?.startDate);
  const end = formatDate(eventData?.schedule?.endDate);
  if (start === end) return start;
  return `${start} - ${end}`;
};

const getEventMetaLabel = (eventData, issuerName) => {
  const dateLabel = formatDate(eventData?.schedule?.startDate);
  const organizerLine = buildOrganizerLine(issuerName);
  return `${organizerLine}\nDate : ${dateLabel}`;
};

const CertificatePreviewTypeToggle = ({ value, onChange }) => (
  <div className="inline-flex rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900/60 p-0.5">
    {[
      { key: "participation", label: "Participation" },
      { key: "winner", label: "Winner" },
    ].map((option) => {
      const isActive = value === option.key;
      return (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded px-2.5 py-1 text-[11px] font-semibold transition ${
            isActive
              ? "bg-indigo-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

export default function OrganizerCertificateManagement() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const backgroundInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const accreditationLogoInputRef = useRef(null);
  const signatureInputRefs = useRef({});
  const previewCanvasRef = useRef(null);
  const dragCanvasRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [downloadingDemo, setDownloadingDemo] = useState(false);
  const [customization, setCustomization] = useState(() =>
    normalizeCertificateCustomization(DEFAULT_CERTIFICATE_CUSTOMIZATION)
  );
  const [draftCustomization, setDraftCustomization] = useState(() =>
    normalizeCertificateCustomization(DEFAULT_CERTIFICATE_CUSTOMIZATION)
  );
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [savingCustomization, setSavingCustomization] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAccreditationLogo, setUploadingAccreditationLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState({
    organizer: false,
    hod: false,
    principal: false,
  });
  const [draggingLayoutKey, setDraggingLayoutKey] = useState(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [dragScale, setDragScale] = useState(1);
  const [previewCertificateType, setPreviewCertificateType] = useState("participation");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const detailResponse = await api({
        ...SummaryApi.get_public_event_details,
        url: SummaryApi.get_public_event_details.url.replace(":eventId", encodeURIComponent(eventId || "")),
      });

      const event = extractEventItem(detailResponse.data);
      if (!event) {
        setError("Event not found.");
        setEventData(null);
        const fallbackCustomization = normalizeCertificateCustomization(DEFAULT_CERTIFICATE_CUSTOMIZATION);
        setCustomization(fallbackCustomization);
        setDraftCustomization(fallbackCustomization);
        return;
      }

      const nextCustomization = normalizeCertificateCustomization(event?.certificate?.customization);
      setEventData(event);
      setCustomization(nextCustomization);
      setDraftCustomization(nextCustomization);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Unable to load certificate management workspace.");
      setEventData(null);
      const fallbackCustomization = normalizeCertificateCustomization(DEFAULT_CERTIFICATE_CUSTOMIZATION);
      setCustomization(fallbackCustomization);
      setDraftCustomization(fallbackCustomization);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isCustomizeDialogOpen) {
      setDraggingLayoutKey(null);
    }
  }, [isCustomizeDialogOpen]);

  useEffect(() => {
    const element = previewCanvasRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const updateScale = () => {
      const width = element.clientWidth || 0;
      setPreviewScale(width ? width / PDF_BASE_WIDTH : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, eventData?._id]);

  useEffect(() => {
    const element = dragCanvasRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;

    const updateScale = () => {
      const width = element.clientWidth || 0;
      setDragScale(width ? width / PDF_BASE_WIDTH : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isCustomizeDialogOpen]);

  const previewCustomization = useMemo(
    () => normalizeCertificateCustomization(isCustomizeDialogOpen ? draftCustomization : customization),
    [customization, draftCustomization, isCustomizeDialogOpen]
  );
  const previewStyles = previewCustomization.styles || DEFAULT_CERTIFICATE_STYLES;
  const draftStyles = draftCustomization.styles || DEFAULT_CERTIFICATE_STYLES;
  const showTemplateDecor = !previewCustomization.backgroundImageUrl;
  const isWinnerPreview = previewCertificateType === "winner";
  const previewTitleText = isWinnerPreview
    ? previewCustomization.winnerTitle
    : previewCustomization.participationTitle;
  const previewActionText = isWinnerPreview
    ? buildWinnerPreviewActionText(previewCustomization.winnerActionText, DEMO_WINNER_POSITION)
    : previewCustomization.participationActionText;
  const draftTitleText = isWinnerPreview
    ? draftCustomization.winnerTitle
    : draftCustomization.participationTitle;
  const draftActionText = isWinnerPreview
    ? buildWinnerPreviewActionText(draftCustomization.winnerActionText, DEMO_WINNER_POSITION)
    : draftCustomization.participationActionText;
  const organizerNameNode = offsetLayoutNode(previewCustomization.layout.coordinatorLabel, -3.2);
  const organizerDeptNode = offsetLayoutNode(previewCustomization.layout.coordinatorLabel, -1.6);
  const hodNameNode = offsetLayoutNode(previewCustomization.layout.hodLabel, -3.2);
  const hodDeptNode = offsetLayoutNode(previewCustomization.layout.hodLabel, -1.6);
  const principalNameNode = offsetLayoutNode(previewCustomization.layout.principalLabel, -3.2);
  const principalDeptNode = offsetLayoutNode(previewCustomization.layout.principalLabel, -1.6);

  const handleDownloadDemo = async () => {
    if (!eventData?._id) return;
    if (!eventData?.certificate?.isEnabled) {
      setNotice("Save the certificate template before downloading a demo certificate.");
      return;
    }

    setNotice(null);
    setDownloadingDemo(true);
    try {
      const demoCertificateUrl = SummaryApi.download_demo_certificate.url.replace(
        ":eventId",
        encodeURIComponent(eventData._id)
      );
      const response = await api({
        ...SummaryApi.download_demo_certificate,
        url: `${demoCertificateUrl}${
          isWinnerPreview ? `?type=winner&position=${encodeURIComponent(DEMO_WINNER_POSITION)}` : ""
        }`,
        responseType: "blob",
        skipCache: true,
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const fileNameBase = String(eventData?.title || "event")
        .trim()
        .replace(/[^a-z0-9-_]+/gi, "_");
      const downloadName = `${isWinnerPreview ? "winner" : "demo"}_certificate_${
        fileNameBase || "event"
      }.pdf`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (demoError) {
      setNotice(demoError.response?.data?.message || "Unable to download demo certificate.");
    } finally {
      setDownloadingDemo(false);
    }
  };

  const handleDraftCustomizationChange = (field, value) => {
    setDraftCustomization((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDraftLayoutChange = (fieldKey, property, value) => {
    setDraftCustomization((prev) => ({
      ...prev,
      layout: {
        ...(prev.layout || {}),
        [fieldKey]: {
          ...(prev.layout?.[fieldKey] || createDefaultCertificateLayout()[fieldKey]),
          [property]: value,
        },
      },
    }));
  };

  const handleDraftStyleChange = (fieldKey, property, value) => {
    setDraftCustomization((prev) => ({
      ...prev,
      styles: {
        ...(prev.styles || {}),
        [fieldKey]: {
          ...(prev.styles?.[fieldKey] || {}),
          [property]: value,
        },
      },
    }));
  };

  const applyPointerPositionToLayoutNode = useCallback((fieldKey, clientX, clientY) => {
    const canvasRect = dragCanvasRef.current?.getBoundingClientRect();
    if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) return;

    const nextX = roundToTenth(clampNumber(((clientX - canvasRect.left) / canvasRect.width) * 100, 0, 100));
    const nextY = roundToTenth(clampNumber(((clientY - canvasRect.top) / canvasRect.height) * 100, 0, 100));

    setDraftCustomization((prev) => ({
      ...prev,
      layout: {
        ...(prev.layout || {}),
        [fieldKey]: {
          ...(prev.layout?.[fieldKey] || createDefaultCertificateLayout()[fieldKey]),
          x: nextX,
          y: nextY,
        },
      },
    }));
  }, []);

  const handleDragCanvasPointerDown = (fieldKey) => (eventValue) => {
    if (!isCustomizeDialogOpen || savingCustomization || uploadingBackground) return;
    eventValue.preventDefault();
    eventValue.stopPropagation();
    setDraggingLayoutKey(fieldKey);
    applyPointerPositionToLayoutNode(fieldKey, eventValue.clientX, eventValue.clientY);
  };

  useEffect(() => {
    if (!draggingLayoutKey) return undefined;

    const handlePointerMove = (eventValue) => {
      applyPointerPositionToLayoutNode(draggingLayoutKey, eventValue.clientX, eventValue.clientY);
    };

    const handlePointerStop = () => {
      setDraggingLayoutKey(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerStop);
    window.addEventListener("pointercancel", handlePointerStop);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerStop);
      window.removeEventListener("pointercancel", handlePointerStop);
    };
  }, [applyPointerPositionToLayoutNode, draggingLayoutKey]);

  const syncSavedCustomizationState = (nextCustomization) => {
    const normalized = normalizeCertificateCustomization(nextCustomization);
    setCustomization(normalized);
    setEventData((prev) =>
      prev
        ? {
            ...prev,
            certificate: {
              ...(prev.certificate || {}),
              isEnabled: true,
              customization: normalized,
            },
          }
        : prev
    );
    return normalized;
  };

  const updateCustomizationState = (nextCustomization) => {
    const normalized = syncSavedCustomizationState(nextCustomization);
    setDraftCustomization(normalized);
  };

  const triggerBackgroundPicker = () => {
    if (uploadingBackground || savingCustomization) return;
    backgroundInputRef.current?.click();
  };

  const handleBackgroundFileSelected = async (eventValue) => {
    const selectedFile = eventValue?.target?.files?.[0];
    eventValue.target.value = "";
    if (!selectedFile) return;

    setUploadingBackground(true);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append("background", selectedFile);

      const response = await api({
        ...SummaryApi.upload_event_certificate_background,
        url: SummaryApi.upload_event_certificate_background.url.replace(
          ":eventId",
          encodeURIComponent(eventId || "")
        ),
        data: formData,
      });

      const savedCustomization = syncSavedCustomizationState(response?.data?.data?.customization);
      setDraftCustomization((prev) =>
        mergePersistedCustomizationIntoDraft(prev, savedCustomization, ["backgroundImageUrl"])
      );
      setNotice("Certificate background image updated.");
    } catch (uploadError) {
      setNotice(uploadError.response?.data?.message || "Unable to upload certificate background image.");
    } finally {
      setUploadingBackground(false);
    }
  };

  const triggerLogoPicker = () => {
    if (uploadingLogo || savingCustomization) return;
    logoInputRef.current?.click();
  };

  const triggerAccreditationLogoPicker = () => {
    if (uploadingAccreditationLogo || savingCustomization) return;
    accreditationLogoInputRef.current?.click();
  };

  const handleLogoFileSelected = async (eventValue) => {
    const selectedFile = eventValue?.target?.files?.[0];
    eventValue.target.value = "";
    if (!selectedFile) return;

    setUploadingLogo(true);
    setNotice(null);

    try {
      const cleanedFile = await removeWhiteBackgroundFromPng(selectedFile, {
        fileName: "logo",
        trimPadding: 8,
      });
      const formData = new FormData();
      formData.append("logo", cleanedFile);

      const response = await api({
        ...SummaryApi.upload_event_certificate_logo,
        url: SummaryApi.upload_event_certificate_logo.url.replace(
          ":eventId",
          encodeURIComponent(eventId || "")
        ),
        data: formData,
      });

      const savedCustomization = syncSavedCustomizationState(response?.data?.data?.customization);
      setDraftCustomization((prev) =>
        mergePersistedCustomizationIntoDraft(prev, savedCustomization, ["logoUrl"])
      );
      setNotice("Certificate logo updated.");
    } catch (uploadError) {
      setNotice(uploadError.response?.data?.message || "Unable to upload certificate logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAccreditationLogoFileSelected = async (eventValue) => {
    const selectedFile = eventValue?.target?.files?.[0];
    eventValue.target.value = "";
    if (!selectedFile) return;

    setUploadingAccreditationLogo(true);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append("accreditationLogo", selectedFile);

      const response = await api({
        ...SummaryApi.upload_event_certificate_accreditation_logo,
        url: SummaryApi.upload_event_certificate_accreditation_logo.url.replace(
          ":eventId",
          encodeURIComponent(eventId || "")
        ),
        data: formData,
      });

      const savedCustomization = syncSavedCustomizationState(response?.data?.data?.customization);
      setDraftCustomization((prev) =>
        mergePersistedCustomizationIntoDraft(prev, savedCustomization, ["accreditationLogoUrl"])
      );
      setNotice("Accreditation logo updated.");
    } catch (uploadError) {
      setNotice(uploadError.response?.data?.message || "Unable to upload accreditation logo.");
    } finally {
      setUploadingAccreditationLogo(false);
    }
  };

  const triggerSignaturePicker = (role) => {
    if (savingCustomization || uploadingSignature[role]) return;
    signatureInputRefs.current?.[role]?.click();
  };

  const handleAutoArrangeSignatures = () => {
    setDraftCustomization((prev) => applyAutoArrangeToCustomization(prev));
    setNotice("Signatures auto-arranged.");
  };

  const handleSignatureFileSelected = (role) => async (eventValue) => {
    const selectedFile = eventValue?.target?.files?.[0];
    eventValue.target.value = "";
    if (!selectedFile) return;

    if (selectedFile.type !== "image/png") {
      setNotice("Please upload a PNG signature file.");
      return;
    }

    setUploadingSignature((prev) => ({ ...prev, [role]: true }));
    setNotice(null);

    try {
      const cleanedFile = await removeWhiteBackgroundFromPng(selectedFile, {
        fileName: `${role}_signature`,
        trimPadding: 10,
      });
      const formData = new FormData();
      formData.append("signature", cleanedFile);

      const response = await api({
        ...SummaryApi.upload_event_certificate_signature,
        url: SummaryApi.upload_event_certificate_signature.url
          .replace(":eventId", encodeURIComponent(eventId || ""))
          .replace(":role", encodeURIComponent(role)),
        data: formData,
      });

      const savedCustomization = syncSavedCustomizationState(response?.data?.data?.customization);
      setDraftCustomization((prev) => mergeUploadedSignatureIntoDraft(prev, savedCustomization, role));
      setNotice("Signature updated and auto-arranged.");
    } catch (uploadError) {
      setNotice(uploadError.response?.data?.message || "Unable to upload signature.");
    } finally {
      setUploadingSignature((prev) => ({ ...prev, [role]: false }));
    }
  };

  const handleOpenCustomizationDialog = () => {
    setDraftCustomization(normalizeCertificateCustomization(customization));
    setIsCustomizeDialogOpen(true);
  };

  const handleCloseCustomizationDialog = () => {
    if (savingCustomization || uploadingBackground) return;
    setDraftCustomization(normalizeCertificateCustomization(customization));
    setIsCustomizeDialogOpen(false);
  };

  const handleResetCustomization = () => {
    setDraftCustomization(normalizeCertificateCustomization(DEFAULT_CERTIFICATE_CUSTOMIZATION));
  };

  const handleSaveCustomization = async () => {
    setSavingCustomization(true);
    setNotice(null);

    try {
      const sanitizedCustomization = normalizeCertificateCustomization(draftCustomization);
      const response = await api({
        ...SummaryApi.update_event_certificate_customization,
        url: SummaryApi.update_event_certificate_customization.url.replace(
          ":eventId",
          encodeURIComponent(eventId || "")
        ),
        data: { customization: sanitizedCustomization },
      });

      const savedCustomization = normalizeCertificateCustomization(
        response?.data?.data?.customization || sanitizedCustomization
      );
      updateCustomizationState(savedCustomization);
      setIsCustomizeDialogOpen(false);
      setNotice("Certificate customization saved.");
    } catch (saveError) {
      setNotice(saveError.response?.data?.message || "Unable to save certificate customization.");
    } finally {
      setSavingCustomization(false);
    }
  };

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate("/organizer-dashboard")}
          className="inline-flex items-center rounded-md p-1 text-slate-600 dark:text-slate-300 hover:bg-white/70 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Certificate Management</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Design and save certificate templates, then download a demo certificate for preview.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCustomizationDialog}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              Edit Template
            </button>
            <button
              type="button"
              onClick={handleDownloadDemo}
              disabled={downloadingDemo}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {downloadingDemo ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Demo Certificate
            </button>
          </div>
        </div>

        <input
          ref={backgroundInputRef}
          type="file"
          name="backgroundImageFile"
          accept="image/*"
          onChange={handleBackgroundFileSelected}
          className="hidden"
        />
        <input
          ref={logoInputRef}
          type="file"
          name="logoImageFile"
          accept="image/*"
          onChange={handleLogoFileSelected}
          className="hidden"
        />
        <input
          ref={accreditationLogoInputRef}
          type="file"
          name="accreditationLogoFile"
          accept="image/*"
          onChange={handleAccreditationLogoFileSelected}
          className="hidden"
        />
        {SIGNATURE_FIELDS.map((field) => (
          <input
            key={field.role}
            ref={(element) => {
              signatureInputRefs.current[field.role] = element;
            }}
            type="file"
            name={`${field.role}SignatureFile`}
            accept="image/png"
            onChange={handleSignatureFileSelected(field.role)}
            className="hidden"
          />
        ))}

        {notice && (
          <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-200">
            {notice}
          </p>
        )}

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading certificate workspace...
          </section>
        )}

        {error && !loading && (
          <section className="eventmate-panel rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </section>
        )}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] gap-4">
              <div className="space-y-4">
                <article className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 inline-flex items-center gap-1.5">
                    <ShieldCheck size={12} className="text-indigo-500" />
                    Current Template
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-300">
                      Preview sample: {isWinnerPreview ? `${DEMO_WINNER_POSITION} Position` : "Participation"}
                    </p>
                    <CertificatePreviewTypeToggle
                      value={previewCertificateType}
                      onChange={setPreviewCertificateType}
                    />
                  </div>

                  <div className="mt-3 rounded-xl border border-dashed border-slate-300 dark:border-white/20 bg-slate-50/80 dark:bg-white/5 p-3">
                    <div
                      ref={previewCanvasRef}
                      className="relative mx-auto w-full overflow-hidden rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/70"
                      style={{ aspectRatio: PREVIEW_RATIO }}
                    >
                      {previewCustomization.backgroundImageUrl ? (
                        <img
                          src={previewCustomization.backgroundImageUrl}
                          alt="Certificate background"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}

                      {showTemplateDecor && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 pointer-events-none" />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(203,213,225,0.55),transparent_60%)] pointer-events-none" />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(191,219,254,0.35),transparent_55%)] pointer-events-none" />
                          <div className="absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-slate-300/90 via-slate-200/60 to-transparent pointer-events-none" />
                          <div className="absolute inset-x-0 top-0 h-[4%] bg-gradient-to-r from-amber-300/70 via-amber-200/40 to-amber-300/70 pointer-events-none" />
                          <div className="absolute left-0 top-0 h-full w-[1.2%] bg-gradient-to-b from-amber-400/70 via-amber-300/40 to-amber-200/30 pointer-events-none" />
                          <div className="absolute right-0 top-0 h-full w-[1.2%] bg-gradient-to-b from-amber-400/70 via-amber-300/40 to-amber-200/30 pointer-events-none" />
                          <div className="absolute inset-[1.6%] border border-slate-300/80 pointer-events-none" />
                          <div className="absolute inset-[2.6%] border border-amber-300/70 pointer-events-none" />

                          <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                            <svg viewBox="0 0 200 200" className="w-[150px] h-[150px]" aria-hidden="true">
                              <circle cx="100" cy="100" r="80" fill="none" stroke="#64748b" strokeWidth="2" />
                              <circle cx="100" cy="100" r="60" fill="none" stroke="#64748b" strokeWidth="1.5" />
                              {[...Array(16)].map((_, idx) => {
                                const angle = (idx * Math.PI) / 8;
                                const x1 = 100 + Math.cos(angle) * 30;
                                const y1 = 100 + Math.sin(angle) * 30;
                                const x2 = 100 + Math.cos(angle) * 75;
                                const y2 = 100 + Math.sin(angle) * 75;
                                return (
                                  <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="1" />
                                );
                              })}
                            </svg>
                          </div>

                          <div
                            className="absolute font-semibold text-slate-600 pointer-events-none whitespace-nowrap"
                            style={{
                              left: `${previewCustomization.layout.estd.x}%`,
                              top: `${previewCustomization.layout.estd.y}%`,
                              transform: getPreviewTransformByAnchor(previewCustomization.layout.estd.anchor),
                              fontSize: `${scaleValue(8, previewScale)}px`,
                              textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.estd.anchor),
                            }}
                          >
                            {CERTIFICATE_HEADER.estd}
                          </div>
                          <p
                            className="absolute max-w-[90%] font-semibold text-slate-600 pointer-events-none whitespace-nowrap"
                            style={{
                              left: `${previewCustomization.layout.trust.x}%`,
                              top: `${previewCustomization.layout.trust.y}%`,
                              transform: getPreviewTransformByAnchor(previewCustomization.layout.trust.anchor),
                              fontSize: `${scaleValue(10, previewScale)}px`,
                              letterSpacing: `${scaleValue(2.2, previewScale)}px`,
                              textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.trust.anchor),
                            }}
                          >
                            {CERTIFICATE_HEADER.trust}
                          </p>
                          <p
                            className="absolute max-w-[90%] font-semibold text-slate-700 pointer-events-none"
                            style={{
                              left: `${previewCustomization.layout.campus.x}%`,
                              top: `${previewCustomization.layout.campus.y}%`,
                              transform: getPreviewTransformByAnchor(previewCustomization.layout.campus.anchor),
                              fontSize: `${scaleValue(11, previewScale)}px`,
                              textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.campus.anchor),
                            }}
                          >
                            {CERTIFICATE_HEADER.campus}
                          </p>
                          <p
                            className="absolute text-slate-500 max-w-[85%] pointer-events-none"
                            style={{
                              left: `${previewCustomization.layout.approvals.x}%`,
                              top: `${previewCustomization.layout.approvals.y}%`,
                              transform: getPreviewTransformByAnchor(previewCustomization.layout.approvals.anchor),
                              fontSize: `${scaleValue(9, previewScale)}px`,
                              textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.approvals.anchor),
                            }}
                          >
                            {CERTIFICATE_HEADER.approvals}
                          </p>
                          <div className="absolute left-[12%] right-[12%] top-[25%] h-px bg-slate-400/40 pointer-events-none" />
                          <div className="absolute left-[12%] right-[12%] top-[50%] h-px bg-slate-400/45 pointer-events-none" />
                          <div className="absolute left-[12%] right-[12%] top-[62%] h-px bg-slate-400/45 pointer-events-none" />
                          <div className="absolute left-[8%] top-[84%] w-[20%] h-px bg-slate-400/55 pointer-events-none" />
                          <div className="absolute left-1/2 top-[84%] w-[20%] -translate-x-1/2 h-px bg-slate-400/55 pointer-events-none" />
                          <div className="absolute right-[8%] top-[84%] w-[20%] h-px bg-slate-400/55 pointer-events-none" />
                          <div className="absolute inset-x-0 bottom-0 h-[16%] opacity-[0.16] pointer-events-none">
                            <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="w-full h-full">
                              <path
                                d="M0 150 L80 130 L140 140 L220 120 L300 135 L380 110 L460 140 L520 120 L600 145 L700 120 L760 150 L860 130 L940 150 L1040 125 L1120 150 L1200 140 L1200 200 L0 200 Z"
                                fill="#64748b"
                              />
                              <g fill="#64748b">
                                {[...Array(18)].map((_, idx) => (
                                  <circle key={idx} cx={40 + idx * 62} cy={180} r="12" opacity="0.45" />
                                ))}
                              </g>
                            </svg>
                          </div>
                        </>
                      )}

                      <div
                        className="absolute"
                        style={{
                          left: `${previewCustomization.layout.logo.x}%`,
                          top: `${previewCustomization.layout.logo.y}%`,
                          transform: getPreviewTransformByAnchor(previewCustomization.layout.logo.anchor),
                        }}
                      >
                        {previewCustomization.logoUrl ? (
                          <img
                            src={previewCustomization.logoUrl}
                            alt="Certificate logo"
                            className="object-contain"
                            style={{ width: `${scaleValue(previewCustomization.layout.logo.width, previewScale)}px` }}
                          />
                        ) : (
                          <CertificateLogo size={scaleValue(previewCustomization.layout.logo.width, previewScale)} />
                        )}
                      </div>
                      <div
                        className="absolute"
                        style={{
                          left: `${previewCustomization.layout.accreditationLogo.x}%`,
                          top: `${previewCustomization.layout.accreditationLogo.y}%`,
                          transform: getPreviewTransformByAnchor(
                            previewCustomization.layout.accreditationLogo.anchor
                          ),
                        }}
                      >
                        {previewCustomization.accreditationLogoUrl ? (
                          <img
                            src={previewCustomization.accreditationLogoUrl}
                            alt="Accreditation logo"
                            className="object-contain drop-shadow-[0_6px_14px_rgba(15,23,42,0.16)]"
                            style={{
                              width: `${scaleValue(
                                previewCustomization.layout.accreditationLogo.width,
                                previewScale
                              )}px`,
                            }}
                          />
                        ) : (
                          <AccreditationLogo
                            size={scaleValue(
                              previewCustomization.layout.accreditationLogo.width,
                              previewScale
                            )}
                          />
                        )}
                      </div>

                      <p
                        className="absolute max-w-[90%] text-center font-extrabold uppercase leading-tight whitespace-nowrap"
                        style={{
                          left: `${previewCustomization.layout.issuerName.x}%`,
                          top: `${previewCustomization.layout.issuerName.y}%`,
                          transform: getPreviewTransformByAnchor(previewCustomization.layout.issuerName.anchor),
                          fontSize: `${scaleValue(previewStyles.issuerName.fontSize, previewScale)}px`,
                          color: previewStyles.issuerName.color,
                          letterSpacing: `${scaleValue(1.4, previewScale)}px`,
                        }}
                      >
                        {previewCustomization.issuerName}
                      </p>

                      <div
                        className="absolute"
                        style={{
                          left: `${previewCustomization.layout.title.x}%`,
                          top: `${previewCustomization.layout.title.y}%`,
                          transform: getPreviewTransformByAnchor(previewCustomization.layout.title.anchor),
                          width: "46%",
                          height: "9%",
                        }}
                      >
                        <CertificateRibbon
                          title={previewTitleText}
                          textClassName="text-[clamp(9px,1.1vw,13px)]"
                          textStyle={{
                            fontSize: `${scaleValue(previewStyles.title.fontSize, previewScale)}px`,
                            color: previewStyles.title.color,
                          }}
                        />
                      </div>

                      <p
                        className="absolute max-w-[70%] font-serif leading-relaxed"
                        style={{
                          left: `${previewCustomization.layout.introText.x}%`,
                          top: `${previewCustomization.layout.introText.y}%`,
                          transform: getPreviewTransformByAnchor(previewCustomization.layout.introText.anchor),
                          fontSize: `${scaleValue(previewStyles.introText.fontSize, previewScale)}px`,
                          color: previewStyles.introText.color,
                          textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.introText.anchor),
                        }}
                      >
                        {previewCustomization.introText}
                      </p>

                      <p
                        className="absolute max-w-[70%] font-semibold font-serif leading-tight"
                        style={{
                          left: `${previewCustomization.layout.participantName.x}%`,
                          top: `${previewCustomization.layout.participantName.y}%`,
                          transform: getPreviewTransformByAnchor(previewCustomization.layout.participantName.anchor),
                          fontSize: `${scaleValue(previewStyles.participantName.fontSize, previewScale)}px`,
                          color: previewStyles.participantName.color,
                          textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.participantName.anchor),
                        }}
                      >
                        {`{Student Name}`}
                      </p>

                      <p
                        className="absolute max-w-[72%] font-serif leading-relaxed"
                        style={{
                          left: `${previewCustomization.layout.actionText.x}%`,
                          top: `${previewCustomization.layout.actionText.y}%`,
                          transform: getPreviewTransformByAnchor(previewCustomization.layout.actionText.anchor),
                          fontSize: `${scaleValue(previewStyles.actionText.fontSize, previewScale)}px`,
                          color: previewStyles.actionText.color,
                          textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.actionText.anchor),
                        }}
                      >
                        {previewActionText}
                      </p>

                      <p
                        className="absolute max-w-[72%] font-bold leading-snug"
                        style={{
                          left: `${previewCustomization.layout.eventName.x}%`,
                          top: `${previewCustomization.layout.eventName.y}%`,
                          transform: getPreviewTransformByAnchor(previewCustomization.layout.eventName.anchor),
                          fontSize: `${scaleValue(previewStyles.eventName.fontSize, previewScale)}px`,
                          color: previewStyles.eventName.color,
                          textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.eventName.anchor),
                        }}
                      >
                        {eventData?.title || "Event"}
                      </p>

                      <p
                        className="absolute max-w-[60%] font-serif whitespace-pre-line leading-relaxed"
                        style={{
                          left: `${previewCustomization.layout.dateVenue.x}%`,
                          top: `${previewCustomization.layout.dateVenue.y}%`,
                          transform: getPreviewTransformByAnchor(previewCustomization.layout.dateVenue.anchor),
                          fontSize: `${scaleValue(previewStyles.dateVenue.fontSize, previewScale)}px`,
                          color: previewStyles.dateVenue.color,
                          textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.dateVenue.anchor),
                        }}
                      >
                        {getEventMetaLabel(eventData, previewCustomization.issuerName)}
                      </p>

                      {previewCustomization.organizerSignatureUrl ? (
                        <div
                          className="absolute flex items-end pointer-events-none"
                          style={{
                            left: `${previewCustomization.layout.organizerSignature.x}%`,
                            top: `${previewCustomization.layout.organizerSignature.y}%`,
                            width: `${scaleValue(
                              previewCustomization.layout.organizerSignature.width,
                              previewScale
                            )}px`,
                            height: `${scaleValue(SIGNATURE_DISPLAY_MAX_HEIGHT, previewScale)}px`,
                            transform: getPreviewTransformByAnchor(
                              previewCustomization.layout.organizerSignature.anchor
                            ),
                          }}
                        >
                          <img
                            src={previewCustomization.organizerSignatureUrl}
                            alt="Organizer signature"
                            className="h-full w-full object-contain object-bottom"
                          />
                        </div>
                      ) : null}
                      {previewCustomization.hodSignatureUrl ? (
                        <div
                          className="absolute flex items-end pointer-events-none"
                          style={{
                            left: `${previewCustomization.layout.hodSignature.x}%`,
                            top: `${previewCustomization.layout.hodSignature.y}%`,
                            width: `${scaleValue(
                              previewCustomization.layout.hodSignature.width,
                              previewScale
                            )}px`,
                            height: `${scaleValue(SIGNATURE_DISPLAY_MAX_HEIGHT, previewScale)}px`,
                            transform: getPreviewTransformByAnchor(previewCustomization.layout.hodSignature.anchor),
                          }}
                        >
                          <img
                            src={previewCustomization.hodSignatureUrl}
                            alt="HOD signature"
                            className="h-full w-full object-contain object-bottom"
                          />
                        </div>
                      ) : null}
                      {previewCustomization.principalSignatureUrl ? (
                        <div
                          className="absolute flex items-end pointer-events-none"
                          style={{
                            left: `${previewCustomization.layout.principalSignature.x}%`,
                            top: `${previewCustomization.layout.principalSignature.y}%`,
                            width: `${scaleValue(
                              previewCustomization.layout.principalSignature.width,
                              previewScale
                            )}px`,
                            height: `${scaleValue(SIGNATURE_DISPLAY_MAX_HEIGHT, previewScale)}px`,
                            transform: getPreviewTransformByAnchor(
                              previewCustomization.layout.principalSignature.anchor
                            ),
                          }}
                        >
                          <img
                            src={previewCustomization.principalSignatureUrl}
                            alt="Principal signature"
                            className="h-full w-full object-contain object-bottom"
                          />
                        </div>
                      ) : null}

                      {previewCustomization.organizerName ? (
                          <p
                            className="absolute font-semibold whitespace-nowrap"
                            style={{
                              left: `${organizerNameNode.x}%`,
                              top: `${organizerNameNode.y}%`,
                              transform: getPreviewTransformByAnchor(organizerNameNode.anchor),
                              fontSize: `${scaleValue(previewStyles.organizerName.fontSize, previewScale)}px`,
                              color: previewStyles.organizerName.color,
                            }}
                          >
                            {previewCustomization.organizerName}
                          </p>
                      ) : null}
                      {previewCustomization.organizerDepartment ? (
                          <p
                            className="absolute whitespace-nowrap"
                            style={{
                              left: `${organizerDeptNode.x}%`,
                              top: `${organizerDeptNode.y}%`,
                              transform: getPreviewTransformByAnchor(organizerDeptNode.anchor),
                              fontSize: `${scaleValue(
                                previewStyles.organizerDepartment.fontSize,
                                previewScale
                              )}px`,
                              color: previewStyles.organizerDepartment.color,
                            }}
                          >
                            {previewCustomization.organizerDepartment}
                          </p>
                      ) : null}
                      {previewCustomization.hodName ? (
                          <p
                            className="absolute font-semibold whitespace-nowrap"
                            style={{
                              left: `${hodNameNode.x}%`,
                              top: `${hodNameNode.y}%`,
                              transform: getPreviewTransformByAnchor(hodNameNode.anchor),
                              fontSize: `${scaleValue(previewStyles.hodName.fontSize, previewScale)}px`,
                              color: previewStyles.hodName.color,
                            }}
                          >
                            {previewCustomization.hodName}
                          </p>
                      ) : null}
                      {previewCustomization.hodDepartment ? (
                          <p
                            className="absolute whitespace-nowrap"
                            style={{
                              left: `${hodDeptNode.x}%`,
                              top: `${hodDeptNode.y}%`,
                              transform: getPreviewTransformByAnchor(hodDeptNode.anchor),
                              fontSize: `${scaleValue(previewStyles.hodDepartment.fontSize, previewScale)}px`,
                              color: previewStyles.hodDepartment.color,
                            }}
                          >
                            {previewCustomization.hodDepartment}
                          </p>
                      ) : null}
                      {previewCustomization.principalName ? (
                          <p
                            className="absolute font-semibold whitespace-nowrap"
                            style={{
                              left: `${principalNameNode.x}%`,
                              top: `${principalNameNode.y}%`,
                              transform: getPreviewTransformByAnchor(principalNameNode.anchor),
                              fontSize: `${scaleValue(previewStyles.principalName.fontSize, previewScale)}px`,
                              color: previewStyles.principalName.color,
                            }}
                          >
                            {previewCustomization.principalName}
                          </p>
                      ) : null}
                      {previewCustomization.principalDepartment ? (
                          <p
                            className="absolute whitespace-nowrap"
                            style={{
                              left: `${principalDeptNode.x}%`,
                              top: `${principalDeptNode.y}%`,
                              transform: getPreviewTransformByAnchor(principalDeptNode.anchor),
                              fontSize: `${scaleValue(
                                previewStyles.principalDepartment.fontSize,
                                previewScale
                              )}px`,
                              color: previewStyles.principalDepartment.color,
                            }}
                          >
                            {previewCustomization.principalDepartment}
                          </p>
                      ) : null}

                          <p
                            className="absolute font-bold uppercase tracking-wide whitespace-nowrap"
                            style={{
                              left: `${previewCustomization.layout.coordinatorLabel.x}%`,
                              top: `${previewCustomization.layout.coordinatorLabel.y}%`,
                              transform: getPreviewTransformByAnchor(previewCustomization.layout.coordinatorLabel.anchor),
                              fontSize: `${scaleValue(previewStyles.coordinatorLabel.fontSize, previewScale)}px`,
                              color: previewStyles.coordinatorLabel.color,
                            }}
                          >
                            {previewCustomization.coordinatorLabel}
                          </p>

                          <p
                            className="absolute font-bold uppercase tracking-wide whitespace-nowrap"
                            style={{
                              left: `${previewCustomization.layout.hodLabel.x}%`,
                              top: `${previewCustomization.layout.hodLabel.y}%`,
                              transform: getPreviewTransformByAnchor(previewCustomization.layout.hodLabel.anchor),
                              fontSize: `${scaleValue(previewStyles.hodLabel.fontSize, previewScale)}px`,
                              color: previewStyles.hodLabel.color,
                            }}
                          >
                            {previewCustomization.hodLabel}
                          </p>

                          <p
                            className="absolute font-bold uppercase tracking-wide whitespace-nowrap"
                            style={{
                              left: `${previewCustomization.layout.principalLabel.x}%`,
                              top: `${previewCustomization.layout.principalLabel.y}%`,
                              transform: getPreviewTransformByAnchor(previewCustomization.layout.principalLabel.anchor),
                              fontSize: `${scaleValue(previewStyles.principalLabel.fontSize, previewScale)}px`,
                              color: previewStyles.principalLabel.color,
                            }}
                          >
                            {previewCustomization.principalLabel}
                          </p>

                          <p
                            className="absolute max-w-[90%] font-serif italic text-center whitespace-normal"
                            style={{
                              left: `${previewCustomization.layout.footerText.x}%`,
                              top: `${previewCustomization.layout.footerText.y}%`,
                              transform: getPreviewTransformByAnchor(previewCustomization.layout.footerText.anchor),
                              fontSize: `${scaleValue(previewStyles.footerText.fontSize, previewScale)}px`,
                              color: previewStyles.footerText.color,
                              textAlign: getPreviewTextAlignByAnchor(previewCustomization.layout.footerText.anchor),
                            }}
                          >
                            {previewCustomization.footerText}
                          </p>

                      <div
                        className="absolute rounded-md border border-amber-400/80 bg-amber-100/90 font-semibold text-amber-900 shadow-sm whitespace-nowrap"
                        style={{
                          left: `${previewCustomization.layout.verificationCode.x}%`,
                          top: `${previewCustomization.layout.verificationCode.y}%`,
                          transform: getPreviewTransformByAnchor(
                            previewCustomization.layout.verificationCode.anchor
                          ),
                          width: `${scaleValue(
                            previewCustomization.layout.verificationCode.width,
                            previewScale
                          )}px`,
                          height: `${scaleValue(
                            previewCustomization.layout.verificationCode.height,
                            previewScale
                          )}px`,
                          padding: `0 ${scaleValue(10, previewScale)}px`,
                          boxSizing: "border-box",
                          fontSize: `${scaleValue(8, previewScale)}px`,
                        }}
                      >
                        <div className="flex h-full items-center justify-between gap-2">
                          <span>Verification Code</span>
                          <span className="font-bold">{DEMO_VERIFICATION_CODE}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-300">
                      <span>Landscape</span>
                      <span>A4 Size</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={triggerBackgroundPicker}
                        disabled={uploadingBackground}
                        className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                      >
                        {uploadingBackground ? "Uploading..." : "Replace Image"}
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenCustomizationDialog}
                        className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200"
                      >
                        Edit & Save Template
                      </button>
                    </div>
                  </div>
                </article>

                
              </div>

              <aside className="space-y-4">
                

                <article className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300 inline-flex items-center gap-1.5">
                    <CalendarDays size={12} />
                    Event Date: {getEventDateLabel(eventData)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    Venue: {eventData?.venue?.location || eventData?.venue?.mode || "TBD"}
                  </p>
                </article>
              </aside>
            </section>
          </>
        )}

        {isCustomizeDialogOpen && (
          <section className="fixed inset-0 z-50 bg-slate-900/60 px-4 py-8 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl">
              <div className="border-b border-slate-200 dark:border-white/10 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Customize Certificate Fields</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                  Changes are saved for this event and used in generated certificates.
                </p>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-5">
                <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Background Image</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">
                    Upload a new background image or set a public image URL.
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-start">
                    <input
                      type="url"
                      name="backgroundImageUrl"
                      value={draftCustomization.backgroundImageUrl || ""}
                      maxLength={CERTIFICATE_CUSTOMIZATION_LIMITS.backgroundImageUrl}
                      onChange={(eventValue) =>
                        handleDraftCustomizationChange("backgroundImageUrl", eventValue.target.value)
                      }
                      placeholder="https://example.com/certificate-background.jpg"
                      className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={triggerBackgroundPicker}
                      disabled={uploadingBackground || savingCustomization}
                      className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                    >
                      {uploadingBackground ? "Uploading..." : "Upload Image"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDraftCustomizationChange("backgroundImageUrl", "")}
                      disabled={savingCustomization}
                      className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                    >
                      Clear
                    </button>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Certificate Logo</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">
                    Upload the college logo (white background auto-removed) or set a public image URL.
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-start">
                    <input
                      type="url"
                      name="logoUrl"
                      value={draftCustomization.logoUrl || ""}
                      maxLength={CERTIFICATE_CUSTOMIZATION_LIMITS.logoUrl}
                      onChange={(eventValue) =>
                        handleDraftCustomizationChange("logoUrl", eventValue.target.value)
                      }
                      placeholder="https://example.com/college-logo.png"
                      className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={triggerLogoPicker}
                      disabled={uploadingLogo || savingCustomization}
                      className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                    >
                      {uploadingLogo ? "Uploading..." : "Upload Logo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDraftCustomizationChange("logoUrl", "")}
                      disabled={savingCustomization}
                      className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                    >
                      Clear
                    </button>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-3">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Accreditation Logo</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">
                    Upload the exact NBA image so the certificate uses the real logo instead of a drawn version.
                  </p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-start">
                    <input
                      type="url"
                      name="accreditationLogoUrl"
                      value={draftCustomization.accreditationLogoUrl || ""}
                      maxLength={CERTIFICATE_CUSTOMIZATION_LIMITS.accreditationLogoUrl}
                      onChange={(eventValue) =>
                        handleDraftCustomizationChange("accreditationLogoUrl", eventValue.target.value)
                      }
                      placeholder="https://example.com/nba-logo.png"
                      className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={triggerAccreditationLogoPicker}
                      disabled={uploadingAccreditationLogo || savingCustomization}
                      className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                    >
                      {uploadingAccreditationLogo ? "Uploading..." : "Upload Logo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDraftCustomizationChange("accreditationLogoUrl", "")}
                      disabled={savingCustomization}
                      className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                    >
                      Clear
                    </button>
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Text Content</p>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {CUSTOMIZATION_FIELDS.map((field) => (
                      <label key={field.key} className="space-y-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{field.label}</span>
                        <input
                          type="text"
                          name={field.key}
                          value={draftCustomization[field.key] || ""}
                          maxLength={CERTIFICATE_CUSTOMIZATION_LIMITS[field.key]}
                          onChange={(eventValue) => handleDraftCustomizationChange(field.key, eventValue.target.value)}
                          className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        {field.hint ? (
                          <p className="text-[11px] text-slate-500 dark:text-slate-300">{field.hint}</p>
                        ) : null}
                      </label>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Text Styles</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">
                    Adjust font size and color for each certificate element.
                  </p>
                  <div className="mt-2 space-y-2">
                    {TEXT_STYLE_FIELDS.map((field) => {
                      const styleNode = draftCustomization.styles?.[field.key] || DEFAULT_CERTIFICATE_STYLES[field.key];
                      return (
                        <div
                          key={field.key}
                          className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-2.5 grid grid-cols-1 sm:grid-cols-[minmax(160px,1fr)_90px_110px_120px] gap-2 items-center"
                        >
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{field.label}</p>

                          <label className="space-y-0.5">
                            <span className="text-[10px] text-slate-500 dark:text-slate-300">Size</span>
                            <input
                              type="number"
                              name={`${field.key}FontSize`}
                              min="8"
                              max="40"
                              step="1"
                              value={styleNode?.fontSize ?? 12}
                              onChange={(eventValue) =>
                                handleDraftStyleChange(field.key, "fontSize", eventValue.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                            />
                          </label>

                          <label className="space-y-0.5">
                            <span className="text-[10px] text-slate-500 dark:text-slate-300">Color</span>
                            <input
                              type="color"
                              name={`${field.key}ColorPicker`}
                              value={styleNode?.color || "#000000"}
                              onChange={(eventValue) =>
                                handleDraftStyleChange(field.key, "color", eventValue.target.value)
                              }
                              className="h-9 w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 p-1"
                            />
                          </label>

                          <label className="space-y-0.5">
                            <span className="text-[10px] text-slate-500 dark:text-slate-300">Hex</span>
                            <input
                              type="text"
                              name={`${field.key}Color`}
                              value={styleNode?.color || ""}
                              onChange={(eventValue) =>
                                handleDraftStyleChange(field.key, "color", eventValue.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Signature Details</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">
                    Upload PNG signatures and add role, name, and department. White background is cleaned automatically.
                  </p>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAutoArrangeSignatures}
                      disabled={savingCustomization}
                      className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                    >
                      Auto Arrange Signatures
                    </button>
                  </div>
                  <div className="mt-2 space-y-3">
                    {SIGNATURE_FIELDS.map((field) => (
                      <div
                        key={field.role}
                        className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{field.label}</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => triggerSignaturePicker(field.role)}
                              disabled={savingCustomization || uploadingSignature[field.role]}
                              className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                            >
                              {uploadingSignature[field.role] ? "Uploading..." : "Upload PNG"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDraftCustomizationChange(field.signatureKey, "")}
                              disabled={savingCustomization}
                              className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {draftCustomization[field.signatureKey] ? (
                          <div className="mt-2 rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-2">
                            <img
                              src={draftCustomization[field.signatureKey]}
                              alt={`${field.label} signature`}
                              className="h-16 w-auto object-contain"
                            />
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-300">
                            No signature uploaded.
                          </p>
                        )}

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                              Role Label
                            </span>
                            <input
                              type="text"
                              name={field.labelKey}
                              value={draftCustomization[field.labelKey] || ""}
                              maxLength={CERTIFICATE_CUSTOMIZATION_LIMITS[field.labelKey]}
                              onChange={(eventValue) =>
                                handleDraftCustomizationChange(field.labelKey, eventValue.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-200">Name</span>
                            <input
                              type="text"
                              name={field.nameKey}
                              value={draftCustomization[field.nameKey] || ""}
                              maxLength={CERTIFICATE_CUSTOMIZATION_LIMITS[field.nameKey]}
                              onChange={(eventValue) =>
                                handleDraftCustomizationChange(field.nameKey, eventValue.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-200">
                              Department
                            </span>
                            <input
                              type="text"
                              name={field.deptKey}
                              value={draftCustomization[field.deptKey] || ""}
                              maxLength={CERTIFICATE_CUSTOMIZATION_LIMITS[field.deptKey]}
                              onChange={(eventValue) =>
                                handleDraftCustomizationChange(field.deptKey, eventValue.target.value)
                              }
                              className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Rearrange Positions</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-300">
                      Drag elements directly on the canvas, or fine tune with X/Y values below.
                    </p>
                    <CertificatePreviewTypeToggle
                      value={previewCertificateType}
                      onChange={setPreviewCertificateType}
                    />
                  </div>
                  <div className="mt-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/5 p-3">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Drag Editor {draggingLayoutKey ? `- Moving ${draggingLayoutKey}` : ""}
                    </p>
                    <div
                      ref={dragCanvasRef}
                      className="relative mt-2 w-full overflow-hidden rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-900/70 touch-none select-none"
                      style={{ aspectRatio: PREVIEW_RATIO }}
                    >
                      {draftCustomization.backgroundImageUrl ? (
                        <img
                          src={draftCustomization.backgroundImageUrl}
                          alt="Certificate background"
                          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                        />
                      ) : null}

                      {!draftCustomization.backgroundImageUrl && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-50 pointer-events-none" />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(203,213,225,0.55),transparent_60%)] pointer-events-none" />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(191,219,254,0.35),transparent_55%)] pointer-events-none" />
                          <div className="absolute inset-x-0 top-0 h-[26%] bg-gradient-to-b from-slate-300/90 via-slate-200/60 to-transparent pointer-events-none" />
                          <div className="absolute inset-x-0 top-0 h-[4%] bg-gradient-to-r from-amber-300/70 via-amber-200/40 to-amber-300/70 pointer-events-none" />
                          <div className="absolute left-0 top-0 h-full w-[1.2%] bg-gradient-to-b from-amber-400/70 via-amber-300/40 to-amber-200/30 pointer-events-none" />
                          <div className="absolute right-0 top-0 h-full w-[1.2%] bg-gradient-to-b from-amber-400/70 via-amber-300/40 to-amber-200/30 pointer-events-none" />
                          <div className="absolute inset-[1.6%] border border-slate-300/80 pointer-events-none" />
                          <div className="absolute inset-[2.6%] border border-amber-300/70 pointer-events-none" />

                          <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                            <svg viewBox="0 0 200 200" className="w-[150px] h-[150px]" aria-hidden="true">
                              <circle cx="100" cy="100" r="80" fill="none" stroke="#64748b" strokeWidth="2" />
                              <circle cx="100" cy="100" r="60" fill="none" stroke="#64748b" strokeWidth="1.5" />
                              {[...Array(16)].map((_, idx) => {
                                const angle = (idx * Math.PI) / 8;
                                const x1 = 100 + Math.cos(angle) * 30;
                                const y1 = 100 + Math.sin(angle) * 30;
                                const x2 = 100 + Math.cos(angle) * 75;
                                const y2 = 100 + Math.sin(angle) * 75;
                                return (
                                  <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="1" />
                                );
                              })}
                            </svg>
                          </div>

                          <button
                            type="button"
                            onPointerDown={handleDragCanvasPointerDown("estd")}
                            className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-semibold text-slate-600 whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                            style={{
                              left: `${draftCustomization.layout.estd.x}%`,
                              top: `${draftCustomization.layout.estd.y}%`,
                              transform: getPreviewTransformByAnchor(draftCustomization.layout.estd.anchor),
                              fontSize: `${scaleValue(8, dragScale)}px`,
                              textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.estd.anchor),
                            }}
                          >
                            {CERTIFICATE_HEADER.estd}
                          </button>
                          <button
                            type="button"
                            onPointerDown={handleDragCanvasPointerDown("trust")}
                            className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-semibold text-slate-600 whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                            style={{
                              left: `${draftCustomization.layout.trust.x}%`,
                              top: `${draftCustomization.layout.trust.y}%`,
                              transform: getPreviewTransformByAnchor(draftCustomization.layout.trust.anchor),
                              fontSize: `${scaleValue(10, dragScale)}px`,
                              letterSpacing: `${scaleValue(2.2, dragScale)}px`,
                              textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.trust.anchor),
                            }}
                          >
                            {CERTIFICATE_HEADER.trust}
                          </button>
                          <button
                            type="button"
                            onPointerDown={handleDragCanvasPointerDown("campus")}
                            className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-semibold text-slate-700 hover:border-violet-300 cursor-grab active:cursor-grabbing"
                            style={{
                              left: `${draftCustomization.layout.campus.x}%`,
                              top: `${draftCustomization.layout.campus.y}%`,
                              transform: getPreviewTransformByAnchor(draftCustomization.layout.campus.anchor),
                              fontSize: `${scaleValue(11, dragScale)}px`,
                              textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.campus.anchor),
                            }}
                          >
                            {CERTIFICATE_HEADER.campus}
                          </button>
                          <button
                            type="button"
                            onPointerDown={handleDragCanvasPointerDown("approvals")}
                            className="absolute max-w-[85%] px-1.5 py-0.5 rounded border border-transparent bg-white/70 text-slate-500 hover:border-violet-300 cursor-grab active:cursor-grabbing"
                            style={{
                              left: `${draftCustomization.layout.approvals.x}%`,
                              top: `${draftCustomization.layout.approvals.y}%`,
                              transform: getPreviewTransformByAnchor(draftCustomization.layout.approvals.anchor),
                              fontSize: `${scaleValue(9, dragScale)}px`,
                              textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.approvals.anchor),
                            }}
                          >
                            {CERTIFICATE_HEADER.approvals}
                          </button>
                          <div className="absolute left-[12%] right-[12%] top-[25%] h-px bg-slate-400/40 pointer-events-none" />
                          <div className="absolute left-[12%] right-[12%] top-[50%] h-px bg-slate-400/45 pointer-events-none" />
                          <div className="absolute left-[12%] right-[12%] top-[62%] h-px bg-slate-400/45 pointer-events-none" />
                          <div className="absolute left-[8%] top-[84%] w-[20%] h-px bg-slate-400/55 pointer-events-none" />
                          <div className="absolute left-1/2 top-[84%] w-[20%] -translate-x-1/2 h-px bg-slate-400/55 pointer-events-none" />
                          <div className="absolute right-[8%] top-[84%] w-[20%] h-px bg-slate-400/55 pointer-events-none" />
                          <div className="absolute inset-x-0 bottom-0 h-[16%] opacity-[0.16] pointer-events-none">
                            <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="w-full h-full">
                              <path
                                d="M0 150 L80 130 L140 140 L220 120 L300 135 L380 110 L460 140 L520 120 L600 145 L700 120 L760 150 L860 130 L940 150 L1040 125 L1120 150 L1200 140 L1200 200 L0 200 Z"
                                fill="#64748b"
                              />
                              <g fill="#64748b">
                                {[...Array(18)].map((_, idx) => (
                                  <circle key={idx} cx={40 + idx * 62} cy={180} r="12" opacity="0.45" />
                                ))}
                              </g>
                            </svg>
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("logo")}
                        className="absolute p-0 rounded-full border border-transparent bg-white/70 hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.logo.x}%`,
                          top: `${draftCustomization.layout.logo.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.logo.anchor),
                        }}
                      >
                        {draftCustomization.logoUrl ? (
                          <img
                            src={draftCustomization.logoUrl}
                            alt="Certificate logo"
                            className="object-contain"
                            style={{ width: `${scaleValue(draftCustomization.layout.logo.width, dragScale)}px` }}
                          />
                        ) : (
                          <CertificateLogo
                            size={scaleValue(draftCustomization.layout.logo.width, dragScale)}
                            className="bg-white/80"
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("accreditationLogo")}
                        className="absolute p-0 rounded-full border border-transparent bg-white/70 hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.accreditationLogo.x}%`,
                          top: `${draftCustomization.layout.accreditationLogo.y}%`,
                          transform: getPreviewTransformByAnchor(
                            draftCustomization.layout.accreditationLogo.anchor
                          ),
                        }}
                      >
                        {draftCustomization.accreditationLogoUrl ? (
                          <img
                            src={draftCustomization.accreditationLogoUrl}
                            alt="Accreditation logo"
                            className="object-contain drop-shadow-[0_6px_14px_rgba(15,23,42,0.16)]"
                            style={{
                              width: `${scaleValue(
                                draftCustomization.layout.accreditationLogo.width,
                                dragScale
                              )}px`,
                            }}
                          />
                        ) : (
                          <AccreditationLogo
                            size={scaleValue(
                              draftCustomization.layout.accreditationLogo.width,
                              dragScale
                            )}
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("issuerName")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-extrabold uppercase whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.issuerName.x}%`,
                          top: `${draftCustomization.layout.issuerName.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.issuerName.anchor),
                          fontSize: `${scaleValue(draftStyles.issuerName.fontSize, dragScale)}px`,
                          color: draftStyles.issuerName.color,
                          letterSpacing: `${scaleValue(1.4, dragScale)}px`,
                        }}
                      >
                        {draftCustomization.issuerName}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("title")}
                        className="absolute p-0 border border-transparent bg-transparent hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.title.x}%`,
                          top: `${draftCustomization.layout.title.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.title.anchor),
                          width: "46%",
                          height: "9%",
                        }}
                      >
                        <CertificateRibbon
                          title={draftTitleText}
                          textClassName="text-[clamp(9px,1.1vw,13px)]"
                          textStyle={{
                            fontSize: `${scaleValue(draftStyles.title.fontSize, dragScale)}px`,
                            color: draftStyles.title.color,
                          }}
                        />
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("introText")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-serif whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.introText.x}%`,
                          top: `${draftCustomization.layout.introText.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.introText.anchor),
                          fontSize: `${scaleValue(draftStyles.introText.fontSize, dragScale)}px`,
                          color: draftStyles.introText.color,
                          textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.introText.anchor),
                        }}
                      >
                        {draftCustomization.introText}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("participantName")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-semibold font-serif whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.participantName.x}%`,
                          top: `${draftCustomization.layout.participantName.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.participantName.anchor),
                          fontSize: `${scaleValue(draftStyles.participantName.fontSize, dragScale)}px`,
                          color: draftStyles.participantName.color,
                          textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.participantName.anchor),
                        }}
                      >
                        {`{Student Name}`}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("actionText")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-serif whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.actionText.x}%`,
                          top: `${draftCustomization.layout.actionText.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.actionText.anchor),
                          fontSize: `${scaleValue(draftStyles.actionText.fontSize, dragScale)}px`,
                          color: draftStyles.actionText.color,
                          textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.actionText.anchor),
                        }}
                      >
                        {draftActionText}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("eventName")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-bold whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.eventName.x}%`,
                          top: `${draftCustomization.layout.eventName.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.eventName.anchor),
                          fontSize: `${scaleValue(draftStyles.eventName.fontSize, dragScale)}px`,
                          color: draftStyles.eventName.color,
                          textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.eventName.anchor),
                        }}
                      >
                        {eventData?.title || "Event"}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("dateVenue")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-serif whitespace-pre-line hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.dateVenue.x}%`,
                          top: `${draftCustomization.layout.dateVenue.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.dateVenue.anchor),
                          fontSize: `${scaleValue(draftStyles.dateVenue.fontSize, dragScale)}px`,
                          color: draftStyles.dateVenue.color,
                          textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.dateVenue.anchor),
                        }}
                      >
                        {getEventMetaLabel(eventData, draftCustomization.issuerName)}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("organizerSignature")}
                        className="absolute flex items-end overflow-hidden p-0 rounded border border-transparent bg-white/70 hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.organizerSignature.x}%`,
                          top: `${draftCustomization.layout.organizerSignature.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.organizerSignature.anchor),
                          width: `${scaleValue(
                            draftCustomization.layout.organizerSignature.width,
                            dragScale
                          )}px`,
                          height: `${scaleValue(SIGNATURE_DISPLAY_MAX_HEIGHT, dragScale)}px`,
                        }}
                      >
                          {draftCustomization.organizerSignatureUrl ? (
                            <img
                              src={draftCustomization.organizerSignatureUrl}
                              alt="Organizer signature"
                              className="h-full w-full object-contain object-bottom"
                            />
                          ) : (
                            <span className="block w-full px-2 py-1 text-[10px] text-slate-500">Organizer Sign</span>
                          )}
                      </button>
                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("hodSignature")}
                        className="absolute flex items-end overflow-hidden p-0 rounded border border-transparent bg-white/70 hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.hodSignature.x}%`,
                          top: `${draftCustomization.layout.hodSignature.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.hodSignature.anchor),
                          width: `${scaleValue(
                            draftCustomization.layout.hodSignature.width,
                            dragScale
                          )}px`,
                          height: `${scaleValue(SIGNATURE_DISPLAY_MAX_HEIGHT, dragScale)}px`,
                        }}
                      >
                          {draftCustomization.hodSignatureUrl ? (
                            <img
                              src={draftCustomization.hodSignatureUrl}
                              alt="HOD signature"
                              className="h-full w-full object-contain object-bottom"
                            />
                          ) : (
                            <span className="block w-full px-2 py-1 text-[10px] text-slate-500">HOD Sign</span>
                          )}
                      </button>
                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("principalSignature")}
                        className="absolute flex items-end overflow-hidden p-0 rounded border border-transparent bg-white/70 hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.principalSignature.x}%`,
                          top: `${draftCustomization.layout.principalSignature.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.principalSignature.anchor),
                          width: `${scaleValue(
                            draftCustomization.layout.principalSignature.width,
                            dragScale
                          )}px`,
                          height: `${scaleValue(SIGNATURE_DISPLAY_MAX_HEIGHT, dragScale)}px`,
                        }}
                      >
                          {draftCustomization.principalSignatureUrl ? (
                            <img
                              src={draftCustomization.principalSignatureUrl}
                              alt="Principal signature"
                              className="h-full w-full object-contain object-bottom"
                            />
                          ) : (
                            <span className="block w-full px-2 py-1 text-[10px] text-slate-500">Principal Sign</span>
                          )}
                      </button>

                      {draftCustomization.organizerName ? (
                        <div
                          className="absolute font-semibold whitespace-nowrap pointer-events-none"
                          style={{
                            left: `${offsetLayoutNode(draftCustomization.layout.coordinatorLabel, -3.2).x}%`,
                            top: `${offsetLayoutNode(draftCustomization.layout.coordinatorLabel, -3.2).y}%`,
                            transform: getPreviewTransformByAnchor(
                              offsetLayoutNode(draftCustomization.layout.coordinatorLabel, -3.2).anchor
                            ),
                            fontSize: `${draftStyles.organizerName.fontSize}px`,
                            color: draftStyles.organizerName.color,
                          }}
                        >
                          {draftCustomization.organizerName}
                        </div>
                      ) : null}
                      {draftCustomization.organizerDepartment ? (
                        <div
                          className="absolute whitespace-nowrap pointer-events-none"
                          style={{
                            left: `${offsetLayoutNode(draftCustomization.layout.coordinatorLabel, -1.6).x}%`,
                            top: `${offsetLayoutNode(draftCustomization.layout.coordinatorLabel, -1.6).y}%`,
                            transform: getPreviewTransformByAnchor(
                              offsetLayoutNode(draftCustomization.layout.coordinatorLabel, -1.6).anchor
                            ),
                            fontSize: `${draftStyles.organizerDepartment.fontSize}px`,
                            color: draftStyles.organizerDepartment.color,
                          }}
                        >
                          {draftCustomization.organizerDepartment}
                        </div>
                      ) : null}
                      {draftCustomization.hodName ? (
                        <div
                          className="absolute font-semibold whitespace-nowrap pointer-events-none"
                          style={{
                            left: `${offsetLayoutNode(draftCustomization.layout.hodLabel, -3.2).x}%`,
                            top: `${offsetLayoutNode(draftCustomization.layout.hodLabel, -3.2).y}%`,
                            transform: getPreviewTransformByAnchor(
                              offsetLayoutNode(draftCustomization.layout.hodLabel, -3.2).anchor
                            ),
                            fontSize: `${draftStyles.hodName.fontSize}px`,
                            color: draftStyles.hodName.color,
                          }}
                        >
                          {draftCustomization.hodName}
                        </div>
                      ) : null}
                      {draftCustomization.hodDepartment ? (
                        <div
                          className="absolute whitespace-nowrap pointer-events-none"
                          style={{
                            left: `${offsetLayoutNode(draftCustomization.layout.hodLabel, -1.6).x}%`,
                            top: `${offsetLayoutNode(draftCustomization.layout.hodLabel, -1.6).y}%`,
                            transform: getPreviewTransformByAnchor(
                              offsetLayoutNode(draftCustomization.layout.hodLabel, -1.6).anchor
                            ),
                            fontSize: `${draftStyles.hodDepartment.fontSize}px`,
                            color: draftStyles.hodDepartment.color,
                          }}
                        >
                          {draftCustomization.hodDepartment}
                        </div>
                      ) : null}
                      {draftCustomization.principalName ? (
                        <div
                          className="absolute font-semibold whitespace-nowrap pointer-events-none"
                          style={{
                            left: `${offsetLayoutNode(draftCustomization.layout.principalLabel, -3.2).x}%`,
                            top: `${offsetLayoutNode(draftCustomization.layout.principalLabel, -3.2).y}%`,
                            transform: getPreviewTransformByAnchor(
                              offsetLayoutNode(draftCustomization.layout.principalLabel, -3.2).anchor
                            ),
                            fontSize: `${draftStyles.principalName.fontSize}px`,
                            color: draftStyles.principalName.color,
                          }}
                        >
                          {draftCustomization.principalName}
                        </div>
                      ) : null}
                      {draftCustomization.principalDepartment ? (
                        <div
                          className="absolute whitespace-nowrap pointer-events-none"
                          style={{
                            left: `${offsetLayoutNode(draftCustomization.layout.principalLabel, -1.6).x}%`,
                            top: `${offsetLayoutNode(draftCustomization.layout.principalLabel, -1.6).y}%`,
                            transform: getPreviewTransformByAnchor(
                              offsetLayoutNode(draftCustomization.layout.principalLabel, -1.6).anchor
                            ),
                            fontSize: `${draftStyles.principalDepartment.fontSize}px`,
                            color: draftStyles.principalDepartment.color,
                          }}
                        >
                          {draftCustomization.principalDepartment}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("coordinatorLabel")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-bold uppercase tracking-wide whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.coordinatorLabel.x}%`,
                          top: `${draftCustomization.layout.coordinatorLabel.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.coordinatorLabel.anchor),
                          fontSize: `${draftStyles.coordinatorLabel.fontSize}px`,
                          color: draftStyles.coordinatorLabel.color,
                        }}
                      >
                        {draftCustomization.coordinatorLabel}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("hodLabel")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-bold uppercase tracking-wide whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.hodLabel.x}%`,
                          top: `${draftCustomization.layout.hodLabel.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.hodLabel.anchor),
                          fontSize: `${draftStyles.hodLabel.fontSize}px`,
                          color: draftStyles.hodLabel.color,
                        }}
                      >
                        {draftCustomization.hodLabel}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("principalLabel")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-bold uppercase tracking-wide whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.principalLabel.x}%`,
                          top: `${draftCustomization.layout.principalLabel.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.principalLabel.anchor),
                          fontSize: `${draftStyles.principalLabel.fontSize}px`,
                          color: draftStyles.principalLabel.color,
                        }}
                      >
                        {draftCustomization.principalLabel}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("footerText")}
                        className="absolute px-1.5 py-0.5 rounded border border-transparent bg-white/70 font-serif italic whitespace-nowrap hover:border-violet-300 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.footerText.x}%`,
                          top: `${draftCustomization.layout.footerText.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.footerText.anchor),
                          fontSize: `${draftStyles.footerText.fontSize}px`,
                          color: draftStyles.footerText.color,
                          textAlign: getPreviewTextAlignByAnchor(draftCustomization.layout.footerText.anchor),
                        }}
                      >
                        {draftCustomization.footerText}
                      </button>

                      <button
                        type="button"
                        onPointerDown={handleDragCanvasPointerDown("verificationCode")}
                        className="absolute rounded-md border border-amber-400/80 bg-amber-100/90 font-semibold text-amber-900 shadow-sm whitespace-nowrap hover:border-amber-500/90 cursor-grab active:cursor-grabbing"
                        style={{
                          left: `${draftCustomization.layout.verificationCode.x}%`,
                          top: `${draftCustomization.layout.verificationCode.y}%`,
                          transform: getPreviewTransformByAnchor(draftCustomization.layout.verificationCode.anchor),
                          width: `${scaleValue(
                            draftCustomization.layout.verificationCode.width,
                            dragScale
                          )}px`,
                          height: `${scaleValue(
                            draftCustomization.layout.verificationCode.height,
                            dragScale
                          )}px`,
                          padding: `0 ${scaleValue(10, dragScale)}px`,
                          boxSizing: "border-box",
                          fontSize: `${scaleValue(8, dragScale)}px`,
                        }}
                      >
                        <span className="flex h-full items-center justify-between gap-2">
                          <span>Verification Code</span>
                          <span className="font-bold">{DEMO_VERIFICATION_CODE}</span>
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {LAYOUT_FIELDS.map((field) => {
                      const node = draftCustomization.layout?.[field.key] || createDefaultCertificateLayout()[field.key];
                      return (
                        <div
                          key={field.key}
                          className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-2.5 grid grid-cols-1 sm:grid-cols-[minmax(120px,1fr)_88px_88px_112px_88px_88px] gap-2 items-center"
                        >
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{field.label}</p>

                          <label className="space-y-0.5">
                            <span className="text-[10px] text-slate-500 dark:text-slate-300">X</span>
                            <input
                              type="number"
                              name={`${field.key}X`}
                              min="0"
                              max="100"
                              step="0.1"
                              value={node.x}
                              onChange={(eventValue) => handleDraftLayoutChange(field.key, "x", eventValue.target.value)}
                              className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                            />
                          </label>

                          <label className="space-y-0.5">
                            <span className="text-[10px] text-slate-500 dark:text-slate-300">Y</span>
                            <input
                              type="number"
                              name={`${field.key}Y`}
                              min="0"
                              max="100"
                              step="0.1"
                              value={node.y}
                              onChange={(eventValue) => handleDraftLayoutChange(field.key, "y", eventValue.target.value)}
                              className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                            />
                          </label>

                          <label className="space-y-0.5">
                            <span className="text-[10px] text-slate-500 dark:text-slate-300">Anchor</span>
                            <select
                              name={`${field.key}Anchor`}
                              value={node.anchor}
                              onChange={(eventValue) => handleDraftLayoutChange(field.key, "anchor", eventValue.target.value)}
                              className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </label>

                          {field.hasWidth ? (
                            <label className="space-y-0.5">
                              <span className="text-[10px] text-slate-500 dark:text-slate-300">Width</span>
                              <input
                                type="number"
                                name={`${field.key}Width`}
                                min={
                                  field.key === "verificationCode"
                                    ? "180"
                                    : field.key === "logo"
                                      ? "60"
                                      : "40"
                                }
                                max={
                                  field.key === "verificationCode"
                                    ? "420"
                                    : field.key === "logo"
                                      ? "320"
                                      : "200"
                                }
                                step="1"
                                value={node.width || 120}
                                onChange={(eventValue) =>
                                  handleDraftLayoutChange(field.key, "width", eventValue.target.value)
                                }
                                className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                              />
                            </label>
                          ) : (
                            <div />
                          )}

                          {field.hasHeight ? (
                            <label className="space-y-0.5">
                              <span className="text-[10px] text-slate-500 dark:text-slate-300">Height</span>
                              <input
                                type="number"
                                name={`${field.key}Height`}
                                min="22"
                                max="52"
                                step="1"
                                value={node.height || VERIFICATION_BADGE_HEIGHT}
                                onChange={(eventValue) =>
                                  handleDraftLayoutChange(field.key, "height", eventValue.target.value)
                                }
                                className="w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                              />
                            </label>
                          ) : (
                            <div />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="border-t border-slate-200 dark:border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleResetCustomization}
                  disabled={savingCustomization || uploadingBackground}
                  className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                >
                  Reset Defaults
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseCustomizationDialog}
                    disabled={savingCustomization || uploadingBackground}
                    className="rounded-md border border-slate-300 dark:border-white/15 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCustomization}
                    disabled={savingCustomization || uploadingBackground}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingCustomization ? <Loader2 size={12} className="animate-spin" /> : null}
                    {savingCustomization ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
