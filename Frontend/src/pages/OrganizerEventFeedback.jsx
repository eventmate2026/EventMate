import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Loader2, MessageSquareMore, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventItem } from "../lib/backendAdapters";
import useToastFeedback from "../hooks/useToastFeedback";

const normalizeId = (value) => String(value || "").trim();

const formatDate = (value) => {
  if (!value) return "Date unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unknown";
  return date.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" });
};

const parseFeedbackRows = (payload) => {
  const feedbacks = Array.isArray(payload?.feedbacks)
    ? payload.feedbacks
    : Array.isArray(payload?.data?.feedbacks)
    ? payload.data.feedbacks
    : [];

  return feedbacks.map((entry, index) => ({
    id: normalizeId(entry?._id || entry?.id) || `feedback-${index}`,
    reviewer: String(entry?.participantName || "Participant").trim() || "Participant",
    reviewerEmail: String(entry?.participantEmail || "").trim(),
    reviewerDepartment: String(entry?.participantDepartment || entry?.department || "").trim(),
    rating: Number(entry?.rating || 0),
    comment: String(entry?.comment || "").trim() || "No written feedback provided.",
    submittedAt: entry?.createdAt || entry?.updatedAt || null,
  }));
};

export default function OrganizerEventFeedback() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [eventData, setEventData] = useState(null);
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [feedbackMeta, setFeedbackMeta] = useState({ totalFeedbacks: 0, averageRating: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load event feedback right now.",
  });
  useToastFeedback(warning, {
    defaultType: "info",
    infoFallback: "Feedback details are limited for this event.",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);

      try {
        const detailResponse = await api({
          ...SummaryApi.get_public_event_details,
          url: SummaryApi.get_public_event_details.url.replace(":eventId", encodeURIComponent(eventId || "")),
        });

        const event = extractEventItem(detailResponse.data);
        if (!event) {
          setError("Event not found.");
          setLoading(false);
          return;
        }
        setEventData(event);

        try {
          const feedbackResponse = await api({
            ...SummaryApi.get_event_feedback,
            url: SummaryApi.get_event_feedback.url.replace(":eventId", encodeURIComponent(eventId || "")),
          });

          const feedbackPayload = feedbackResponse.data?.data || {};
          const rows = parseFeedbackRows(feedbackPayload).sort(
            (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
          );

          setFeedbackRows(rows);
          setFeedbackMeta({
            totalFeedbacks: Number(feedbackPayload?.totalFeedbacks || rows.length || 0),
            averageRating: Number.isFinite(Number(feedbackPayload?.averageRating))
              ? Number(feedbackPayload.averageRating)
              : null,
          });
        } catch (feedbackError) {
          setFeedbackRows([]);
          setFeedbackMeta({ totalFeedbacks: 0, averageRating: null });
          setWarning(feedbackError.response?.data?.message || "Unable to load feedback entries.");
        }
      } catch (fetchError) {
        setEventData(null);
        setFeedbackRows([]);
        setError(fetchError.response?.data?.message || "Unable to load feedback details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [eventId]);

  const summary = useMemo(() => {
    if (!eventData) {
      return {
        title: "Event",
        category: "General",
        status: "N/A",
        averageRating: null,
        feedbackCount: 0,
      };
    }

    return {
      title: eventData?.title || "Event",
      category: eventData?.category || "General",
      status: String(eventData?.status || "Draft"),
      averageRating: feedbackMeta.averageRating,
      feedbackCount: Math.max(Number(feedbackMeta.totalFeedbacks || 0), feedbackRows.length),
    };
  }, [eventData, feedbackMeta, feedbackRows.length]);

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate("/organizer-dashboard")}
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading feedback details...
          </section>
        )}

        {!loading && !error && (
          <>
            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                      {summary.category}
                    </span>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                      {summary.status}
                    </span>
                  </div>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Feedback - {summary.title}</h1>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/organizer-dashboard/event/${encodeURIComponent(eventId || "")}/details`)}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                >
                  <CalendarDays size={15} />
                  Event Details
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Average Rating</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {summary.averageRating === null ? "--" : summary.averageRating.toFixed(1)}
                </p>
              </article>
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Feedback Count</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{summary.feedbackCount}</p>
              </article>
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Detailed Entries</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{feedbackRows.length}</p>
              </article>
            </section>

            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Feedback Entries</h2>
              {feedbackRows.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                  No feedback entries available for this event yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {feedbackRows.map((row) => (
                    <article key={row.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{row.reviewer}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300 break-all">{row.reviewerEmail || "Email unavailable"}</p>
                          {row.reviewerDepartment ? (
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{row.reviewerDepartment}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{formatDate(row.submittedAt)}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                          <Star size={12} />
                          {Number.isFinite(row.rating) && row.rating > 0 ? row.rating : "No rating"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{row.comment}</p>
                    </article>
                  ))}
                </div>
              )}

            </section>
          </>
        )}
      </div>
    </div>
  );
}
