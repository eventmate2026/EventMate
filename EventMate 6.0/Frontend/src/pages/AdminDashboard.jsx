import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  RefreshCcw,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
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

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api({ ...SummaryApi.get_all_users });
      setUsers(response.data?.users || []);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((user) => user.isActive).length;
    const verifiedUsers = users.filter((user) => user.emailVerified).length;
    const blockedUsers = totalUsers - activeUsers;
    const now = Date.now();
    const last30Days = now - 30 * 24 * 60 * 60 * 1000;
    const recentlyJoined = users.filter((user) => {
      const createdAt = new Date(user.createdAt).getTime();
      return !Number.isNaN(createdAt) && createdAt >= last30Days;
    }).length;

    const roleCounts = users.reduce(
      (acc, user) => {
        if (acc[user.role] !== undefined) acc[user.role] += 1;
        return acc;
      },
      { MAIN_ADMIN: 0, ORGANIZER: 0, STUDENT_COORDINATOR: 0, STUDENT: 0 }
    );

    const verificationRate = totalUsers ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : "0.0";

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      blockedUsers,
      recentlyJoined,
      verificationRate,
      roleCounts,
    };
  }, [users]);

  const securityAlerts = useMemo(() => {
    const alerts = [];
    users.forEach((user) => {
      const createdAt = new Date(user.createdAt).getTime();
      const ageInDays = Number.isNaN(createdAt) ? 0 : Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));

      if (!user.emailVerified && ageInDays > 3) {
        alerts.push({
          id: `verify-${user._id}`,
          timestamp: user.createdAt,
          event: `Unverified account older than ${ageInDays} days`,
          source: user.email,
          severity: ageInDays > 14 ? "High" : "Medium",
          action: "Review",
        });
      }

      if (!user.isActive && user.emailVerified) {
        alerts.push({
          id: `inactive-${user._id}`,
          timestamp: user.updatedAt || user.createdAt,
          event: "Verified account is currently inactive",
          source: user.email,
          severity: "Info",
          action: "Monitor",
        });
      }
    });

    return alerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);
  }, [users]);

  const recentActivity = useMemo(() => {
    const feed = [];
    users.forEach((user) => {
      if (user.createdAt) {
        feed.push({
          id: `joined-${user._id}`,
          type: "joined",
          name: user.fullName,
          avatar: user.avatar || null,
          profilePreferences: {
            avatarFrame: user?.profilePreferences?.avatarFrame || "NONE",
          },
          detail: `${ROLE_LABELS[user.role] || user.role} account created`,
          time: user.createdAt,
        });
      }
      if (user.lastLoginAt) {
        feed.push({
          id: `login-${user._id}`,
          type: "login",
          name: user.fullName,
          avatar: user.avatar || null,
          profilePreferences: {
            avatarFrame: user?.profilePreferences?.avatarFrame || "NONE",
          },
          detail: "Successful login activity recorded",
          time: user.lastLoginAt,
        });
      }
    });

    return feed
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 4);
  }, [users]);

  const exportReport = () => {
    const rows = users.map((user) => ({
      Name: user.fullName,
      Email: user.email,
      Role: ROLE_LABELS[user.role] || user.role,
      Active: user.isActive ? "Yes" : "No",
      Verified: user.emailVerified ? "Yes" : "No",
      CreatedAt: formatDateTime(user.createdAt),
      LastLogin: formatDateTime(user.lastLoginAt),
    }));
    downloadCsv("admin-system-overview.csv", rows);
  };

  const cardConfig = [
    {
      title: "Total Accounts",
      value: metrics.totalUsers.toLocaleString(),
      sub: `${metrics.recentlyJoined} joined in last 30 days`,
      icon: Users,
      accent: "from-indigo-500 to-blue-500",
    },
    {
      title: "Verified Users",
      value: `${metrics.verifiedUsers.toLocaleString()} (${metrics.verificationRate}%)`,
      sub: "Verification coverage",
      icon: ShieldCheck,
      accent: "from-emerald-500 to-teal-500",
    },
    {
      title: "Active Users",
      value: metrics.activeUsers.toLocaleString(),
      sub: `${metrics.blockedUsers} inactive accounts`,
      icon: UserCheck,
      accent: "from-violet-500 to-fuchsia-500",
    },
    {
      title: "Role Distribution",
      value: `${metrics.roleCounts.STUDENT} students`,
      sub: `${metrics.roleCounts.ORGANIZER} organizers | ${metrics.roleCounts.STUDENT_COORDINATOR} coordinators`,
      icon: Activity,
      accent: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <div className="eventmate-page min-h-screen bg-slate-50 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">System Overview</h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">Real-time metrics generated from current user records.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchUsers}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <RefreshCcw size={15} />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportReport}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                disabled={!users.length}
              >
                <Download size={15} />
                Export Report
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Last synced: {formatDateTime(lastUpdated)}</p>
        </section>

        {loading && <p className="text-sm text-slate-500 dark:text-slate-300">Loading admin metrics...</p>}
        {error && !loading && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {cardConfig.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-300">{card.title}</p>
                      <span className={`h-8 w-8 rounded-lg bg-gradient-to-br ${card.accent} text-white flex items-center justify-center`}>
                        <Icon size={16} />
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{card.value}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.sub}</p>
                  </article>
                );
              })}
            </section>

            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} className="text-rose-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Critical Security Alerts</h2>
              </div>

              {securityAlerts.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">No critical alerts found in current records.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="pb-3 pr-3">Timestamp</th>
                        <th className="pb-3 pr-3">Event</th>
                        <th className="pb-3 pr-3">Source</th>
                        <th className="pb-3 pr-3">Severity</th>
                        <th className="pb-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                      {securityAlerts.map((alert) => (
                        <tr key={alert.id}>
                          <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">{formatDateTime(alert.timestamp)}</td>
                          <td className="py-3 pr-3 text-slate-900 dark:text-white font-medium">{alert.event}</td>
                          <td className="py-3 pr-3 text-slate-500 dark:text-slate-300">{alert.source}</td>
                          <td className="py-3 pr-3">
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                alert.severity === "High"
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                                  : alert.severity === "Medium"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                              }`}
                            >
                              {alert.severity}
                            </span>
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-300">{alert.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Users size={17} className="text-indigo-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent System Activity</h2>
              </div>

              {recentActivity.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300">No recent activity available.</p>
              ) : (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/80 dark:bg-white/5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarWithFrame
                            src={item.avatar || ""}
                            alt={item.name || "User"}
                            frame={item.profilePreferences?.avatarFrame}
                            className="h-8 w-8 shrink-0"
                            coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 text-xs font-semibold flex items-center justify-center"
                            fallback={<span>{getInitials(item.name || "U")}</span>}
                          />
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${item.type === "login" ? "text-emerald-600 dark:text-emerald-300" : "text-indigo-600 dark:text-indigo-300"}`}>
                          {item.type === "login" ? <UserCheck size={13} /> : <UserX size={13} />}
                          {item.type === "login" ? "Login" : "Joined"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.time)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
