import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { useToast } from "../context/ToastContext";

const formatStatus = (status) =>
  String(status || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatRole = (role) =>
  String(role || "").trim().toLowerCase() === "leader" ? "Team Leader" : "Team Member";

export default function TeamInvite() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const actionParam = params.get("action");
  const toast = useToast();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [autoResponded, setAutoResponded] = useState(false);

  const loadInvite = async () => {
    if (!token) {
      toast.error("Missing invitation token.");
      setLoading(false);
      return;
    }

    try {
      const response = await api({
        ...SummaryApi.get_team_invite,
        url: SummaryApi.get_team_invite.url.replace(":token", encodeURIComponent(token)),
        skipAuth: true,
      });
      setInvite(response.data?.data || null);
    } catch (error) {
      setInvite(null);
      toast.error(error.response?.data?.message || "Unable to load invitation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvite();
  }, [token]);

  const respond = async (nextAction) => {
    if (!token) return;
    const normalized = String(nextAction || "").trim().toLowerCase();
    if (normalized !== "accept" && normalized !== "reject") {
      toast.error("Invalid invitation action.");
      return;
    }

    setResponding(true);
    try {
      const response = await api({
        ...SummaryApi.respond_team_invite,
        url: SummaryApi.respond_team_invite.url
          .replace(":token", encodeURIComponent(token))
          .replace(":action", normalized),
        skipAuth: true,
      });
      const data = response.data?.data || {};
      setInvite((prev) => (prev ? { ...prev, status: data.status || prev.status } : prev));
      toast.success(response.data?.message || "Response recorded.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update invitation response.");
    } finally {
      setResponding(false);
    }
  };

  useEffect(() => {
    if (!actionParam || !token || autoResponded) return;
    setAutoResponded(true);
    respond(actionParam);
  }, [actionParam, token, autoResponded]);

  const canRespond = useMemo(() => {
    const status = String(invite?.status || "").trim();
    if (!status) return false;
    return status === "PENDING";
  }, [invite]);

  const statusLabel = formatStatus(invite?.status);

  return (
    <section className="eventmate-page min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/60 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full bg-white/90 dark:bg-slate-900/85 backdrop-blur rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300 font-semibold">
          Team Invitation
        </p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
          {invite?.event?.title || "Event Invitation"}
        </h1>

        {loading ? (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 size={14} className="animate-spin" />
            Loading...
          </p>
        ) : (
          <>
            {invite ? (
              <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3 text-left text-sm text-slate-700 dark:text-slate-200">
                <p>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Team</span>
                  <br />
                  <span className="font-semibold">{invite.teamName || "Team"}</span>
                </p>
                <p className="mt-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Team Leader</span>
                  <br />
                  <span className="font-semibold">{invite.leaderName || "Team Leader"}</span>
                </p>
                <p className="mt-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Your Role</span>
                  <br />
                  <span className="font-semibold">{formatRole(invite.role)}</span>
                </p>
                <p className="mt-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Date</span>
                  <br />
                  <span className="font-semibold">{invite?.event?.date || "Date TBD"}</span>
                </p>
              </div>
            ) : null}

            {invite?.status && (
              <div className="mt-4 text-xs text-slate-500 dark:text-slate-300">
                Current status: <span className="font-semibold">{statusLabel}</span>
              </div>
            )}

            {invite?.status === "AWAITING_SIGNUP" && (
              <div className="mt-4 text-xs text-amber-700 dark:text-amber-200">
                <p>Please sign up or log in with this email to receive the invitation.</p>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <Link
                    to={`/signup?email=${encodeURIComponent(invite?.email || "")}`}
                    className="font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                  >
                    Go to signup
                  </Link>
                  <Link
                    to={`/login?email=${encodeURIComponent(invite?.email || "")}`}
                    className="font-semibold text-slate-700 dark:text-slate-200 hover:underline"
                  >
                    Go to login
                  </Link>
                </div>
              </div>
            )}

            {canRespond && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => respond("accept")}
                  disabled={responding}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {responding ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => respond("reject")}
                  disabled={responding}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {responding ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  Reject
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Link to="/" className="text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300">
            Back to home
          </Link>
          <Link to="/login" className="font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    </section>
  );
}
