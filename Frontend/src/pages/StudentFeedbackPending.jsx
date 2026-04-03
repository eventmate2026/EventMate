import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import StudentWorkflowSectionLinks from "../components/StudentWorkflowSectionLinks";
import { fetchMyRegistrations, invalidateMyRegistrationsCache } from "../lib/registrationApi";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import useToastFeedback from "../hooks/useToastFeedback";
import { emitToast } from "../lib/toastBus";
import { isFeedbackPendingForRegistration } from "../lib/studentEventWorkflow";

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1469493338021-0f1816e69d86?auto=format&fit=crop&w=900&q=80";

const formatDateLabel = (value) => {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const formatMonthDay = (value) => {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) {
    return { month: "TBD", day: "--" };
  }

  return {
    month: parsed.toLocaleDateString([], { month: "short" }),
    day: parsed.toLocaleDateString([], { day: "2-digit" }),
  };
};

const formatTimeRange = (startTime, endTime) => {
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;
  return "Time TBD";
};

export default function StudentFeedbackPending() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [expandedEventId, setExpandedEventId] = useState("");
  const [submittingEventId, setSubmittingEventId] = useState("");
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        const response = await fetchMyRegistrations();
        setWarning(response.warning);
        setRows(
          response.rows
            .filter((row) => isFeedbackPendingForRegistration(row))
            .sort((a, b) => {
              const aTime = new Date(a?.eventStartDate || 0).getTime();
              const bTime = new Date(b?.eventStartDate || 0).getTime();
              return bTime - aTime;
            })
        );
      } catch (fetchError) {
        setRows([]);
        setError(fetchError?.response?.data?.message || "Unable to load pending feedback.");
      } finally {
        setLoading(false);
      }
    };

    loadRows();
  }, []);

  const feedbackRows = useMemo(
    () =>
      rows.map((row) => {
        return {
          ...row,
          attended: true,
          confirmed: true,
          canSubmit: true,
          badgeDate: formatMonthDay(row?.eventStartDate),
        };
      }),
    [rows]
  );

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load pending feedback right now.",
  });
  useToastFeedback(warning, {
    defaultType: "info",
    infoFallback: "Feedback update available.",
  });

  const markEventAsSubmitted = (eventId) => {
    const normalized = String(eventId || "").trim();
    if (!normalized) return;

    setRows((prev) => prev.filter((row) => String(row?.eventId || "").trim() !== normalized));
    setExpandedEventId((prev) => (prev === normalized ? "" : prev));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[normalized];
      return next;
    });
  };

  const updateDraft = (eventId, patch) => {
    const normalized = String(eventId || "").trim();
    if (!normalized) return;
    setDrafts((prev) => ({
      ...prev,
      [normalized]: {
        rating: prev[normalized]?.rating || "",
        comment: prev[normalized]?.comment || "",
        ...patch,
      },
    }));
  };

  const handleSubmitFeedback = async (row) => {
    const eventId = String(row?.eventId || "").trim();
    if (!eventId) return;

    const draft = drafts[eventId] || { rating: "", comment: "" };
    const rating = Number(draft.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      emitToast({ type: "error", text: "Please select a rating between 1 and 5." });
      return;
    }

    if (!row?.canSubmit) {
      emitToast({
        type: "error",
        text: "Feedback requires confirmed registration and marked attendance.",
      });
      return;
    }

    setSubmittingEventId(eventId);
    try {
      const response = await api({
        ...SummaryApi.submit_feedback,
        url: SummaryApi.submit_feedback.url.replace(":eventId", encodeURIComponent(eventId)),
        skipSuccessToast: true,
        skipErrorToast: true,
        data: {
          rating,
          comment: String(draft.comment || "").trim() || undefined,
        },
      });
      emitToast({
        type: "success",
        text: response.data?.message || "Feedback submitted successfully.",
      });
      invalidateMyRegistrationsCache();
      markEventAsSubmitted(eventId);
    } catch (submitError) {
      const backendMessage = submitError?.response?.data?.message || "Unable to submit feedback.";
      if (/already submitted/i.test(backendMessage)) {
        emitToast({
          type: "success",
          text: "Feedback for this event was already submitted. Removed from pending queue.",
        });
        invalidateMyRegistrationsCache();
        markEventAsSubmitted(eventId);
      } else {
        emitToast({ type: "error", text: backendMessage });
      }
    } finally {
      setSubmittingEventId("");
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

        <header className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Feedback Pending</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Submit feedback for completed events to unlock certificate flow.
          </p>
        </header>

        <StudentWorkflowSectionLinks currentSection="feedback-pending" />

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading feedback queue...
          </section>
        )}

        {!loading && !error && feedbackRows.length > 0 && (
          <section className="rounded-2xl border border-slate-200/80 bg-white/75 p-4 sm:p-5 dark:border-white/10 dark:bg-slate-900/65">
            <div className="space-y-4 border-l-2 border-indigo-500/70 pl-3 sm:pl-4">
              {feedbackRows.map((row) => {
                const eventId = String(row?.eventId || "").trim();
                const expanded = expandedEventId === eventId;
                const draft = drafts[eventId] || { rating: "", comment: "" };
                const isSubmitting = submittingEventId === eventId;

                return (
                  <article
                    key={row.id || `${row.eventId}-${row.eventTitle}`}
                    className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-white/10 dark:bg-slate-900/70"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[170px_1fr]">
                      <div className="relative h-32 sm:h-36 overflow-hidden rounded-xl">
                        <img
                          src={row.eventPosterUrl || FALLBACK_POSTER}
                          alt={row.eventTitle || "Event"}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute left-2 top-2 rounded-lg bg-white px-2 py-1 text-center shadow-sm">
                          <p className="text-[10px] font-semibold text-slate-500">{row.badgeDate.month}</p>
                          <p className="text-sm font-bold leading-none text-slate-900">{row.badgeDate.day}</p>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              row.attended
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                            }`}
                          >
                            {row.attended ? "Attended" : "Attendance Pending"}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                            Feedback Pending
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                            {row.eventCategory || "Seminar"}
                          </span>
                        </div>

                        <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                          {row.eventTitle || "Completed Event"}
                        </h2>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          <p className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
                            <CalendarDays size={12} />
                            {formatDateLabel(row.eventStartDate)} - {formatTimeRange(row.eventStartTime, row.eventEndTime)}
                          </p>
                          <p className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300">
                            <MapPin size={12} />
                            {row.eventLocation || "Campus Venue"}
                          </p>
                        </div>

                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          {row.canSubmit
                            ? "Your attendance is verified. Submit feedback to complete your event journey."
                            : "Feedback submission is available only after confirmed registration and marked attendance."}
                        </p>

                        {expanded && (
                          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-3">
                            <div>
                              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Rating (1 to 5)</label>
                              <div className="mt-2 flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((ratingValue) => (
                                  <button
                                    key={`${eventId}-rating-${ratingValue}`}
                                    type="button"
                                    onClick={() => updateDraft(eventId, { rating: String(ratingValue) })}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                                      Number(draft.rating) === ratingValue
                                        ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-300/70 dark:bg-amber-500/15 dark:text-amber-300"
                                        : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                                    }`}
                                  >
                                    <Star size={12} />
                                    {ratingValue}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Comment (optional)</label>
                              <textarea
                                rows={3}
                                value={draft.comment}
                                onChange={(inputEvent) => updateDraft(eventId, { comment: inputEvent.target.value })}
                                placeholder="Share your experience with this event"
                                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => setExpandedEventId((prev) => (prev === eventId ? "" : eventId))}
                            className="inline-flex items-center gap-1.5 rounded-md border border-orange-400 px-3 py-1.5 text-xs font-semibold text-orange-600 transition hover:bg-orange-50 dark:border-orange-300/60 dark:text-orange-300 dark:hover:bg-orange-500/15"
                          >
                            <MessageSquarePlus size={12} />
                            {expanded ? "Hide Feedback Form" : "Give Feedback"}
                          </button>
                          {expanded && (
                            <button
                              type="button"
                              onClick={() => handleSubmitFeedback(row)}
                              disabled={isSubmitting || !row.canSubmit}
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {isSubmitting ? "Submitting..." : "Submit Feedback"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleViewDetails(row.eventId)}
                            disabled={!row.eventId}
                            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!loading && !error && feedbackRows.length === 0 && (
          <section className="eventmate-panel rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            No feedback is pending right now.
          </section>
        )}
      </div>
    </div>
  );
}
