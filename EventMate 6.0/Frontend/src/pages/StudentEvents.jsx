import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { mapApiEventToCard } from "../data/studentEventApiData";
import { extractEventList } from "../lib/backendAdapters";
import { fetchRegisteredEventIds } from "../lib/registrationApi";

const statusStyles = {
  current: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  completed: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

const statusLabel = {
  current: "Live",
  upcoming: "Upcoming",
  completed: "Completed",
};

const statusRank = {
  current: 0,
  upcoming: 1,
  completed: 2,
};

const getDateValue = (value) => {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const EventCard = ({ event, onRegister, onViewDetails }) => (
  <div className="eventmate-panel bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-full border border-gray-100 dark:border-gray-700 group">
    <div className="relative h-48 overflow-hidden">
      <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium bg-white/90 dark:bg-gray-900/80 dark:text-gray-100 shadow-sm backdrop-blur-sm z-10">
        {event.isFree ? "Free" : `Rs ${event.price}`}
      </div>
      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[event.status] || statusStyles.upcoming}`}>
        {statusLabel[event.status] || "Upcoming"}
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
          disabled={event.isRegistered || !event.registrationOpen}
          className="w-full py-2.5 rounded-xl border-2 border-indigo-500 text-indigo-600 dark:border-indigo-300 dark:text-indigo-200 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/20 transition disabled:opacity-60"
        >
          {event.isRegistered ? "Registered" : event.registrationOpen ? "Registration Form" : "Closed"}
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

export default function StudentEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registrationWarning, setRegistrationWarning] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    setRegistrationWarning(null);

    try {
      const publicEventsResponse = await api({ ...SummaryApi.get_public_events });
      const publicEvents = extractEventList(publicEventsResponse.data);
      const registrationInfo = await fetchRegisteredEventIds();
      const registeredIds = registrationInfo.ids;
      setRegistrationWarning(registrationInfo.warning);

      const mapped = publicEvents
        .map((event) => mapApiEventToCard(event, { registeredIds }))
        .sort((a, b) => {
          const rankDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
          if (rankDiff !== 0) return rankDiff;

          const aTime = getDateValue(a.startDate);
          const bTime = getDateValue(b.startDate);
          if (a.status === "completed") return bTime - aTime;
          return aTime - bTime;
        });

      setEvents(mapped);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load events.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const goToEventDetails = (eventId) => {
    const normalizedId = String(eventId || "").trim();
    if (!normalizedId) return;
    navigate(`/student-dashboard/events/${encodeURIComponent(normalizedId)}`);
  };

  const goToEventRegistration = (eventId) => {
    const normalizedId = String(eventId || "").trim();
    if (!normalizedId) return;
    navigate(`/student-dashboard/events/${encodeURIComponent(normalizedId)}/register`);
  };

  const handleRegister = (eventId) => {
    goToEventRegistration(eventId);
  };

  const stats = useMemo(
    () => ({
      total: events.length,
      current: events.filter((event) => event.status === "current").length,
      upcoming: events.filter((event) => event.status === "upcoming").length,
      completed: events.filter((event) => event.status === "completed").length,
    }),
    [events]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-900 dark:text-gray-100">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">All Events</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Events created by organizers are loaded from database.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="eventmate-kpi rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">Total Events</p>
          <p className="mt-2 text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="eventmate-kpi rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-500/20 p-4">
          <p className="text-sm text-green-700 dark:text-green-300">Live</p>
          <p className="mt-2 text-2xl font-bold text-green-700 dark:text-green-300">{stats.current}</p>
        </div>
        <div className="eventmate-kpi rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/20 p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">Upcoming</p>
          <p className="mt-2 text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.upcoming}</p>
        </div>
        <div className="eventmate-kpi rounded-xl bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 p-4">
          <p className="text-sm text-gray-700 dark:text-gray-200">Completed</p>
          <p className="mt-2 text-2xl font-bold text-gray-700 dark:text-gray-200">{stats.completed}</p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-300 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Loading events...
        </p>
      )}

      {error && !loading && (
        <div className="eventmate-kpi rounded-xl border border-dashed border-red-200 dark:border-red-500/30 p-6 text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {registrationWarning && !loading && !error && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
          {registrationWarning}
        </p>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onRegister={handleRegister}
              onViewDetails={goToEventDetails}
            />
          ))}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="eventmate-kpi rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-gray-500 dark:text-gray-300">
          No events available right now.
        </div>
      )}
    </div>
  );
}
