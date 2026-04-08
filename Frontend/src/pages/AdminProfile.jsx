import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  PencilLine,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Tablet
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser, storeAuth } from "../lib/auth";
import useToastFeedback from "../hooks/useToastFeedback";
import { logoutUser } from "../lib/logout";

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&w=120&q=80";

const getDeviceIcon = (device = "") => {
  const lower = device.toLowerCase();
  if (lower.includes("iphone") || lower.includes("mobile")) return Smartphone;
  if (lower.includes("ipad") || lower.includes("tablet")) return Tablet;
  return Laptop;
};

export default function AdminProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => getStoredUser());
  const [sessions, setSessions] = useState([]);
  const [sessionSummary, setSessionSummary] = useState({
    activeSessions: 0,
    loginsLast30: 0,
    lastLoginAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [forcingLogout, setForcingLogout] = useState(false);
  const [terminatingSessionId, setTerminatingSessionId] = useState("");

  const displayName = profile?.fullName || "Admin";
  const department = profile?.professionalProfile?.department || "Department of IT";
  const title = profile?.professionalProfile?.occupation || "Lead System Administrator";
  const avatarUrl = profile?.avatar || DEFAULT_AVATAR;

  useEffect(() => {
    let intervalId = null;
    let mounted = true;

    const loadProfile = async ({ showLoader = true } = {}) => {
      if (showLoader) setLoading(true);
      setError("");
      try {
        const [profileResponse, sessionsResponse] = await Promise.all([
          api({
            ...SummaryApi.get_profile,
            skipCache: true,
            skipDedupe: true,
          }),
          api({
            ...SummaryApi.get_my_sessions,
            skipCache: true,
            skipDedupe: true,
          }),
        ]);

        if (!mounted) return;

        const nextUser = profileResponse.data?.user || null;
        if (nextUser) {
          setProfile(nextUser);
          storeAuth({ user: nextUser });
        }
        setSessions(Array.isArray(sessionsResponse.data?.data) ? sessionsResponse.data.data : []);
        setSessionSummary(
          sessionsResponse.data?.summary || {
            activeSessions: 0,
            loginsLast30: 0,
            lastLoginAt: null,
          }
        );
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.message || "Unable to load profile details.");
      } finally {
        if (mounted && showLoader) setLoading(false);
      }
    };

    void loadProfile({ showLoader: true });
    intervalId = setInterval(() => {
      void loadProfile({ showLoader: false });
    }, 30000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const formatDateTime = (value) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const lastLoginLabel = useMemo(
    () => formatDateTime(sessionSummary?.lastLoginAt || profile?.lastLoginAt),
    [profile?.lastLoginAt, sessionSummary?.lastLoginAt]
  );

  const securityScore = useMemo(() => {
    let score = 100;
    if (!profile?.emailVerified) score -= 20;
    if (!profile?.avatar) score -= 6;
    if (!profile?.mobileNumber) score -= 6;
    if (!profile?.passwordChangedAt) score -= 8;

    const lastPasswordChange = profile?.passwordChangedAt
      ? new Date(profile.passwordChangedAt).getTime()
      : 0;
    if (lastPasswordChange) {
      const daysSince = Math.floor((Date.now() - lastPasswordChange) / (1000 * 60 * 60 * 24));
      if (daysSince > 180) score -= 8;
      else if (daysSince > 90) score -= 4;
    }

    return Math.max(0, Math.min(100, score));
  }, [profile]);

  const loginsLast30 = Number(sessionSummary?.loginsLast30 || 0);

  const stats = useMemo(
    () => [
      {
        label: "Active Sessions",
        value: String(sessionSummary?.activeSessions || sessions.length),
        trend: (sessionSummary?.activeSessions || sessions.length) > 1 ? "Multiple devices" : "Current session",
        color: "text-emerald-600 dark:text-emerald-300"
      },
      {
        label: "Security Score",
        value: `${securityScore}%`,
        trend: securityScore >= 90 ? "Stable" : "Needs review",
        color: securityScore >= 90 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"
      },
      {
        label: "Logins (30d)",
        value: String(loginsLast30),
        trend: lastLoginLabel,
        color: "text-emerald-600 dark:text-emerald-300"
      }
    ],
    [lastLoginLabel, loginsLast30, securityScore, sessionSummary?.activeSessions, sessions.length]
  );

  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load profile details right now.",
  });
  useToastFeedback(notice, {
    successFallback: "Security action completed successfully.",
    errorFallback: "We couldn't complete that security action right now.",
    infoFallback: "Profile updated.",
  });

  const handleForceLogoutAll = async () => {
    const confirmed = window.confirm(
      "Force logout all sessions? You will be logged out and must sign in again."
    );
    if (!confirmed) return;

    setForcingLogout(true);
    setNotice(null);

    try {
      const response = await api({ ...SummaryApi.force_logout_all });
      setNotice({
        type: "success",
        text: response.data?.message || "Forced logout applied to all sessions."
      });
      await logoutUser();
      navigate("/login", { replace: true });
    } catch (err) {
      setNotice({
        type: "error",
        text: err?.response?.data?.message || "Unable to force logout sessions right now."
      });
    } finally {
      setForcingLogout(false);
    }
  };

  const loadSessionsOnly = async () => {
    try {
      const response = await api({
        ...SummaryApi.get_my_sessions,
        skipCache: true,
        skipDedupe: true,
      });
      setSessions(Array.isArray(response.data?.data) ? response.data.data : []);
      setSessionSummary(
        response.data?.summary || {
          activeSessions: 0,
          loginsLast30: 0,
          lastLoginAt: null,
        }
      );
    } catch (err) {
      setNotice({
        type: "error",
        text: err?.response?.data?.message || "Unable to refresh active sessions right now.",
      });
    }
  };

  const handleTerminateSession = async (session) => {
    if (!session?.id || session.current) return;

    const confirmed = window.confirm(
      `Terminate the session on "${session.device}"?`
    );
    if (!confirmed) return;

    setTerminatingSessionId(session.id);
    setNotice(null);

    try {
      const response = await api({
        ...SummaryApi.terminate_my_session,
        url: SummaryApi.terminate_my_session.url.replace(":sessionId", session.id),
      });
      setNotice({
        type: "success",
        text: response.data?.message || "Session terminated successfully.",
      });
      await loadSessionsOnly();
    } catch (err) {
      setNotice({
        type: "error",
        text: err?.response?.data?.message || "Unable to terminate that session right now.",
      });
    } finally {
      setTerminatingSessionId("");
    }
  };

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
            <button
              type="button"
              onClick={() => navigate("/admin-dashboard")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900 text-slate-700 dark:text-slate-200 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-400/40"
              aria-label="Back to admin dashboard"
            >
              <ArrowLeft size={16} />
            </button>
            <span>Admin Profile</span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={avatarUrl}
                  alt="Admin avatar"
                  className="h-16 w-16 rounded-full object-cover ring-4 ring-white shadow-md"
                />
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{displayName}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {title} | {department}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300"
              >
                <PencilLine size={14} />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <KeyRound size={14} />
                Change Password
              </button>
            </div>
          </div>
        </header>

        {loading && (
          <div className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading profile data...
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5"
            >
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">{stat.label}</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                <span className={`text-xs font-semibold ${stat.color}`}>{stat.trend}</span>
              </div>
            </article>
          ))}
        </div>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Active Sessions</h2>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                Devices currently logged into your admin account.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadSessionsOnly}
                disabled={forcingLogout || Boolean(terminatingSessionId)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-300"
              >
                <RefreshCcw size={14} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleForceLogoutAll}
                disabled={forcingLogout}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 hover:border-rose-300 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              >
                {forcingLogout ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                {forcingLogout ? "Forcing Logout..." : "Force Logout All"}
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-[11px] uppercase text-slate-400 dark:text-slate-500">
                <tr>
                  <th className="pb-3">Device & Browser</th>
                  <th className="pb-3">IP Address</th>
                  <th className="pb-3">Location</th>
                  <th className="pb-3">Last Active</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr className="border-t border-slate-100 dark:border-white/10">
                    <td colSpan={5} className="py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                      No active sessions found for this account.
                    </td>
                  </tr>
                ) : sessions.map((session) => {
                  const Icon = getDeviceIcon(session.device);
                  return (
                    <tr key={session.id} className="border-t border-slate-100 dark:border-white/10">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                            <Icon size={16} />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {session.device}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {session.current ? "Current Session" : `${session.browser} | ${session.os}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-slate-500 dark:text-slate-300">{session.ipAddress}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-300">{session.location}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            session.status === "active"
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                          }`}
                        >
                          {session.status === "active" ? <CheckCircle2 size={12} /> : <ShieldCheck size={12} />}
                          {formatDateTime(session.lastActiveAt)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {session.current ? (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                            Managed
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTerminateSession(session)}
                            disabled={terminatingSessionId === session.id}
                            className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60 dark:bg-rose-500/10 dark:text-rose-300"
                          >
                            {terminatingSessionId === session.id ? "Terminating..." : "Terminate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        
      </div>
    </section>
  );
}
