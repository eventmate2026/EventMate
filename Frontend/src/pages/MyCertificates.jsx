import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";

const formatDateLabel = (value) => {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return String(value || "Date TBD");
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

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

const toCertificateRows = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.certificates)) return payload.certificates;
  if (Array.isArray(payload?.data?.certificates)) return payload.data.certificates;
  return [];
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

const hasCertificateData = (value) => {
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object" && value.type === "Buffer" && Array.isArray(value.data)) {
    return value.data.length > 0;
  }
  return false;
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

const resolveDownloadCandidates = (row) => {
  const directUrl = String(row?.certificateUrl || row?.downloadUrl || row?.url || "").trim();
  const routeParts = parseDownloadRouteParts(directUrl);

  const eventId = resolveEntityId(
    row?.eventId,
    row?.event?._id,
    row?.event,
    row?.eventRef,
    routeParts.eventId
  );
  if (!eventId) return [];

  const participantEmail = resolveEmail(row?.participantEmail, row?.email, row?.userEmail);
  const primarySlug = buildEmailSlug(participantEmail);
  const legacySlug = buildLegacyEmailSlug(participantEmail);
  const fallbackSlug = String(routeParts.emailSlug || "").trim();

  const slugCandidates = [primarySlug, legacySlug, fallbackSlug].filter(Boolean);
  return [...new Set(slugCandidates)]
    .map((slug) => buildDownloadRoutePath(eventId, slug))
    .filter(Boolean);
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

export default function MyCertificates() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [certificateRows, setCertificateRows] = useState([]);
  const [notice, setNotice] = useState(null);
  const [downloadingRowId, setDownloadingRowId] = useState(null);

  useEffect(() => {
    const fetchCertificates = async () => {
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const response = await api({ ...SummaryApi.get_my_certificates, cacheTTL: 90000 });
        const rows = toCertificateRows(response.data).sort(
          (a, b) => new Date(b?.issuedAt || 0).getTime() - new Date(a?.issuedAt || 0).getTime()
        );
        setCertificateRows(rows);
      } catch (fetchError) {
        setCertificateRows([]);
        setError(fetchError.response?.data?.message || "Unable to load certificate records.");
      } finally {
        setLoading(false);
      }
    };

    fetchCertificates();
  }, []);

  const mappedRows = useMemo(
    () =>
      certificateRows.map((row) => {
        const type = String(row?.certificateType || "").trim();
        const normalizedType = type === "winner" ? "Winner" : "Participation";
        const position = String(row?.position || "").trim();
        const eventId = resolveEntityId(row?.eventId, row?.event?._id, row?.event, row?.eventRef);
        const participantEmail = resolveEmail(row?.participantEmail, row?.email, row?.userEmail);
        return {
          id: String(row?._id || row?.id || `${row?.eventId}-${row?.participantEmail}`),
          eventId,
          eventName: String(row?.eventName || "").trim() || "Event",
          eventDate: row?.eventDate || row?.issuedAt || null,
          issuedAt: row?.issuedAt || null,
          certificateType: normalizedType,
          position,
          participantEmail,
          rawCertificateData: row?.certificateData,
          hasInlineCertificateData: hasCertificateData(row?.certificateData),
          downloadCandidates: resolveDownloadCandidates({
            ...row,
            eventId,
            participantEmail,
          }),
        };
      }),
    [certificateRows]
  );

  const handleDownloadClick = async (row) => {
    const urls = Array.isArray(row?.downloadCandidates)
      ? row.downloadCandidates.filter((value) => String(value || "").trim().length > 0)
      : [];
    const inlineCertificateData = resolveCertificateData(row?.rawCertificateData);

    if (urls.length === 0 && !inlineCertificateData) {
      setNotice("Certificate download details are missing for this entry.");
      return;
    }

    setNotice(null);
    setDownloadingRowId(row.id);

    let downloadError = null;
    try {
      for (const url of urls) {
        try {
          const response = await api({
            method: "get",
            url,
            responseType: "blob",
            skipAuth: true,
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
          if (!downloaded) throw new Error("Received an empty certificate file.");
          return;
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
          if (downloaded) return;
        } catch (errorValue) {
          downloadError = errorValue;
        }
      }

      const errorStatus = Number(downloadError?.response?.status || 0);
      if (errorStatus === 404 || /status code 404/i.test(String(downloadError?.message || ""))) {
        setNotice("Certificate is not available on the download route yet. Please try again later.");
        return;
      }

      setNotice(downloadError?.message || "Unable to download this certificate right now. Please try again.");
    } finally {
      setDownloadingRowId(null);
    }
  };

  const handleViewDetails = (eventId) => {
    const normalized = String(eventId || "").trim();
    if (!normalized) return;
    navigate(`/student-dashboard/events/${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-slate-950 pt-10 pb-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
        <button
          type="button"
          onClick={() => navigate("/student-dashboard")}
          className="inline-flex items-center rounded-lg p-1.5 text-slate-500 transition hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={20} />
        </button>

        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">My Certificates</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Certificates generated from completed events and feedback workflow.
          </p>
        </header>

        {notice && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
            {notice}
          </p>
        )}

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 inline-flex items-center gap-2">
            <Clock3 size={14} />
            Loading certificate records...
          </section>
        )}

        {error && !loading && (
          <section className="eventmate-panel rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </section>
        )}

        {!loading && !error && mappedRows.length > 0 && (
          <section className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 sm:p-5 dark:border-white/10 dark:bg-slate-900/65">
            <div className="space-y-4 border-l-2 border-indigo-500/70 pl-3 sm:pl-4">
              {mappedRows.map((row) => (
                <article
                  key={row.id}
                  className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/70"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        Certificate Issued
                      </span>
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                        {row.certificateType}
                      </span>
                      {row.position && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                          {row.position} Place
                        </span>
                      )}
                    </div>

                    <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{row.eventName}</h2>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <p className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
                        <CalendarDays size={12} />
                        Event Date: {formatDateLabel(row.eventDate)}
                      </p>
                      <p className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300">
                        <CalendarDays size={12} />
                        Issued: {formatDateLabel(row.issuedAt)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => handleDownloadClick(row)}
                        disabled={
                          downloadingRowId === row.id ||
                          (!row?.hasInlineCertificateData &&
                            (!Array.isArray(row.downloadCandidates) || row.downloadCandidates.length === 0))
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-400/40 dark:text-indigo-200 dark:hover:bg-indigo-500/15"
                      >
                        <Download size={12} />
                        {downloadingRowId === row.id ? "Downloading..." : "Download Certificate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewDetails(row.eventId)}
                        disabled={!row.eventId}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                      >
                        View Event
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && mappedRows.length === 0 && (
          <section className="eventmate-panel rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            No certificates available yet.
          </section>
        )}
      </div>
    </div>
  );
}
