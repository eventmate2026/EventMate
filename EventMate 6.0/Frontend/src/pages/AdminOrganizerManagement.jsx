import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import AvatarWithFrame from "../components/AvatarWithFrame";
import { extractCreatedUser, extractUsersList, filterUsersByRole } from "../lib/backendAdapters";

const EMPTY_FORM = {
  fullName: "",
  email: "",
  password: "",
  mobileNumber: "",
  department: "",
};

const getInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function AdminOrganizerManagement() {
  const [organizers, setOrganizers] = useState([]);
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

  const fetchOrganizers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api({ ...SummaryApi.get_organizers });
      const users = extractUsersList(response.data);
      setOrganizers(filterUsersByRole(users, "ORGANIZER"));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load organizers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizers();
  }, []);

  const filteredOrganizers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return organizers;

    return organizers.filter((organizer) => {
      return (
        organizer.fullName?.toLowerCase().includes(term) ||
        organizer.email?.toLowerCase().includes(term) ||
        String(organizer.mobileNumber || "").toLowerCase().includes(term)
      );
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
      department: organizer?.professionalProfile?.department || "",
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
          },
        });

        const created = extractCreatedUser(response.data);
        if (created?._id) {
          upsertOrganizer({ ...created, isActive: true, emailVerified: true });
        } else {
          await fetchOrganizers();
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
              department: formValues.department.trim() || undefined,
            },
          },
        });

        if (response.data?.user?._id) {
          upsertOrganizer(response.data.user);
        } else {
          await fetchOrganizers();
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
        await fetchOrganizers();
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Unable to update organizer status." });
    } finally {
      setPendingId(null);
    }
  };

  const handleDeleteOrganizer = async (organizer) => {
    const shouldDelete = window.confirm(`Delete organizer "${organizer.fullName}"?`);
    if (!shouldDelete) return;

    setMessage(null);
    setPendingId(organizer._id);
    try {
      await api({
        ...SummaryApi.delete_organizer,
        url: SummaryApi.delete_organizer.url.replace(":id", organizer._id),
      });
      setOrganizers((prev) => prev.filter((item) => item._id !== organizer._id));
      setMessage({ type: "success", text: "Organizer deleted successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Unable to delete organizer." });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Organizer Management</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Create organizers and manage account status using current backend routes.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search organizers..."
                  className="w-full sm:w-56 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 pl-9 pr-3 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={openCreateForm}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <UserPlus size={15} />
                Create Organizer
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">Total: <span className="font-semibold">{metrics.total}</span></div>
            <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">Active: <span className="font-semibold">{metrics.active}</span></div>
            <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2">Inactive: <span className="font-semibold">{metrics.deactivated}</span></div>
          </div>

          {message && (
            <p
              className={`mt-4 text-sm rounded-lg py-2 px-3 ${
                message.type === "success"
                  ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15"
                  : "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/15"
              }`}
            >
              {message.text}
            </p>
          )}

          {loading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">Loading organizers...</p>}
          {error && !loading && <p className="mt-6 text-sm text-red-600 dark:text-red-300">{error}</p>}

          {!loading && !error && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="pb-3 pr-3">Name & Contact</th>
                    <th className="pb-3 pr-3">Department</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {filteredOrganizers.map((organizer) => {
                    const isPending = pendingId === organizer._id;
                    return (
                      <tr key={organizer._id}>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <AvatarWithFrame
                              src={organizer.avatar || ""}
                              alt={organizer.fullName || "Organizer"}
                              frame={organizer?.profilePreferences?.avatarFrame}
                              className="h-8 w-8 shrink-0"
                              coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200 text-xs font-semibold flex items-center justify-center"
                              fallback={<span>{getInitials(organizer.fullName)}</span>}
                            />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">{organizer.fullName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{organizer.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-slate-700 dark:text-slate-200">{organizer?.professionalProfile?.department || "-"}</td>
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => toggleOrganizerStatus(organizer)}
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              organizer.isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                            }`}
                          >
                            {organizer.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-300">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => openEditForm(organizer)}
                              className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                              aria-label={`Edit ${organizer.fullName}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleDeleteOrganizer(organizer)}
                              className="rounded-md p-1.5 hover:bg-red-50 text-red-600 dark:text-red-300 dark:hover:bg-red-500/15 disabled:opacity-60"
                              aria-label={`Delete ${organizer.fullName}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredOrganizers.length === 0 && (
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">No organizers found for the current search.</p>
              )}
            </div>
          )}
        </section>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/55 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{formMode === "create" ? "Create Organizer" : "Edit Organizer"}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                  {formMode === "create"
                    ? "Backend supports fullName, email, password during organizer creation."
                    : "Update profile details for existing organizer."}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Full Name</span>
                  <input type="text" name="fullName" value={formValues.fullName} onChange={handleFormChange} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 px-3 text-sm" required />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Email</span>
                  <input type="email" name="email" value={formValues.email} onChange={handleFormChange} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 px-3 text-sm" required />
                </label>
              </div>

              {formMode === "create" && (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Password</span>
                  <input type="password" name="password" value={formValues.password} onChange={handleFormChange} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 px-3 text-sm" minLength={8} required />
                </label>
              )}

              {formMode === "edit" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mobile Number</span>
                    <input type="text" name="mobileNumber" value={formValues.mobileNumber} onChange={handleFormChange} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 px-3 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Department</span>
                    <input type="text" name="department" value={formValues.department} onChange={handleFormChange} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-2.5 px-3 text-sm" />
                  </label>
                </div>
              )}

              {formError && (
                <p className="text-sm rounded-lg px-3 py-2 bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle size={15} className="mt-0.5" />
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={closeForm} disabled={submitting} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60">Cancel</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70">
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
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
