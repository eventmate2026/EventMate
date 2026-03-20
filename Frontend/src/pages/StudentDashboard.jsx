import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, CalendarDays, Loader2, MapPin, MessageSquareMore, Search, Users2 } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { mapApiEventToCard } from "../data/studentEventApiData";
import { extractEventList } from "../lib/backendAdapters";
import { fetchMyRegistrations } from "../lib/registrationApi";
import { computeProfileProgress } from "../lib/profileProgress";
import { getStoredUser, subscribeAuthUpdates } from "../lib/auth";

const StatCard = ({ label, value, color = "bg-purple-100 text-purple-700 dark:bg-indigo-500/20 dark:text-indigo-200" }) => (
  <div className={`eventmate-kpi flex flex-col items-center p-6 rounded-2xl ${color} shadow-sm`}>
    <div className="text-sm">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
  </div>
);

const statusRank = {
  current: 0,
  upcoming: 1,
  completed: 2,
};

const COMPLETED_EVENT_STATUSES = new Set([
  "completed",
  "cancelled",
  "canceled",
  "ended",
  "done",
  "past",
]);

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const dateValue = (value) => {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const FEEDBACK_SUBMITTED_KEY = "eventmate:feedback-submitted-events";

const loadSubmittedFeedbackEventIds = () => {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FEEDBACK_SUBMITTED_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : []);
  } catch {
    return new Set();
  }
};

const countCertificateRows = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data.length;
  if (Array.isArray(payload?.certificates)) return payload.certificates.length;
  if (Array.isArray(payload?.data?.certificates)) return payload.data.certificates.length;
  return Number(payload?.count || payload?.data?.count || 0) || 0;
};

const countPendingFeedbackRows = (rows) => {
  const submittedEventIds = loadSubmittedFeedbackEventIds();
  return rows.filter((row) => {
    const normalizedEventId = String(row?.eventId || "").trim();
    if (!normalizedEventId || submittedEventIds.has(normalizedEventId)) return false;

    const status = String(row?.eventStatus || "").trim().toLowerCase();
    if (status === "completed") return true;

    const eventDate = new Date(row?.eventStartDate || 0).getTime();
    return Number.isFinite(eventDate) && eventDate > 0 && Date.now() > eventDate;
  }).length;
};

const resolveDashboardStatus = (event) => {
  const mappedStatus = normalizeStatus(event?.status);
  if (mappedStatus === "current") return "current";
  if (mappedStatus === "upcoming") return "upcoming";
  if (COMPLETED_EVENT_STATUSES.has(mappedStatus)) return "completed";

  const workflowStatus = normalizeStatus(event?.eventStatus);
  if (COMPLETED_EVENT_STATUSES.has(workflowStatus)) return "completed";

  const startDateTimestamp = dateValue(event?.startDate);
  if (startDateTimestamp > 0 && Date.now() > startDateTimestamp) return "completed";

  return "upcoming";
};

const EventCard = ({ event, onRegister, onViewDetails, registering }) => {
  const dashboardStatus = resolveDashboardStatus(event);
  const statusLabel = dashboardStatus === "current" ? "Live" : dashboardStatus === "completed" ? "Completed" : "Upcoming";
  const showRegisterButton = event.registrationOpen || event.isRegistered;

  return (
    <div className="eventmate-panel bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-full border border-gray-100 dark:border-gray-700 group">
      <div className="relative h-48 overflow-hidden">
        <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium bg-white/90 dark:bg-gray-900/80 dark:text-gray-100 shadow-sm backdrop-blur-sm z-10">
          {event.isFree ? "Free" : `Rs ${event.price}`}
        </div>
        <div
          className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold ${
            dashboardStatus === "current"
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              : dashboardStatus === "completed"
                ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          }`}
        >
          {statusLabel}
        </div>
      </div>
      <div className="p-5 flex-grow flex flex-col">
        <div className="flex items-center justify-between gap-3 text-sm mb-3">
          <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
            <CalendarDays size={16} />
            <span>{event.date} | {event.time}</span>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              event.type === "Technical"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : event.type === "Cultural"
                  ? "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"
                  : event.type === "Sports"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
            }`}
          >
            {event.type}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-300 mb-3">
          <MapPin size={16} />
          <span>{event.venue}, {event.dept}</span>
        </div>
        <h3 className="font-bold text-2xl leading-tight text-gray-900 dark:text-white line-clamp-1 mb-2">{event.title}</h3>
        <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2 mb-6">
          {event.description}
        </p>
        <div className={`mt-auto grid ${showRegisterButton ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
          {showRegisterButton && (
            <button
              type="button"
              onClick={() => onRegister(event.id)}
              disabled={event.isRegistered || registering || !event.registrationOpen}
              className="w-full py-2.5 rounded-xl border-2 border-indigo-500 text-indigo-600 dark:border-indigo-300 dark:text-indigo-200 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition disabled:opacity-60"
            >
              {registering ? "Registering..." : event.isRegistered ? "Registered" : event.registrationOpen ? "Register" : "Closed"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onViewDetails(event.id)}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [assignedEventsCount, setAssignedEventsCount] = useState(0);
  const [certificateCount, setCertificateCount] = useState(0);
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registrationWarning, setRegistrationWarning] = useState(null);

  const fetchDashboardEvents = async () => {
    setLoading(true);
    setError(null);
    setRegistrationWarning(null);
    try {
      const [publicResponse, registrationInfo] = await Promise.all([
        api({ ...SummaryApi.get_public_events, cacheTTL: 90000 }),
        fetchMyRegistrations(),
      ]);
      const registrationRows = Array.isArray(registrationInfo?.rows) ? registrationInfo.rows : [];
      const registeredIds = new Set(registrationRows.map((row) => String(row?.eventId || "").trim()).filter(Boolean));
      setRegistrationWarning(registrationInfo.warning);
      setPendingFeedbackCount(countPendingFeedbackRows(registrationRows));
      const publicEvents = extractEventList(publicResponse.data);

      const allMapped = publicEvents
        .map((event) => mapApiEventToCard(event, { registeredIds }))
        .sort((a, b) => {
          const rankDiff =
            (statusRank[resolveDashboardStatus(a)] ?? 9) -
            (statusRank[resolveDashboardStatus(b)] ?? 9);
          if (rankDiff !== 0) return rankDiff;
          return dateValue(a.startDate) - dateValue(b.startDate);
        });

      const myMapped = allMapped
        .filter((event) => registeredIds.has(String(event.id)))
        .sort((a, b) => dateValue(b.startDate) - dateValue(a.startDate));

      setEvents(allMapped);
      setMyEvents(myMapped);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load dashboard events.");
      setEvents([]);
      setMyEvents([]);
      setPendingFeedbackCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardEvents();
  }, []);

  useEffect(() => {
    const fetchAssignedEvents = async () => {
      try {
        const response = await api({ ...SummaryApi.get_my_assigned_events, cacheTTL: 30000 });
        const rows = extractEventList(response.data);
        setAssignedEventsCount(rows.length);
      } catch {
        setAssignedEventsCount(0);
      }
    };

    fetchAssignedEvents();
  }, [user?._id]);

  useEffect(() => {
    const fetchCertificateCount = async () => {
      try {
        const response = await api({ ...SummaryApi.get_my_certificates, cacheTTL: 90000 });
        setCertificateCount(countCertificateRows(response?.data));
      } catch {
        setCertificateCount(0);
      }
    };

    fetchCertificateCount();
  }, [user?._id]);

  useEffect(() => {
    return subscribeAuthUpdates(() => {
      setUser(getStoredUser());
    });
  }, []);

  const goToEventDetails = (eventId) => {
    const normalizedId = String(eventId || "").trim();
    if (!normalizedId) return;
    navigate(`/student-dashboard/events/${encodeURIComponent(normalizedId)}`);
  };

  const handleRegister = (eventId) => {
    const normalizedId = String(eventId || "").trim();
    if (!normalizedId) return;
    navigate(`/student-dashboard/events/${encodeURIComponent(normalizedId)}/register`);
  };

  const recommendedEvents = useMemo(() => {
    const joinedIds = new Set(myEvents.map((event) => event.id));
    const notJoined = events.filter((event) => !joinedIds.has(event.id));
    return notJoined.length > 0 ? notJoined : events;
  }, [events, myEvents]);

  const displayedEvents = useMemo(() => recommendedEvents.slice(0, 3), [recommendedEvents]);

  const profileProgress = useMemo(() => computeProfileProgress(user), [user]);
  const showProfileCard = profileProgress.left > 0;

  const coordinatorAction =
    assignedEventsCount > 0
      ? {
          id: "coordinator-workspace",
          title: "Coordinator Workspace",
          subtitle: `${assignedEventsCount} assigned`,
          icon: Users2,
          iconClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
          path: "/coordinator-dashboard",
        }
      : null;

  const quickActions = [
    {
      id: "browse-events",
      title: "Browse Events",
      subtitle: "Find new activities",
      icon: Search,
      iconClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      path: "/student-dashboard/events",
    },
    {
      id: "my-events",
      title: "My Events",
      subtitle: `${myEvents.length} registered`,
      icon: CalendarDays,
      iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      path: "/student-dashboard/my-events",
    },
    ...(coordinatorAction ? [coordinatorAction] : []),
    {
      id: "my-certificates",
      title: "My Certificates",
      subtitle: `${certificateCount} earned`,
      icon: BadgeCheck,
      iconClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      path: "/student-dashboard/my-certificates",
    },
    {
      id: "feedback",
      title: "Feedback",
      subtitle: `${pendingFeedbackCount} pending`,
      icon: MessageSquareMore,
      iconClass: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
      path: "/student-dashboard/feedback-pending",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-900 dark:text-gray-100">
      {registrationWarning && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
          {registrationWarning}
        </p>
      )}

      <section className="eventmate-panel mb-8 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-gray-900/60 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                className="eventmate-kpi rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-400/50 dark:hover:bg-indigo-500/10"
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${item.iconClass}`}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">{item.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {loading && (
        <p className="mb-8 text-sm text-gray-500 dark:text-gray-300 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Loading dashboard...
        </p>
      )}

      {error && !loading && (
        <div className="mb-8 rounded-xl border border-dashed border-red-300 dark:border-red-500/30 bg-white dark:bg-gray-800 p-5 text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div className={`grid gap-8 ${showProfileCard ? "md:grid-cols-3" : "grid-cols-1"}`}>
        <div className={showProfileCard ? "md:col-span-2" : ""}>
          <section className="eventmate-panel rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/60 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Event Highlights</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Recommended events from database</p>
              </div>
              <div className="mt-3 sm:mt-0 flex gap-2">
                <button
                  onClick={() => navigate("/student-dashboard/events")}
                  className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
                >
                  View All Events
                </button>
              </div>
            </div>

            {!loading && !error && displayedEvents.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {displayedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    registering={false}
                    onRegister={handleRegister}
                    onViewDetails={goToEventDetails}
                  />
                ))}
              </div>
            ) : !loading && !error ? (
              <div className="eventmate-kpi rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-gray-500 dark:text-gray-300">
                No events available right now.
              </div>
            ) : null}
          </section>
        </div>

        {showProfileCard && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-indigo-700 dark:to-slate-800 text-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold mb-3">Complete your profile</h2>
              <p className="mb-4 text-purple-100 dark:text-indigo-100 text-sm">
                Keep your profile complete for better event targeting and communication.
              </p>
              <div className="mb-5">
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
                onClick={() => navigate("/profile")}
                className="w-full bg-white text-purple-700 dark:text-indigo-700 font-medium py-3 rounded-xl hover:bg-gray-100 transition"
              >
                Continue Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
