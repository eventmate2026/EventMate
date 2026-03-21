import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Loader2,
  QrCode,
  RefreshCcw,
  Search,
  UserCircle2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventItem } from "../lib/backendAdapters";

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const parseRegistrationRows = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.registrations)) return payload.registrations;
  if (Array.isArray(payload?.data?.registrations)) return payload.data.registrations;
  return [];
};

const toParticipantRows = (registration) => {
  const registrationId = normalizeId(registration?._id || registration?.id);
  const registrationStatus = String(registration?.status || "Pending").trim() || "Pending";
  const paymentStatus = String(registration?.payment?.paymentStatus || "NotRequired").trim() || "NotRequired";
  const paymentAmount = Number(registration?.payment?.amount || 0) || 0;
  const paymentTransactionId = String(registration?.payment?.transactionId || "").trim();
  const paymentScreenshot = String(registration?.payment?.paymentScreenshot || "").trim();
  const paymentRejectionReason = String(registration?.payment?.rejectionReason || "").trim();
  const teamName = String(registration?.teamName || "").trim();
  const registeredAt = registration?.createdAt || null;
  const winnerPosition = String(registration?.winner?.position || "").trim();
  const isWinner = Boolean(registration?.winner?.isWinner);
  const winnerAssignmentCount = Number(registration?.winner?.assignmentCount || 0);
  const winnerUnassignedOnce = Boolean(registration?.winner?.unassignedOnce);

  const qrParticipants = Array.isArray(registration?.participants) ? registration.participants : [];
  const qrByEmail = new Map(
    qrParticipants
      .filter((item) => item)
      .map((item) => [normalizeEmail(item?.email), item])
  );

  const structuredParticipants = [registration?.teamLeader, ...(Array.isArray(registration?.teamMembers) ? registration.teamMembers : [])].filter(Boolean);

  if (structuredParticipants.length > 0) {
    return structuredParticipants.map((participant, index) => {
      const participantEmail = String(participant?.email || "").trim();
      const qr = qrByEmail.get(normalizeEmail(participantEmail)) || null;

      return {
        id: normalizeId(participant?._id || participant?.id || `${registrationId}-${participantEmail || index}`),
        registrationId,
        participantName: String(participant?.name || "Participant").trim() || "Participant",
        participantEmail,
        participantRole: String(qr?.role || (index === 0 ? "leader" : "member")).trim(),
        mobileNumber: String(participant?.mobileNumber || "").trim(),
        college: String(participant?.college || "").trim(),
        branch: String(participant?.branch || "").trim(),
        year: String(participant?.year || "").trim(),
        teamName,
        registrationStatus,
        paymentStatus,
        paymentAmount,
        paymentTransactionId,
        paymentScreenshot,
        paymentRejectionReason,
        registeredAt,
        attendanceMarked: Boolean(qr?.attendanceMarked),
        attendanceMarkedAt: qr?.attendanceMarkedAt || null,
        isLeader: index === 0,
        winnerPosition,
        isWinner,
        winnerAssignmentCount,
        winnerUnassignedOnce,
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
      mobileNumber: "",
      college: "",
      branch: "",
      year: "",
      teamName,
      registrationStatus,
      paymentStatus,
      paymentAmount,
      paymentTransactionId,
      paymentScreenshot,
      paymentRejectionReason,
      registeredAt,
      attendanceMarked: Boolean(participant?.attendanceMarked),
      attendanceMarkedAt: participant?.attendanceMarkedAt || null,
      isLeader: index === 0,
      winnerPosition,
      isWinner,
      winnerAssignmentCount,
      winnerUnassignedOnce,
    }));
  }

  return [
    {
      id: registrationId || Math.random().toString(36).slice(2),
      registrationId,
      participantName: "Participant",
      participantEmail: "",
      participantRole: "participant",
      mobileNumber: "",
      college: "",
      branch: "",
      year: "",
      teamName,
      registrationStatus,
      paymentStatus,
      paymentAmount,
      paymentTransactionId,
      paymentScreenshot,
      paymentRejectionReason,
      registeredAt,
      attendanceMarked: false,
      attendanceMarkedAt: null,
      isLeader: true,
      winnerPosition,
      isWinner,
      winnerAssignmentCount,
      winnerUnassignedOnce,
    },
  ];
};

const parseParticipantRows = (payload) =>
  parseRegistrationRows(payload).flatMap((registration) => toParticipantRows(registration));

const formatDate = (value) => {
  if (!value) return "Date TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const REGISTRATION_STATUS_STYLES = {
  Confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  PendingMemberVerification: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  PendingPayment: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  PendingPaymentVerification: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  Cancelled: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

const PAYMENT_STATUS_STYLES = {
  Verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  UnderReview: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  NotRequired: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

const getStatusClass = (status, map) => map[String(status || "")] || "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";

export default function OrganizerEventViewList() {
  const navigate = useNavigate();
  const { eventId } = useParams();

  const [eventData, setEventData] = useState(null);
  const [participantRows, setParticipantRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [winnerNotice, setWinnerNotice] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [pendingWinnerUpdates, setPendingWinnerUpdates] = useState({});
  const [savingWinnerChanges, setSavingWinnerChanges] = useState(false);
  const [paymentReviewDrafts, setPaymentReviewDrafts] = useState({});
  const [paymentActionByRegistration, setPaymentActionByRegistration] = useState({});

  const [query, setQuery] = useState("");
  const [registrationFilter, setRegistrationFilter] = useState("All");
  const [attendanceFilter, setAttendanceFilter] = useState("All");

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [detailResponse, registrationResponse] = await Promise.all([
          api({
            ...SummaryApi.get_public_event_details,
            url: SummaryApi.get_public_event_details.url.replace(":eventId", encodeURIComponent(eventId || "")),
          }),
          api({
            ...SummaryApi.get_event_registrations,
            url: SummaryApi.get_event_registrations.url.replace(":eventId", encodeURIComponent(eventId || "")),
          }),
        ]);

        const event = extractEventItem(detailResponse.data);
        if (!event) {
          setEventData(null);
          setParticipantRows([]);
          setError("Event not found.");
          return;
        }

        setEventData(event);
        setParticipantRows(parseParticipantRows(registrationResponse.data));
      } catch (fetchError) {
        setEventData(null);
        setParticipantRows([]);
        setError(fetchError.response?.data?.message || "Unable to load event participant list.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const registrationOptions = useMemo(() => {
    const options = new Set(["All"]);
    participantRows.forEach((row) => {
      const status = String(row?.registrationStatus || "").trim();
      if (status) options.add(status);
    });
    return [...options];
  }, [participantRows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();

    return participantRows.filter((row) => {
      if (registrationFilter !== "All" && row.registrationStatus !== registrationFilter) return false;

      if (attendanceFilter === "CheckedIn" && !row.attendanceMarked) return false;
      if (attendanceFilter === "Pending" && row.attendanceMarked) return false;

      if (!normalizedQuery) return true;

      const searchSpace = [
        row.participantName,
        row.participantEmail,
        row.mobileNumber,
        row.teamName,
        row.college,
        row.branch,
        row.year,
        row.registrationStatus,
        row.paymentStatus,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return searchSpace.includes(normalizedQuery);
    });
  }, [attendanceFilter, participantRows, query, registrationFilter]);

  const stats = useMemo(() => {
    const totalParticipants = participantRows.length;
    const checkedIn = participantRows.filter((row) => row.attendanceMarked).length;
    const remaining = Math.max(0, totalParticipants - checkedIn);
    const confirmed = participantRows.filter((row) => row.registrationStatus === "Confirmed").length;
    const groups = new Set(participantRows.map((row) => row.registrationId).filter(Boolean)).size;

    return {
      totalParticipants,
      checkedIn,
      remaining,
      confirmed,
      groups,
    };
  }, [participantRows]);

  const positionTakenBy = useMemo(() => {
    const map = new Map();
    participantRows.forEach((row) => {
      if (!row.isLeader) return;
      if (!row.isWinner || !row.winnerPosition) return;
      const registrationKey = normalizeId(row.registrationId);
      const pending = pendingWinnerUpdates[registrationKey];
      if (pending?.action === "clear") return;
      map.set(row.winnerPosition, registrationKey);
    });

    Object.entries(pendingWinnerUpdates).forEach(([registrationKey, update]) => {
      if (update?.action === "assign" && update.position) {
        map.set(update.position, registrationKey);
      }
    });

    return map;
  }, [participantRows, pendingWinnerUpdates]);

  const canAssignWinners = useMemo(() => {
    if (!eventData) return false;
    const status = String(eventData?.status || "").trim().toLowerCase();
    if (status === "cancelled") return false;
    const startDate = new Date(eventData?.schedule?.startDate || 0);
    if (Number.isNaN(startDate.getTime())) return false;
    return Date.now() >= startDate.getTime();
  }, [eventData]);

  const pendingWinnerCount = useMemo(
    () => Object.keys(pendingWinnerUpdates).length,
    [pendingWinnerUpdates]
  );

  const handleReviewPayment = async (registrationId, action) => {
    const normalizedId = normalizeId(registrationId);
    if (!normalizedId) return;

    const rejectionReason = String(paymentReviewDrafts[normalizedId] || "").trim();
    if (action === "reject" && !rejectionReason) {
      setPaymentNotice({
        type: "error",
        text: "Enter a rejection reason before rejecting payment.",
      });
      return;
    }

    setPaymentNotice(null);
    setPaymentActionByRegistration((prev) => ({ ...prev, [normalizedId]: action }));
    try {
      const response = await api({
        ...SummaryApi.review_registration_payment,
        url: SummaryApi.review_registration_payment.url.replace(
          ":registrationId",
          encodeURIComponent(normalizedId)
        ),
        data: {
          action,
          rejectionReason,
        },
      });
      setPaymentNotice({
        type: "success",
        text: response.data?.message || "Payment review updated successfully.",
      });
      setPaymentReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[normalizedId];
        return next;
      });
      await load({ silent: true });
    } catch (reviewError) {
      setPaymentNotice({
        type: "error",
        text: reviewError.response?.data?.message || "Unable to update payment review.",
      });
    } finally {
      setPaymentActionByRegistration((prev) => {
        const next = { ...prev };
        delete next[normalizedId];
        return next;
      });
    }
  };

  const handleQueueWinnerAssign = (registrationId, position) => {
    const normalizedId = normalizeId(registrationId);
    const normalizedPosition = String(position || "").trim();
    if (!normalizedId) return;

    if (!normalizedPosition) {
      setPendingWinnerUpdates((prev) => {
        const next = { ...prev };
        delete next[normalizedId];
        return next;
      });
      return;
    }

    const takenBy = positionTakenBy.get(normalizedPosition);
    if (takenBy && takenBy !== normalizedId) {
      setWinnerNotice({
        type: "error",
        text: `${normalizedPosition} place is already selected.`,
      });
      return;
    }

    setPendingWinnerUpdates((prev) => ({
      ...prev,
      [normalizedId]: { action: "assign", position: normalizedPosition },
    }));
  };

  const handleQueueWinnerClear = (registrationId) => {
    const normalizedId = normalizeId(registrationId);
    if (!normalizedId) return;

    setPendingWinnerUpdates((prev) => ({
      ...prev,
      [normalizedId]: { action: "clear" },
    }));
  };

  const handleUndoWinnerChange = (registrationId) => {
    const normalizedId = normalizeId(registrationId);
    if (!normalizedId) return;
    setPendingWinnerUpdates((prev) => {
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
  };

  const handleSaveWinnerChanges = async () => {
    const pendingEntries = Object.entries(pendingWinnerUpdates);
    if (pendingEntries.length === 0) return;

    setWinnerNotice(null);
    setSavingWinnerChanges(true);

    const clearEntries = pendingEntries.filter(([, update]) => update?.action === "clear");
    const assignEntries = pendingEntries.filter(([, update]) => update?.action === "assign");

    let hadError = false;
    let errorMessage = "";
    let hasSuccess = false;

    try {
      for (const [registrationId] of clearEntries) {
        try {
          await api({
            ...SummaryApi.untag_registration_winner,
            url: SummaryApi.untag_registration_winner.url.replace(
              ":registrationId",
              encodeURIComponent(registrationId)
            ),
          });
          hasSuccess = true;
          setPendingWinnerUpdates((prev) => {
            const next = { ...prev };
            delete next[registrationId];
            return next;
          });
        } catch (clearError) {
          hadError = true;
          errorMessage = clearError.response?.data?.message || "Unable to clear winner selection.";
          break;
        }
      }

      if (!hadError) {
        for (const [registrationId, update] of assignEntries) {
          try {
            await api({
              ...SummaryApi.tag_registration_winner,
              url: SummaryApi.tag_registration_winner.url.replace(
                ":registrationId",
                encodeURIComponent(registrationId)
              ),
              data: { position: update.position },
            });
            hasSuccess = true;
            setPendingWinnerUpdates((prev) => {
              const next = { ...prev };
              delete next[registrationId];
              return next;
            });
          } catch (assignError) {
            hadError = true;
            errorMessage = assignError.response?.data?.message || "Unable to assign winner.";
            break;
          }
        }
      }

      if (hasSuccess) {
        await load({ silent: true });
      }

      if (hadError) {
        setWinnerNotice({ type: "error", text: errorMessage });
      } else {
        setWinnerNotice({
          type: "success",
          text: "Winner changes saved successfully.",
        });
      }
    } finally {
      setSavingWinnerChanges(false);
    }
  };

  const encodedEventId = encodeURIComponent(normalizeId(eventData?._id) || eventId || "");

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/details`)}
            className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ArrowLeft size={15} />
            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load({ silent: true })}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => navigate(`/organizer-dashboard/event/${encodedEventId}/scan-qr`)}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <QrCode size={14} />
              Open Scanner
            </button>
          </div>
        </div>

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading participant list...
          </section>
        )}

        {error && !loading && (
          <section className="eventmate-panel rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </section>
        )}

        {!loading && !error && eventData && (
          <>
            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Participant List</h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{eventData?.title || "Event"}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarDays size={12} />
                    {formatDate(eventData?.schedule?.startDate)}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Total Participants</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.totalParticipants}</p>
              </article>
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Checked In</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-300">{stats.checkedIn}</p>
              </article>
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Remaining</p>
                <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-300">{stats.remaining}</p>
              </article>
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Confirmed</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.confirmed}</p>
              </article>
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Groups</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stats.groups}</p>
              </article>
            </section>

            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
              {winnerNotice && (
                <p
                  className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                    winnerNotice.type === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300"
                  }`}
                >
                  {winnerNotice.text}
                </p>
              )}
              {paymentNotice && (
                <p
                  className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                    paymentNotice.type === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300"
                  }`}
                >
                  {paymentNotice.text}
                </p>
              )}

              {!canAssignWinners && (
                <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                  Winner selection opens on the event start date.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_170px] gap-3">
                <label className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    name="participantSearch"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name, email, college, team..."
                    className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>

                <select
                  name="registrationFilter"
                  value={registrationFilter}
                  onChange={(event) => setRegistrationFilter(event.target.value)}
                  className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
                >
                  {registrationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <select
                  name="attendanceFilter"
                  value={attendanceFilter}
                  onChange={(event) => setAttendanceFilter(event.target.value)}
                  className="rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
                >
                  <option value="All">All Attendance</option>
                  <option value="CheckedIn">Checked In</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Select winners, then save changes to apply.
                </p>
                <div className="flex items-center gap-2">
                  {pendingWinnerCount > 0 && (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                      {pendingWinnerCount} pending
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveWinnerChanges}
                    disabled={!canAssignWinners || pendingWinnerCount === 0 || savingWinnerChanges}
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingWinnerChanges ? <Loader2 size={12} className="animate-spin" /> : null}
                    {savingWinnerChanges ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100/80 dark:bg-white/5">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      <th className="px-3 py-2.5 font-semibold">Participant</th>
                      <th className="px-3 py-2.5 font-semibold">Contact</th>
                      <th className="px-3 py-2.5 font-semibold">Academic</th>
                      <th className="px-3 py-2.5 font-semibold">Team</th>
                      <th className="px-3 py-2.5 font-semibold">Rank</th>
                      <th className="px-3 py-2.5 font-semibold">Registration</th>
                      <th className="px-3 py-2.5 font-semibold">Payment Review</th>
                      <th className="px-3 py-2.5 font-semibold">Attendance</th>
                      <th className="px-3 py-2.5 font-semibold">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white dark:bg-gray-900/40 select-none">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
                          No participants found for the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        const winnerKey = normalizeId(row.registrationId);
                        const pendingUpdate = pendingWinnerUpdates[winnerKey];
                        const pendingAction = pendingUpdate?.action || "";
                        const pendingPosition = pendingUpdate?.position || "";
                        const isPendingClear = pendingAction === "clear";
                        const assignmentCount = Number(row.winnerAssignmentCount || 0);
                        const winnerLocked = assignmentCount >= 2;
                        const canEditWinner =
                          row.isLeader &&
                          row.registrationStatus === "Confirmed" &&
                          canAssignWinners &&
                          !savingWinnerChanges;
                        const canClearWinner =
                          canEditWinner &&
                          row.isWinner &&
                          !row.winnerUnassignedOnce &&
                          assignmentCount < 2 &&
                          !isPendingClear;
                        const canSelectWinner =
                          canEditWinner &&
                          row.attendanceMarked &&
                          !row.isWinner &&
                          !winnerLocked;
                        const reviewAction = paymentActionByRegistration[winnerKey];
                        const canReviewPayment =
                          row.isLeader &&
                          Number(row.paymentAmount || 0) > 0 &&
                          row.paymentStatus === "UnderReview";

                        return (
                          <tr key={`${row.registrationId}-${row.id}`} className="align-top">
                          <td className="px-3 py-3">
                            <div className="flex items-start gap-2.5">
                              <UserCircle2 size={22} className="text-slate-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{row.participantName}</p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">Role: {row.participantRole || "participant"}</p>
                                {row.branch ? (
                                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{row.branch}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-slate-800 dark:text-slate-100">{row.participantEmail || "-"}</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{row.mobileNumber || "No mobile"}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-slate-800 dark:text-slate-100">{row.college || "-"}</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
                              {[row.branch, row.year].filter(Boolean).join(" | ") || "-"}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.teamName || "Individual"}</td>
                          <td className="px-3 py-3">
                            {row.isWinner && row.winnerPosition ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                  {row.winnerPosition} Place
                                </span>
                                {isPendingClear ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-amber-600 dark:text-amber-300">Pending removal</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUndoWinnerChange(row.registrationId)}
                                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"
                                    >
                                      Undo
                                    </button>
                                  </div>
                                ) : canClearWinner ? (
                                  <button
                                    type="button"
                                    onClick={() => handleQueueWinnerClear(row.registrationId)}
                                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300"
                                  >
                                    Deselect
                                  </button>
                                ) : winnerLocked ? (
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Locked</span>
                                ) : null}
                              </div>
                            ) : row.isLeader ? (
                              !row.attendanceMarked ? (
                                <span className="text-xs text-slate-400 dark:text-slate-500">Attendance pending</span>
                              ) : winnerLocked ? (
                                <span className="text-xs text-slate-400 dark:text-slate-500">Locked</span>
                              ) : (
                                <select
                                  value={pendingPosition}
                                  onChange={(event) => handleQueueWinnerAssign(row.registrationId, event.target.value)}
                                  disabled={!canSelectWinner}
                                  className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-100 disabled:opacity-60"
                                >
                                  <option value="">Select</option>
                                  {["1st", "2nd", "3rd"].map((position) => (
                                    <option key={position} value={position} disabled={positionTakenBy.get(position) && positionTakenBy.get(position) !== winnerKey}>
                                      {position}
                                    </option>
                                  ))}
                                </select>
                              )
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">Team member</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-1.5">
                              <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusClass(row.registrationStatus, REGISTRATION_STATUS_STYLES)}`}>
                                {row.registrationStatus}
                              </span>
                              <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusClass(row.paymentStatus, PAYMENT_STATUS_STYLES)}`}>
                                Payment: {row.paymentStatus}
                              </span>
                              {row.paymentAmount > 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-300">
                                  Amount: Rs {row.paymentAmount}
                                </p>
                              ) : null}
                              {row.paymentTransactionId ? (
                                <p className="break-all text-xs text-slate-500 dark:text-slate-300">
                                  Txn: {row.paymentTransactionId}
                                </p>
                              ) : null}
                              {row.paymentScreenshot ? (
                                <a
                                  href={row.paymentScreenshot}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
                                >
                                  View Proof
                                </a>
                              ) : null}
                              {row.paymentRejectionReason ? (
                                <p className="text-xs text-rose-600 dark:text-rose-300">
                                  {row.paymentRejectionReason}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {canReviewPayment ? (
                              <div className="flex min-w-[200px] flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReviewPayment(row.registrationId, "approve")}
                                  disabled={Boolean(reviewAction)}
                                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                >
                                  {reviewAction === "approve" ? "Approving..." : "Approve"}
                                </button>
                                <input
                                  name={`paymentReviewReason-${winnerKey}`}
                                  value={paymentReviewDrafts[winnerKey] || ""}
                                  onChange={(event) =>
                                    setPaymentReviewDrafts((prev) => ({
                                      ...prev,
                                      [winnerKey]: event.target.value,
                                    }))
                                  }
                                  placeholder="Reason if rejecting"
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleReviewPayment(row.registrationId, "reject")}
                                  disabled={Boolean(reviewAction)}
                                  className="rounded-md border border-rose-200 px-3 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                >
                                  {reviewAction === "reject" ? "Rejecting..." : "Reject"}
                                </button>
                              </div>
                            ) : row.isLeader && Number(row.paymentAmount || 0) > 0 ? (
                              <p className="text-xs text-slate-500 dark:text-slate-300">
                                {row.paymentStatus === "Verified"
                                  ? "Approved"
                                  : row.paymentStatus === "Rejected"
                                    ? "Waiting for resubmission"
                                    : row.paymentStatus === "Pending"
                                      ? "Student payment pending"
                                      : "No action required"}
                              </p>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {row.paymentAmount > 0 ? "Leader handles payment" : "Not required"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {row.attendanceMarked ? (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                  <CheckCircle2 size={11} />
                                  Checked In
                                </span>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{formatDateTime(row.attendanceMarkedAt)}</p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-500/20 dark:text-slate-300">
                                <CircleDashed size={11} />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{formatDateTime(row.registeredAt)}</td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                Showing {filteredRows.length} of {participantRows.length} participants.
              </p>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

