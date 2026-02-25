import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Award, CalendarDays, CheckCircle2, Clock3, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventList } from "../lib/backendAdapters";

const deriveCompleted = (event) => {
  const status = String(event?.status || "");
  if (status === "Completed") return true;

  const endDate = new Date(event?.schedule?.endDate || event?.schedule?.startDate || 0).getTime();
  if (Number.isNaN(endDate)) return false;
  return Date.now() > endDate;
};

export default function MyCertificates() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completedEvents, setCompletedEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api({ ...SummaryApi.get_public_events });
        const events = extractEventList(response.data);
        setCompletedEvents(events.filter(deriveCompleted));
      } catch (fetchError) {
        setCompletedEvents([]);
        setError(fetchError.response?.data?.message || "Unable to load event context.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const stats = useMemo(() => {
    const latest = completedEvents[0]?.schedule?.endDate || completedEvents[0]?.schedule?.startDate || null;
    return {
      totalCertificates: 0,
      completedEventCount: completedEvents.length,
      latest,
    };
  }, [completedEvents]);

  return (
    <div className="eventmate-page min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-6 space-y-6">
        <section className="eventmate-panel rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Link
                to="/student-dashboard"
                className="mt-1 rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10 transition"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">My Certificates</h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Certificate APIs are not available in this backend build.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              <Award size={13} />
              Certificate Vault
            </span>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <article className="eventmate-kpi rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-300">My Certificates</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCertificates}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-300">Completed Events (Global)</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{stats.completedEventCount}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-300">Latest Completed Event</p>
            <p className="mt-2 text-base font-bold text-gray-900 dark:text-white">
              {stats.latest ? new Date(stats.latest).toLocaleDateString() : "N/A"}
            </p>
          </article>
        </section>

        <section className="eventmate-panel rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 p-5">
          <div className="inline-flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold text-sm">
            <CheckCircle2 size={15} />
            Backend Limitation
          </div>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-200">
            Certificate issuance and student-specific certificate listing endpoints are not present in the current backend.
          </p>
        </section>

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-sm text-gray-600 dark:text-gray-300 inline-flex items-center gap-2">
            <Clock3 size={14} />
            Loading backend event context...
          </section>
        )}

        {error && !loading && (
          <section className="eventmate-panel rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/15 p-6 text-sm text-red-700 dark:text-red-300">
            {error}
          </section>
        )}

        {!loading && !error && completedEvents.length > 0 && (
          <section className="eventmate-panel rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Completed Events Snapshot</h2>
            <div className="mt-4 space-y-3">
              {completedEvents.slice(0, 5).map((event) => (
                <article key={event._id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-white/5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{event.title || "Untitled Event"}</p>
                  <div className="mt-2 grid sm:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <p className="inline-flex items-center gap-1"><CalendarDays size={12} /> {event?.schedule?.startDate ? new Date(event.schedule.startDate).toLocaleDateString() : "N/A"}</p>
                    <p className="inline-flex items-center gap-1"><MapPin size={12} /> {event?.venue?.location || "N/A"}</p>
                    <p className="inline-flex items-center gap-1"><Award size={12} /> Status: {event?.status || "Published"}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
