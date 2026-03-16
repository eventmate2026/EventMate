import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventItem } from "../lib/backendAdapters";
import { formatEventDate, mapApiEventToDetails } from "../data/studentEventApiData";

export default function PublicEventDetails() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api({
          ...SummaryApi.get_public_event_details,
          url: SummaryApi.get_public_event_details.url.replace(":eventId", encodeURIComponent(eventId || "")),
          skipAuth: true,
          cacheTTL: 90000,
        });
        const eventDoc = extractEventItem(response.data);
        const mapped = mapApiEventToDetails(eventDoc);
        if (!mapped) throw new Error("Event not found.");
        if (mounted) setEvent(mapped);
      } catch (err) {
        if (mounted) {
          setError(err?.response?.data?.message || "Unable to load event details.");
          setEvent(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [eventId]);

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 px-4 py-8 dark:bg-gray-900 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
          aria-label="Go back"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200/80 bg-white/90 p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-gray-900/70 dark:text-slate-300">
            Loading event details...
          </section>
        )}

        {error && !loading && (
          <section className="eventmate-panel rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </section>
        )}

        {!loading && !error && event && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="eventmate-panel overflow-hidden rounded-3xl">
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-800 shadow-sm">
                  {event.type}
                </span>
                <span className="absolute right-4 top-4 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
                  {event.isFree ? "Free" : `Rs ${event.price}`}
                </span>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">{event.title}</h1>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {event.description}
                  </p>
                </div>

                <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-indigo-500" />
                    {formatEventDate(event.startDate)} | {event.time}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-indigo-500" />
                    {event.venue}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-indigo-500" />
                    {event.audience}
                  </div>
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={16} className="text-indigo-500" />
                    {event.eventStatus}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Register
                  </button>
                  <Link
                    to="/"
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-200"
                  >
                    Back to Home
                  </Link>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="eventmate-panel rounded-2xl p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">About this event</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {event.longDescription}
                </p>
              </section>

              <section className="eventmate-panel rounded-2xl p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Organizer</h2>
                <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{event.organizerName}</p>
                  <p>{event.organizerDepartment}</p>
                </div>
              </section>

              <section className="eventmate-panel rounded-2xl p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Contact</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-indigo-500" />
                    {event.contact?.email || "support@eventmate.com"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-indigo-500" />
                    {event.contact?.phone || "Not available"}
                  </div>
                </div>
              </section>

              <section className="eventmate-panel rounded-2xl p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Requirements</h2>
                <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {(event.requirements || []).slice(0, 4).map((item) => (
                    <li key={item.title} className="rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.title}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-200">{item.description}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
