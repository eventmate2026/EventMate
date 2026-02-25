import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  Loader2,
  LogOut,
  MessageSquareMore,
  PencilLine,
  Plus,
  RefreshCcw,
  Users2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser } from "../lib/auth";
import { logoutUser } from "../lib/logout";
import { extractEventList } from "../lib/backendAdapters";

const STATUS_STYLES = {
  Draft: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Completed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  Cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const normalizeId = (value) => String(value || "").trim();

const sortByRecent = (items) =>
  [...items].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime()
  );

export default function OrganizerDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const userId = normalizeId(user?._id);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [pendingEventId, setPendingEventId] = useState("");

  const fetchMyEvents = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const publishedResponse = await api({ ...SummaryApi.get_public_events });
      const publishedEvents = extractEventList(publishedResponse.data);

      const ownPublished = publishedEvents.filter(
        (event) => normalizeId(event?.organizer?.organizerId) === userId
      );
      setEvents(sortByRecent(ownPublished));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load events.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyEvents();
  }, [userId]);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };

  const metrics = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        const status = String(event.status || "Draft");
        acc.total += 1;
        if (status === "Draft") acc.draft += 1;
        if (status === "Published") acc.published += 1;
        if (status === "Completed") acc.completed += 1;
        if (status === "Cancelled") acc.cancelled += 1;
        return acc;
      },
      {
        total: 0,
        draft: 0,
        published: 0,
        completed: 0,
        cancelled: 0,
      }
    );
  }, [events]);

  const updateEventWorkflowStatus = async (eventId, action, successMessage) => {
    if (!eventId) return;
    setPendingEventId(eventId);
    setMessage(null);
    try {
      const response = await api({
        url: `/api/events/${eventId}/${action}`,
        method: "patch",
      });
      setMessage({ type: "success", text: response.data?.message || successMessage });
      await fetchMyEvents({ silent: true });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Unable to update event status.",
      });
    } finally {
      setPendingEventId("");
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <Users2 size={13} />
                Organizer Workspace
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Organizer Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Welcome back, {user?.fullName || "Organizer"}. Manage publish/cancel/complete workflow here.
              </p>
              <p className="mt-3 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                Signed in as <span className="font-semibold text-slate-900 dark:text-white">{user?.email || "organizer@eventmate.com"}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchMyEvents({ silent: true })}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
              >
                {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                Refresh
              </button>
              <button
                type="button"
                onClick={() => navigate("/organizer-dashboard/create-event")}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus size={15} />
                Create Event
              </button>
              <button
                type="button"
                onClick={() => navigate("/organizer-dashboard/coordinator-management")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
              >
                Manage Coordinators
              </button>
              <button
                type="button"
                onClick={() => navigate("/organizer-dashboard/contact-admin")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10"
              >
                <MessageSquareMore size={15} />
                Contact Admin
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/15"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Total Events</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Published</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.published}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Draft</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.draft}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Completed</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.completed}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Cancelled</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.cancelled}</p>
          </article>
        </section>

        {message && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
            }`}
          >
            {message.text}
          </p>
        )}

        {loading && (
          <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
            <Loader2 size={14} className="animate-spin" />
            Loading events...
          </p>
        )}

        {error && !loading && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

        {!loading && !error && (
          <section id="my-events" className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">My Events</h2>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              This backend currently exposes only published event listing for organizer dashboards.
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="pb-3 pr-4">Event</th>
                    <th className="pb-3 pr-4">Schedule</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Venue</th>
                    <th className="pb-3 pr-4">Updated</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {events.map((event) => {
                    const status = String(event.status || "Draft");
                    const eventId = normalizeId(event._id);
                    const isPending = pendingEventId === eventId;

                    return (
                      <tr key={eventId}>
                        <td className="py-3 pr-4 align-top">
                          <p className="font-semibold text-slate-900 dark:text-white">{event.title || "Untitled Event"}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.category || "N/A"}</p>
                        </td>
                        <td className="py-3 pr-4 align-top text-slate-700 dark:text-slate-200">
                          <p>{formatDate(event.schedule?.startDate)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{event.schedule?.startTime || "Time not set"}</p>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              STATUS_STYLES[status] || STATUS_STYLES.Draft
                            }`}
                          >
                            <Circle size={8} className="fill-current" />
                            {status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top text-slate-700 dark:text-slate-200">{event.venue?.location || "Not set"}</td>
                        <td className="py-3 pr-4 align-top text-slate-600 dark:text-slate-300">{formatDateTime(event.updatedAt || event.createdAt)}</td>
                        <td className="py-3 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/organizer-dashboard/edit-event/${eventId}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                            >
                              <PencilLine size={12} />
                              Edit
                            </button>

                            {status === "Draft" && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => updateEventWorkflowStatus(eventId, "publish", "Event published successfully.")}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {isPending ? "Publishing..." : "Publish"}
                              </button>
                            )}

                            {status === "Published" && (
                              <>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => updateEventWorkflowStatus(eventId, "complete", "Event marked completed.")}
                                  className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                >
                                  {isPending ? "Updating..." : "Complete"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => updateEventWorkflowStatus(eventId, "cancel", "Event cancelled successfully.")}
                                  className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                                >
                                  {isPending ? "Updating..." : "Cancel"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {events.length === 0 && (
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">
                  No events found for this organizer yet. Create one to get started.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
