import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CircleCheck,
  Clock3,
  Loader2,
  MapPin,
  MessageSquareMore,
  QrCode,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  Users2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventList } from "../lib/backendAdapters";
import { getStoredUser, subscribeAuthUpdates } from "../lib/auth";
import { computeProfileProgress } from "../lib/profileProgress";
import useToastFeedback from "../hooks/useToastFeedback";

const FALLBACK_POSTERS = [
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=900&q=80",
];

const STAGE_FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const WORKFLOW_STYLE = {
  Draft: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Completed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  Cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

const STAGE_STYLE = {
  live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  upcoming: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  completed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

const STAGE_LABEL = {
  live: "Live Now",
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
};

const normalizeId = (value) => String(value || "").trim();

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value) => {
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return "Date TBD";
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
};

const formatDateTime = (value) => {
  const date = parseDate(value);
  if (!date) return "just now";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const formatTimeRange = (schedule) => {
  const startTime = String(schedule?.startTime || "").trim();
  const endTime = String(schedule?.endTime || "").trim();
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return startTime;

  const start = parseDate(schedule?.startDate);
  const end = parseDate(schedule?.endDate);
  if (!start) return "Time TBD";

  const startText = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!end) return startText;
  const endText = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${startText} - ${endText}`;
};

const formatRelative = (value) => {
  const date = parseDate(value);
  if (!date) return "just now";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  return `${Math.floor(hours / 24)} days ago`;
};

const getEventAttendance = (event) => Math.max(0, Math.floor(toNumber(event?.attendance?.totalPresent) || 0));

const getEventRating = (event) =>
  toNumber(
    event?.feedback?.averageRating ??
      event?.averageRating ??
      event?.ratingAverage ??
      event?.rating?.average
  );

const getFeedbackCount = (event) =>
  Math.max(
    0,
    Math.floor(
      toNumber(
        event?.feedbackCount ?? event?.totalFeedback ?? event?.feedback?.count ?? event?.feedback?.total ?? 0
      ) || 0
    )
  );

const deriveStage = (event) => {
  const workflow = String(event?.status || "").trim();
  if (workflow === "Cancelled") return "cancelled";
  if (workflow === "Completed") return "completed";

  const start = parseDate(event?.schedule?.startDate);
  const end = parseDate(event?.schedule?.endDate || event?.schedule?.startDate);
  const now = new Date();

  if (start && end && now >= start && now <= end) return "live";
  if (end && now > end) return "completed";
  return "upcoming";
};

const sortByRecent = (items) =>
  [...items].sort(
    (a, b) =>
      new Date(b?.updatedAt || b?.createdAt || 0).getTime() -
      new Date(a?.updatedAt || a?.createdAt || 0).getTime()
  );

export default function CoordinatorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load the coordinator dashboard right now.",
  });

  const loadEvents = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const response = await api({
        ...SummaryApi.get_my_assigned_events,
        skipCache: true,
      });

      const rows = extractEventList(response.data);
      const assigned = rows
        .map((event, index) => ({
          ...event,
          eventId: normalizeId(event?._id),
          stage: deriveStage(event),
          status: String(event?.status || "Published"),
          title: event?.title || "Untitled Event",
          category: event?.category || "General",
          venue: event?.venue?.location || "Venue TBD",
          schedule: event?.schedule || {},
          startDate: event?.schedule?.startDate || event?.createdAt || null,
          updatedAt: event?.updatedAt || event?.createdAt || null,
          description: event?.description || "Coordinate attendance flow for this event.",
          posterUrl: String(event?.posterUrl || "").trim() || FALLBACK_POSTERS[index % FALLBACK_POSTERS.length],
          attendance: getEventAttendance(event),
          rating: getEventRating(event),
          feedbackCount: getFeedbackCount(event),
        }));

      setEvents(sortByRecent(assigned));
    } catch (fetchError) {
      setEvents([]);
      setError(fetchError.response?.data?.message || "Unable to load assigned events.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [user?._id, user?.email]);

  useEffect(() => {
    return subscribeAuthUpdates(() => {
      setUser(getStoredUser());
    });
  }, []);

  const metrics = useMemo(() => {
    const workflow = {
      live: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0,
    };

    let attendance = 0;
    let feedbackTotal = 0;
    const ratings = [];

    events.forEach((event) => {
      workflow[event.stage] = (workflow[event.stage] || 0) + 1;
      attendance += event.attendance;
      feedbackTotal += event.feedbackCount;
      if (Number.isFinite(event.rating)) ratings.push(event.rating);
    });

    const averageRating = ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : null;

    return {
      assigned: events.length,
      attendance,
      feedbackTotal,
      averageRating,
      workflow,
    };
  }, [events]);

  const activity = useMemo(() => {
    if (!events.length) {
      return [{ id: "a-empty", type: "status", text: "No recent activity for assigned events.", time: "just now" }];
    }

    const rows = [];
    events.slice(0, 8).forEach((event) => {
      rows.push({
        id: `status-${event.eventId}`,
        type: event.stage === "live" ? "live" : "status",
        text: `${event.title} is ${STAGE_LABEL[event.stage].toLowerCase()}.`,
        time: formatRelative(event.updatedAt),
      });

      if (event.attendance > 0) {
        rows.push({
          id: `attendance-${event.eventId}`,
          type: "attendance",
          text: `${event.attendance} attendance marked for ${event.title}.`,
          time: formatRelative(event.updatedAt),
        });
      }

      if (event.feedbackCount > 0) {
        rows.push({
          id: `feedback-${event.eventId}`,
          type: "feedback",
          text: `${event.feedbackCount} feedback entries for ${event.title}.`,
          time: formatRelative(event.updatedAt),
        });
      }
    });

    return rows.slice(0, 6);
  }, [events]);

  const profileProgress = useMemo(() => computeProfileProgress(user), [user]);
  const showProfileCard = profileProgress.left > 0;

  const filterCounts = useMemo(
    () => ({
      all: events.length,
      live: events.filter((event) => event.stage === "live").length,
      upcoming: events.filter((event) => event.stage === "upcoming").length,
      completed: events.filter((event) => event.stage === "completed").length,
      cancelled: events.filter((event) => event.stage === "cancelled").length,
    }),
    [events]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const matchesFilter = activeFilter === "all" ? true : event.stage === activeFilter;
        if (!matchesFilter) return false;
        if (!normalizedQuery) return true;

        const haystack = `${event.title} ${event.category} ${event.venue} ${event.status}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [events, activeFilter, normalizedQuery]
  );

  const kpis = [
    {
      label: "Assigned Events",
      value: metrics.assigned,
      icon: CalendarDays,
      iconClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300",
      hint: `${metrics.workflow.upcoming} upcoming`,
    },
    {
      label: "Live Right Now",
      value: metrics.workflow.live,
      icon: Sparkles,
      iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
      hint: `${metrics.workflow.completed} completed`,
    },
    {
      label: "Attendance Marked",
      value: metrics.attendance,
      icon: Users2,
      iconClass: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300",
      hint: "Across assigned events",
    },
    {
      label: "Avg Rating",
      value: metrics.averageRating === null ? "--" : metrics.averageRating.toFixed(1),
      icon: Star,
      iconClass: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
      hint: `${metrics.feedbackTotal} total feedback`,
    },
  ];

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="eventmate-panel relative overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-6 sm:p-7">
          <div className="pointer-events-none absolute -right-28 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-500/15" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl dark:bg-cyan-500/10" />

          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <BadgeCheck size={13} />
                Coordinator Control Room
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Coordinator Home</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                Monitor assigned events, handle attendance scanning, and manage on-ground execution from one dashboard.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  Live: {metrics.workflow.live}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  Upcoming: {metrics.workflow.upcoming}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  Completed: {metrics.workflow.completed}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-start gap-2 xl:justify-end">
              <button
                type="button"
                onClick={() => loadEvents({ silent: true })}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
              >
                {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                Refresh
              </button>
              <button
                type="button"
                onClick={() => navigate("/coordinator-dashboard/contact-admin")}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
              >
                Contact Admin
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className="eventmate-kpi rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">{item.label}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{item.value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.hint}</p>
                  </div>
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${item.iconClass}`}>
                    <Icon size={16} />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        {loading && (
          <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
            <Loader2 size={14} className="animate-spin" />
            Loading coordinator workspace...
          </p>
        )}

        {!loading && !error && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Assigned Event Command Center</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Search, filter, and access scan/registration workflows quickly.
                  </p>
                </div>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                  Showing {filteredEvents.length} of {events.length}
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                <label className="relative flex-1">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by title, category, venue..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {STAGE_FILTERS.map((filter) => {
                    const isSelected = activeFilter === filter.key;
                    const count = filterCounts[filter.key] || 0;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setActiveFilter(filter.key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                        }`}
                      >
                        {filter.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {filteredEvents.length > 0 ? (
                  filteredEvents.slice(0, 8).map((event) => {
                    const encodedId = encodeURIComponent(event.eventId || "");
                    const canAct = Boolean(event.eventId);
                    const isCompleted = event.stage === "completed" || event.status === "Completed";
                    const isCancelled = event.stage === "cancelled" || event.status === "Cancelled";

                    return (
                      <article
                        key={event.eventId || `${event.title}-${event.updatedAt || event.startDate}`}
                        className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:border-indigo-300 dark:border-white/10 dark:bg-slate-900/65"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-800">
                              <img src={event.posterUrl} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                                  {event.category}
                                </span>
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STAGE_STYLE[event.stage] || STAGE_STYLE.upcoming}`}>
                                  {STAGE_LABEL[event.stage] || STAGE_LABEL.upcoming}
                                </span>
                              </div>
                              <h3 className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">{event.title}</h3>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Workflow: {event.status} • Updated {formatDateTime(event.updatedAt)}
                              </p>
                            </div>
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-300">
                            <p className="font-semibold text-slate-700 dark:text-slate-200">{formatDate(event.startDate)}</p>
                            <p>{formatTimeRange(event.schedule)}</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                          <p className="inline-flex items-center gap-1.5">
                            <MapPin size={13} />
                            {event.venue}
                          </p>
                          <p className="inline-flex items-center gap-1.5">
                            <Users2 size={13} />
                            {event.attendance} attendance marked
                          </p>
                          <p className="inline-flex items-center gap-1.5">
                            <Star size={13} />
                            {Number.isFinite(event.rating) ? `${event.rating.toFixed(1)} rating` : "Not rated yet"}
                          </p>
                          <p className="inline-flex items-center gap-1.5">
                            <MessageSquareMore size={13} />
                            {event.feedbackCount} feedback
                          </p>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{event.description}</p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={!canAct}
                            onClick={() => navigate(`/coordinator-dashboard/event/${encodedId}/details`)}
                            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                          >
                            Details
                          </button>

                          {!isCancelled && (
                            <button
                              type="button"
                              disabled={!canAct}
                              onClick={() => navigate(`/coordinator-dashboard/event/${encodedId}/scan`)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                            >
                              <QrCode size={13} />
                              Scan QR
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={!canAct || isCancelled}
                            onClick={() => navigate(`/coordinator-dashboard/event/${encodedId}/registrations`)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${
                              isCancelled
                                ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/10 dark:text-slate-500"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }`}
                          >
                            <Users2 size={13} />
                            Registrations
                          </button>

                          {(isCompleted || event.feedbackCount > 0) && (
                            <button
                              type="button"
                              disabled={!canAct}
                              onClick={() => navigate(`/coordinator-dashboard/event/${encodedId}/feedback`)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/20"
                            >
                              <MessageSquareMore size={13} />
                              Feedback
                            </button>
                          )}

                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${WORKFLOW_STYLE[event.status] || WORKFLOW_STYLE.Published}`}>
                            Workflow: {event.status}
                          </span>
                        </div>
                      </article>
                    );
                  })
                ) : events.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    No assigned events found for this coordinator account.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    No assigned events match your current search/filter.
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4">
              <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
                <div className="mt-4 space-y-3">
                  {activity.map((item) => {
                    const iconClass =
                      item.type === "attendance"
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                        : item.type === "feedback"
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
                        : item.type === "live"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300";

                    return (
                      <div key={item.id} className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${iconClass}`}>
                          {item.type === "attendance" ? <Users2 size={14} /> : null}
                          {item.type === "feedback" ? <MessageSquareMore size={14} /> : null}
                          {item.type === "live" ? <Sparkles size={14} /> : null}
                          {item.type === "status" ? <CircleCheck size={14} /> : null}
                        </span>
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-200">{item.text}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {showProfileCard && (
                <section className="rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-5 text-white shadow-xl shadow-indigo-500/20">
                  <h3 className="text-lg font-semibold">Complete your profile</h3>
                  <p className="mt-1 text-sm text-white/85">
                    Keep profile data complete so organizers can coordinate with you faster.
                  </p>
                  <div className="mt-4">
                    <div className="h-2 rounded-full bg-white/25">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-300"
                        style={{ width: `${profileProgress.percent}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-white/90">
                      <span>{profileProgress.percent}% completed</span>
                      <span>{profileProgress.left} steps left</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/coordinator-dashboard/profile")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-white"
                  >
                    Continue Setup
                  </button>
                </section>
              )}

              <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Quick Shortcuts</p>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/coordinator-dashboard/notifications")}
                    className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Open Notifications
                    <Clock3 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/coordinator-dashboard/contact-admin")}
                    className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Contact Admin
                    <MessageSquareMore size={14} />
                  </button>
                </div>
              </section>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
