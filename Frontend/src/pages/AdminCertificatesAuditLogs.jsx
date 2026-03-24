import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShieldX
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";

const toList = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString([], {
    month: "short",
    day: "2-digit",
    year: "numeric"
  });
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleString([], {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const safeNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
};

const statusBadgeClass = (status) => {
  if (status === "VALID") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  }
  if (status === "REVOKED") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  }
  return "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
};

const outcomeBadgeClass = (outcome) => {
  if (outcome === "SUCCESS") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  }
  if (outcome === "FAILED") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  }
  return "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
};

export default function AdminCertificatesAuditLogs() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [registryRows, setRegistryRows] = useState([]);
  const [auditRows, setAuditRows] = useState([]);
  const [summary, setSummary] = useState({
    totalIssued: 0,
    validCount: 0,
    revokedCount: 0,
    revocationRate: 0,
    verificationAttempts: 0,
    verificationSuccessRate: 100,
    lastAuditAt: null
  });
  const [registryStatus, setRegistryStatus] = useState("ALL");
  const [registrySearch, setRegistrySearch] = useState("");
  const [auditAction, setAuditAction] = useState("ALL");
  const [auditSearch, setAuditSearch] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [registryResponse, auditResponse] = await Promise.all([
          api({
            ...SummaryApi.get_admin_certificates_registry,
            params: {
              page: 1,
              limit: 60,
              status: registryStatus,
              search: registrySearch || undefined
            },
            cacheTTL: 8000
          }),
          api({
            ...SummaryApi.get_admin_certificate_audit_logs,
            params: {
              page: 1,
              limit: 80,
              action: auditAction,
              search: auditSearch || undefined
            },
            cacheTTL: 8000
          })
        ]);

        setRegistryRows(toList(registryResponse.data));
        setAuditRows(toList(auditResponse.data));
        setSummary({
          totalIssued: safeNumber(registryResponse.data?.summary?.totalIssued),
          validCount: safeNumber(registryResponse.data?.summary?.validCount),
          revokedCount: safeNumber(registryResponse.data?.summary?.revokedCount),
          revocationRate: safeNumber(registryResponse.data?.summary?.revocationRate),
          verificationAttempts: safeNumber(registryResponse.data?.summary?.verificationAttempts),
          verificationSuccessRate: safeNumber(registryResponse.data?.summary?.verificationSuccessRate),
          lastAuditAt: registryResponse.data?.summary?.lastAuditAt || null
        });
      } catch (loadError) {
        setRegistryRows([]);
        setAuditRows([]);
        setError(loadError?.response?.data?.message || "Unable to load certificate authority data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [registryStatus, registrySearch, auditAction, auditSearch]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runVerification = useCallback(
    async (code) => {
      const normalizedInput = String(code || "").trim();
      if (!normalizedInput) return;

      setVerifyBusy(true);
      setVerifyMessage("");
      setVerifyResult(null);

      try {
        const response = await api({
          ...SummaryApi.verify_certificate_code,
          data: { verificationCode: normalizedInput }
        });

        setVerifyMessage(response.data?.message || "Certificate verified.");
        setVerifyResult(response.data?.data || null);
      } catch (verifyError) {
        const message =
          verifyError?.response?.data?.message || "Unable to verify this certificate code.";
        setVerifyMessage(message);
        if (verifyError?.response?.data?.data) {
          setVerifyResult(verifyError.response.data.data);
        } else {
          setVerifyResult(null);
        }
      } finally {
        setVerifyBusy(false);
        await loadData({ silent: true });
      }
    },
    [loadData]
  );

  const handleVerifySubmit = async (event) => {
    event.preventDefault();
    await runVerification(verifyCode);
  };

  const handleRevokeCertificate = async (certificate) => {
    const certificateId = String(certificate?._id || "");
    if (!certificateId || certificate?.verificationStatus === "REVOKED") {
      return;
    }

    const reason = window.prompt(
      `Revoke certificate ${certificate?.verificationCode || ""}? Add reason (optional):`,
      "Revoked by administrator"
    );
    if (reason === null) return;

    try {
      setRevokingId(certificateId);
      await api({
        ...SummaryApi.revoke_admin_certificate,
        url: SummaryApi.revoke_admin_certificate.url.replace(
          ":certificateId",
          encodeURIComponent(certificateId)
        ),
        data: { reason }
      });
      setVerifyMessage("Certificate revoked successfully.");
      setVerifyResult(null);
      await loadData({ silent: true });
    } catch (revokeError) {
      setVerifyMessage(
        revokeError?.response?.data?.message || "Unable to revoke certificate right now."
      );
    } finally {
      setRevokingId(null);
    }
  };

  const reliability = useMemo(() => {
    return safeNumber(summary.verificationSuccessRate).toFixed(1);
  }, [summary.verificationSuccessRate]);

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <header className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Certificate Authority Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Verify credentials, monitor issued certificates, and review authority audit logs.
          </p>
        </header>

        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-300" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Verify Certificate</h2>
          </div>
          <form onSubmit={handleVerifySubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <input
              type="text"
              value={verifyCode}
              onChange={(event) => setVerifyCode(event.target.value)}
              placeholder="Enter verification code (e.g. EM-2026-7A1C-4D9F)"
              className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={verifyBusy || !String(verifyCode || "").trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {verifyBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Verify Now
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            System Operational - Last Audit: {formatDateTime(summary.lastAuditAt)}
          </p>

          {verifyMessage ? (
            <article
              className={`mt-4 rounded-lg border p-3 text-sm ${
                verifyResult?.isValid === true
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : verifyResult?.isValid === false
                    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                    : "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              }`}
            >
              <p className="font-semibold">{verifyMessage}</p>
              {verifyResult?.certificate ? (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <p>
                    <span className="text-slate-500 dark:text-slate-300">Code:</span>{" "}
                    {verifyResult.certificate.verificationCode}
                  </p>
                  <p>
                    <span className="text-slate-500 dark:text-slate-300">Status:</span>{" "}
                    {verifyResult.certificate.verificationStatus}
                  </p>
                  <p>
                    <span className="text-slate-500 dark:text-slate-300">Student:</span>{" "}
                    {verifyResult.certificate.participantName}
                  </p>
                  <p>
                    <span className="text-slate-500 dark:text-slate-300">Event:</span>{" "}
                    {verifyResult.certificate.eventName}
                  </p>
                </div>
              ) : null}
            </article>
          ) : null}
        </section>

        {(loading || refreshing) && (
          <article className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            {loading ? "Loading certificates and logs..." : "Refreshing data..."}
          </article>
        )}

        {error && !loading && (
          <article className="eventmate-panel rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 inline-flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {error}
          </article>
        )}

        {!loading && !error && (
          <>
            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Issued Certificates Registry</h2>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={registrySearch}
                      onChange={(event) => setRegistrySearch(event.target.value)}
                      placeholder="Search code, student, event..."
                      className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <select
                    value={registryStatus}
                    onChange={(event) => setRegistryStatus(event.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="ALL">All Status</option>
                    <option value="VALID">Valid</option>
                    <option value="REVOKED">Revoked</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => loadData({ silent: true })}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <RefreshCcw size={14} />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-3">Verification Code</th>
                      <th className="px-3 py-3">Student Name</th>
                      <th className="px-3 py-3">Event Name</th>
                      <th className="px-3 py-3">Issuance Date</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {registryRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-300">
                          No certificates found for the current filter.
                        </td>
                      </tr>
                    ) : (
                      registryRows.map((row) => (
                        <tr key={row._id}>
                          <td className="px-3 py-3 text-indigo-700 dark:text-indigo-300 font-medium">
                            {row.verificationCode || "N/A"}
                          </td>
                          <td className="px-3 py-3 text-slate-900 dark:text-white">
                            <p className="font-medium">{row.participantName || "Participant"}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">{row.participantEmail || "N/A"}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.eventName || "N/A"}</td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(row.issuedAt)}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.verificationStatus)}`}>
                              {row.verificationStatus || "UNKNOWN"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const rowCode = String(row.verificationCode || "").trim();
                                  setVerifyCode(rowCode);
                                  if (!rowCode) {
                                    setVerifyMessage(
                                      "This certificate does not have a verification code yet."
                                    );
                                    setVerifyResult({ isValid: false });
                                    return;
                                  }
                                  runVerification(rowCode);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-white/10 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                              >
                                <ShieldCheck size={12} />
                                Verify
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeCertificate(row)}
                                disabled={row.verificationStatus === "REVOKED" || revokingId === row._id}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                              >
                                {revokingId === row._id ? <Loader2 size={12} className="animate-spin" /> : <ShieldX size={12} />}
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Certificate Audit Trail</h2>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={auditSearch}
                      onChange={(event) => setAuditSearch(event.target.value)}
                      placeholder="Search actor, code or details..."
                      className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <select
                    value={auditAction}
                    onChange={(event) => setAuditAction(event.target.value)}
                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="ALL">All Actions</option>
                    <option value="ISSUED">Issued</option>
                    <option value="VERIFIED">Verified</option>
                    <option value="REVOKED">Revoked</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-white/5">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-3">Timestamp</th>
                      <th className="px-3 py-3">Action</th>
                      <th className="px-3 py-3">Outcome</th>
                      <th className="px-3 py-3">Actor</th>
                      <th className="px-3 py-3">Code</th>
                      <th className="px-3 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {auditRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-300">
                          No audit logs found for the current filter.
                        </td>
                      </tr>
                    ) : (
                      auditRows.map((logRow) => (
                        <tr key={logRow._id}>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(logRow.createdAt)}</td>
                          <td className="px-3 py-3 text-slate-900 dark:text-white font-medium">{logRow.action}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${outcomeBadgeClass(logRow.outcome)}`}>
                              {logRow.outcome}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                            <p>{logRow.actorName || "Unknown"}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-300">{logRow.actorRole || logRow.source}</p>
                          </td>
                          <td className="px-3 py-3 text-indigo-700 dark:text-indigo-300">
                            {logRow.verificationCode || "N/A"}
                          </td>
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                            <p>{logRow.message || "No details recorded."}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {logRow.participantName || "N/A"} - {logRow.eventName || "N/A"}
                            </p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <article className="eventmate-kpi rounded-xl border border-indigo-500/20 bg-indigo-600 p-4 text-white">
                <p className="text-xs text-indigo-100">Trust Score</p>
                <p className="mt-1 text-3xl font-bold">{reliability}% Reliable</p>
                <p className="mt-1 text-xs text-indigo-100 inline-flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Successful verifications ratio
                </p>
              </article>

              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Total Issued</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
                  {safeNumber(summary.totalIssued).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Valid: {safeNumber(summary.validCount).toLocaleString()} - Revoked:{" "}
                  {safeNumber(summary.revokedCount).toLocaleString()}
                </p>
              </article>

              <article className="eventmate-kpi rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Revocation Rate</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
                  {safeNumber(summary.revocationRate).toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Attempts: {safeNumber(summary.verificationAttempts).toLocaleString()}
                </p>
              </article>
            </section>
          </>
        )}
      </div>
    </section>
  );
}
