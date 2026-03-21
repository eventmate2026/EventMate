import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import AvatarWithFrame from "../components/AvatarWithFrame";
import { extractCreatedUser, extractUsersList, filterUsersByRole } from "../lib/backendAdapters";
import { resolveUserDepartment } from "../lib/userDepartment";
import { useToastFeedback } from "../hooks/useToastFeedback";

const EMPTY_FORM = {
  fullName: "",
  email: "",
  password: "",
  mobileNumber: "",
  department: "",
};

const DEPARTMENT_OPTIONS = ["COMPUTER", "CIVIL", "MECHANICAL", "ELECTRICAL", "ELECTRONICS", "MINING"];

const normalizeDepartment = (value) => {
  const next = String(value || "").trim();
  if (!next) return "";
  const upper = next.toUpperCase();
  if (DEPARTMENT_OPTIONS.includes(upper)) return upper;
  if (upper.includes("COMPUTER")) return "COMPUTER";
  if (upper.includes("CIVIL")) return "CIVIL";
  if (upper.includes("MECHANICAL")) return "MECHANICAL";
  if (upper.includes("ELECTRICAL") || upper.includes("EEE")) return "ELECTRICAL";
  if (upper.includes("MINING")) return "MINING";
  return "";
};

const getInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const toEventCountMap = (payload) => {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const next = {};
  rows.forEach((row) => {
    const organizerId = String(row?.organizerId || row?._id || "").trim();
    if (!organizerId) return;
    next[organizerId] = Number(row?.totalEvents) || 0;
  });
  return next;
};

export default function AdminOrganizerManagement() {
  const [organizers, setOrganizers] = useState([]);
  const [eventCounts, setEventCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingId, setPendingId] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingOrganizerId, setEditingOrganizerId] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  useToastFeedback(message);
  useToastFeedback(error, { defaultType: "error" });
  useToastFeedback(formError, { defaultType: "error" });

  const fetchOrganizersWorkspace = async () => {
    setLoading(true);
    setError(null);

    try {
      const [organizersResult, countsResult] = await Promise.allSettled([
        api({ ...SummaryApi.get_organizers, cacheTTL: 90000 }),
        api({ ...SummaryApi.get_organizer_event_counts, cacheTTL: 90000 }),
      ]);

      if (organizersResult.status !== "fulfilled") {
        throw organizersResult.reason;
      }

      const users = extractUsersList(organizersResult.value.data);
      setOrganizers(filterUsersByRole(users, "ORGANIZER"));

      if (countsResult.status === "fulfilled") {
        setEventCounts(toEventCountMap(countsResult.value.data));
      } else {
        setEventCounts({});
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load organizers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizersWorkspace();
  }, []);

  const filteredOrganizers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return organizers;

    return organizers.filter((organizer) => {
      const department = resolveUserDepartment(organizer);
      return [
        organizer?.fullName,
        organizer?.email,
        organizer?.mobileNumber,
        department,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(term));
    });
  }, [organizers, searchTerm]);

  const metrics = useMemo(() => {
    const total = organizers.length;
    const active = organizers.filter((item) => item.isActive).length;
    const deactivated = total - active;
    return { total, active, deactivated };
  }, [organizers]);

  const openCreateForm = () => {
    setFormMode("create");
    setEditingOrganizerId(null);
    setFormValues(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (organizer) => {
    setFormMode("edit");
    setEditingOrganizerId(organizer._id);
    setFormValues({
      fullName: organizer.fullName || "",
      email: organizer.email || "",
      password: "",
      mobileNumber: organizer.mobileNumber || "",
      department: normalizeDepartment(organizer?.professionalProfile?.department),
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setIsFormOpen(false);
    setFormError(null);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const upsertOrganizer = (nextOrganizer) => {
    setOrganizers((prev) => {
      const idx = prev.findIndex((item) => item._id === nextOrganizer._id);
      if (idx === -1) return [nextOrganizer, ...prev];
      const copy = [...prev];
      copy[idx] = nextOrganizer;
      return copy;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    setMessage(null);

    const fullName = formValues.fullName.trim();
    const email = formValues.email.trim().toLowerCase();
    const department = normalizeDepartment(formValues.department);

    if (fullName.length < 3) {
      setFormError("Full name must be at least 3 characters.");
      return;
    }

    if (!email) {
      setFormError("Email is required.");
      return;
    }

    if (formMode === "create" && String(formValues.password || "").length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (formMode === "create") {
        const response = await api({
          ...SummaryApi.create_organizer,
          data: {
            fullName,
            email,
            password: formValues.password,
            ...(department ? { professionalProfile: { department } } : {}),
          },
        });

        const created = extractCreatedUser(response.data);
        if (created?._id) {
          upsertOrganizer({ ...created, isActive: true, emailVerified: true });
          setEventCounts((prev) => ({ ...prev, [created._id]: 0 }));
        } else {
          await fetchOrganizersWorkspace();
        }
      } else {
        const response = await api({
          ...SummaryApi.update_organizer,
          url: SummaryApi.update_organizer.url.replace(":id", editingOrganizerId),
          data: {
            fullName,
            email,
            mobileNumber: formValues.mobileNumber.trim() || undefined,
            professionalProfile: {
              department: department || undefined,
            },
          },
        });

        if (response.data?.user?._id) {
          upsertOrganizer(response.data.user);
        } else {
          await fetchOrganizersWorkspace();
        }
      }

      setMessage({
        type: "success",
        text: formMode === "create" ? "Organizer created successfully." : "Organizer updated successfully.",
      });
      setIsFormOpen(false);
    } catch (err) {
      setFormError(err.response?.data?.message || "Unable to save organizer.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOrganizerStatus = async (organizer) => {
    setMessage(null);
    setPendingId(organizer._id);
    try {
      const response = await api({
        ...SummaryApi.update_organizer,
        url: SummaryApi.update_organizer.url.replace(":id", organizer._id),
        data: { isActive: !organizer.isActive },
      });

      if (response.data?.user?._id) {
        upsertOrganizer(response.data.user);
      } else {
        await fetchOrganizersWorkspace();
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Unable to update organizer status.",
      });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/85 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Organizer Management</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Manage university event organizers, account status, and permissions.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="organizerSearch"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search organizers..."
                  className="w-full sm:w-60 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 pl-9 pr-3 text-sm text-slate-700 dark:text-slate-100"
                />
              </label>
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <Plus size={15} />
                Create Organizer
              </button>
            </div>
          </div>

          {loading && (
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 size={15} className="animate-spin" />
              Loading organizers...
            </p>
          )}
          {error && !loading && <p className="mt-6 text-sm text-red-600 dark:text-red-300">{error}</p>}

          {!loading && !error && (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-white/5">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    <th className="px-4 py-3">Name & Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Total Events</th>
                    <th className="px-4 py-3">Force Deactivate</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10 bg-white dark:bg-gray-900/40">
                  {filteredOrganizers.map((organizer) => {
                    const isPending = pendingId === organizer._id;
                    const isInactive = !organizer.isActive;
                    const totalEvents = Number(eventCounts[organizer._id] || 0);
                    const department = resolveUserDepartment(organizer);

                    return (
                      <tr key={organizer._id}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <AvatarWithFrame
                              src={organizer.avatar || ""}
                              alt={organizer.fullName || "Organizer"}
                              className="h-9 w-9 shrink-0"
                              coreClassName="h-full w-full rounded-full border border-slate-200 dark:border-white/10 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200 text-xs font-semibold flex items-center justify-center"
                              fallback={<span>{getInitials(organizer.fullName)}</span>}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-white">{organizer.fullName}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{organizer.email}</p>
                              {department ? (
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{department}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              organizer.isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {organizer.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-100">
                          {totalEvents} {totalEvents === 1 ? "Event" : "Events"}
                        </td>

                        <td className="px-4 py-4">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isInactive}
                              disabled={isPending}
                              onClick={() => toggleOrganizerStatus(organizer)}
                              aria-label={isInactive ? `Activate ${organizer.fullName}` : `Deactivate ${organizer.fullName}`}
                              title={isInactive ? "Force Deactivate: ON" : "Force Deactivate: OFF"}
                              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${
                                isInactive
                                  ? "border-rose-400/80 bg-rose-500"
                                  : "border-slate-300/80 bg-slate-200/90 dark:border-slate-500/80 dark:bg-slate-700/85"
                              } ${isPending ? "opacity-60" : "hover:brightness-105"}`}
                            >
                              <span
                                className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.28)] transition-all duration-200"
                                style={{
                                  left: isInactive ? "calc(100% - 1.35rem)" : "0.1rem",
                                }}
                              />
                            </button>
                            <span className={`text-[11px] font-semibold uppercase tracking-wide ${
                              isInactive ? "text-rose-400" : "text-slate-500 dark:text-slate-400"
                            }`}>
                              {isInactive ? "On" : "Off"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-300">
                            <button
                              type="button"
                              onClick={() => openEditForm(organizer)}
                              disabled={isPending}
                              className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                              aria-label={`Edit ${organizer.fullName}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleOrganizerStatus(organizer)}
                              disabled={isPending}
                              className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                              aria-label={isInactive ? `Reactivate ${organizer.fullName}` : `Deactivate ${organizer.fullName}`}
                            >
                              <RefreshCcw size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredOrganizers.length === 0 && (
                <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300">
                  No organizers found for the current search.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                <Users size={18} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total Organizers</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.total}</p>
              </div>
            </div>
          </article>

          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                <UserCheck size={18} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Active Accounts</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.active}</p>
              </div>
            </div>
          </article>

          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                <UserX size={18} />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Deactivated</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{metrics.deactivated}</p>
              </div>
            </div>
          </article>
        </section>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-gray-900 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {formMode === "create" ? "Create Organizer" : "Edit Organizer"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  {formMode === "create"
                    ? "Provide organizer credentials to create account."
                    : "Update organizer profile details."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 disabled:opacity-60"
                aria-label="Close form"
              >
                <X size={16} />
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Full Name</span>
                  <input
                    type="text"
                    name="fullName"
                    value={formValues.fullName}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Email</span>
                  <input
                    type="email"
                    name="email"
                    value={formValues.email}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
                    required
                  />
                </label>
              </div>

              {formMode === "create" && (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Password</span>
                  <input
                    type="password"
                    name="password"
                    value={formValues.password}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
                    minLength={8}
                    required
                  />
                </label>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {formMode === "edit" && (
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mobile Number</span>
                    <input
                      type="text"
                      name="mobileNumber"
                      value={formValues.mobileNumber}
                      onChange={handleFormChange}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Department</span>
                  <select
                    name="department"
                    value={formValues.department}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  >
                    <option value="">Select department</option>
                    {DEPARTMENT_OPTIONS.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {formError && (
                <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/15 dark:text-red-300">
                  <AlertCircle size={15} className="mt-0.5" />
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {formMode === "create" ? "Create Organizer" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
