import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, Users } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser } from "../lib/auth";
import { extractEventList } from "../lib/backendAdapters";

const formDefaults = {
  fullName: "",
  email: "",
  password: "",
};

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export default function OrganizerCoordinatorManagement() {
  const user = getStoredUser();
  const userId = normalizeId(user?._id);

  const [form, setForm] = useState(formDefaults);
  const [creating, setCreating] = useState(false);
  const [coordinators, setCoordinators] = useState([]);
  const [loadingCoordinators, setLoadingCoordinators] = useState(true);
  const [listWarning, setListWarning] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchCoordinators = async () => {
    setLoadingCoordinators(true);
    setListWarning(null);

    try {
      const response = await api({ ...SummaryApi.get_public_events });
      const events = extractEventList(response.data);
      const myPublishedEvents = events.filter((event) => normalizeId(event?.organizer?.organizerId) === userId);

      const unique = new Map();
      myPublishedEvents.forEach((event) => {
        const eventTitle = event?.title || "Untitled Event";
        const eventId = normalizeId(event?._id);
        const rows = Array.isArray(event?.studentCoordinators) ? event.studentCoordinators : [];
        rows.forEach((item) => {
          const coordinatorEmail = normalizeEmail(item?.email);
          const coordinatorId = normalizeId(item?.coordinatorId);
          const name = String(item?.name || "Coordinator").trim();
          const key = `${coordinatorId || coordinatorEmail || name}-${eventId}`;
          if (!key.trim()) return;
          if (!unique.has(key)) {
            unique.set(key, {
              key,
              coordinatorId,
              fullName: name || "Coordinator",
              email: coordinatorEmail || "N/A",
              eventTitle,
            });
          }
        });
      });

      const next = Array.from(unique.values());
      setCoordinators(next);

      if (!myPublishedEvents.length) {
        setListWarning("No published events found for this organizer account.");
      } else if (!next.length) {
        setListWarning("No student coordinators are attached to your published events yet.");
      }
    } catch (error) {
      setCoordinators([]);
      setListWarning(error.response?.data?.message || "Unable to load coordinators from backend event data.");
    } finally {
      setLoadingCoordinators(false);
    }
  };

  useEffect(() => {
    fetchCoordinators();
  }, [userId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage(null);

    const fullName = form.fullName.trim();
    const email = normalizeEmail(form.email);
    const password = String(form.password || "");

    if (!fullName || !email || password.length < 8) {
      setMessage({ type: "error", text: "Name, email and password (min 8 chars) are required." });
      return;
    }

    setCreating(true);
    try {
      const response = await api({
        ...SummaryApi.create_event_coordinator,
        data: { fullName, email, password },
      });

      setForm(formDefaults);
      setMessage({
        type: "success",
        text: `${response.data?.message || "Coordinator created successfully."} Attach coordinator details while creating events.`,
      });
      await fetchCoordinators();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to create coordinator.",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Coordinator Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Create coordinator accounts and view coordinators attached to your published events.
          </p>
        </section>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200 inline-flex items-start gap-2 w-full">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Backend does not expose organizer-wide coordinator account listing. This view shows coordinators attached in your published events.
        </div>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Coordinator</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              placeholder="Full name"
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Email"
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Password (min 8 chars)"
              className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />

            <button
              type="submit"
              disabled={creating}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {creating ? "Creating..." : "Create Coordinator"}
            </button>
          </form>

          {message && (
            <p
              className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
              }`}
            >
              {message.text}
            </p>
          )}
        </section>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
            <Users size={16} />
            Coordinators In My Events
          </h2>

          {loadingCoordinators ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Loading coordinators...
            </p>
          ) : coordinators.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">No coordinators available in published event records.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {coordinators.map((item) => (
                <article
                  key={item.key}
                  className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 bg-slate-50/80 dark:bg-white/5"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.fullName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.email}</p>
                  <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">Event: {item.eventTitle}</p>
                </article>
              ))}
            </div>
          )}

          {listWarning && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
              {listWarning}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
