import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Loader2, MapPin, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { mapApiEventToCard } from "../data/studentEventApiData";
import { extractEventList } from "../lib/backendAdapters";
import { fetchMyRegistrations } from "../lib/registrationApi";
import useToastFeedback from "../hooks/useToastFeedback";
import { emitToast } from "../lib/toastBus";
import { downloadStudentCertificate } from "../lib/studentCertificateDownload";
import { resolveStudentEventAction } from "../lib/studentEventWorkflow";

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
  if (!value) return 0;
  const text = String(value || "").trim();
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const fetchAllPublicEvents = async () => {
  const limit = 50;
  let page = 1;
  let pages = 1;
  const allEvents = [];

  while (page <= pages) {
    const response = await api({
      ...SummaryApi.get_public_events,
      params: { page, limit },
      cacheTTL: 90000,
    });
    const batch = extractEventList(response.data);
    if (batch.length) {
      allEvents.push(...batch);
    }

    const nextPages = Number(response.data?.pages || 0);
    if (!Number.isFinite(nextPages) || nextPages <= 0) break;
    pages = nextPages;
    if (batch.length === 0) break;
    page += 1;
  }

  return allEvents;
};

const filterEvents = (list, term) => {
  const normalized = String(term || "").trim().toLowerCase();
  if (!normalized) return list;
  return list.filter((event) => {
    return (
      String(event.title || "").toLowerCase().includes(normalized) ||
      String(event.type || "").toLowerCase().includes(normalized) ||
      String(event.venue || "").toLowerCase().includes(normalized) ||
      String(event.dept || "").toLowerCase().includes(normalized)
    );
  });
};

const resolvePrimaryActionClass = (actionKey) => {
  if (actionKey === "certificate") {
    return "bg-violet-600 text-white hover:bg-violet-700";
  }
  if (actionKey === "feedback") {
    return "bg-emerald-600 text-white hover:bg-emerald-700";
  }
  return "border border-indigo-500 text-indigo-600 dark:border-indigo-300 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/20";
};

const EventCard = ({ event, onPrimaryAction, onViewDetails, metaBadge = null }) => {
  const action = event.primaryAction;
  const showPrimaryAction = Boolean(action) && (event.registrationOpen || event.isRegistered);

  return (
    <div className="eventmate-panel bg-white dark:bg-gray-900 rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-full border border-gray-100 dark:border-white/10 group">
      <div className="relative h-44 overflow-hidden">
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 dark:bg-gray-900/80 dark:text-gray-100 shadow-sm backdrop-blur-sm z-10">
          {event.isFree ? "Free" : `Rs ${event.price}`}
        </div>
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusStyles[event.status] || statusStyles.upcoming}`}>
          {statusLabel[event.status] || "Upcoming"}
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <div className="mb-2 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-300">
            <CalendarDays size={14} />
            <span className="break-words">{event.date} | {event.time}</span>
          </div>
          <div className="inline-flex flex-wrap items-center gap-1.5">
            {metaBadge ? (
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${metaBadge.className}`}>
                {metaBadge.label}
              </span>
            ) : null}
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
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
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300 mb-2">
          <MapPin size={14} />
          <span className="break-words">{event.venue}, {event.dept}</span>
        </div>
        <h3 className="font-bold text-lg sm:text-xl leading-tight text-gray-900 dark:text-white line-clamp-2 mb-2">{event.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2 mb-4">
          {event.description}
        </p>
        <div className={`mt-auto grid ${showPrimaryAction ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-3`}>
          {showPrimaryAction && (
            <button
              type="button"
              onClick={() => onPrimaryAction(event)}
              disabled={action.disabled}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition disabled:opacity-60 ${resolvePrimaryActionClass(action.key)}`}
            >
              {action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => onViewDetails(event.id)}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default function StudentEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [registrationRows, setRegistrationRows] = useState([]);
  const [upcomingSearch, setUpcomingSearch] = useState("");
  const [completedSearch, setCompletedSearch] = useState("");
  const [upcomingFilter, setUpcomingFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registrationWarning, setRegistrationWarning] = useState(null);

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load events right now.",
  });
  useToastFeedback(registrationWarning, {
    defaultType: "info",
    infoFallback: "Registration status updated.",
  });

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    setRegistrationWarning(null);

    try {
      const [publicEvents, registrationInfo] = await Promise.all([
        fetchAllPublicEvents(),
        fetchMyRegistrations(),
      ]);
      const registeredIds = new Set(
        (registrationInfo.rows || []).map((row) => row.eventId).filter(Boolean)
      );
      const registrationByEventId = new Map(
        (registrationInfo.rows || [])
          .filter((row) => String(row?.eventId || "").trim())
          .map((row) => [String(row.eventId).trim(), row])
      );
      setRegistrationWarning(registrationInfo.warning);
      setRegistrationRows(registrationInfo.rows || []);

      const mapped = publicEvents
        .map((event) => {
          const card = mapApiEventToCard(event, { registeredIds });
          const myRegistration = registrationByEventId.get(String(card.id).trim()) || null;
          return {
            ...card,
            myRegistration,
            primaryAction: resolveStudentEventAction({
              eventId: card.id,
              registration: myRegistration,
              registrationOpen: card.registrationOpen,
              isCompletedEvent: card.status === "completed",
            }),
          };
        })
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

  const handlePrimaryAction = async (event) => {
    const action = event?.primaryAction;
    if (!action) return;

    if (action.key === "register") {
      handleRegister(event.id);
      return;
    }

    if (action.key === "qr") {
      const registrationId = String(event?.myRegistration?.id || "").trim();
      if (!registrationId) return;
      navigate(`/student-dashboard/my-events/qr/${encodeURIComponent(registrationId)}`);
      return;
    }

    if (action.key === "feedback") {
      navigate("/student-dashboard/feedback-pending");
      return;
    }

    if (action.key === "certificate") {
      if (!event?.myRegistration) {
        navigate("/student-dashboard/my-certificates");
        return;
      }
      try {
        await downloadStudentCertificate({
          eventId: event.myRegistration.eventId || event.id,
          participantEmail: event.myRegistration.participantEmail,
          certificateUrl: event.myRegistration.certificateUrl,
          participantName: event.myRegistration.participantName,
        });
      } catch (downloadError) {
        emitToast({
          type: "error",
          text: downloadError?.message || "Unable to download this certificate right now.",
        });
      }
    }
  };

  const upcomingEvents = useMemo(() => {
    const filtered = events.filter((event) => event.status !== "completed");
    return filtered.sort((a, b) => getDateValue(a.startDate) - getDateValue(b.startDate));
  }, [events]);

  const completedEvents = useMemo(() => {
    const filtered = events.filter((event) => event.status === "completed");
    return filtered.sort((a, b) => getDateValue(b.startDate) - getDateValue(a.startDate));
  }, [events]);

  const filteredUpcomingEvents = useMemo(() => {
    const filteredByText = filterEvents(upcomingEvents, upcomingSearch);
    if (!upcomingFilter || upcomingFilter === "All") return filteredByText;
    const normalized = String(upcomingFilter || "").trim().toLowerCase();
    return filteredByText.filter(
      (event) => String(event.type || "").toLowerCase() === normalized
    );
  }, [upcomingEvents, upcomingSearch, upcomingFilter]);
  const filteredCompletedEvents = useMemo(
    () => filterEvents(completedEvents, completedSearch),
    [completedEvents, completedSearch]
  );

  const registrationLookup = useMemo(() => {
    const map = new Map();
    registrationRows.forEach((row) => {
      if (row?.eventId) {
        map.set(String(row.eventId).trim(), row);
      }
    });
    return map;
  }, [registrationRows]);

  const resolveCompletionBadge = (event) => {
    const entry = registrationLookup.get(String(event?.id || "").trim());
    if (event?.status === "completed") {
      if (entry?.qr?.attendanceMarked) {
        return {
          label: "Attended",
          className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
        };
      }
      if (entry) {
        return {
          label: "Registered",
          className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
        };
      }
      return {
        label: "Completed",
        className: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
      };
    }

    if (event?.registrationOpen === false) {
      return {
        label: "Closed",
        className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      };
    }

    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 text-gray-900 dark:text-gray-100">
      <button
        type="button"
        onClick={() => navigate("/student-dashboard")}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-indigo-300"
      >
        <ArrowLeft size={16} />
      </button>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">All Events</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Browse events created by organizers.
        </p>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-300 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Loading events...
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-10">
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/60 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upcoming Events</h2>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Don&apos;t miss out on what&apos;s happening on campus.
                </p>
              </div>
              <label className="relative sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={upcomingSearch}
                  onChange={(event) => setUpcomingSearch(event.target.value)}
                  placeholder="Search upcoming events..."
                  aria-label="Search upcoming events"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {["All", "Technical", "Cultural", "Sports", "Workshop", "Seminar"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setUpcomingFilter(chip)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    upcomingFilter === chip
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {filteredUpcomingEvents.length > 0 ? (
              <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredUpcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onPrimaryAction={handlePrimaryAction}
                    onViewDetails={goToEventDetails}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-gray-500 dark:text-gray-300">
                No upcoming events found.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/60 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Completed Events</h2>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Don&apos;t miss out on what&apos;s happening on campus.
                </p>
              </div>
              <label className="relative sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={completedSearch}
                  onChange={(event) => setCompletedSearch(event.target.value)}
                  placeholder="Search completed events..."
                  aria-label="Search completed events"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
              </label>
            </div>

            {filteredCompletedEvents.length > 0 ? (
              <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredCompletedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onPrimaryAction={handlePrimaryAction}
                    onViewDetails={goToEventDetails}
                    metaBadge={resolveCompletionBadge(event)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-gray-500 dark:text-gray-300">
                No completed events found.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
