import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  UserCircle2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventList } from "../lib/backendAdapters";
import { getStoredUser } from "../lib/auth";
import useToastFeedback from "../hooks/useToastFeedback";

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeTeamName = (value) => String(value || "").trim();
const compareStrings = (left, right) => String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base" });
const rankParticipantRole = (value) => {
  const role = String(value || "").toLowerCase();
  if (role === "leader") return 0;
  if (role === "member") return 1;
  if (role === "participant") return 2;
  return 3;
};

const parseRegistrationRows = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.registrations)) return payload.registrations;
  if (Array.isArray(payload?.data?.registrations)) return payload.data.registrations;
  return [];
};

const isConfirmedRegistration = (registration) =>
  String(registration?.status || "").trim() === "Confirmed";

const toParticipantRows = (registration) => {
  const registrationId = normalizeId(registration?._id || registration?.id);
  const registrationStatus = String(registration?.status || "Pending").trim() || "Pending";
  const teamName = String(registration?.teamName || "").trim();
  const registeredAt = registration?.createdAt || null;

  const qrParticipants = Array.isArray(registration?.participants) ? registration.participants : [];
  const qrByEmail = new Map(
    qrParticipants
      .filter((item) => item)
      .map((item) => [normalizeEmail(item?.email), item])
  );

  const structuredParticipants = [registration?.teamLeader, ...(Array.isArray(registration?.teamMembers) ? registration.teamMembers : [])]
    .filter(Boolean);

  if (structuredParticipants.length > 0) {
    return structuredParticipants.map((participant, index) => {
      const participantEmail = String(participant?.email || "").trim();
      const qr = qrByEmail.get(normalizeEmail(participantEmail)) || null;
      const hasQr = Boolean(qr?.qrImageUrl);

      return {
        id: normalizeId(participant?._id || participant?.id || `${registrationId}-${participantEmail || index}`),
        registrationId,
        participantName: String(participant?.name || "Participant").trim() || "Participant",
        participantEmail,
        participantRole: String(qr?.role || (index === 0 ? "leader" : "member")).trim(),
        department: String(participant?.branch || participant?.department || "").trim(),
        year: String(participant?.year || "").trim(),
        teamName,
        registrationStatus,
        registeredAt,
        hasQr,
        attendanceMarked: Boolean(qr?.attendanceMarked),
        attendanceMarkedAt: qr?.attendanceMarkedAt || null,
      };
    });
  }

  if (qrParticipants.length > 0) {
    return qrParticipants.map((participant, index) => ({
      id: normalizeId(participant?._id || participant?.id || `${registrationId}-${participant?.email || index}`),
      registrationId,
      participantName: String(participant?.name || "Participant").trim() || "Participant",
      participantEmail: String(participant?.email || "").trim(),
      participantRole: String(participant?.role || "participant").trim(),
      department: "",
      year: "",
      teamName,
      registrationStatus,
      registeredAt,
      hasQr: Boolean(participant?.qrImageUrl),
      attendanceMarked: Boolean(participant?.attendanceMarked),
      attendanceMarkedAt: participant?.attendanceMarkedAt || null,
    }));
  }

  return [
    {
      id: registrationId || Math.random().toString(36).slice(2),
      registrationId,
      participantName: "Participant",
      participantEmail: "",
      participantRole: "participant",
      department: "",
      year: "",
      teamName,
      registrationStatus,
      registeredAt,
      hasQr: false,
      attendanceMarked: false,
      attendanceMarkedAt: null,
    },
  ];
};

const parseParticipantRows = (payload) =>
  parseRegistrationRows(payload)
    .filter((registration) => isConfirmedRegistration(registration))
    .flatMap((registration) => toParticipantRows(registration))
    .filter((row) => row.hasQr);

const parseDate = (value) => {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseDate(value);
  if (!date) return "Date TBD";
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
};

const formatTime = (value) => {
  const text = String(value || "").trim();
  return text || "Time TBD";
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const deriveStatus = (event) => {
  const status = String(event?.status || "").trim();
  if (status === "Cancelled") return "cancelled";
  if (status === "Completed") return "completed";

  const start = parseDate(event?.schedule?.startDate);
  const end = parseDate(event?.schedule?.endDate || event?.schedule?.startDate);
  const now = new Date();

  if (start && end && now >= start && now <= end) return "live";
  if (end && now > end) return "completed";
  return "upcoming";
};

const STATUS_BADGE = {
  live: "bg-emerald-100 text-emerald-700",
  upcoming: "bg-indigo-100 text-indigo-700",
  completed: "bg-slate-200 text-slate-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const STATUS_LABEL = {
  live: "Live Now",
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
};

const REGISTRATION_STATUS_STYLES = {
  Confirmed: "bg-emerald-100 text-emerald-700",
  PendingMemberVerification: "bg-amber-100 text-amber-700",
  PendingPayment: "bg-amber-100 text-amber-700",
  PendingPaymentVerification: "bg-orange-100 text-orange-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-slate-200 text-slate-700",
};

const getStatusClass = (status) =>
  REGISTRATION_STATUS_STYLES[String(status || "")] || "bg-slate-200 text-slate-700";
const sortRegistrationRows = (left, right) => {
  const leftTeam = normalizeTeamName(left?.teamName);
  const rightTeam = normalizeTeamName(right?.teamName);
  const leftHasTeam = Boolean(leftTeam);
  const rightHasTeam = Boolean(rightTeam);

  if (leftHasTeam !== rightHasTeam) return leftHasTeam ? -1 : 1;

  if (leftHasTeam && rightHasTeam) {
    const teamCompare = compareStrings(leftTeam, rightTeam);
    if (teamCompare !== 0) return teamCompare;
  }

  const roleCompare = rankParticipantRole(left?.participantRole) - rankParticipantRole(right?.participantRole);
  if (roleCompare !== 0) return roleCompare;

  const nameCompare = compareStrings(left?.participantName, right?.participantName);
  if (nameCompare !== 0) return nameCompare;

  return compareStrings(left?.participantEmail, right?.participantEmail);
};

export default function CoordinatorRegistrations() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const { eventId } = useParams();

  const [assignedEvents, setAssignedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registrationRows, setRegistrationRows] = useState([]);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState("");
  const [registrationQuery, setRegistrationQuery] = useState("");

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load registrations right now.",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const eventsResponse = await api({
          ...SummaryApi.get_my_assigned_events,
          skipCache: true,
        });
        const assigned = extractEventList(eventsResponse.data)
          .sort((a, b) => new Date(a?.schedule?.startDate || 0) - new Date(b?.schedule?.startDate || 0));

        setAssignedEvents(assigned);

        if (assigned.length === 0) {
          setSelectedEventId("");
          return;
        }

        const requestedId = normalizeId(eventId);
        const hasRequested = requestedId && assigned.some((event) => normalizeId(event?._id) === requestedId);

        if (requestedId && !hasRequested) {
          setError("Selected event is not available in your current coordinator assignments.");
        }

        setSelectedEventId(hasRequested ? requestedId : normalizeId(assigned[0]?._id));
      } catch (fetchError) {
        setAssignedEvents([]);
        setSelectedEventId("");
        setError(fetchError.response?.data?.message || "Unable to load assigned coordinator events.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [eventId, user?._id, user?.email]);

  const loadRegistrations = useCallback(
    async () => {
      if (!selectedEventId) {
        setRegistrationRows([]);
        setRegistrationError("");
        return;
      }

      setRegistrationLoading(true);
      setRegistrationError("");

      try {
        const registrationResponse = await api({
          ...SummaryApi.get_event_registrations,
          url: SummaryApi.get_event_registrations.url.replace(":eventId", encodeURIComponent(selectedEventId)),
        });
        setRegistrationRows(parseParticipantRows(registrationResponse.data));
      } catch (fetchError) {
        setRegistrationRows([]);
        setRegistrationError(fetchError.response?.data?.message || "Unable to load registrations for this event.");
      } finally {
        setRegistrationLoading(false);
      }
    },
    [selectedEventId]
  );

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const selectedEvent = useMemo(() => {
    if (!assignedEvents.length) return null;
    return assignedEvents.find((event) => normalizeId(event?._id) === normalizeId(selectedEventId)) || assignedEvents[0];
  }, [assignedEvents, selectedEventId]);

  const selectedStatus = deriveStatus(selectedEvent);

  const visibleRegistrationRows = useMemo(() => {
    const normalizedQuery = String(registrationQuery || "").trim().toLowerCase();
    const baseRows = registrationRows;
    const rows = normalizedQuery
      ? baseRows.filter((row) => {
          const haystack = [
            row.participantName,
            row.participantEmail,
            row.teamName,
            row.registrationStatus,
            row.participantRole,
            row.department,
          ]
            .map((value) => String(value || "").toLowerCase())
            .join(" ");
          return haystack.includes(normalizedQuery);
        })
      : baseRows;

    return rows.slice().sort(sortRegistrationRows);
  }, [registrationQuery, registrationRows]);

  const registrationStats = useMemo(() => {
    const totalParticipants = registrationRows.length;
    const attended = registrationRows.filter((row) => row.attendanceMarked).length;
    const pending = registrationRows.filter((row) => row.registrationStatus !== "Confirmed").length;
    const notAttended = registrationRows.filter(
      (row) => row.registrationStatus === "Confirmed" && !row.attendanceMarked
    ).length;

    return {
      totalParticipants,
      attended,
      pending,
      notAttended,
    };
  }, [registrationRows]);

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => navigate("/coordinator-dashboard")}
          className="inline-flex rounded-md p-1 text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Registered Students</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">View registrations for your assigned events.</p>
            {selectedEvent && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={12} />
                  {formatDate(selectedEvent?.schedule?.startDate)} | {formatTime(selectedEvent?.schedule?.startTime)} -{" "}
                  {formatTime(selectedEvent?.schedule?.endTime)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} className="text-indigo-500" />
                  {selectedEvent?.venue?.location || "Venue TBD"}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[selectedStatus] || STATUS_BADGE.upcoming}`}
                >
                  {STATUS_LABEL[selectedStatus] || STATUS_LABEL.upcoming}
                </span>
              </div>
            )}
          </div>
          {assignedEvents.length > 0 && (
            <label className="eventmate-panel w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 sm:w-auto">
              <span className="mr-2 font-semibold text-slate-700 dark:text-slate-200">Event</span>
              <select
                value={normalizeId(selectedEvent?._id)}
                onChange={(event) => {
                  const nextId = normalizeId(event.target.value);
                  setSelectedEventId(nextId);
                  navigate(`/coordinator-dashboard/event/${encodeURIComponent(nextId)}/registrations`);
                }}
                className="mt-2 w-full rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-xs text-slate-900 dark:text-slate-100 sm:mt-0 sm:w-auto"
              >
                {assignedEvents.map((event) => (
                  <option key={normalizeId(event?._id)} value={normalizeId(event?._id)}>
                    {event?.title || "Untitled Event"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {loading ? (
          <section className="eventmate-panel mt-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 text-sm text-slate-500 dark:text-slate-300">
            Loading assigned events...
          </section>
        ) : assignedEvents.length === 0 ? (
          <section className="eventmate-panel mt-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 text-sm text-slate-500 dark:text-slate-300">
            No assigned events found for this coordinator account.
          </section>
        ) : selectedEvent ? (
          <>
            <section className="eventmate-panel mt-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Event</p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedEvent?.title || "Selected Event"}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Live list of registrations for this event.</p>
                </div>
                <button
                  type="button"
                  onClick={loadRegistrations}
                  disabled={registrationLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-70"
                >
                  {registrationLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
                  Refresh
                </button>
              </div>

              <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="eventmate-kpi rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Total Registrations</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{registrationStats.totalParticipants}</p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Attended</p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{registrationStats.attended}</p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pending</p>
                  <p className="mt-0.5 text-sm font-semibold text-amber-700 dark:text-amber-300">{registrationStats.pending}</p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Not Attended</p>
                  <p className="mt-0.5 text-sm font-semibold text-rose-700 dark:text-rose-300">{registrationStats.notAttended}</p>
                </article>
              </section>

              <label className="relative mt-4 block">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={registrationQuery}
                  onChange={(event) => setRegistrationQuery(event.target.value)}
                  placeholder="Search by name, email, or team..."
                  className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-9 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 focus:border-indigo-400"
                />
              </label>

              {registrationLoading ? (
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                  <Loader2 size={14} className="animate-spin" />
                  Loading registrations...
                </p>
              ) : registrationError ? (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                  {registrationError}
                </p>
              ) : registrationRows.length === 0 ? (
                <p className="mt-4 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                  No registrations found for this event yet.
                </p>
              ) : (
                <>
                  {visibleRegistrationRows.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                      No participants match the current search.
                    </p>
                  ) : (
                    <>
                      <div className="mt-4 space-y-3 sm:hidden">
                        {visibleRegistrationRows.map((row) => (
                          <article key={`${row.registrationId}-${row.id}`} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-3">
                            <div className="flex items-start gap-2.5">
                              <UserCircle2 size={22} className="text-slate-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 dark:text-white">{row.participantName}</p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300 break-words">{row.participantEmail || "-"}</p>
                                <span
                                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusClass(row.registrationStatus)}`}
                                >
                                  {row.registrationStatus}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Branch &amp; Year</p>
                                <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">
                                  {row.department || "-"} {row.year ? `• ${row.year}` : ""}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Team</p>
                                <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">{row.teamName || "Individual"}</p>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Reg. Date</p>
                                <p className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">{formatDateTime(row.registeredAt)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Attendance</p>
                                {row.attendanceMarked ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                      <CheckCircle2 size={11} />
                                      Checked In
                                    </span>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{formatDateTime(row.attendanceMarkedAt)}</p>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                    <CircleDashed size={11} />
                                    Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>

                      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 sm:block">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100/80 dark:bg-white/5">
                            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                              <th className="px-3 py-2.5 font-semibold">Student Name</th>
                              <th className="px-3 py-2.5 font-semibold">Branch &amp; Year</th>
                              <th className="px-3 py-2.5 font-semibold">Team</th>
                              <th className="px-3 py-2.5 font-semibold">Reg. Date</th>
                              <th className="px-3 py-2.5 font-semibold">Attendance Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white dark:bg-gray-900/40">
                            {visibleRegistrationRows.map((row) => (
                              <tr key={`${row.registrationId}-${row.id}`} className="align-top">
                                <td className="px-3 py-3">
                                  <div className="flex items-start gap-2.5">
                                    <UserCircle2 size={22} className="text-slate-400 mt-0.5 shrink-0" />
                                    <div>
                                      <p className="font-semibold text-slate-900 dark:text-white">{row.participantName}</p>
                                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{row.participantEmail || "-"}</p>
                                      <span
                                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusClass(row.registrationStatus)}`}
                                      >
                                        {row.registrationStatus}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <p className="text-slate-800 dark:text-slate-100">{row.department || "-"}</p>
                                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{row.year || "-"}</p>
                                </td>
                                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.teamName || "Individual"}</td>
                                <td className="px-3 py-3">
                                  <span className="text-xs text-slate-600 dark:text-slate-300">{formatDateTime(row.registeredAt)}</span>
                                </td>
                                <td className="px-3 py-3">
                                  {row.attendanceMarked ? (
                                    <div>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        <CheckCircle2 size={11} />
                                        Checked In
                                      </span>
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{formatDateTime(row.attendanceMarkedAt)}</p>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                      <CircleDashed size={11} />
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                        Showing {visibleRegistrationRows.length} of {registrationRows.length} participants.
                      </p>
                    </>
                  )}
                </>
              )}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
