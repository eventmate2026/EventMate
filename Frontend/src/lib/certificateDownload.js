import api from "./api";
import SummaryApi from "../api/SummaryApi";

const resolveEntityId = (...candidates) => {
  for (const value of candidates) {
    if (!value) continue;
    if (typeof value === "string" || typeof value === "number") {
      const normalized = String(value).trim();
      if (normalized) {
        const objectIdMatch = normalized.match(/[a-f0-9]{24}/i);
        return objectIdMatch?.[0] || normalized;
      }
      continue;
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

const buildEmailSlug = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.replace(/[@.]/g, "_");
};

const buildLegacyEmailSlug = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.replace(/@/g, "_at_").replace(/\./g, "_");
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
  const eventId = resolveEntityId(safeDecode(match?.[1] || ""));
  const emailSlug = safeDecode(match?.[2] || "").replace(/\.pdf$/i, "");
  return { eventId, emailSlug };
};

const buildDownloadRoutePath = (eventId, emailSlug) => {
  const normalizedEventId = resolveEntityId(eventId);
  const normalizedSlug = String(emailSlug || "").trim();
  if (!normalizedEventId || !normalizedSlug) return "";

  return SummaryApi.download_certificate.url
    .replace(":eventId", encodeURIComponent(normalizedEventId))
    .replace(":emailSlug", encodeURIComponent(normalizedSlug));
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

const resolveCertificateData = (value) => {
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

const buildDefaultFilename = (row) => {
  const safeEventName = String(row?.eventName || "certificate")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${safeEventName || "certificate"}_${String(row?.certificateType || "participation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")}.pdf`;
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

export const resolveCertificateDownloadCandidates = (row) => {
  const directUrl = String(row?.certificateUrl || row?.downloadUrl || row?.url || "").trim();
  const routeParts = parseDownloadRouteParts(directUrl);

  const eventId = resolveEntityId(
    row?.eventId,
    row?.event?._id,
    row?.event,
    row?.eventRef,
    routeParts.eventId
  );
  const participantEmail = resolveEmail(
    row?.participantEmail,
    row?.email,
    row?.userEmail
  );
  const rawCertificateData = row?.rawCertificateData ?? row?.certificateData ?? null;

  const primarySlug = buildEmailSlug(participantEmail);
  const legacySlug = buildLegacyEmailSlug(participantEmail);
  const fallbackSlug = String(routeParts.emailSlug || "").trim();
  const downloadCandidates = [...new Set([directUrl, primarySlug && buildDownloadRoutePath(eventId, primarySlug), legacySlug && buildDownloadRoutePath(eventId, legacySlug), fallbackSlug && buildDownloadRoutePath(eventId, fallbackSlug)].filter(Boolean))];

  return {
    eventId,
    participantEmail,
    rawCertificateData,
    downloadCandidates,
  };
};

export const downloadCertificateAsset = async (row) => {
  const { downloadCandidates, rawCertificateData } = resolveCertificateDownloadCandidates(row);
  const inlineCertificateData = resolveCertificateData(rawCertificateData);

  if (downloadCandidates.length === 0 && !inlineCertificateData) {
    return {
      ok: false,
      code: "missing",
      message: "Certificate download details are missing for this entry.",
    };
  }

  let downloadError = null;

  for (const url of downloadCandidates) {
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
      const contentDisposition = String(response?.headers?.["content-disposition"] || "");

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Received an empty certificate file.");
      }

      const mimeType = String(blob.type || "").toLowerCase();
      if (mimeType.includes("application/json") || mimeType.includes("text/html")) {
        const apiMessage = await extractErrorMessageFromBlob(blob);
        throw new Error(apiMessage || "Certificate endpoint returned non-PDF response.");
      }

      const downloaded = triggerBlobDownload(
        blob,
        parseFileNameFromHeader(contentDisposition) || buildDefaultFilename(row)
      );
      if (!downloaded) {
        throw new Error("Received an empty certificate file.");
      }

      return { ok: true, code: "downloaded", message: "" };
    } catch (errorValue) {
      if (errorValue?.response?.status === 404) {
        downloadError = new Error("Certificate file not found on download route.");
        continue;
      }

      const blobMessage = await extractErrorMessageFromBlob(errorValue?.response?.data);
      if (blobMessage) {
        downloadError = new Error(blobMessage);
        continue;
      }

      downloadError = errorValue;
    }
  }

  if (inlineCertificateData) {
    try {
      const blob = decodeBase64ToBlob(inlineCertificateData);
      const downloaded = triggerBlobDownload(blob, buildDefaultFilename(row));
      if (downloaded) {
        return { ok: true, code: "downloaded", message: "" };
      }
    } catch (errorValue) {
      downloadError = errorValue;
    }
  }

  const message = downloadError?.message || "Unable to download this certificate right now. Please try again.";
  if (/not found/i.test(message) || /status code 404/i.test(message)) {
    return {
      ok: false,
      code: "not_found",
      message: "Certificate is not available on the download route yet. Please try again later.",
    };
  }

  return {
    ok: false,
    code: "error",
    message,
  };
};
