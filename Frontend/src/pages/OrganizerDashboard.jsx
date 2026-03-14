import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  FileCheck2,
  Loader2,
  MapPin,
  MessageSquareMore,
  PencilLine,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  SendHorizontal,
  Sparkles,
  Star,
  Users2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser, subscribeAuthUpdates } from "../lib/auth";
import { extractEventList } from "../lib/backendAdapters";
import { computeProfileProgress } from "../lib/profileProgress";

const STATUS_STYLES = {
  Draft: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Completed: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  Cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

const STAGE_FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "draft", label: "Draft" },
  { key: "completed", label: "Completed" },
];

const FALLBACK_POSTERS = [
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=900&q=80",
];

const timeAgo = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const normalizeId = (value) => String(value || "").trim();

const sortByRecent = (items) =>
  [...items].sort(
    (a, b) =>
      new Date(b?.updatedAt || b?.createdAt || 0).getTime() -
      new Date(a?.updatedAt || a?.createdAt || 0).getTime()
  );

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const formatDate = (value) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return date.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" });
};

const formatDateTime = (value) => {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const formatRelativeTime = (value) => {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return "just now";
  if (abs < 3600) return timeAgo.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return timeAgo.format(Math.round(diffSec / 3600), "hour");
  return timeAgo.format(Math.round(diffSec / 86400), "day");
};

const formatTimeRange = (schedule) => {
  const startTime = String(schedule?.startTime || "").trim();
  const endTime = String(schedule?.endTime || "").trim();
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return startTime || endTime || "Time TBD";
};

const getEventRating = (event) =>
  firstNumber(
    event?.averageRating,
    event?.ratingAverage,
    event?.rating?.average,
    event?.ratings?.average,
    event?.feedback?.averageRating,
    event?.feedback?.rating
  );

const getFeedbackCount = (event) =>
  Math.max(
    0,
    Math.floor(
      firstNumber(
        event?.feedbackCount,
        event?.totalFeedback,
        event?.feedback?.count,
        event?.feedback?.total,
        event?.feedbackSummary?.total
      ) || 0
    )
  );

const deriveEventStage = (event) => {
  const workflowStatus = String(event?.status || "Draft");
  if (workflowStatus === "Draft") {
    return {
      key: "draft",
      label: "Draft",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    };
  }
  if (workflowStatus === "Completed") {
    return {
      key: "completed",
      label: "Completed",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    };
  }
  if (workflowStatus === "Cancelled") {
    return {
      key: "cancelled",
      label: "Cancelled",
      className: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    };
  }

  const start = new Date(event?.schedule?.startDate || 0).getTime();
  const end = new Date(event?.schedule?.endDate || event?.schedule?.startDate || 0).getTime();
  const now = Date.now();

  if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end) {
    return {
      key: "live",
      label: "Live Now",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    };
  }

  if (Number.isFinite(start) && now < start) {
    return {
      key: "upcoming",
      label: "Upcoming",
      className: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
    };
  }

  return {
    key: "published",
    label: "Published",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  };
};

export default function OrganizerDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());

  const [events, setEvents] = useState([]);
  const [registrationStats, setRegistrationStats] = useState({});
  const [loadingRegistrationStats, setLoadingRegistrationStats] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [pendingEventId, setPendingEventId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const fetchRegistrationStats = async (eventRows) => {
    const rows = Array.isArray(eventRows) ? eventRows : [];
    if (!rows.length) {
      setRegistrationStats({});
      return;
    }

    setLoadingRegistrationStats(true);
    try {
      const requests = rows.map(async (event) => {
        const eventId = normalizeId(event?._id);
        if (!eventId) return null;
        try {
          const response = await api({
            ...SummaryApi.get_event_registrations,
            url: SummaryApi.get_event_registrations.url.replace(":eventId", eventId),
          });
          const apiCount = Number(response.data?.count);
          const list = Array.isArray(response.data?.data) ? response.data.data : [];
          return [eventId, { count: Number.isFinite(apiCount) ? apiCount : list.length, error: null }];
        } catch (fetchError) {
          return [eventId, { count: null, error: fetchError.response?.data?.message || "Unavailable" }];
        }
      });

      const resolved = await Promise.all(requests);
      const next = {};
      resolved.filter(Boolean).forEach(([eventId, payload]) => {
        next[eventId] = payload;
      });
      setRegistrationStats(next);
    } finally {
      setLoadingRegistrationStats(false);
    }
  };

  const fetchMyEvents = async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setMessage(null);
    }
    setError(null);

    try {
      const response = await api({ ...SummaryApi.get_my_events, cacheTTL: 60000 });
      const myEvents = extractEventList(response.data);
      const sortedEvents = sortByRecent(myEvents);
      setEvents(sortedEvents);
      void fetchRegistrationStats(sortedEvents);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load organizer events.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyEvents();
  }, [user?._id]);

  useEffect(() => {
    return subscribeAuthUpdates(() => {
      setUser(getStoredUser());
    });
  }, []);

  const handlePublishEvent = async (eventId) => {
    if (!eventId) return;
    setPendingEventId(eventId);
    setMessage(null);

    try {
      const response = await api({
        ...SummaryApi.publish_event,
        url: SummaryApi.publish_event.url.replace(":eventId", eventId),
      });
      setMessage({ type: "success", text: response.data?.message || "Event published successfully." });
      await fetchMyEvents({ silent: true });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Unable to publish event.",
      });
    } finally {
      setPendingEventId("");
    }
  };

  const eventRows = useMemo(
    () =>
      events.map((event, index) => {
        const eventId = normalizeId(event?._id);
        const registrationInfo = registrationStats[eventId] || null;
        const registrationCount = Number(registrationInfo?.count);

        return {
          ...event,
          eventId,
          stage: deriveEventStage(event),
          status: String(event?.status || "Draft"),
          title: event?.title || "Untitled Event",
          category: event?.category || "General",
          venue: event?.venue?.location || "Venue TBD",
          startDate: event?.schedule?.startDate || event?.createdAt || null,
          updatedAt: event?.updatedAt || event?.createdAt || null,
          description: event?.description || "Event details will be announced soon.",
          feedbackCount: getFeedbackCount(event),
          rating: getEventRating(event),
          registrations: Number.isFinite(registrationCount) ? registrationCount : null,
          registrationError: registrationInfo?.error || null,
          posterUrl: String(event?.posterUrl || "").trim() || FALLBACK_POSTERS[index % FALLBACK_POSTERS.length],
        };
      }),
    [events, registrationStats]
  );

  const metrics = useMemo(() => {
    const workflow = {
      draft: 0,
      published: 0,
      completed: 0,
      cancelled: 0,
      live: 0,
      upcoming: 0,
    };

    let totalRegistrations = 0;
    let totalFeedback = 0;
    const ratings = [];

    eventRows.forEach((event) => {
      const status = String(event.status || "Draft");
      if (status === "Draft") workflow.draft += 1;
      if (status === "Published") workflow.published += 1;
      if (status === "Completed") workflow.completed += 1;
      if (status === "Cancelled") workflow.cancelled += 1;
      if (event.stage.key === "live") workflow.live += 1;
      if (event.stage.key === "upcoming" || event.stage.key === "published") workflow.upcoming += 1;

      if (Number.isFinite(event.registrations)) totalRegistrations += event.registrations;
      totalFeedback += event.feedbackCount;
      if (Number.isFinite(event.rating)) ratings.push(event.rating);
    });

    const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;

    return {
      totalEvents: eventRows.length,
      totalRegistrations,
      totalFeedback,
      averageRating,
      workflow,
    };
  }, [eventRows]);

  const profileProgress = useMemo(() => computeProfileProgress(user), [user]);
  const showProfileCard = profileProgress.left > 0;

  const activity = useMemo(() => {
    const rows = [];
    eventRows.slice(0, 8).forEach((event) => {
      if (!event.eventId) return;
      rows.push({
        id: `status-${event.eventId}`,
        type: "status",
        text: `${event.title} is ${event.stage.label.toLowerCase()}.`,
        at: event.updatedAt,
      });

      if (Number.isFinite(event.registrations) && event.registrations > 0) {
        rows.push({
          id: `reg-${event.eventId}`,
          type: "registration",
          text: `${event.registrations} registrations for ${event.title}.`,
          at: event.updatedAt,
        });
      }

      if (event.feedbackCount > 0) {
        rows.push({
          id: `feedback-${event.eventId}`,
          type: "feedback",
          text: `${event.feedbackCount} feedback entries on ${event.title}.`,
          at: event.updatedAt,
        });
      }
    });

    if (!rows.length) {
      rows.push({
        id: "activity-empty",
        type: "status",
        text: "Create your first event to start tracking organizer activity.",
        at: new Date().toISOString(),
      });
    }

    return rows
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 6);
  }, [eventRows]);

  const filterCounts = useMemo(() => {
    let live = 0;
    let upcoming = 0;
    let draft = 0;
    let completed = 0;

    eventRows.forEach((event) => {
      if (event.stage.key === "live") live += 1;
      if (event.stage.key === "upcoming" || event.stage.key === "published") upcoming += 1;
      if (event.stage.key === "draft") draft += 1;
      if (event.stage.key === "completed") completed += 1;
    });

    return {
      all: eventRows.length,
      live,
      upcoming,
      draft,
      completed,
    };
  }, [eventRows]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEvents = useMemo(
    () =>
      eventRows.filter((event) => {
        const matchesFilter =
          activeFilter === "all" ||
          (activeFilter === "upcoming"
            ? event.stage.key === "upcoming" || event.stage.key === "published"
            : event.stage.key === activeFilter);

        if (!matchesFilter) return false;
        if (!normalizedQuery) return true;

        const haystack = `${event.title} ${event.category} ${event.venue} ${event.status}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [eventRows, activeFilter, normalizedQuery]
  );

  const kpis = [
    {
      label: "Total Events",
      value: metrics.totalEvents,
      icon: CalendarDays,
      iconClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300",
      hint: `${metrics.workflow.published + metrics.workflow.completed} published/completed`,
    },
    {
      label: "Live Right Now",
      value: metrics.workflow.live,
      icon: Sparkles,
      iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
      hint: `${metrics.workflow.upcoming} upcoming`,
    },
    {
      label: "Total Registrations",
      value: metrics.totalRegistrations.toLocaleString(),
      icon: Users2,
      iconClass: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300",
      hint: loadingRegistrationStats ? "Updating registrations..." : "Across all events",
    },
    {
      label: "Avg Rating",
      value: metrics.averageRating === null ? "--" : metrics.averageRating.toFixed(1),
      icon: Star,
      iconClass: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300",
      hint: `${metrics.totalFeedback} total feedback`,
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
                Organizer Control Room
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Organizer Home</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                Manage events, monitor registrations, publish drafts, and move quickly between scan, feedback, and certificate workflows.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  Draft: {metrics.workflow.draft}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  Published: {metrics.workflow.published}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  Completed: {metrics.workflow.completed}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-start gap-2 xl:justify-end">
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
                onClick={() => navigate("/organizer-dashboard/coordinator-management")}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
              >
                <Users2 size={15} />
                Coordinators
              </button>
              <button
                type="button"
                onClick={() => navigate("/organizer-dashboard/create-event")}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus size={15} />
                Create Event
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
            Loading organizer workspace...
          </p>
        )}

        {error && !loading && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
            <section id="my-events" className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Event Command Center</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Search, filter, and action your events from one place.
                  </p>
                </div>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                  Showing {filteredEvents.length} of {eventRows.length}
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
                    const isActive = activeFilter === filter.key;
                    const count = filterCounts[filter.key] || 0;
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setActiveFilter(filter.key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          isActive
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
                  filteredEvents.map((event) => {
                    const encodedEventId = encodeURIComponent(event.eventId || "");
                    const hasEventId = Boolean(event.eventId);
                    const registrationLabel = event.registrationError
                      ? "Registrations unavailable"
                      : Number.isFinite(event.registrations)
                      ? `${event.registrations} registrations`
                      : loadingRegistrationStats
                      ? "Loading registrations..."
                      : "0 registrations";
                    const showScanButton = event.status === "Published" || event.stage.key === "live";

                    return (
                      <article
                        key={event.eventId || `${event.title}-${event.updatedAt || event.startDate || "event"}`}
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
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${event.stage.className}`}>
                                  {event.stage.label}
                                </span>
                              </div>
                              <h3 className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">{event.title}</h3>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Workflow: {event.status} | Updated {formatDateTime(event.updatedAt)}
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
                            {registrationLabel}
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
                          {event.status === "Draft" ? (
                            <>
                              <button
                                type="button"
                                disabled={!hasEventId}
                                onClick={() => navigate(`/organizer-dashboard/edit-event/${event.eventId}`)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                              >
                                <PencilLine size={13} />
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={!hasEventId || pendingEventId === event.eventId}
                                onClick={() => handlePublishEvent(event.eventId)}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                {pendingEventId === event.eventId ? "Publishing..." : "Publish"}
                              </button>
                            </>
                          ) : (
                            <>
                              {event.status === "Completed" || event.status === "Cancelled" ? (
                                <button
                                  type="button"
                                  disabled={!hasEventId}
                                  onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/contact-center`)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                                >
                                  <MessageSquareMore size={13} />
                                  History
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!hasEventId}
                                  onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/contact-center`)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                                >
                                  <SendHorizontal size={13} />
                                  Message
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!hasEventId}
                                onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/details`)}
                                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                              >
                                Details
                              </button>

                              <button
                                type="button"
                                disabled={!hasEventId}
                                onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/view-list`)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                              >
                                <Users2 size={13} />
                                Registrations
                              </button>

                              {showScanButton && (
                                <button
                                  type="button"
                                  disabled={!hasEventId}
                                  onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/scan-qr`)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                                >
                                  <QrCode size={13} />
                                  Scan QR
                                </button>
                              )}

                              {(event.status === "Completed" || event.feedbackCount > 0) && (
                                <button
                                  type="button"
                                  disabled={!hasEventId}
                                  onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/feedback`)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-400/30 dark:text-violet-200 dark:hover:bg-violet-500/20"
                                >
                                  <MessageSquareMore size={13} />
                                  Feedback
                                </button>
                              )}

                              {event.status === "Completed" && (
                                <button
                                  type="button"
                                  disabled={!hasEventId}
                                  onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/certificates`)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                                >
                                  <FileCheck2 size={13} />
                                  Certificates
                                </button>
                              )}
                            </>
                          )}

                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[event.status] || STATUS_STYLES.Draft}`}>
                            Workflow: {event.status}
                          </span>
                        </div>
                      </article>
                    );
                  })
                ) : eventRows.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    No events found. Create your first event to activate organizer workflow.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    No events match your current search/filter.
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
                      item.type === "registration"
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300"
                        : item.type === "feedback"
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
                        : "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300";

                    return (
                      <div key={item.id} className="flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${iconClass}`}>
                          {item.type === "registration" ? <Users2 size={14} /> : item.type === "feedback" ? <MessageSquareMore size={14} /> : <Sparkles size={14} />}
                        </span>
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-200">{item.text}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatRelativeTime(item.at)}</p>
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
                    Better profile data helps admins and coordinators collaborate quickly.
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
                    onClick={() => navigate("/profile")}
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
                    onClick={() => navigate("/organizer-dashboard/create-event")}
                    className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Create New Event
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/organizer-dashboard/coordinator-management")}
                    className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Manage Coordinators
                    <Users2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/organizer-dashboard/notifications")}
                    className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    Open Notifications
                    <Clock3 size={14} />
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
