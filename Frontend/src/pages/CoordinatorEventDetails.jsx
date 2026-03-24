import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleCheck,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Users2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventList } from "../lib/backendAdapters";

const DEFAULT_POSTER =
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80";

const normalizeId = (value) => String(value || "").trim();

const formatDate = (value) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return date.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" });
};

const formatDateTime = (dateValue, timeValue) => {
  const dateLabel = formatDate(dateValue);
  const timeLabel = String(timeValue || "").trim() || "Time TBD";
  return `${dateLabel} | ${timeLabel}`;
};

const parseRegistrationSummary = (payload) => {
  const count = Number(payload?.count);
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.registrations)
    ? payload.registrations
    : Array.isArray(payload?.data?.registrations)
    ? payload.data.registrations
    : [];

  return {
    count: Number.isFinite(count) ? count : rows.length,
    rows,
  };
};

const detailTabs = [
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
  { id: "mentors", label: "Mentors & Judges" },
];

export default function CoordinatorEventDetails() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [eventData, setEventData] = useState(null);
  const [registrationSummary, setRegistrationSummary] = useState({ count: 0, rows: [] });
  const [activeTab, setActiveTab] = useState("about");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);

      try {
        const assignedResponse = await api({
          ...SummaryApi.get_my_assigned_events,
          skipCache: true,
        });

        const event = extractEventList(assignedResponse.data).find(
          (item) => normalizeId(item?._id) === normalizeId(eventId)
        );
        if (!event) {
          setError("Event not found in your assigned events.");
          setLoading(false);
          return;
        }

        setEventData(event);

        try {
          const registrationResponse = await api({
            ...SummaryApi.get_event_registrations,
            url: SummaryApi.get_event_registrations.url.replace(":eventId", encodeURIComponent(eventId || "")),
          });
          setRegistrationSummary(parseRegistrationSummary(registrationResponse.data));
        } catch (registrationError) {
          const status = Number(registrationError?.response?.status);
          if (status === 403) {
            setWarning("Registration list is not available for this event in current permissions.");
          } else {
            setWarning("Detailed registration list is unavailable in this backend build.");
          }
          setRegistrationSummary({ count: 0, rows: [] });
        }
      } catch (fetchError) {
        setEventData(null);
        setError(fetchError.response?.data?.message || "Unable to load event details.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [eventId]);

  const eventMeta = useMemo(() => {
    if (!eventData) return null;

    const fee = Number(eventData?.registration?.fee || 0);
    const organizerName =
      eventData?.organizer?.name ||
      eventData?.organizer?.fullName ||
      "Organizer";
    const organizerDepartment = String(eventData?.organizer?.department || "").trim();
    const organizedBy =
      [organizerName, organizerDepartment].filter(Boolean).join(" • ") ||
      organizerDepartment ||
      organizerName;

    return {
      id: normalizeId(eventData?._id) || normalizeId(eventId),
      title: eventData?.title || "Untitled Event",
      description:
        eventData?.description ||
        "Event details are shown in read-only mode for coordinator assignments.",
      category: eventData?.category || "General",
      posterUrl: String(eventData?.posterUrl || "").trim() || DEFAULT_POSTER,
      status: String(eventData?.status || "Draft"),
      startDate: eventData?.schedule?.startDate || null,
      endDate: eventData?.schedule?.endDate || null,
      startTime: eventData?.schedule?.startTime || "",
      endTime: eventData?.schedule?.endTime || "",
      venue: eventData?.venue?.location || "Venue TBD",
      organizedBy,
      contactEmail: eventData?.organizer?.contactEmail || eventData?.organizer?.email || "eventmate@gmail.com",
      contactPhone: eventData?.organizer?.contactPhone || eventData?.organizer?.phone || "Not available",
      isTeamEvent: Boolean(eventData?.isTeamEvent),
      minTeamSize: Number(eventData?.minTeamSize || 1),
      maxTeamSize: Number(eventData?.maxTeamSize || 1),
      registrationLastDate: eventData?.registration?.lastDate || null,
      maxParticipants: Number(eventData?.registration?.maxParticipants || 0),
      registrationOpen: Boolean(eventData?.registration?.isOpen),
      fee,
      isFree: fee <= 0,
      mentors: Array.isArray(eventData?.mentors) ? eventData.mentors : [],
      judges: Array.isArray(eventData?.judges) ? eventData.judges : [],
    };
  }, [eventData, eventId]);

  const requirements = useMemo(() => {
    if (!eventMeta) return [];

    const rows = [];

    if (eventMeta.isTeamEvent) {
      rows.push({
        title: "Team Size",
        description: `Minimum ${Math.max(eventMeta.minTeamSize, 1)} members, Maximum ${Math.max(eventMeta.maxTeamSize, eventMeta.minTeamSize)} members per team.`,
      });
    } else {
      rows.push({
        title: "Participation",
        description: "Individual participation mode for this event.",
      });
    }

    rows.push({
      title: "Tools & Equipment",
      description: "Participants should bring their own laptops and chargers. Campus Wi-Fi support is available.",
    });

    if (eventMeta.maxParticipants > 0) {
      rows.push({
        title: "Registration Capacity",
        description: `Maximum ${eventMeta.maxParticipants} participant slots are available.`,
      });
    }

    if (eventMeta.registrationLastDate) {
      rows.push({
        title: "Registration Deadline",
        description: `Registrations close on ${formatDate(eventMeta.registrationLastDate)}.`,
      });
    }

    return rows;
  }, [eventMeta]);

  const groupLabel = eventMeta?.isTeamEvent ? "Total Groups Registered" : "Total Registrations";
  const encodedEventId = encodeURIComponent(eventMeta?.id || eventId || "");

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <button
          type="button"
          onClick={() => navigate("/coordinator-dashboard")}
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading event details...
          </section>
        )}

        {error && !loading && (
          <section className="eventmate-panel rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </section>
        )}

        {!loading && !error && eventMeta && (
          <>
            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 overflow-hidden">
              <div className="relative h-52 sm:h-64 lg:h-72">
                <img src={eventMeta.posterUrl} alt={eventMeta.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/75 via-slate-900/20 to-transparent" />

                <div className="absolute left-4 right-4 bottom-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                      {eventMeta.isTeamEvent ? "Team Event" : "Individual Event"}
                    </span>
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {eventMeta.category}
                    </span>
                  </div>
                  <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight text-white">{eventMeta.title}</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200/80 dark:border-white/10 p-4 sm:p-5 bg-white/95 dark:bg-slate-900/80">
                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Date & Time</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                    <CalendarDays size={13} className="text-indigo-500" />
                    {formatDateTime(eventMeta.startDate, eventMeta.startTime)}
                  </p>
                </article>

                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Venue</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                    <MapPin size={13} className="text-indigo-500" />
                    {eventMeta.venue}
                  </p>
                </article>

                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Organized By</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                    <Building2 size={13} className="text-indigo-500" />
                    {eventMeta.organizedBy}
                  </p>
                </article>
              </div>
            </section>

            {warning && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                {warning}
              </p>
            )}

            <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_240px] gap-4">
              <div>
                <div className="border-b border-slate-200 dark:border-white/10 mb-4 flex items-center gap-6">
                  {detailTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`pb-2 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "text-indigo-600 dark:text-indigo-300 border-b-2 border-indigo-600 dark:border-indigo-300"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border-b-2 border-transparent"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "about" && (
                  <div className="space-y-4">
                    <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">About the Event</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300 whitespace-pre-line">
                        {eventMeta.description}
                      </p>
                    </section>

                    <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Event Requirements</h2>
                      <div className="mt-4 space-y-3">
                        {requirements.map((item) => (
                          <article key={item.title} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
                              <CircleCheck size={14} className="text-emerald-500" />
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>
                )}

                {activeTab === "contact" && (
                  <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Contact</h2>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <article className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Email</p>
                        <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                          <Mail size={13} className="text-indigo-500" />
                          {eventMeta.contactEmail}
                        </p>
                      </article>
                      <article className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Phone</p>
                        <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                          <Phone size={13} className="text-indigo-500" />
                          {eventMeta.contactPhone}
                        </p>
                      </article>
                      <article className="rounded-xl border border-slate-200 dark:border-white/10 p-3 sm:col-span-2">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Venue</p>
                        <p className="mt-1 text-sm text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                          <MapPin size={13} className="text-indigo-500" />
                          {eventMeta.venue}
                        </p>
                      </article>
                    </div>
                  </section>
                )}

                {activeTab === "mentors" && (
                  <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Mentors & Judges</h2>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <article className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Mentors</p>
                        {eventMeta.mentors.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {eventMeta.mentors.map((mentor, index) => (
                              <li key={`mentor-${index}`} className="text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
                                <UserRound size={13} className="text-indigo-500" />
                                {String(mentor?.name || mentor || "Mentor")}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Mentor list not published yet.</p>
                        )}
                      </article>

                      <article className="rounded-xl border border-slate-200 dark:border-white/10 p-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Judges</p>
                        {eventMeta.judges.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {eventMeta.judges.map((judge, index) => (
                              <li key={`judge-${index}`} className="text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
                                <UserRound size={13} className="text-indigo-500" />
                                {String(judge?.name || judge || "Judge")}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Judge list not published yet.</p>
                        )}
                      </article>
                    </div>
                  </section>
                )}
              </div>

              <aside className="space-y-4">
                <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Entry Fee</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
                    {eventMeta.isFree ? "Free" : `Rs ${eventMeta.fee}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    {eventMeta.registrationOpen ? "Registration open" : "Registration closed"}
                  </p>
                </section>

                <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{groupLabel}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                      <Users2 size={17} className="text-emerald-500" />
                      {registrationSummary.count}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(`/coordinator-dashboard/event/${encodedEventId}/registrations`)}
                      className="mt-3 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-400/30 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
                    >
                      Event Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/coordinator-dashboard/event/${encodedEventId}/scan`)}
                      className="mt-2 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                    >
                      Scan QR
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-300 space-y-1">
                    <p className="inline-flex items-center gap-1.5">
                      <Clock3 size={12} className="text-indigo-500" />
                      {eventMeta.startTime || "Time TBD"} - {eventMeta.endTime || "Time TBD"}
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <CalendarDays size={12} className="text-indigo-500" />
                      {formatDate(eventMeta.startDate)}
                    </p>
                  </div>
                </section>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
