import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  Clock3,
  LogOut,
  MessageSquareMore,
  ShieldCheck,
  Sparkles,
  Users2,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStoredUser } from "../lib/auth";
import { logoutUser } from "../lib/logout";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventList } from "../lib/backendAdapters";

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const deriveStatus = (event) => {
  const workflow = String(event?.status || "");
  if (workflow === "Completed" || workflow === "Cancelled") return "completed";

  const start = new Date(event?.schedule?.startDate || 0).getTime();
  const end = new Date(event?.schedule?.endDate || event?.schedule?.startDate || 0).getTime();
  const now = Date.now();

  if (Number.isFinite(end) && now > end) return "completed";
  if (Number.isFinite(start) && now >= start && now <= end) return "current";
  return "upcoming";
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
};

export default function CoordinatorDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [assignedEvents, setAssignedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssignedEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api({ ...SummaryApi.get_public_events });
      const events = extractEventList(response.data);

      const coordinatorId = normalizeId(user?._id);
      const coordinatorEmail = normalizeEmail(user?.email);

      const assigned = events
        .filter((event) => {
          const coordinators = Array.isArray(event?.studentCoordinators) ? event.studentCoordinators : [];
          return coordinators.some(
            (item) =>
              normalizeId(item?.coordinatorId) === coordinatorId ||
              normalizeEmail(item?.email) === coordinatorEmail
          );
        })
        .map((event) => ({
          ...event,
          derivedStatus: deriveStatus(event),
        }))
        .sort((a, b) => new Date(a?.schedule?.startDate || 0) - new Date(b?.schedule?.startDate || 0));

      setAssignedEvents(assigned);
    } catch (fetchError) {
      setAssignedEvents([]);
      setError(fetchError.response?.data?.message || "Unable to load coordinator dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedEvents();
  }, [user?._id]);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };

  const metrics = useMemo(() => {
    const eventsAssigned = assignedEvents.length;
    const studentsCapacity = assignedEvents.reduce(
      (sum, event) => sum + Number(event?.registration?.maxParticipants || 0),
      0
    );
    const openRegistrations = assignedEvents.filter(
      (event) => Boolean(event?.registration?.isOpen) && String(event?.status || "") === "Published"
    ).length;
    const liveNow = assignedEvents.filter((event) => event.derivedStatus === "current").length;

    return {
      eventsAssigned,
      studentsCapacity,
      openRegistrations,
      liveNow,
    };
  }, [assignedEvents]);

  const tasks = useMemo(() => {
    return assignedEvents.slice(0, 3).map((event) => ({
      id: normalizeId(event?._id),
      title: `Coordinate: ${event?.title || "Untitled Event"}`,
      status: event?.registration?.isOpen ? "Registration Open" : "Registration Closed",
      due: `Starts ${formatDate(event?.schedule?.startDate)}`,
    }));
  }, [assignedEvents]);

  const mostRecent = useMemo(() => {
    if (!assignedEvents.length) return null;
    return [...assignedEvents].sort(
      (a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0)
    )[0];
  }, [assignedEvents]);

  return (
    <div className="eventmate-page min-h-screen bg-gray-50 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <Sparkles size={13} />
                Coordinator Workspace
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Coordinator Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Backend-synced view of events assigned to your coordinator account.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchAssignedEvents}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                Refresh
              </button>
              <button
                type="button"
                onClick={() => navigate("/coordinator-dashboard/contact-admin")}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <MessageSquareMore size={15} />
                Contact Admin
              </button>
              <button
                type="button"
                onClick={() => navigate("/coordinator-dashboard/profile")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              >
                Profile
              </button>
              <button
                type="button"
                onClick={() => navigate("/coordinator-dashboard/registrations")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <Users2 size={15} />
                Registrations
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/15"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Signed in as <span className="font-semibold text-slate-900 dark:text-white">{user?.fullName || "Coordinator"}</span>
            {" "}({user?.email || "coordinator@eventmate.com"})
          </div>
        </section>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">Events Assigned</p>
              <CalendarCheck2 size={16} className="text-indigo-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.eventsAssigned}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">Capacity Scope</p>
              <Users2 size={16} className="text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.studentsCapacity}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">Open Registrations</p>
              <Clock3 size={16} className="text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.openRegistrations}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">Live Events</p>
              <ShieldCheck size={16} className="text-cyan-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.liveNow}</p>
          </article>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Priority Task Queue</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Upcoming coordinator actions derived from assigned event schedules.
            </p>
            <div className="mt-4 space-y-3">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <article
                    key={task.id}
                    className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/80 dark:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{task.title}</p>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                        {task.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{task.due}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-300">No assigned events found for this coordinator account.</p>
              )}
            </div>
          </section>

          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Coordination Insights</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/80 dark:bg-white/5">
                <p className="font-semibold text-slate-900 dark:text-white">Most recently updated event</p>
                <p className="text-slate-500 dark:text-slate-300 mt-1">{mostRecent?.title || "N/A"}</p>
              </div>
              <div className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/80 dark:bg-white/5">
                <p className="font-semibold text-slate-900 dark:text-white">Next schedule checkpoint</p>
                <p className="text-slate-500 dark:text-slate-300 mt-1">{formatDateTime(mostRecent?.schedule?.startDate)}</p>
              </div>
              <div className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/80 dark:bg-white/5">
                <p className="font-semibold text-slate-900 dark:text-white">Escalation channel</p>
                <p className="text-slate-500 dark:text-slate-300 mt-1">Use Contact Admin for approvals and blockers.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
