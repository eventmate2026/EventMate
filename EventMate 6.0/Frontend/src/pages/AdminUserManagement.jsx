import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, RefreshCcw, Search, ShieldCheck, Trash2, UserCog, Users, X } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import AvatarWithFrame from "../components/AvatarWithFrame";

const ROLE_LABELS = {
  MAIN_ADMIN: "Main Admin",
  ORGANIZER: "Organizer",
  STUDENT_COORDINATOR: "Coordinator",
  STUDENT: "Student",
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString([], { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const getInitials = (value) =>
  String(value || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const formatText = (value) => {
  const next = String(value ?? "").trim();
  return next || "N/A";
};

function downloadCsv(filename, rows) {
  if (!rows.length) return;
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
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [profileUser, setProfileUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api({ ...SummaryApi.get_all_users });
      setUsers(response.data?.users || []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.isActive).length;
    const verified = users.filter((user) => user.emailVerified).length;
    const adminsAndStaff = users.filter((user) => user.role !== "STUDENT").length;
    return { total, active, verified, adminsAndStaff };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !term ||
        user.fullName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.role?.toLowerCase().includes(term);

      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.isActive) ||
        (statusFilter === "INACTIVE" && !user.isActive) ||
        (statusFilter === "VERIFIED" && user.emailVerified) ||
        (statusFilter === "UNVERIFIED" && !user.emailVerified);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const updateUser = async (userId, payload) => {
    setMessage(null);
    setPendingId(userId);
    try {
      const response = await api({
        ...SummaryApi.update_user,
        url: SummaryApi.update_user.url.replace(":id", userId),
        data: payload,
      });
      const updatedUser = response.data?.user;
      setUsers((prev) => prev.map((user) => (user._id === userId ? updatedUser : user)));
      setMessage({ type: "success", text: "User updated successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Unable to update user." });
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Delete this user account?")) return;
    setMessage(null);
    setPendingId(userId);
    try {
      await api({
        ...SummaryApi.delete_user,
        url: SummaryApi.delete_user.url.replace(":id", userId),
      });
      setUsers((prev) => prev.filter((user) => user._id !== userId));
      setMessage({ type: "success", text: "User deleted successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Unable to delete user." });
    } finally {
      setPendingId(null);
    }
  };

  const exportUsers = () => {
    const rows = filteredUsers.map((user) => ({
      Name: user.fullName,
      Email: user.email,
      Role: ROLE_LABELS[user.role] || user.role,
      Active: user.isActive ? "Yes" : "No",
      Verified: user.emailVerified ? "Yes" : "No",
      CreatedAt: formatDateTime(user.createdAt),
      LastLogin: formatDateTime(user.lastLoginAt),
    }));
    downloadCsv("admin-user-management.csv", rows);
  };

  const closeProfileModal = () => setProfileUser(null);

  return (
    <div className="eventmate-page min-h-screen bg-slate-50 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">User Management</h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">Monitor active status and verification state across all user accounts.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchUsers}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <RefreshCcw size={15} />
                Refresh Feed
              </button>
              <button
                type="button"
                onClick={exportUsers}
                disabled={!filteredUsers.length}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">Total Users</p>
              <Users size={16} className="text-indigo-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.total.toLocaleString()}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">Active Users</p>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.active.toLocaleString()}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">Verified Users</p>
              <ShieldCheck size={16} className="text-teal-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.verified.toLocaleString()}</p>
          </article>
          <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">Admins + Staff</p>
              <UserCog size={16} className="text-violet-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{metrics.adminsAndStaff.toLocaleString()}</p>
          </article>
        </section>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="relative md:col-span-2">
              <span className="sr-only">Search users</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, email, or role..."
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 text-sm px-2"
              >
                <option value="ALL">All Roles</option>
                <option value="MAIN_ADMIN">Main Admin</option>
                <option value="ORGANIZER">Organizer</option>
                <option value="STUDENT_COORDINATOR">Coordinator</option>
                <option value="STUDENT">Student</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full py-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 text-sm px-2"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="VERIFIED">Verified</option>
                <option value="UNVERIFIED">Unverified</option>
              </select>
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Verification labels are system-managed and can be viewed here, but not edited from admin actions.
          </p>

          {message && (
            <p
              className={`mt-4 text-sm text-center rounded-lg py-2 ${
                message.type === "success"
                  ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15"
                  : "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/15"
              }`}
            >
              {message.text}
            </p>
          )}

          {loading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">Loading users...</p>}
          {error && !loading && <p className="mt-6 text-sm text-red-600 dark:text-red-300">{error}</p>}

          {!loading && !error && (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="pb-3 pr-3">Created</th>
                    <th className="pb-3 pr-3">User</th>
                    <th className="pb-3 pr-3">Role</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Last Login</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {filteredUsers.map((user) => (
                    <tr key={user._id}>
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">{formatDateTime(user.createdAt)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <AvatarWithFrame
                            src={user.avatar || ""}
                            alt={user.fullName || "User"}
                            frame={user?.profilePreferences?.avatarFrame}
                            className="h-8 w-8 shrink-0"
                            coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-xs font-semibold"
                            fallback={<span>{getInitials(user.fullName || "U")}</span>}
                          />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{user.fullName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-700 dark:text-slate-200">{ROLE_LABELS[user.role] || user.role}</td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${user.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200"}`}>
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${user.emailVerified ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"}`}>
                            {user.emailVerified ? "Verified" : "Unverified"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setProfileUser(user)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-400/30 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-500/15"
                          >
                            <Eye size={12} />
                            View Profile
                          </button>
                          <button
                            type="button"
                            disabled={pendingId === user._id}
                            onClick={() => updateUser(user._id, { isActive: !user.isActive })}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            disabled={pendingId === user._id}
                            onClick={() => handleDelete(user._id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 dark:border-red-400/30 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 disabled:opacity-60"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">No users found for current filters.</p>}
            </div>
          )}
        </section>
      </div>

      {profileUser && (
        <div className="fixed inset-0 z-[100] bg-slate-900/55 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <AvatarWithFrame
                  src={profileUser.avatar || ""}
                  alt={profileUser.fullName || "User"}
                  frame={profileUser?.profilePreferences?.avatarFrame}
                  className="h-12 w-12 shrink-0"
                  coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-base font-semibold"
                  fallback={<span>{getInitials(profileUser.fullName || "U")}</span>}
                />
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    {profileUser.fullName || "User Profile"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ROLE_LABELS[profileUser.role] || profileUser.role} | ID: {profileUser._id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeProfileModal}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Close profile"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
              <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Account Status</p>
                  <p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${profileUser.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200"}`}>
                    {profileUser.isActive ? "Active" : "Inactive"}
                  </p>
                </article>
                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Email Verification</p>
                  <p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${profileUser.emailVerified ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"}`}>
                    {profileUser.emailVerified ? "Verified" : "Unverified"}
                  </p>
                </article>
                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Avatar Frame</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatText(profileUser?.profilePreferences?.avatarFrame)}
                  </p>
                </article>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Basic Details</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Email:</span> {formatText(profileUser.email)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Mobile:</span> {formatText(profileUser.mobileNumber)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">College:</span> {formatText(profileUser.collegeName)}</p>
                </article>

                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Academic Profile</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Branch:</span> {formatText(profileUser?.academicProfile?.branch)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Year:</span> {formatText(profileUser?.academicProfile?.year)}</p>
                </article>

                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Professional Profile</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Department:</span> {formatText(profileUser?.professionalProfile?.department)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Occupation:</span> {formatText(profileUser?.professionalProfile?.occupation)}</p>
                </article>

                <article className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Coordinator Profile</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Assigned Event ID:</span> {formatText(profileUser?.coordinatorProfile?.assignedEventId)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Scope:</span> {formatText(profileUser?.coordinatorProfile?.scope)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Status:</span> {formatText(profileUser?.coordinatorProfile?.status)}</p>
                </article>
              </section>

              <section className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Timeline</h3>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Created:</span> {formatDateTime(profileUser.createdAt)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Updated:</span> {formatDateTime(profileUser.updatedAt)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Last Login:</span> {formatDateTime(profileUser.lastLoginAt)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-semibold text-slate-800 dark:text-slate-100">Password Changed:</span> {formatDateTime(profileUser.passwordChangedAt)}</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




