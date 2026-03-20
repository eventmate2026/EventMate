import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCcw, Users } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { useToastFeedback } from "../hooks/useToastFeedback";

const STATUS_STYLES = {
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  AWAITING_SIGNUP: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

const formatStatus = (status) =>
  String(status || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatRole = (role) =>
  String(role || "").trim().toLowerCase() === "leader" ? "Leader" : "Member";

export default function StudentTeamRegistration() {
  const { registrationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [updatingEmailIndex, setUpdatingEmailIndex] = useState(null);
  const [editingEmailIndex, setEditingEmailIndex] = useState(null);
  const [emailDrafts, setEmailDrafts] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [registration, setRegistration] = useState(null);
  useToastFeedback(error, { defaultType: "error" });
  useToastFeedback(notice);

  const loadStatus = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await api({
        ...SummaryApi.get_team_registration_status,
        url: SummaryApi.get_team_registration_status.url.replace(
          ":registrationId",
          encodeURIComponent(registrationId || "")
        ),
      });
      setRegistration(response.data?.data || null);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Unable to load team registration status.");
      setRegistration(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [registrationId]);

  useEffect(() => {
    setEditingEmailIndex(null);
    setEmailDrafts({});
  }, [registration?.registrationId]);

  const handleResend = async () => {
    if (!registrationId || resending) return;
    setResending(true);
    setNotice(null);
    try {
      const response = await api({
        ...SummaryApi.resend_team_invites,
        url: SummaryApi.resend_team_invites.url.replace(
          ":registrationId",
          encodeURIComponent(registrationId || "")
        ),
      });
      setNotice({
        type: "success",
        text: response.data?.message || "Invitations resent.",
      });
      await loadStatus({ silent: true });
    } catch (resendError) {
      setNotice({
        type: "error",
        text: resendError.response?.data?.message || "Unable to resend invitations.",
      });
    } finally {
      setResending(false);
    }
  };

  const startEmailEdit = (index, email) => {
    setEditingEmailIndex(index);
    setEmailDrafts((prev) => ({ ...prev, [index]: email || "" }));
  };

  const cancelEmailEdit = () => {
    setEditingEmailIndex(null);
  };

  const handleEmailSave = async (member, index) => {
    const nextEmail = String(emailDrafts[index] || "").trim();
    if (!nextEmail) {
      setNotice({ type: "error", text: "Email is required." });
      return;
    }
    if (!registrationId || !member?.email) return;

    setUpdatingEmailIndex(index);
    setNotice(null);
    try {
      const response = await api({
        ...SummaryApi.update_team_member_email,
        url: SummaryApi.update_team_member_email.url.replace(
          ":registrationId",
          encodeURIComponent(registrationId || "")
        ),
        data: {
          currentEmail: member.email,
          nextEmail,
        },
      });
      setNotice({
        type: "success",
        text: response.data?.message || "Team member email updated.",
      });
      await loadStatus({ silent: true });
      setEditingEmailIndex(null);
    } catch (updateError) {
      setNotice({
        type: "error",
        text: updateError.response?.data?.message || "Unable to update team member email.",
      });
    } finally {
      setUpdatingEmailIndex(null);
    }
  };

  const statusSummary = useMemo(() => registration?.summary || null, [registration]);
  const canResend =
    registration?.status === "PendingMemberVerification" &&
    ((statusSummary?.pending || 0) + (statusSummary?.awaitingSignup || 0) > 0);
  const canEditMembers = registration?.status === "PendingMemberVerification";
  const paymentStatus = String(registration?.payment?.paymentStatus || "NotRequired").trim();
  const paymentRequired = Boolean(registration?.payment?.required);
  const needsPayment = paymentRequired && (paymentStatus === "Pending" || paymentStatus === "Rejected");
  const paymentUnderReview = paymentRequired && paymentStatus === "UnderReview";

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <button
          type="button"
          onClick={() => navigate("/student-dashboard/my-events")}
          className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ArrowLeft size={15} />
          Back to My Events
        </button>

        {loading ? (
          <div className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading team registration status...
          </div>
        ) : error ? (
          <div className="eventmate-panel rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </div>
        ) : registration ? (
          <>
            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300 font-semibold">
                    Team Registration
                  </p>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    {registration?.event?.title || "Event"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {registration?.event?.date || "Date TBD"} • {registration?.event?.venue || "Venue TBD"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Team: <span className="font-semibold text-slate-900 dark:text-white">{registration.teamName || "Team"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canResend && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {resending ? <Loader2 size={12} className="animate-spin" /> : null}
                      {resending ? "Resending..." : "Resend Invites"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => loadStatus({ silent: true })}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <RefreshCcw size={12} />
                    Refresh
                  </button>
                </div>
              </div>
            </section>

            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Team Members</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Invitations must be accepted before the registration is completed.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                  <Users size={14} />
                  {statusSummary ? `${statusSummary.accepted}/${statusSummary.total} accepted` : "Loading"}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100/80 dark:bg-white/5">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      <th className="px-3 py-2.5 font-semibold">Member</th>
                      <th className="px-3 py-2.5 font-semibold">Email</th>
                      <th className="px-3 py-2.5 font-semibold">Role</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10 bg-white dark:bg-gray-900/40">
                    {registration.members?.length ? (
                      registration.members.map((member, index) => {
                        const status = String(member?.status || "PENDING").trim();
                        const normalizedStatus = status.toUpperCase();
                        const isMemberEditable =
                          canEditMembers &&
                          String(member?.role || "").toLowerCase() !== "leader" &&
                          (normalizedStatus === "PENDING" || normalizedStatus === "AWAITING_SIGNUP");
                        const isEditing = editingEmailIndex === index;
                        const draftEmail = emailDrafts[index] ?? member.email ?? "";
                        return (
                          <tr key={`${member.email || member.name}-${index}`}>
                            <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">
                              {member.name || "Member"}
                            </td>
                            <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                              {isEditing ? (
                                <div className="flex flex-col gap-2">
                                  <input
                                    value={draftEmail}
                                    onChange={(event) =>
                                      setEmailDrafts((prev) => ({
                                        ...prev,
                                        [index]: event.target.value,
                                      }))
                                    }
                                    placeholder="Enter email"
                                    className="w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEmailSave(member, index)}
                                      disabled={updatingEmailIndex === index}
                                      className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                                    >
                                      {updatingEmailIndex === index ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEmailEdit}
                                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="break-all">{member.email || "-"}</span>
                                  {isMemberEditable && (
                                    <button
                                      type="button"
                                      onClick={() => startEmailEdit(index, member.email)}
                                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                                    >
                                      Change
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                              {formatRole(member?.role)}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  STATUS_STYLES[status] || "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300"
                                }`}
                              >
                                {formatStatus(status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-300">
                          Team members are not available yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {registration.status === "Confirmed"
                    ? "Registration confirmed. QR codes are available in My Events."
                    : needsPayment
                      ? "All team members accepted. Complete payment to unlock the QR pass."
                      : paymentUnderReview
                        ? "Payment proof is under review. QR codes will appear after approval."
                      : registration.anyRejected
                        ? "A team member rejected the invitation. You cannot continue."
                        : registration.allAccepted
                          ? "All members accepted. Registration is being finalized."
                          : "Waiting for team members to accept the invitation."}
                </div>
                {paymentRequired ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        paymentStatus === "Verified"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : paymentStatus === "UnderReview"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                            : paymentStatus === "Rejected"
                              ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      }`}
                    >
                      Payment: {formatStatus(paymentStatus)}
                    </span>
                    {(needsPayment || paymentUnderReview) && registration?.registrationId ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/student-dashboard/my-events/payment/${encodeURIComponent(
                              registration.registrationId
                            )}`
                          )
                        }
                        className="rounded-md bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-indigo-700"
                      >
                        {needsPayment ? "Complete Payment" : "View Payment"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
