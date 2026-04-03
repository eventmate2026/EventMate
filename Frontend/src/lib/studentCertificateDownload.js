import SummaryApi from "../api/SummaryApi";
import api from "./api";
import { sanitizeUserMessage } from "./safeMessage";

export const CERTIFICATE_DOWNLOAD_FALLBACK =
  "Unable to download this certificate right now. Please try again.";

const resolveEntityId = (...candidates) => {
  for (const value of candidates) {
    if (!value) continue;

    if (typeof value === "string" || typeof value === "number") {
      const normalized = String(value).trim();
      if (!normalized) continue;
      const objectIdMatch = normalized.match(/[a-f0-9]{24}/i);
      return objectIdMatch?.[0] || normalized;
    }

    if (typeof value === "object") {
      const oid = String(value?.$oid || "").trim();
      if (oid) return oid;
      const nested = resolveEntityId(value?._id, value?.id, value?.eventId);
      if (nested) return nested;
    }
  }

  return "";
};

const resolveEmail = (...candidates) => {
  for (const value of candidates) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized && normalized.includes("@")) return normalized;
  }
  return "";
};

const toBinaryString = (bytes) => {
  if (!Array.isArray(bytes) || bytes.length === 0) return "";

  let output = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.slice(index, index + chunkSize);
    output += String.fromCharCode(...chunk);
  }

  return output;
};

export const resolveInlineCertificateData = (value) => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object" && value.type === "Buffer" && Array.isArray(value.data)) {
    try {
      return btoa(toBinaryString(value.data));
    } catch {
      return "";
    }
  }
  return "";
};

export const hasInlineCertificateData = (value) => {
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object" && value.type === "Buffer" && Array.isArray(value.data)) {
    return value.data.length > 0;
  }
  return false;
};

const buildEmailSlug = (email) => {
  const normalized = resolveEmail(email);
  return normalized ? normalized.replace(/[@.]/g, "_") : "";
};

const buildLegacyEmailSlug = (email) => {
  const normalized = resolveEmail(email);
  return normalized ? normalized.replace(/@/g, "_at_").replace(/\./g, "_") : "";
};

const safeDecode = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
};

const parseDownloadRouteParts = (value) => {
  const url = String(value || "").trim();
  if (!url) return { eventId: "", emailSlug: "" };

  const match = url.match(/\/api\/certificates\/download\/([^/]+)\/([^/?#]+)/i);
  return {
    eventId: resolveEntityId(safeDecode(match?.[1] || "")),
    emailSlug: safeDecode(match?.[2] || "").replace(/\.pdf$/i, ""),
  };
};

const buildDownloadRoutePath = (eventId, emailSlug) => {
  const normalizedEventId = resolveEntityId(eventId);
  const normalizedSlug = String(emailSlug || "").trim();
  if (!normalizedEventId || !normalizedSlug) return "";

  return SummaryApi.download_certificate.url
    .replace(":eventId", encodeURIComponent(normalizedEventId))
    .replace(":emailSlug", encodeURIComponent(normalizedSlug));
};

const resolveDownloadCandidates = ({ eventId, participantEmail, certificateUrl } = {}) => {
  const directUrl = String(certificateUrl || "").trim();
  const routeParts = parseDownloadRouteParts(directUrl);
  const normalizedEventId = resolveEntityId(eventId, routeParts.eventId);
  const normalizedEmail = resolveEmail(participantEmail);

  const slugCandidates = [
    buildEmailSlug(normalizedEmail),
    buildLegacyEmailSlug(normalizedEmail),
    String(routeParts.emailSlug || "").trim(),
  ].filter(Boolean);

  const candidates = [
    ...new Set(slugCandidates.map((slug) => buildDownloadRoutePath(normalizedEventId, slug)).filter(Boolean)),
  ];

  if (directUrl) {
    candidates.push(directUrl);
  }

  return [...new Set(candidates)];
};

const parseFileNameFromHeader = (value) => {
  const header = String(value || "").trim();
  if (!header) return "";

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]).replace(/["']/g, "").trim();
    } catch {
      return utfMatch[1].replace(/["']/g, "").trim();
    }
  }

  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return "";
};

export const buildCertificateDownloadFilename = (participantName) => {
  const safeName = String(participantName || "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${safeName ? `certificate_${safeName}` : "certificate"}.pdf`;
};

const decodeBase64ToBlob = (base64Value) => {
  const value = String(base64Value || "").trim();
  if (!value) return null;

  const cleaned = value
    .replace(/^data:application\/pdf;base64,/i, "")
    .replace(/\s/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  if (!cleaned) return null;

  const padded = cleaned + "=".repeat((4 - (cleaned.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: "application/pdf" });
};

const triggerBlobDownload = (blob, filename) => {
  if (!(blob instanceof Blob) || blob.size === 0) return false;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return true;
};

const extractErrorMessageFromBlob = async (blob) => {
  if (!(blob instanceof Blob)) return "";
  try {
    const text = await blob.text();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      return String(parsed?.message || parsed?.error || "").trim();
    } catch {
      return text.slice(0, 180).trim();
    }
  } catch {
    return "";
  }
};

export const downloadStudentCertificate = async ({
  eventId,
  participantEmail,
  certificateUrl,
  rawCertificateData,
  participantName,
} = {}) => {
  const urls = resolveDownloadCandidates({ eventId, participantEmail, certificateUrl });
  const inlineCertificateData = resolveInlineCertificateData(rawCertificateData);
  const fallbackFileName = buildCertificateDownloadFilename(participantName);

  if (urls.length === 0 && !inlineCertificateData) {
    throw new Error(CERTIFICATE_DOWNLOAD_FALLBACK);
  }

  let downloadError = null;

  for (const url of urls) {
    try {
      const response = await api({
        method: "get",
        url,
        responseType: "blob",
        skipCache: true,
        headers: {
          Accept: "application/pdf,application/octet-stream,*/*",
        },
      });

      const blob = response?.data;
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error(CERTIFICATE_DOWNLOAD_FALLBACK);
      }

      const mimeType = String(blob.type || "").toLowerCase();
      if (mimeType.includes("application/json") || mimeType.includes("text/html")) {
        const apiMessage = sanitizeUserMessage(
          await extractErrorMessageFromBlob(blob),
          CERTIFICATE_DOWNLOAD_FALLBACK
        );
        throw new Error(apiMessage || CERTIFICATE_DOWNLOAD_FALLBACK);
      }

      const fileName =
        parseFileNameFromHeader(response?.headers?.["content-disposition"]) || fallbackFileName;
      const downloaded = triggerBlobDownload(blob, fileName);
      if (!downloaded) {
        throw new Error(CERTIFICATE_DOWNLOAD_FALLBACK);
      }

      return { downloaded: true, fileName };
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        const blobMessage = await extractErrorMessageFromBlob(error?.response?.data);
        downloadError = new Error(
          sanitizeUserMessage(
            blobMessage,
            "Please sign in to EventMate to download your certificate."
          )
        );
        continue;
      }

      if (error?.response?.status === 404) {
        downloadError = new Error(CERTIFICATE_DOWNLOAD_FALLBACK);
        continue;
      }

      const blobMessage = await extractErrorMessageFromBlob(error?.response?.data);
      if (blobMessage) {
        downloadError = new Error(
          sanitizeUserMessage(blobMessage, CERTIFICATE_DOWNLOAD_FALLBACK)
        );
        continue;
      }

      downloadError = error;
    }
  }

  if (inlineCertificateData) {
    const blob = decodeBase64ToBlob(inlineCertificateData);
    const downloaded = triggerBlobDownload(blob, fallbackFileName);
    if (downloaded) {
      return { downloaded: true, fileName: fallbackFileName };
    }
  }

  throw new Error(
    sanitizeUserMessage(downloadError?.message, CERTIFICATE_DOWNLOAD_FALLBACK)
  );
};
