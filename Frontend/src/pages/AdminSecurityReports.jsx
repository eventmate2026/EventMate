import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Power,
  RefreshCcw,
  Save
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { useToastFeedback } from "../hooks/useToastFeedback";

const DEFAULT_SECURITY_SETTINGS = Object.freeze({
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  accessTokenLifetimeMinutes: 15,
  refreshTokenLifetimeDays: 7,
  notifyOnLockout: true,
  maintenanceMode: false,
  lastRotatedAt: null
});

const clampNumber = (value, min, max) =>
  Math.min(max, Math.max(min, Number(value) || 0));

const formatDateTime = (value) => {
  if (!value) return "Not rotated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not rotated yet";
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const Switch = ({ checked, onChange, disabled = false, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
      checked
        ? "border-indigo-500 bg-indigo-600"
        : "border-slate-300 bg-slate-200 dark:border-white/20 dark:bg-white/10"
    } disabled:cursor-not-allowed disabled:opacity-60`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
        checked ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

export default function AdminSecurityReports() {
  const [settings, setSettings] = useState(DEFAULT_SECURITY_SETTINGS);
  const [initialSettings, setInitialSettings] = useState(DEFAULT_SECURITY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rotatingSecret, setRotatingSecret] = useState(false);
  const [forcingLogout, setForcingLogout] = useState(false);
  const [notice, setNotice] = useState(null);
  useToastFeedback(error, { defaultType: "error" });
  useToastFeedback(notice);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api({ ...SummaryApi.get_security_settings, cacheTTL: 60000 });
        const data = response.data?.data || DEFAULT_SECURITY_SETTINGS;
        setSettings(data);
        setInitialSettings(data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load security settings.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const securityScore = useMemo(() => {
    let score = 100;

    if (settings.accessTokenLifetimeMinutes > 30) score -= 4;
    if (settings.refreshTokenLifetimeDays > 14) score -= 4;
    if (settings.maxFailedLoginAttempts > 7) score -= 3;
    if (settings.lockoutDurationMinutes < 15) score -= 4;
    if (!settings.notifyOnLockout) score -= 2;
    if (settings.maintenanceMode) score -= 1;

    return Math.max(0, Math.min(100, score));
  }, [settings]);

  const handleRotateSecret = async () => {
    setRotatingSecret(true);
    setNotice(null);
    try {
      const response = await api({ ...SummaryApi.rotate_security_secret });
      const data = response.data?.data;
      if (data) {
        setSettings(data);
        setInitialSettings(data);
      }
      setNotice({
        type: "success",
        text: response.data?.message || "JWT secret rotated. Current sessions now require fresh login.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Unable to rotate secret right now.",
      });
    } finally {
      setRotatingSecret(false);
    }
  };

  const handleForceLogoutAll = async () => {
    setForcingLogout(true);
    setNotice(null);
    try {
      const response = await api({ ...SummaryApi.force_logout_all });
      const data = response.data?.data;
      if (data) {
        setSettings(data);
        setInitialSettings(data);
      }
      setNotice({
        type: "success",
        text: response.data?.message || "Forced logout applied to all active sessions.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Unable to force logout right now.",
      });
    } finally {
      setForcingLogout(false);
    }
  };

  const handleDiscardChanges = () => {
    setSettings(initialSettings);
    setNotice({ type: "info", text: "Unsaved changes discarded." });
  };

  const handleSaveConfiguration = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await api({
        ...SummaryApi.update_security_settings,
        data: settings
      });
      const data = response.data?.data;
      if (data) {
        setSettings(data);
        setInitialSettings(data);
      }
      setNotice({
        type: "success",
        text: response.data?.message || "System security configuration saved.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Unable to save configuration.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Security & Access Control
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Configure global security protocols, token lifecycles, and admin incident actions.
          </p>
        </header>

        {loading && (
          <article className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-3 text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading security settings...
          </article>
        )}

        {error && !loading ? (
          <article className="eventmate-panel rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </article>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)] gap-4">
          <div className="space-y-4">
            <article className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">JWT Secret Rotation</h2>
                <RefreshCcw size={16} className="text-indigo-500" />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                Rotate the primary signing secret. Existing sessions must re-authenticate.
              </p>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <p className="font-semibold">Caution: This action cannot be undone immediately.</p>
                <p>Enable during low-traffic periods to reduce disruption.</p>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Last rotated: {formatDateTime(settings.lastRotatedAt)}
                </p>
                <button
                  type="button"
                  onClick={handleRotateSecret}
                  disabled={rotatingSecret}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {rotatingSecret ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
                  {rotatingSecret ? "Rotating..." : "Rotate Secret Key"}
                </button>
              </div>
            </article>

            <article className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Token Expiry Configuration</h2>

              <div className="mt-4 space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Access Token Lifetime (Minutes)
                    </p>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                      {settings.accessTokenLifetimeMinutes}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={120}
                    step={1}
                    value={settings.accessTokenLifetimeMinutes}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        accessTokenLifetimeMinutes: clampNumber(event.target.value, 5, 120)
                      }))
                    }
                    className="mt-2 w-full accent-indigo-600"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>5 min</span>
                    <span>60 min</span>
                    <span>120 min</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Refresh Token Lifetime (Days)
                    </p>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                      {settings.refreshTokenLifetimeDays}d
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={settings.refreshTokenLifetimeDays}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        refreshTokenLifetimeDays: clampNumber(event.target.value, 1, 30)
                      }))
                    }
                    className="mt-2 w-full accent-indigo-600"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>1 day</span>
                    <span>14 days</span>
                    <span>30 days</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setNotice({
                      type: "info",
                      text: "Token settings staged. Save system configuration to persist.",
                    })
                  }
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                >
                  Apply Token Settings
                </button>
              </div>
            </article>
          </div>

          <div className="space-y-4">
            <article className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account Lockout Rules</h2>

              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Max Failed Login Attempts
                  </span>
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={settings.maxFailedLoginAttempts}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        maxFailedLoginAttempts: clampNumber(event.target.value, 3, 20)
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Lockout Duration (Minutes)
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={settings.lockoutDurationMinutes}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        lockoutDurationMinutes: clampNumber(event.target.value, 5, 240)
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.notifyOnLockout}
                    onChange={(next) =>
                      setSettings((prev) => ({ ...prev, notifyOnLockout: next }))
                    }
                    label="Enable lockout notifications"
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Enable Admin Notification on Lockout
                  </p>
                </div>
              </div>
            </article>

            <article className="eventmate-panel rounded-2xl border border-rose-200 bg-rose-50/80 p-4 sm:p-5 dark:border-rose-500/30 dark:bg-rose-500/10">
              <h2 className="text-lg font-semibold text-rose-700 dark:text-rose-300">Emergency Actions</h2>
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-200">
                Use these controls during potential security incidents.
              </p>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleForceLogoutAll}
                  disabled={forcingLogout}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {forcingLogout ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                  {forcingLogout ? "Forcing Logout..." : "Force Logout All Active Sessions"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      maintenanceMode: !prev.maintenanceMode
                    }))
                  }
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                    settings.maintenanceMode
                      ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-200"
                      : "border-rose-300 bg-white text-rose-700 dark:border-rose-500/40 dark:bg-transparent dark:text-rose-300"
                  }`}
                >
                  <LockKeyhole size={13} />
                  {settings.maintenanceMode ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
                </button>
              </div>
            </article>

            <article className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Security Score</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{securityScore}%</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${securityScore}%` }}
                />
              </div>

              <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-slate-300">
                <p className="inline-flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  Two-factor Authentication active
                </p>
                <p className="inline-flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  SSL certificate valid
                </p>
                <p className="inline-flex items-center gap-1">
                  <BellRing size={12} className="text-indigo-500" />
                  {settings.notifyOnLockout ? "Lockout alerts enabled" : "Lockout alerts disabled"}
                </p>
                <p className="inline-flex items-center gap-1">
                  <AlertTriangle
                    size={12}
                    className={settings.maintenanceMode ? "text-amber-500" : "text-slate-400"}
                  />
                  {settings.maintenanceMode ? "Maintenance mode is enabled" : "Maintenance mode is disabled"}
                </p>
              </div>
            </article>
          </div>
        </div>

        <footer className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-300">
              All changes are logged in the Audit Trail.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={saving}
                className="rounded-md border border-slate-300 dark:border-white/20 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-60"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={handleSaveConfiguration}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? "Saving..." : "Save System Configuration"}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}
