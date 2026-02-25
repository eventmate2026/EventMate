import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Loader2, MapPin } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { mapApiEventToCard } from "../data/studentEventApiData";
import { extractEventList } from "../lib/backendAdapters";
import { fetchRegisteredEventIds } from "../lib/registrationApi";

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

const dateValue = (value) => {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const EventCard = ({ event, onRegister, onViewDetails, registering }) => (
  <div className="eventmate-panel bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-full border border-gray-100 dark:border-gray-700 group">
    <div className="relative h-48 overflow-hidden">
      <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium bg-white/90 dark:bg-gray-900/80 dark:text-gray-100 shadow-sm backdrop-blur-sm z-10">
        {event.isFree ? "Free" : `Rs ${event.price}`}
      </div>
      <div
        className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold ${
          event.status === "current"
            ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            : event.status === "completed"
              ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
        }`}
      >
        {event.status === "current" ? "Live" : event.status === "completed" ? "Completed" : "Upcoming"}
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
      <div className="mt-auto grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onRegister(event.id)}
          disabled={event.isRegistered || registering || !event.registrationOpen}
          className="w-full py-2.5 rounded-xl border-2 border-indigo-500 text-indigo-600 dark:border-indigo-300 dark:text-indigo-200 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition disabled:opacity-60"
        >
          {registering ? "Registering..." : event.isRegistered ? "Registered" : event.registrationOpen ? "Register" : "Closed"}
        </button>
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

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [showAllRecommended, setShowAllRecommended] = useState(false);
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [registrationWarning, setRegistrationWarning] = useState(null);

  const fetchDashboardEvents = async () => {
    setLoading(true);
    setError(null);
    setRegistrationWarning(null);
    try {
      const publicResponse = await api({ ...SummaryApi.get_public_events });
      const registrationInfo = await fetchRegisteredEventIds();
      const registeredIds = registrationInfo.ids;
      setRegistrationWarning(registrationInfo.warning);
      const publicEvents = extractEventList(publicResponse.data);

      const allMapped = publicEvents
        .map((event) => mapApiEventToCard(event, { registeredIds }))
        .sort((a, b) => {
          const rankDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardEvents();
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

  const displayedEvents = useMemo(
    () => (showAllRecommended ? recommendedEvents : recommendedEvents.slice(0, 3)),
    [recommendedEvents, showAllRecommended]
  );

  const totalLiveEvents = events.filter((event) => event.status === "current").length;
  const totalUpcomingEvents = events.filter((event) => event.status === "upcoming").length;
  const totalCompletedMyEvents = myEvents.filter((event) => event.status === "completed").length;
  const totalActiveMyEvents = myEvents.filter((event) => event.status !== "completed").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-900 dark:text-gray-100">
      {message && (
        <p
          className={`mb-6 rounded-lg px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
          }`}
        >
          {message.text}
        </p>
      )}

      {registrationWarning && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
          {registrationWarning}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="All Events" value={events.length} color="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" />
        <StatCard label="My Events" value={myEvents.length} />
        <StatCard label="Live Now" value={totalLiveEvents} color="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" />
        <StatCard label="Completed" value={totalCompletedMyEvents} color="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300" />
      </div>

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

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <section className="eventmate-panel rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/60 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Event Highlights</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">Recommended events from database</p>
              </div>
              <div className="mt-3 sm:mt-0 flex gap-2">
                <button
                  onClick={() => setShowAllRecommended((prev) => !prev)}
                  disabled={recommendedEvents.length <= 3}
                  className="px-5 py-2 bg-purple-100 dark:bg-indigo-500/20 text-purple-700 dark:text-indigo-200 rounded-lg hover:bg-purple-200 dark:hover:bg-indigo-500/30 transition font-medium disabled:opacity-60"
                >
                  {showAllRecommended ? "Show Less" : "Show More"}
                </button>
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

        <div className="space-y-6">
          <div className="eventmate-panel bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold mb-5 text-gray-900 dark:text-white">My Activity</h2>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <p>Active registrations: <span className="font-semibold">{totalActiveMyEvents}</span></p>
              <p>Upcoming campus events: <span className="font-semibold">{totalUpcomingEvents}</span></p>
              <p>Completed events: <span className="font-semibold">{totalCompletedMyEvents}</span></p>
            </div>
            <button
              onClick={() => navigate("/student-dashboard/my-events")}
              className="mt-5 w-full border border-purple-200 dark:border-indigo-400/40 text-purple-700 dark:text-indigo-200 rounded-lg py-2.5 font-medium hover:bg-purple-50 dark:hover:bg-indigo-500/15 transition"
            >
              Open My Events
            </button>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-indigo-700 dark:to-slate-800 text-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-3">Need profile updates?</h2>
            <p className="mb-6 text-purple-100 dark:text-indigo-100 text-sm">
              Keep your profile complete for better event targeting and communication.
            </p>
            <button
              onClick={() => navigate("/profile")}
              className="w-full bg-white text-purple-700 dark:text-indigo-700 font-medium py-3 rounded-xl hover:bg-gray-100 transition"
            >
              Continue Setup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
