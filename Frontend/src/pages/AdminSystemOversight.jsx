import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  MoreHorizontal,
  RefreshCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import AdminStatusBanner from "../components/AdminStatusBanner";
import PageBackButton from "../components/PageBackButton";
import useToastFeedback from "../hooks/useToastFeedback";

const formatDateTime = (value) => {
  if (!value) return "Recently";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return parsed.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const csvEscape = (value) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

const downloadCsv = (filename, rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const typeToBadge = (type) => {
  const value = String(type || "").toUpperCase();
  if (value === "CONTACT") return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  if (value === "CERTIFICATE") return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300";
  if (value === "ATTENDANCE") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (value === "FEEDBACK") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
  if (value === "NOTICE") return "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300";
  if (value === "MESSAGE") return "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300";
  return "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
};

export default function AdminSystemOversight() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [oversightData, setOversightData] = useState(null);
  const [search, setSearch] = useState("");
  const [activeControlId, setActiveControlId] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load system oversight right now.",
  });

  const loadOversightData = async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      const response = await api({
        ...SummaryApi.get_admin_system_live_data,
        skipCache: true,
        skipDedupe: true,
      });
      const nextData = response.data?.data?.oversight || null;
      setOversightData(nextData);
      setLastSyncedAt(response.data?.data?.generatedAt || new Date().toISOString());
    } catch (loadError) {
      setError(loadError?.response?.data?.message || "Unable to load oversight data.");
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    let intervalId = null;

    void loadOversightData({ showLoader: true });
    intervalId = setInterval(() => {
      void loadOversightData({ showLoader: false });
    }, 30000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (event.target.closest("[data-emergency-menu]")) return;
      setActiveControlId(null);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const eventRows = oversightData?.events || [];

  const filteredRows = useMemo(() => {
    const query = String(search || "").trim().toLowerCase();
    if (!query) return eventRows;
    return eventRows.filter((row) =>
      [row.title, row.organizer, row.department].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  }, [eventRows, search]);

  const kpis = oversightData?.kpis || {
    liveEvents: 0,
    totalAttendance: 0,
    totalRegisteredParticipants: 0,
    pendingApprovals: 0,
    pendingPaymentReviews: 0,
    pendingMemberVerifications: 0,
    pendingContacts: 0,
    avgUtilization: 0,
  };
  const historyRows = oversightData?.history || [];
  const health = oversightData?.health || {
    score: 0,
    maintenanceMode: false,
    activeSessions: 0,
    lockedUsers: 0,
    pendingContacts: 0,
    pendingPaymentReviews: 0,
    pendingMemberVerifications: 0,
    trackedEvents: 0,
  };
  const alerts = oversightData?.alerts || [];
  const hasOversightData = Boolean(oversightData);

  const handleExport = () => {
    const rows = filteredRows.map((row) => ({
      Event: row.title,
      Organizer: row.organizer,
      Department: row.department,
      State: row.state,
      Registered: row.registered,
      Present: row.present,
      Capacity: row.capacity,
      FillRate: `${row.utilization}%`,
      AttendanceRate: `${Number(row.attendanceRate || 0)}%`,
      FeedbackCount: row.feedbackCount,
      Date: row.dateLabel,
    }));
    downloadCsv("system-oversight-report.csv", rows);
  };

  const handleEmergencyAction = async (row, action) => {
    if (!row?.id || actionBusyId) return;
    const normalizedStatus = String(row.status || "").toLowerCase();

    if (action === "complete" && normalizedStatus !== "published") {
      setActionNotice({
        type: "error",
        text: "Only published events can be completed.",
      });
      setActiveControlId(null);
      return;
    }

    const confirmText =
      action === "cancel"
        ? `Cancel "${row.title}"? This will immediately stop registrations and hide the event.`
        : `Mark "${row.title}" as completed?`;

    if (!window.confirm(confirmText)) {
      setActiveControlId(null);
      return;
    }

    setActionBusyId(row.id);
    setActionNotice(null);

    try {
      const config = action === "cancel" ? SummaryApi.cancel_event : SummaryApi.complete_event;
      await api({
        ...config,
        url: config.url.replace(":eventId", row.id),
      });
      await loadOversightData({ showLoader: false });

      setActionNotice({
        type: "success",
        text:
          action === "cancel"
            ? "Event cancelled successfully."
            : "Event marked as completed.",
      });
    } catch (actionError) {
      setActionNotice({
        type: "error",
        text:
          actionError?.response?.data?.message ||
          "Unable to perform this emergency action.",
      });
    } finally {
      setActionBusyId(null);
      setActiveControlId(null);
    }
  };

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <PageBackButton to="/admin-dashboard" label="Back to Dashboard" />

        <header className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                System-Wide Event Oversight
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Live monitoring across active, pending, and completed university events.
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Last synced: {formatDateTime(lastSyncedAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadOversightData({ showLoader: false })}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <RefreshCcw size={15} />
              Refresh
            </button>
          </div>
        </header>

        {loading && !hasOversightData && (
          <article className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading system oversight...
          </article>
        )}

        {error && (
          <AdminStatusBanner
            title={hasOversightData ? "Oversight refresh interrupted" : "System oversight is temporarily unavailable"}
            message={
              hasOversightData
                ? "The live oversight feed could not be refreshed. Showing the most recent admin snapshot."
                : "We couldn't refresh the live oversight feed. Retry to restore this admin page."
            }
            actionLabel="Retry"
            onAction={() => loadOversightData({ showLoader: true })}
          />
        )}

        {!loading && (hasOversightData || !error) && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Total Live Events</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{Number(kpis.liveEvents || 0)}</p>
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">Live operations in progress</p>
              </article>

              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Total Attendance</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{Number(kpis.totalAttendance || 0).toLocaleString()}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                  {Number(kpis.totalRegisteredParticipants || 0).toLocaleString()} registered system-wide
                </p>
              </article>

              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Pending Approvals</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{Number(kpis.pendingApprovals || 0)}</p>
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                  {Number(kpis.pendingPaymentReviews || 0)} payment reviews | {Number(kpis.pendingContacts || 0)} contacts
                </p>
              </article>

              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Avg. Capacity Util.</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{Number(kpis.avgUtilization || 0).toFixed(1)}%</p>
                <div className="mt-3 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.max(4, Math.min(100, Number(kpis.avgUtilization || 0)))}%` }}
                  />
                </div>
              </article>
            </section>

            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
              <div className="relative max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search event, organizer or department..."
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
              {actionNotice && (
                <div
                  className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                    actionNotice.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200"
                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200"
                  }`}
                >
                  {actionNotice.text}
                </div>
              )}

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-3">Event Details</th>
                      <th className="px-3 py-3">Organizer</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Participation</th>
                      <th className="px-3 py-3 text-center">Emergency Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-500 dark:text-slate-300">
                          No events found for the current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-900 dark:text-white">{row.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">
                              {row.department} · {row.dateLabel}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-slate-800 dark:text-slate-100">{row.organizer}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">{row.department}</p>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {row.feedbackCount > 0 && row.averageRating
                                ? `${row.feedbackCount} feedback | ${row.averageRating} rating`
                                : row.feedbackCount > 0
                                  ? `${row.feedbackCount} feedback submitted`
                                  : "No feedback submitted yet"}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                row.state === "Active"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                  : row.state === "Pending"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                  : "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                              }`}
                            >
                              {row.state}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {row.present} / {row.capacity || "N/A"} · {row.utilization}%
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {Number(row.registered || 0)} registered
                              {Number(row.registered || 0) > 0 ? ` | ${Number(row.attendanceRate || 0)}% checked in` : ""}
                              {Number(row.pendingQueue || 0) > 0 ? ` | ${Number(row.pendingQueue || 0)} in queue` : ""}
                            </p>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className={`h-full rounded-full ${
                                  row.utilization >= 100
                                    ? "bg-emerald-500"
                                    : row.utilization >= 60
                                    ? "bg-indigo-500"
                                    : "bg-amber-500"
                                }`}
                                style={{ width: `${Math.max(3, row.utilization)}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="relative inline-flex" data-emergency-menu>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setActiveControlId((prev) => (prev === row.id ? null : row.id));
                                }}
                                disabled={actionBusyId === row.id}
                                className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 disabled:opacity-60"
                                title="Emergency controls"
                                aria-label="Emergency controls"
                              >
                                {actionBusyId === row.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <MoreHorizontal size={14} />
                                )}
                              </button>
                              {activeControlId === row.id && (
                                <div
                                  onClick={(event) => event.stopPropagation()}
                                  className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 text-left text-xs shadow-lg dark:border-white/10 dark:bg-slate-950 z-20"
                                >
                                  {String(row.status || "").toLowerCase() === "published" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleEmergencyAction(row, "complete")}
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                                    >
                                      <CheckCircle2 size={14} />
                                      Mark Completed
                                    </button>
                                  ) : null}
                                  {String(row.status || "").toLowerCase() !== "completed" && (
                                    <button
                                      type="button"
                                      onClick={() => handleEmergencyAction(row, "cancel")}
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                    >
                                      <AlertTriangle size={14} />
                                      Cancel Event
                                    </button>
                                  )}
                                  {String(row.status || "").toLowerCase() === "completed" && (
                                    <div className="px-3 py-2 text-slate-500 dark:text-slate-400">
                                      No actions available
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] gap-4">
              <article className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">System Override History</h2>
                  <span className="text-xs text-indigo-600 dark:text-indigo-300">Latest Logs</span>
                </div>
                <div className="mt-3 space-y-2">
                  {historyRows.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-300">No recent override history.</p>
                  ) : (
                    historyRows.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-slate-50/80 dark:bg-white/5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${typeToBadge(item.type)}`}>
                            {item.type}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.message}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(item.createdAt)}</p>
                      </article>
                    ))
                  )}
                </div>
              </article>

              <aside className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Oversight Health</h2>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-slate-600 dark:text-slate-300">Operational Score</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-300">{Number(health.score || 0).toFixed(1)}%</p>
                  </div>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {Array.from({ length: 6 }).map((_, index) => {
                      const fillLimit = Math.round((Number(health.score || 0) / 100) * 6);
                      return (
                        <span
                          key={index}
                          className={`h-6 rounded-sm ${
                            index < fillLimit
                              ? "bg-emerald-500"
                              : "bg-emerald-200 dark:bg-emerald-500/20"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/10 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{health.maintenanceMode ? "Maintenance mode enabled" : "Maintenance mode disabled"}</span>
                    <span>{Number(health.activeSessions || 0)} active device session(s)</span>
                  </div>
                  <div className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {Number(health.trackedEvents || 0)} tracked event(s) | {Number(health.lockedUsers || 0)} locked user(s) | {Number(health.pendingMemberVerifications || 0)} verification queue
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-rose-500" />
                    System Alerts
                  </p>
                  <div className="mt-2 space-y-2">
                    {alerts.map((alert, index) => (
                      <p key={`${alert}-${index}`} className="text-xs text-slate-600 dark:text-slate-300 inline-flex items-start gap-1.5">
                        <AlertTriangle size={12} className="mt-0.5 text-amber-500 shrink-0" />
                        {alert}
                      </p>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExport}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700"
                >
                  <Download size={14} />
                  Download Weekly Audit Report
                </button>

                <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  Report includes filtered event oversight data.
                </p>

                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <Clock3 size={12} className="text-indigo-500" />
                  Updated from live system data every 30 seconds.
                </p>
              </aside>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
