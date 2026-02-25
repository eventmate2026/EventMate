import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarDays, Loader2, MapPin } from "lucide-react";
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
  <div className="eventmate-panel bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow duration-300 flex flex-col h-full">
    <div className="h-40 overflow-hidden relative">
      <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
      <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${statusStyles[event.status] || statusStyles.upcoming}`}>
        {statusLabel[event.status] || "Upcoming"}
      </div>
      <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-white/90 dark:bg-gray-900/80">
        {event.isFree ? "Free" : `Rs ${event.price}`}
      </div>
    </div>

    <div className="p-5 flex flex-col flex-grow">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{event.title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{event.type}</p>
      <div className="space-y-2 mb-6 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-indigo-500 dark:text-indigo-300" />
          <span>{event.date} | {event.time}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-indigo-500 dark:text-indigo-300" />
          <span>{event.venue}</span>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onRegister(event.id)}
          disabled={event.isRegistered || !event.registrationOpen}
          className="w-full py-2.5 rounded-lg border border-indigo-300 dark:border-indigo-400/50 text-indigo-700 dark:text-indigo-200 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/15 disabled:opacity-60 transition"
        >
          {event.isRegistered ? "Registered" : event.registrationOpen ? "Registration Form" : "Closed"}
        </button>
        <button
          type="button"
          onClick={() => onViewDetails(event.id)}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
        >
          View Details
        </button>
      </div>
    </div>
  </div>
);

export default function StudentMyEvents() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("available");
  const [allEvents, setAllEvents] = useState([]);
  const [registeredEvents, setRegisteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registrationWarning, setRegistrationWarning] = useState(null);

  const fetchEvents = async () => {
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
          return getDateValue(a.startDate) - getDateValue(b.startDate);
        });

      const registeredMapped = allMapped
        .filter((event) => registeredIds.has(String(event.id)))
        .sort((a, b) => getDateValue(b.startDate) - getDateValue(a.startDate));

      setAllEvents(allMapped);
      setRegisteredEvents(registeredMapped);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load events.");
      setAllEvents([]);
      setRegisteredEvents([]);
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

  const activeEvents = useMemo(
    () => registeredEvents.filter((event) => event.status === "upcoming" || event.status === "current"),
    [registeredEvents]
  );

  const completedEvents = useMemo(
    () => registeredEvents.filter((event) => event.status === "completed"),
    [registeredEvents]
  );

  const displayedEvents = activeTab === "available" ? allEvents : registeredEvents;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-900 dark:text-gray-100">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">My Events</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Organizer-created events are loaded from database. Register and view details from here.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="eventmate-kpi rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">All Events</p>
          <p className="mt-2 text-2xl font-bold">{allEvents.length}</p>
        </div>
        <div className="eventmate-kpi rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/20 p-4">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">Registered</p>
          <p className="mt-2 text-2xl font-bold text-indigo-700 dark:text-indigo-300">{registeredEvents.length}</p>
        </div>
        <div className="eventmate-kpi rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-500/20 p-4">
          <p className="text-sm text-green-700 dark:text-green-300">Active</p>
          <p className="mt-2 text-2xl font-bold text-green-700 dark:text-green-300">{activeEvents.length}</p>
        </div>
        <div className="eventmate-kpi rounded-xl bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 p-4">
          <p className="text-sm text-gray-700 dark:text-gray-200">Completed</p>
          <p className="mt-2 text-2xl font-bold text-gray-700 dark:text-gray-200">{completedEvents.length}</p>
        </div>
      </div>

      <div className="flex gap-5 mb-8 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("available")}
          className={`pb-4 px-1 text-sm font-semibold transition-colors ${
            activeTab === "available"
              ? "text-indigo-600 dark:text-indigo-300 border-b-2 border-indigo-600 dark:border-indigo-300"
              : "text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 border-b-2 border-transparent"
          }`}
        >
          Available ({allEvents.length})
        </button>
        <button
          onClick={() => setActiveTab("registered")}
          className={`pb-4 px-1 text-sm font-semibold transition-colors ${
            activeTab === "registered"
              ? "text-indigo-600 dark:text-indigo-300 border-b-2 border-indigo-600 dark:border-indigo-300"
              : "text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 border-b-2 border-transparent"
          }`}
        >
          Registered ({registeredEvents.length})
        </button>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-300 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Loading events...
        </p>
      )}

      {error && !loading && (
        <div className="eventmate-kpi text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {registrationWarning && !loading && !error && (
        <div className="eventmate-kpi text-center py-4 bg-amber-50 dark:bg-amber-500/15 rounded-2xl border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200">
          {registrationWarning}
        </div>
      )}

      {!loading && !error && displayedEvents.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onRegister={handleRegister}
              onViewDetails={goToEventDetails}
            />
          ))}
        </div>
      )}

      {!loading && !error && displayedEvents.length === 0 && (
        <div className="eventmate-kpi text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <Calendar className="mx-auto text-gray-300 dark:text-gray-500 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No events found</h3>
          <p className="text-gray-500 dark:text-gray-300">
            {activeTab === "available"
              ? "No organizer events are available right now."
              : "You have not registered for any event yet."}
          </p>
        </div>
      )}
    </div>
  );
}
