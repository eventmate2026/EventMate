import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, MapPin, Users2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser } from "../lib/auth";
import { extractEventList } from "../lib/backendAdapters";

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const formatDate = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
};

export default function CoordinatorRegistrations() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAssignedEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api({ ...SummaryApi.get_public_events });
      const rows = extractEventList(response.data);

      const coordinatorId = normalizeId(user?._id);
      const coordinatorEmail = normalizeEmail(user?.email);

      const assigned = rows
        .filter((event) => {
          const coordinators = Array.isArray(event?.studentCoordinators) ? event.studentCoordinators : [];
          return coordinators.some(
            (item) =>
              normalizeId(item?.coordinatorId) === coordinatorId ||
              normalizeEmail(item?.email) === coordinatorEmail
          );
        })
        .sort((a, b) => new Date(a?.schedule?.startDate || 0) - new Date(b?.schedule?.startDate || 0));

      setEvents(assigned);
    } catch (fetchError) {
      setEvents([]);
      setError(fetchError.response?.data?.message || "Unable to load assigned events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedEvents();
  }, [user?._id]);

  const totals = useMemo(() => {
    const totalEvents = events.length;
    const openRegistrations = events.filter(
      (event) => Boolean(event?.registration?.isOpen) && String(event?.status || "") === "Published"
    ).length;
    const totalCapacity = events.reduce((sum, event) => sum + Number(event?.registration?.maxParticipants || 0), 0);

    return { totalEvents, openRegistrations, totalCapacity };
  }, [events]);

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Event Registrations</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Events assigned to your coordinator account from backend records.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/coordinator-dashboard")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <ArrowLeft size={14} />
              Dashboard
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200 inline-flex items-start gap-2 w-full">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Detailed student registration list is not exposed by current backend routes. This page shows assigned event registration windows only.
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-300">Assigned Events</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totals.totalEvents}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-300">Open Registration</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totals.openRegistrations}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-300">Capacity Scope</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totals.totalCapacity}</p>
          </article>
        </section>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Loading assigned events...
            </p>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">No events are currently assigned to this coordinator account.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const isOpen = Boolean(event?.registration?.isOpen) && String(event?.status || "") === "Published";
                return (
                  <article key={normalizeId(event?._id)} className="rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/80 dark:bg-white/5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{event?.title || "Untitled Event"}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(event?.schedule?.startDate)} to {formatDate(event?.schedule?.endDate)}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${isOpen ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200"}`}>
                        {isOpen ? "Open" : "Closed"}
                      </span>
                    </div>

                    <div className="mt-3 grid sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <p className="inline-flex items-center gap-2">
                        <MapPin size={13} className="text-indigo-500" />
                        {event?.venue?.location || "Venue N/A"}
                      </p>
                      <p className="inline-flex items-center gap-2">
                        <Users2 size={13} className="text-indigo-500" />
                        Max participants: {Number(event?.registration?.maxParticipants || 0)}
                      </p>
                      <p>Fee: {Number(event?.registration?.fee || 0) > 0 ? `Rs ${Number(event.registration.fee)}` : "Free"}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
