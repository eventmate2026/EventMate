import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, CalendarDays, Loader2, MapPin, Search } from "lucide-react";
import { isRegistrationEventCompleted } from "../lib/eventSchedule";
import { fetchMyRegistrations } from "../lib/registrationApi";

const FALLBACK_BANNER =
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80";

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value || "").trim();
  if (!text) return null;

  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return "Date TBD";
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const formatMonthDay = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return { month: "TBD", day: "--" };
  return {
    month: parsed.toLocaleDateString([], { month: "short" }),
    day: parsed.toLocaleDateString([], { day: "2-digit" }),
  };
};

const formatTimeRange = (start, end) => {
  const startText = String(start || "").trim();
  const endText = String(end || "").trim();
  if (startText && endText) return `${startText} - ${endText}`;
  if (startText) return startText;
  if (endText) return endText;
  return "Time TBD";
};

const normalizeStatus = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Pending";
  if (normalized === "PendingMemberVerification") return "Pending Team Acceptance";
  return normalized.replace(/([a-z])([A-Z])/g, "$1 $2");
};

const deriveEventPhase = (registration) => {
  return isRegistrationEventCompleted(registration) ? "completed" : "upcoming";
};

const mapToUiRow = (registration) => {
  const phase = deriveEventPhase(registration);
  const registrationStatus = normalizeStatus(registration?.status);
  const attendanceMarked = Boolean(registration?.qr?.attendanceMarked);
  const feedbackSubmitted = Boolean(registration?.feedbackSubmitted);
  const certificateReady = Boolean(registration?.certificate);
  const canGiveFeedback =
    attendanceMarked &&
    phase === "completed" &&
    Boolean(registration?.eventId) &&
    !feedbackSubmitted &&
    Boolean(registration?.isTeamLeader);

  const primaryLabel = attendanceMarked
    ? "Attended"
    : registrationStatus === "Confirmed"
      ? "Registered"
      : registrationStatus;

  const primaryLabelClass = attendanceMarked
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
    : registrationStatus === "Confirmed"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";

  return {
    ...registration,
    phase,
    registrationStatus,
    primaryLabel,
    primaryLabelClass,
    hasQr: Boolean(registration?.qr?.qrImageUrl),
    feedbackSubmitted,
    certificateReady,
    canGiveFeedback,
    monthDay: formatMonthDay(registration?.eventStartDate),
  };
};

const MyEventCard = ({ row, onViewQr, onViewDetails, onGiveFeedback, onDownloadCertificate }) => (
  <article className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-3 sm:p-4">
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4">
      <div className="relative h-28 sm:h-28 overflow-hidden rounded-xl">
        <img
          src={row.eventPosterUrl || FALLBACK_BANNER}
          alt={row.eventTitle || "Event"}
          className="h-full w-full object-cover"
        />
        <div className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-center text-[10px] font-semibold text-slate-700 shadow-sm">
          <p>{row.monthDay.month}</p>
          <p className="text-sm leading-none">{row.monthDay.day}</p>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.primaryLabelClass}`}>
            {row.primaryLabel}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {row.eventCategory || "Event"}
          </span>
          {row.certificateReady ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              Certificate Ready
            </span>
          ) : row.canGiveFeedback ? (
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
              Feedback Ready
            </span>
          ) : row.feedbackSubmitted ? (
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
              Feedback Submitted
            </span>
          ) : row.hasQr ? (
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
              QR Ready
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              QR Pending
            </span>
          )}
        </div>

        <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{row.eventTitle || "Registered Event"}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          <p className="inline-flex items-center gap-1.5">
            <CalendarDays size={12} className="text-emerald-500" />
            {formatDate(row.eventStartDate)} | {formatTimeRange(row.eventStartTime, row.eventEndTime)}
          </p>
          <p className="inline-flex items-center gap-1.5">
            <MapPin size={12} className="text-indigo-500" />
            {row.eventLocation || "Venue TBD"}
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Registration status: <span className="font-semibold">{row.registrationStatus}</span>.{" "}
          {row.certificateReady
            ? "Your certificate is ready to download."
            : row.canGiveFeedback
            ? "Your event is completed and feedback is now available."
            : row.feedbackSubmitted
            ? "Feedback is submitted. Your certificate will appear once the organizer finishes certificate setup."
            : row.qr?.attendanceMarked
            ? "Attendance has been marked for this event."
            : "Use your QR code at check-in when the event starts."}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => {
              if (row.certificateReady) {
                onDownloadCertificate(row.certificate?.certificateUrl, row.eventId);
                return;
              }
              if (row.canGiveFeedback) {
                onGiveFeedback(row.eventId);
                return;
              }
              onViewQr(row.id);
            }}
            disabled={!row.certificateReady && !row.canGiveFeedback && !row.hasQr}
            className="rounded-lg border border-indigo-300 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-400/40 dark:text-indigo-200 dark:hover:bg-indigo-500/15"
          >
            {row.certificateReady
              ? "Download Certificate"
              : row.canGiveFeedback
              ? "Give Feedback"
              : row.hasQr
              ? "View QR"
              : "QR Pending"}
          </button>
          <button
            type="button"
            onClick={() => onViewDetails(row.eventId)}
            disabled={!row.eventId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  </article>
);

export default function StudentMyEvents() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

  const loadMyEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    setWarning(null);
    try {
      const response = await fetchMyRegistrations({ bypassCache: true });
      setWarning(response.warning);
      const nextRows = response.rows
        .map(mapToUiRow)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setRows(nextRows);
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Unable to load your registrations.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMyEvents();

    const refreshOnFocus = () => {
      void loadMyEvents({ silent: true });
    };
    const intervalId = window.setInterval(() => {
      void loadMyEvents({ silent: true });
    }, 15000);

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [loadMyEvents]);

  const filteredRows = useMemo(() => {
    const term = String(searchTerm || "").trim().toLowerCase();
    let next = rows;

    if (activeTab === "upcoming") {
      next = next.filter((row) => row.phase === "upcoming");
    } else if (activeTab === "completed") {
      next = next.filter((row) => row.phase === "completed");
    }

    if (!term) return next;
    return next.filter((row) => {
      return (
        String(row.eventTitle || "").toLowerCase().includes(term) ||
        String(row.eventCategory || "").toLowerCase().includes(term) ||
        String(row.eventLocation || "").toLowerCase().includes(term)
      );
    });
  }, [activeTab, rows, searchTerm]);

  const tabCounts = useMemo(() => {
    const upcoming = rows.filter((row) => row.phase === "upcoming").length;
    const completed = rows.filter((row) => row.phase === "completed").length;
    return {
      all: rows.length,
      upcoming,
      completed,
    };
  }, [rows]);

  const openQr = (registrationId) => {
    const normalizedId = String(registrationId || "").trim();
    if (!normalizedId) return;
    navigate(`/student-dashboard/my-events/qr/${encodeURIComponent(normalizedId)}`);
  };

  const openEventDetails = (eventId) => {
    const normalizedId = String(eventId || "").trim();
    if (!normalizedId) return;
    navigate(`/student-dashboard/events/${encodeURIComponent(normalizedId)}`);
  };

  const openFeedback = (eventId) => {
    const normalizedId = String(eventId || "").trim();
    navigate("/student-dashboard/feedback-pending", {
      state: normalizedId ? { eventId: normalizedId, expandFeedback: true } : undefined,
    });
  };

  const downloadCertificate = (certificateUrl, eventId) => {
    const targetUrl = String(certificateUrl || "").trim();
    if (!targetUrl) {
      const normalizedEventId = String(eventId || "").trim();
      navigate("/student-dashboard/my-certificates", {
        state: normalizedEventId ? { eventId: normalizedEventId } : undefined,
      });
      return;
    }
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-900 dark:text-gray-100">
      <button
        type="button"
        onClick={() => navigate("/student-dashboard")}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-indigo-300"
      >
        <ArrowLeft size={16} />
      </button>

      <section className="mt-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-gray-900/60 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Events</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Manage your registrations, attendance, and QR passes.
            </p>
          </div>

          <label className="relative sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search my events..."
              aria-label="Search my events"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              activeTab === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10"
            }`}
          >
            All Events
            <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">
              {tabCounts.all}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              activeTab === "upcoming"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10"
            }`}
          >
            Upcoming
            <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">
              {tabCounts.upcoming}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              activeTab === "completed"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10"
            }`}
          >
            Completed
            <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">
              {tabCounts.completed}
            </span>
          </button>
        </div>

        {warning && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
            {warning}
          </p>
        )}

        {loading ? (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
            <Loader2 size={14} className="animate-spin" />
            Loading your events...
          </p>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </div>
        ) : filteredRows.length > 0 ? (
          <div className="mt-6 border-l-2 border-indigo-300/70 pl-4 space-y-4">
            {filteredRows.map((row) => (
              <MyEventCard
                key={row.id || `${row.eventId}-${row.createdAt || "row"}`}
                row={row}
                onViewQr={openQr}
                onViewDetails={openEventDetails}
                onGiveFeedback={openFeedback}
                onDownloadCertificate={downloadCertificate}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center">
            <Calendar className="mx-auto text-gray-300 dark:text-gray-500 mb-3" size={44} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No events found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
              {rows.length === 0
                ? "You have not registered for any events yet."
                : "No events match the current filter/search."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
