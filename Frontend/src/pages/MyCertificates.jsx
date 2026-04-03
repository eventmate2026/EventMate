import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Clock3, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StudentWorkflowSectionLinks from "../components/StudentWorkflowSectionLinks";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import useToastFeedback from "../hooks/useToastFeedback";
import {
  CERTIFICATE_DOWNLOAD_FALLBACK,
  downloadStudentCertificate,
  hasInlineCertificateData,
} from "../lib/studentCertificateDownload";

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
        const position = String(row?.position || "").trim();
        const type = String(row?.certificateType || "").trim().toLowerCase();
        const normalizedType = type === "winner" || position ? "Winner" : "Participation";
        const eventId = resolveEntityId(row?.eventId, row?.event?._id, row?.event, row?.eventRef);
        const participantEmail = resolveEmail(row?.participantEmail, row?.email, row?.userEmail);
        return {
          id: String(row?._id || row?.id || `${row?.eventId}-${row?.participantEmail}`),
          eventId,
          eventName: String(row?.eventName || "").trim() || "Event",
          eventDate: row?.eventDate || row?.issuedAt || null,
          issuedAt: row?.issuedAt || null,
          participantName: String(row?.participantName || "").trim() || null,
          certificateType: normalizedType,
          position,
          participantEmail,
          certificateUrl: String(row?.certificateUrl || row?.downloadUrl || row?.url || "").trim() || null,
          rawCertificateData: row?.certificateData,
          hasInlineCertificateData: hasInlineCertificateData(row?.certificateData),
          canDownload: Boolean(
            hasInlineCertificateData(row?.certificateData) ||
              String(row?.certificateUrl || row?.downloadUrl || row?.url || "").trim() ||
              (eventId && participantEmail)
          ),
        };
      }),
    [certificateRows]
  );

  useToastFeedback(notice, {
    successFallback: "Certificate update available.",
    errorFallback: "We couldn't complete that certificate action right now.",
    infoFallback: "Certificate update available.",
  });
  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load certificate records right now.",
  });

  const handleDownloadClick = async (row) => {
    if (!row?.canDownload) {
      setNotice({ type: "info", text: "Certificate download details are unavailable for this entry." });
      return;
    }

    setNotice(null);
    setDownloadingRowId(row.id);

    try {
      await downloadStudentCertificate({
        eventId: row.eventId,
        participantEmail: row.participantEmail,
        certificateUrl: row.certificateUrl,
        rawCertificateData: row.rawCertificateData,
        participantName: row.participantName,
      });
    } catch (downloadError) {
      setNotice({
        type: "error",
        text: String(downloadError?.message || CERTIFICATE_DOWNLOAD_FALLBACK).trim() || CERTIFICATE_DOWNLOAD_FALLBACK,
      });
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

        <StudentWorkflowSectionLinks currentSection="my-certificates" />

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 inline-flex items-center gap-2">
            <Clock3 size={14} />
            Loading certificate records...
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
                        disabled={downloadingRowId === row.id || !row?.canDownload}
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
