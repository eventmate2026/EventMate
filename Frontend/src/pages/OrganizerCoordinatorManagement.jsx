import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, Loader2, Plus, Users } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser } from "../lib/auth";
import { useToast } from "../context/ToastContext";
import { extractCreatedUser, extractEventList } from "../lib/backendAdapters";
import { getSafeApiErrorText } from "../lib/safeMessage";
import { resolveUserDepartment } from "../lib/userDepartment";

const formDefaults = {
  fullName: "",
  email: "",
  password: "",
  assignEventId: "",
};

const assignDefaults = {
  eventId: "",
  coordinatorId: "",
};

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const sortByRecent = (events) =>
  [...events].sort(
    (a, b) =>
      new Date(b?.updatedAt || b?.createdAt || 0).getTime() -
      new Date(a?.updatedAt || a?.createdAt || 0).getTime()
  );

const upsertCoordinator = (list, payload) => {
  const coordinatorId = normalizeId(payload?.coordinatorId || payload?._id || payload?.id);
  const email = normalizeEmail(payload?.email);
  const fullName = String(payload?.fullName || payload?.name || "Coordinator").trim() || "Coordinator";
  const department = resolveUserDepartment(payload);
  const key = coordinatorId || email;
  if (!key) return list;

  const next = [...list];
  const index = next.findIndex((item) => item.key === key);
  const normalized = {
    key,
    coordinatorId,
    fullName,
    email: email || "N/A",
    department,
  };

  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...normalized,
    };
    return next;
  }

  next.push(normalized);
  return next;
};

const buildCoordinatorCatalog = (events, createdCoordinators) => {
  const map = new Map();

  createdCoordinators.forEach((coordinator) => {
    const key = normalizeId(coordinator?.coordinatorId) || normalizeEmail(coordinator?.email);
    if (!key) return;
    const department = resolveUserDepartment(coordinator);
    map.set(key, {
      key,
      coordinatorId: normalizeId(coordinator?.coordinatorId),
      fullName: String(coordinator?.fullName || "Coordinator").trim() || "Coordinator",
      email: normalizeEmail(coordinator?.email) || "N/A",
      department,
    });
  });

  events.forEach((event) => {
    const coordinators = Array.isArray(event?.studentCoordinators) ? event.studentCoordinators : [];
    coordinators.forEach((item) => {
      const key = normalizeId(item?.coordinatorId) || normalizeEmail(item?.email);
      if (!key) return;
      const department = resolveUserDepartment(item);
      map.set(key, {
        key,
        coordinatorId: normalizeId(item?.coordinatorId),
        fullName: String(item?.name || "Coordinator").trim() || "Coordinator",
        email: normalizeEmail(item?.email) || "N/A",
        department,
      });
    });
  });

  return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
};

export default function OrganizerCoordinatorManagement() {
  const navigate = useNavigate();
  const toast = useToast();
  const user = getStoredUser();

  const [form, setForm] = useState(formDefaults);
  const [assignForm, setAssignForm] = useState(assignDefaults);

  const [myEvents, setMyEvents] = useState([]);
  const [createdCoordinators, setCreatedCoordinators] = useState([]);

  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [listWarning, setListWarning] = useState(null);

  const coordinatorCatalog = useMemo(
    () => buildCoordinatorCatalog(myEvents, createdCoordinators),
    [myEvents, createdCoordinators]
  );

  const assignableCoordinators = useMemo(
    () => coordinatorCatalog.filter((item) => normalizeId(item?.coordinatorId)),
    [coordinatorCatalog]
  );

  const eventsById = useMemo(
    () => new Map(myEvents.map((event) => [normalizeId(event?._id), event])),
    [myEvents]
  );

  const refreshWorkspace = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingWorkspace(true);
    }
    setListWarning(null);

    try {
      const response = await api({ ...SummaryApi.get_my_events, cacheTTL: 90000 });
      const events = sortByRecent(extractEventList(response.data));
      setMyEvents(events);

      if (!events.length) {
        setListWarning("No events found for this organizer account. Create an event first.");
      }
    } catch (error) {
      setMyEvents([]);
      setListWarning(error.response?.data?.message || "Unable to load organizer events.");
    } finally {
      setLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    refreshWorkspace();
  }, [user?._id]);

  useEffect(() => {
    const firstEventId = normalizeId(myEvents[0]?._id);
    if (!firstEventId) return;

    setForm((prev) => (prev.assignEventId ? prev : { ...prev, assignEventId: firstEventId }));
    setAssignForm((prev) => (prev.eventId ? prev : { ...prev, eventId: firstEventId }));
  }, [myEvents]);

  const handleCreateCoordinator = async (event) => {
    event.preventDefault();

    const fullName = String(form.fullName || "").trim();
    const email = normalizeEmail(form.email);
    const password = String(form.password || "");
    const assignEventId = normalizeId(form.assignEventId);

    if (!fullName || !email || password.length < 8) {
      toast.error("Name, email and password (min 8 chars) are required.");
      return;
    }

    setCreating(true);
    try {
      const response = await api({
        ...SummaryApi.create_event_coordinator,
        data: { fullName, email, password },
      });

      const created = extractCreatedUser(response.data) || response.data?.data || null;
      const createdCoordinatorId = normalizeId(created?._id);

      if (createdCoordinatorId || created?.email) {
        setCreatedCoordinators((prev) =>
          upsertCoordinator(prev, {
            coordinatorId: createdCoordinatorId,
            fullName: created?.fullName || fullName,
            email: created?.email || email,
            department: resolveUserDepartment(created),
          })
        );
      }

      let assignmentMessage = "";
      if (assignEventId) {
        if (!createdCoordinatorId) {
          throw new Error("Coordinator created, but assignment failed because coordinator id was missing in response.");
        }

        await api({
          ...SummaryApi.assign_coordinator_to_event,
          url: SummaryApi.assign_coordinator_to_event.url.replace(":eventId", assignEventId),
          data: { coordinatorId: createdCoordinatorId },
        });

        const eventTitle = eventsById.get(assignEventId)?.title || "selected event";
        assignmentMessage = ` Assigned to ${eventTitle}.`;
      }

      toast.success(
        `${response.data?.message || "Coordinator created successfully."}${assignmentMessage} Verification OTP sent to the coordinator email.`
      );

      const nextEmail = created?.email || email;
      if (nextEmail) {
        setTimeout(() => {
          navigate("/verify-email", { state: { email: nextEmail } });
        }, 400);
      }

      setForm((prev) => ({
        ...formDefaults,
        assignEventId: prev.assignEventId,
      }));

      await refreshWorkspace({ silent: true });
    } catch (error) {
      toast.error(getSafeApiErrorText(error, "Unable to create coordinator."));
    } finally {
      setCreating(false);
    }
  };

  const handleAssignCoordinator = async (event) => {
    event.preventDefault();

    const eventId = normalizeId(assignForm.eventId);
    const coordinatorId = normalizeId(assignForm.coordinatorId);

    if (!eventId || !coordinatorId) {
      toast.error("Select both event and coordinator to assign.");
      return;
    }

    setAssigning(true);
    try {
      const response = await api({
        ...SummaryApi.assign_coordinator_to_event,
        url: SummaryApi.assign_coordinator_to_event.url.replace(":eventId", eventId),
        data: { coordinatorId },
      });

      const eventTitle = eventsById.get(eventId)?.title || "event";
      toast.success(`${response.data?.message || "Coordinator assigned successfully."} (${eventTitle})`);

      await refreshWorkspace({ silent: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to assign coordinator.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Coordinator Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Create coordinator accounts and assign them to your events using current backend routes.
          </p>
        </section>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Coordinator</h2>
          <form onSubmit={handleCreateCoordinator} className="mt-4 grid gap-3 sm:grid-cols-2">
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
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
            />
            <select
              value={form.assignEventId}
              onChange={(event) => setForm((prev) => ({ ...prev, assignEventId: event.target.value }))}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              disabled={myEvents.length === 0}
            >
              <option value="">Create only (no assignment)</option>
              {myEvents.map((item) => (
                <option key={normalizeId(item?._id)} value={normalizeId(item?._id)}>
                  {item?.title || "Untitled Event"} ({item?.status || "Draft"})
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={creating}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {creating ? "Creating..." : "Create Coordinator"}
            </button>
          </form>
        </section>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
            <Link2 size={16} />
            Assign Existing Coordinator
          </h2>
          <form onSubmit={handleAssignCoordinator} className="mt-4 grid gap-3 sm:grid-cols-2">
            <select
              value={assignForm.eventId}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, eventId: event.target.value }))}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              disabled={myEvents.length === 0}
            >
              <option value="">Select event</option>
              {myEvents.map((item) => (
                <option key={normalizeId(item?._id)} value={normalizeId(item?._id)}>
                  {item?.title || "Untitled Event"} ({item?.status || "Draft"})
                </option>
              ))}
            </select>

            <select
              value={assignForm.coordinatorId}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, coordinatorId: event.target.value }))}
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              disabled={assignableCoordinators.length === 0}
            >
              <option value="">Select coordinator</option>
              {assignableCoordinators.map((item) => (
                <option key={item.key} value={item.coordinatorId}>
                  {item.fullName} ({item.email}){item.department ? ` • ${item.department}` : ""}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={assigning || myEvents.length === 0 || assignableCoordinators.length === 0}
              className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-70"
            >
              {assigning ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
              {assigning ? "Assigning..." : "Assign Coordinator"}
            </button>
          </form>
        </section>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white inline-flex items-center gap-2">
            <Users size={16} />
            Coordinators In My Events
          </h2>

          {loadingWorkspace ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Loading events...
            </p>
          ) : myEvents.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">No events available yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {myEvents.map((event) => {
                const eventId = normalizeId(event?._id);
                const coordinators = Array.isArray(event?.studentCoordinators) ? event.studentCoordinators : [];

                return (
                  <article
                    key={eventId}
                    className="rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/80 dark:bg-white/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{event?.title || "Untitled Event"}</p>
                      <span className="rounded-full bg-slate-200 dark:bg-slate-600/40 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {event?.status || "Draft"}
                      </span>
                    </div>

                    {coordinators.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No coordinator assigned yet.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {coordinators.map((item, index) => (
                          <div
                            key={`${eventId}-${normalizeId(item?.coordinatorId) || normalizeEmail(item?.email) || index}`}
                            className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2"
                          >
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item?.name || "Coordinator"}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">{item?.email || "Email not available"}</p>
                            {item?.department ? (
                              <p className="text-xs text-slate-500 dark:text-slate-300">{item.department}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {listWarning && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
              {listWarning}
            </p>
          )}

          {!listWarning && myEvents.length > 0 && coordinatorCatalog.length === 0 && !loadingWorkspace && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
              No coordinators are currently linked to your events.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
