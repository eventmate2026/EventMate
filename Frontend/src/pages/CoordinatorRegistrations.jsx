import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Loader2,
  MapPin,
  QrCode,
  RefreshCcw,
  Search,
  UserCircle2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventList } from "../lib/backendAdapters";
import { getStoredUser } from "../lib/auth";

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
  parseRegistrationRows(payload).flatMap((registration) => toParticipantRows(registration));

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

const isAttendanceWindowOpen = (event) => {
  const start = parseDate(event?.schedule?.startDate);
  const end = parseDate(event?.schedule?.endDate || event?.schedule?.startDate);
  if (!start || !end) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  return today >= startDate && today <= endDate;
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
  const scannerEnabled = selectedEvent && selectedStatus !== "cancelled";
  const attendanceWindowOpen = isAttendanceWindowOpen(selectedEvent);

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
    <section className="eventmate-page min-h-screen bg-slate-100/80 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => navigate("/coordinator-dashboard")}
          className="inline-flex rounded-md p-1 text-slate-600 hover:bg-white/70 hover:text-slate-900"
          aria-label="Back"
        >
          <ArrowLeft size={17} />
        </button>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Coordinator Event Workspace</h1>
            <p className="mt-1 text-sm text-slate-500">
              View assigned events and run attendance scan from backend-supported coordinator APIs.
            </p>
          </div>
          {assignedEvents.length > 0 && (
            <label className="eventmate-panel rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <span className="mr-2 font-semibold text-slate-700">Event</span>
              <select
                value={normalizeId(selectedEvent?._id)}
                onChange={(event) => {
                  const nextId = normalizeId(event.target.value);
                  setSelectedEventId(nextId);
                  navigate(`/coordinator-dashboard/event/${encodeURIComponent(nextId)}/registrations`);
                }}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
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

        {error && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</p>
        )}

        {loading ? (
          <section className="eventmate-panel mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Loading assigned events...
          </section>
        ) : assignedEvents.length === 0 ? (
          <section className="eventmate-panel mt-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            No assigned events found for this coordinator account.
          </section>
        ) : selectedEvent ? (
          <>
            <section className="eventmate-panel mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedEvent?.title || "Selected Event"}</h2>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays size={12} />
                    {formatDate(selectedEvent?.schedule?.startDate)} | {formatTime(selectedEvent?.schedule?.startTime)} - {formatTime(selectedEvent?.schedule?.endTime)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[selectedStatus] || STATUS_BADGE.upcoming}`}>
                  {STATUS_LABEL[selectedStatus] || STATUS_LABEL.upcoming}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="eventmate-kpi rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Category</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedEvent?.category || "General"}</p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Location</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                    <MapPin size={12} className="text-indigo-500" />
                    {selectedEvent?.venue?.location || "Venue TBD"}
                  </p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Registration Ends</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatDate(selectedEvent?.registration?.lastDate)}</p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Max Participants</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedEvent?.registration?.maxParticipants ?? "N/A"}</p>
                </article>
              </div>
            </section>

            <section className="eventmate-panel mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <AlertTriangle size={13} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Coordinator workspace</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Open event details, review registrations, and run QR attendance scanning from this page.
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => navigate(`/coordinator-dashboard/event/${encodeURIComponent(normalizeId(selectedEvent?._id))}/details`)}
                className="eventmate-kpi rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                View Details
              </button>
              <button
                type="button"
                onClick={() => navigate(`/coordinator-dashboard/event/${encodeURIComponent(normalizeId(selectedEvent?._id))}/scan`)}
                disabled={!scannerEnabled}
                className={`eventmate-kpi inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                  scannerEnabled
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                <QrCode size={15} />
                Open Attendance Scanner
              </button>
              <button
                type="button"
                onClick={() => navigate("/coordinator-dashboard/notifications")}
                className="eventmate-kpi rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                View Notifications
              </button>
              <button
                type="button"
                onClick={() => navigate("/coordinator-dashboard/contact-admin")}
                className="eventmate-kpi rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Contact Admin
              </button>
            </section>

            <p className="mt-2 text-xs text-slate-500">
              {attendanceWindowOpen
                ? "Attendance window is open based on event dates."
                : "Attendance marking will be accepted by backend only on event date range."}
            </p>

            <section className="eventmate-panel mt-4 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Registered Students</h3>
                  <p className="text-xs text-slate-500">Live list of registrations for this event.</p>
                </div>
                <button
                  type="button"
                  onClick={loadRegistrations}
                  disabled={registrationLoading}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70"
                >
                  {registrationLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
                  Refresh
                </button>
              </div>

              <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="eventmate-kpi rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Total Registrations</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{registrationStats.totalParticipants}</p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Attended</p>
                  <p className="mt-0.5 text-sm font-semibold text-emerald-700">{registrationStats.attended}</p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Pending</p>
                  <p className="mt-0.5 text-sm font-semibold text-amber-700">{registrationStats.pending}</p>
                </article>
                <article className="eventmate-kpi rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">Not Attended</p>
                  <p className="mt-0.5 text-sm font-semibold text-rose-700">{registrationStats.notAttended}</p>
                </article>
              </section>

              <label className="relative mt-4 block">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={registrationQuery}
                  onChange={(event) => setRegistrationQuery(event.target.value)}
                  placeholder="Search by name, email, or team..."
                  className="w-full rounded-md border border-slate-200 bg-white px-9 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400"
                />
              </label>

              {registrationLoading ? (
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  Loading registrations...
                </p>
              ) : registrationError ? (
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {registrationError}
                </p>
              ) : registrationRows.length === 0 ? (
                <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  No confirmed registrations with QR sent for this event yet.
                </p>
              ) : (
                <>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100/80">
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2.5 font-semibold">Student Name</th>
                          <th className="px-3 py-2.5 font-semibold">Branch &amp; Year</th>
                          <th className="px-3 py-2.5 font-semibold">Team</th>
                          <th className="px-3 py-2.5 font-semibold">Reg. Date</th>
                          <th className="px-3 py-2.5 font-semibold">Attendance Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {visibleRegistrationRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                              No participants match the current search.
                            </td>
                          </tr>
                        ) : (
                          visibleRegistrationRows.map((row) => (
                            <tr key={`${row.registrationId}-${row.id}`} className="align-top">
                              <td className="px-3 py-3">
                                <div className="flex items-start gap-2.5">
                                  <UserCircle2 size={22} className="text-slate-400 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="font-semibold text-slate-900">{row.participantName}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">{row.participantEmail || "-"}</p>
                                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusClass(row.registrationStatus)}`}>
                                      {row.registrationStatus}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <p className="text-slate-800">{row.department || "-"}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{row.year || "-"}</p>
                              </td>
                              <td className="px-3 py-3 text-slate-700">{row.teamName || "Individual"}</td>
                              <td className="px-3 py-3">
                                <span className="text-xs text-slate-600">{formatDateTime(row.registeredAt)}</span>
                              </td>
                              <td className="px-3 py-3">
                                {row.attendanceMarked ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                      <CheckCircle2 size={11} />
                                      Checked In
                                    </span>
                                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.attendanceMarkedAt)}</p>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                    <CircleDashed size={11} />
                                    Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Showing {visibleRegistrationRows.length} of {registrationRows.length} participants.
                  </p>
                </>
              )}
            </section>

            <section className="mt-5 space-y-2">
              <h3 className="text-lg font-bold text-slate-900">All Assigned Events</h3>
              {assignedEvents.map((event) => {
                const eventStatus = deriveStatus(event);
                const eventIdValue = normalizeId(event?._id);
                const canScan = eventStatus !== "cancelled";

                return (
                  <article key={eventIdValue} className="eventmate-panel rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{event?.title || "Untitled Event"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(event?.schedule?.startDate)} | {formatTime(event?.schedule?.startTime)} - {formatTime(event?.schedule?.endTime)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[eventStatus] || STATUS_BADGE.upcoming}`}>
                        {STATUS_LABEL[eventStatus] || STATUS_LABEL.upcoming}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/coordinator-dashboard/event/${encodeURIComponent(eventIdValue)}/details`)}
                        className="rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/coordinator-dashboard/event/${encodeURIComponent(eventIdValue)}/registrations`)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open Workspace
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/coordinator-dashboard/event/${encodeURIComponent(eventIdValue)}/scan`)}
                        disabled={!canScan}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                          canScan
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
                        }`}
                      >
                        Scan Attendance
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
