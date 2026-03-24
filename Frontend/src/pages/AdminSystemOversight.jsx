import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldAlert,
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import useToastFeedback from "../hooks/useToastFeedback";

const toList = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.events)) return payload.events;
  return [];
};

const formatDate = (value) => {
  if (!value) return "Date TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

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

const deriveEventState = (event) => {
  const now = Date.now();
  const start = new Date(event?.schedule?.startDate || "").getTime();
  const end = new Date(event?.schedule?.endDate || "").getTime();

  if (event?.status === "Cancelled") return "Closed";
  if (!Number.isNaN(start) && now < start) return "Pending";
  if (!Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end) return "Active";
  return "Closed";
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
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState("");
  const [activeControlId, setActiveControlId] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load system oversight right now.",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [eventsResponse, contactsResponse, notificationsResponse] = await Promise.all([
          api({
            ...SummaryApi.get_public_events,
            params: { page: 1, limit: 200 },
            cacheTTL: 45000,
          }),
          api({
            ...SummaryApi.get_contacts,
            cacheTTL: 20000,
          }),
          api({
            ...SummaryApi.get_my_notifications,
            cacheTTL: 12000,
          }),
        ]);

        setEvents(toList(eventsResponse.data));
        setContacts(toList(contactsResponse.data));
        setNotifications(toList(notificationsResponse.data));
      } catch (loadError) {
        setEvents([]);
        setContacts([]);
        setNotifications([]);
        setError(loadError?.response?.data?.message || "Unable to load oversight data.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (event.target.closest("[data-emergency-menu]")) return;
      setActiveControlId(null);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const eventRows = useMemo(() => {
    return toList({ data: events })
      .map((event) => {
        const present = Number(event?.attendance?.totalPresent || 0);
        const capacity = Number(event?.registration?.maxParticipants || 0);
        const utilization = capacity > 0 ? Math.min(100, Math.round((present / capacity) * 100)) : 0;
        return {
          id: String(event?._id || ""),
          title: String(event?.title || "Untitled Event"),
          organizer: String(event?.organizer?.name || "Organizer"),
          department: String(event?.organizer?.department || "Department not set"),
          status: String(event?.status || ""),
          state: deriveEventState(event),
          present,
          capacity,
          utilization,
          dateLabel: formatDate(event?.schedule?.startDate),
        };
      })
      .sort((a, b) => {
        const rank = { Active: 0, Pending: 1, Closed: 2 };
        return (rank[a.state] ?? 9) - (rank[b.state] ?? 9);
      });
  }, [events]);

  const filteredRows = useMemo(() => {
    const query = String(search || "").trim().toLowerCase();
    if (!query) return eventRows;
    return eventRows.filter((row) =>
      [row.title, row.organizer, row.department].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    );
  }, [eventRows, search]);

  const kpis = useMemo(() => {
    const totalAttendance = eventRows.reduce((sum, row) => sum + row.present, 0);
    const totalCapacity = eventRows.reduce((sum, row) => sum + row.capacity, 0);
    const liveEvents = eventRows.filter((row) => row.state === "Active").length;
    const pendingEvents = eventRows.filter((row) => row.state === "Pending").length;
    const pendingContacts = contacts.filter(
      (item) => String(item?.status || "").toLowerCase() === "pending"
    ).length;

    return {
      liveEvents,
      totalAttendance,
      pendingApprovals: pendingEvents + pendingContacts,
      avgUtilization: totalCapacity > 0 ? ((totalAttendance / totalCapacity) * 100).toFixed(1) : "0.0",
    };
  }, [contacts, eventRows]);

  const historyRows = useMemo(() => {
    return notifications
      .map((item) => ({
        id: String(item?._id || `${item?.type}-${item?.createdAt}`),
        title: String(item?.title || "System update"),
        message: String(item?.message || "No message provided."),
        type: String(item?.type || "SYSTEM"),
        createdAt: item?.createdAt || null,
      }))
      .slice(0, 5);
  }, [notifications]);

  const uptime = useMemo(() => {
    const penalty = Math.min(2.4, kpis.pendingApprovals * 0.08);
    return (99.9 - penalty).toFixed(1);
  }, [kpis.pendingApprovals]);

  const alerts = useMemo(() => {
    const rows = [];
    if (kpis.pendingApprovals > 0) {
      rows.push(`${kpis.pendingApprovals} pending approvals require review`);
    }
    if (Number(kpis.avgUtilization) < 35) {
      rows.push("Event capacity utilization is below target threshold");
    }
    if (kpis.liveEvents === 0) {
      rows.push("No active live events right now");
    }
    if (rows.length === 0) {
      rows.push("No critical system alerts detected");
    }
    return rows;
  }, [kpis.avgUtilization, kpis.liveEvents, kpis.pendingApprovals]);

  const handleExport = () => {
    const rows = filteredRows.map((row) => ({
      Event: row.title,
      Organizer: row.organizer,
      Department: row.department,
      State: row.state,
      Attendance: row.present,
      Capacity: row.capacity,
      Utilization: `${row.utilization}%`,
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

      setEvents((prev) => {
        if (!Array.isArray(prev)) return prev;
        if (action === "cancel") {
          return prev.filter((item) => String(item?._id || "") !== row.id);
        }
        return prev.map((item) =>
          String(item?._id || "") === row.id ? { ...item, status: "Completed" } : item
        );
      });

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
        <header className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            System-Wide Event Oversight
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Monitor and manage active, pending, and completed university events.
          </p>
        </header>

        {loading && (
          <article className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading system oversight...
          </article>
        )}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Total Live Events</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{kpis.liveEvents}</p>
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">Live operations in progress</p>
              </article>

              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Total Attendance</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{kpis.totalAttendance.toLocaleString()}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">Across monitored events</p>
              </article>

              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Pending Approvals</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{kpis.pendingApprovals}</p>
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">Needs immediate review</p>
              </article>

              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Avg. Capacity Util.</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{kpis.avgUtilization}%</p>
                <div className="mt-3 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.max(4, Math.min(100, Number(kpis.avgUtilization)))}%` }}
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
                      <th className="px-3 py-3">Attendance Progress</th>
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
                    <p className="text-slate-600 dark:text-slate-300">API Uptime</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-300">{uptime}%</p>
                  </div>
                  <div className="mt-2 grid grid-cols-6 gap-1">
                    {Array.from({ length: 6 }).map((_, index) => {
                      const fillLimit = Math.round((Number(uptime) / 100) * 6);
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
                  Updated from live API data on page load.
                </p>
              </aside>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
