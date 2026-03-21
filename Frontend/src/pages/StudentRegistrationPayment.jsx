import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { invalidateMyRegistrationsCache } from "../lib/registrationApi";
import { useToastFeedback } from "../hooks/useToastFeedback";

const STATUS_STYLES = {
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  UnderReview: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  Verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  NotRequired: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};
const MAX_SCREENSHOT_SIZE_MB = 5;

const formatStatus = (value) => {
  const text = String(value || "").trim();
  if (!text) return "Pending";
  return text.replace(/([a-z])([A-Z])/g, "$1 $2");
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Free";
  return `Rs ${amount}`;
};

const buildUpiPaymentUrl = (details) => {
  const upiId = String(details?.paymentConfig?.upiId || "").trim();
  if (!upiId) return "";

  const params = new URLSearchParams();
  params.set("pa", upiId);

  const accountName = String(details?.paymentConfig?.accountName || "").trim();
  if (accountName) {
    params.set("pn", accountName);
  }

  const amount = Number(details?.payment?.amount || 0);
  if (Number.isFinite(amount) && amount > 0) {
    params.set("am", amount.toFixed(2));
    params.set("cu", "INR");
  }

  const note = String(details?.event?.title || "Event registration").trim();
  if (note) {
    params.set("tn", note);
  }

  return `upi://pay?${params.toString()}`;
};

export default function StudentRegistrationPayment() {
  const { registrationId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [details, setDetails] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [paymentScreenshotPreviewUrl, setPaymentScreenshotPreviewUrl] = useState("");
  const paymentScreenshotInputRef = useRef(null);

  useToastFeedback(error, { defaultType: "error" });
  useToastFeedback(notice);

  const loadDetails = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await api({
        ...SummaryApi.get_registration_payment,
        url: SummaryApi.get_registration_payment.url.replace(
          ":registrationId",
          encodeURIComponent(registrationId || "")
        ),
      });
      const nextDetails = response.data?.data || null;
      setDetails(nextDetails);
      setTransactionId(String(nextDetails?.payment?.transactionId || "").trim());
    } catch (fetchError) {
      setDetails(null);
      setError(
        fetchError.response?.data?.message || "Unable to load payment details right now."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    if (!paymentScreenshot) {
      setPaymentScreenshotPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(paymentScreenshot);
    setPaymentScreenshotPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [paymentScreenshot]);

  const handleCopy = async (label, value) => {
    const text = String(value || "").trim();
    if (!text) {
      setNotice({ type: "error", text: `${label} is not available.` });
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setNotice({ type: "error", text: "Clipboard is not available in this browser." });
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setNotice({ type: "success", text: `${label} copied.` });
    } catch {
      setNotice({ type: "error", text: `Unable to copy ${label.toLowerCase()}.` });
    }
  };

  const handlePaymentScreenshotChange = (event) => {
    const nextFile = event.target.files?.[0] || null;

    if (!nextFile) {
      setPaymentScreenshot(null);
      if (paymentScreenshotInputRef.current) {
        paymentScreenshotInputRef.current.value = "";
      }
      return;
    }

    if (!String(nextFile.type || "").toLowerCase().startsWith("image/")) {
      event.target.value = "";
      setPaymentScreenshot(null);
      setNotice({ type: "error", text: "Upload a PNG, JPG, or other image screenshot." });
      return;
    }

    if (nextFile.size > MAX_SCREENSHOT_SIZE_MB * 1024 * 1024) {
      event.target.value = "";
      setPaymentScreenshot(null);
      setNotice({
        type: "error",
        text: `Payment screenshot must be under ${MAX_SCREENSHOT_SIZE_MB}MB.`,
      });
      return;
    }

    setNotice(null);
    setPaymentScreenshot(nextFile);
  };

  const handleSubmit = async () => {
    if (!details?.canSubmitPayment) return;
    if (!transactionId.trim()) {
      setNotice({ type: "error", text: "Transaction ID is required." });
      return;
    }
    if (!paymentScreenshot) {
      setNotice({ type: "error", text: "Payment screenshot is required." });
      return;
    }

    const payload = new FormData();
    payload.append("transactionId", transactionId.trim());
    payload.append("paymentScreenshot", paymentScreenshot);

    setSubmitting(true);
    setNotice(null);
    try {
      const response = await api({
        ...SummaryApi.submit_registration_payment,
        url: SummaryApi.submit_registration_payment.url.replace(
          ":registrationId",
          encodeURIComponent(registrationId || "")
        ),
        data: payload,
      });
      invalidateMyRegistrationsCache();
      setPaymentScreenshot(null);
      if (paymentScreenshotInputRef.current) {
        paymentScreenshotInputRef.current.value = "";
      }
      setNotice({
        type: "success",
        text: response.data?.message || "Payment proof submitted successfully.",
      });
      await loadDetails({ silent: true });
    } catch (submitError) {
      setNotice({
        type: "error",
        text: submitError.response?.data?.message || "Unable to submit payment proof.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const paymentStatus = String(details?.payment?.paymentStatus || "Pending").trim() || "Pending";
  const isUnderReview = paymentStatus === "UnderReview";
  const isVerified = paymentStatus === "Verified";
  const canUploadProof = Boolean(details?.canSubmitPayment) && !isUnderReview && !isVerified;
  const upiPaymentUrl = buildUpiPaymentUrl(details);

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 px-4 pt-4 pb-8 dark:bg-gray-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <button
          type="button"
          onClick={() => navigate("/student-dashboard/my-events")}
          className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ArrowLeft size={15} />
          Back to My Events
        </button>

        {loading ? (
          <div className="eventmate-panel inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-gray-900/70 dark:text-slate-300">
            <Loader2 size={14} className="animate-spin" />
            Loading payment details...
          </div>
        ) : details ? (
          <>
            <section className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-gray-900/70 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-500 dark:text-indigo-300">
                    Registration Payment
                  </p>
                  <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                    {details?.event?.title || "Event"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {details?.event?.date || "Date TBD"} • {details?.event?.venue || "Venue TBD"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Amount</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(details?.payment?.amount)}
                  </p>
                  <span
                    className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      STATUS_STYLES[paymentStatus] || STATUS_STYLES.Pending
                    }`}
                  >
                    {formatStatus(paymentStatus)}
                  </span>
                </div>
              </div>

              {paymentStatus === "Rejected" && details?.payment?.rejectionReason ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
                  <div className="inline-flex items-center gap-2 font-semibold">
                    <XCircle size={14} />
                    Payment proof needs correction
                  </div>
                  <p className="mt-1">{details.payment.rejectionReason}</p>
                </div>
              ) : null}

              {isUnderReview ? (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <div className="inline-flex items-center gap-2 font-semibold">
                    <Clock3 size={14} />
                    Organizer review in progress
                  </div>
                  <p className="mt-1">
                    Your payment proof has been submitted. QR will be issued after approval.
                  </p>
                </div>
              ) : null}

              {isVerified ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <div className="inline-flex items-center gap-2 font-semibold">
                    <CheckCircle2 size={14} />
                    Payment approved
                  </div>
                  <p className="mt-1">
                    Your registration is confirmed and your QR pass is ready in My Events.
                  </p>
                </div>
              ) : null}
            </section>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-gray-900/70 sm:p-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Payment Instructions
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Account Name</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {details?.paymentConfig?.accountName || "Not available"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">UPI ID</p>
                        <p className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-white">
                          {details?.paymentConfig?.upiId || "Not available"}
                        </p>
                      </div>
                      {details?.paymentConfig?.upiId ? (
                        <button
                          type="button"
                          onClick={() => handleCopy("UPI ID", details.paymentConfig.upiId)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                {details?.paymentConfig?.instructions ? (
                  <div className="mt-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-300">
                    {details.paymentConfig.instructions}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {upiPaymentUrl ? (
                    <a
                      href={upiPaymentUrl}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <ExternalLink size={13} />
                      Open UPI App
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleCopy("Payment amount", formatCurrency(details?.payment?.amount))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <Copy size={13} />
                    Copy Amount
                  </button>
                </div>

                {String(details?.payment?.transactionId || "").trim() ? (
                  <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Submitted Transaction ID</p>
                        <p className="mt-1 break-all text-sm font-semibold text-slate-900 dark:text-white">
                          {details.payment.transactionId}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy("Transaction ID", details.payment.transactionId)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                      >
                        <Copy size={12} />
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}

                {String(details?.payment?.paymentScreenshot || "").trim() ? (
                  <a
                    href={details.payment.paymentScreenshot}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                  >
                    View submitted payment proof
                  </a>
                ) : null}
              </section>

              <aside className="space-y-4">
                {details?.paymentConfig?.qrImageUrl ? (
                  <section className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-gray-900/70">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Scan to Pay</p>
                    <img
                      src={details.paymentConfig.qrImageUrl}
                      alt="Payment QR"
                      className="mt-3 w-full rounded-xl border border-slate-200 object-contain dark:border-white/10"
                    />
                  </section>
                ) : null}

                <section className="eventmate-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-gray-900/70">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Upload Payment Proof
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Upload a screenshot after you complete the payment.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Accepted: image files only, up to {MAX_SCREENSHOT_SIZE_MB}MB.
                  </p>

                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Transaction ID
                      </span>
                      <input
                        id="registration-payment-transaction-id"
                        name="transactionId"
                        value={transactionId}
                        onChange={(event) => setTransactionId(event.target.value)}
                        disabled={!canUploadProof}
                        placeholder="Enter UPI transaction ID"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                      />
                    </label>

                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5">
                      <UploadCloud size={18} className="text-indigo-500" />
                      <span className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        {paymentScreenshot ? paymentScreenshot.name : "Choose payment screenshot"}
                      </span>
                      <input
                        id="registration-payment-screenshot"
                        ref={paymentScreenshotInputRef}
                        type="file"
                        name="paymentScreenshot"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        disabled={!canUploadProof}
                        onChange={handlePaymentScreenshotChange}
                        className="hidden"
                      />
                    </label>
                    {paymentScreenshotPreviewUrl ? (
                      <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                        <img
                          src={paymentScreenshotPreviewUrl}
                          alt="Payment proof preview"
                          className="w-full rounded-lg object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentScreenshot(null);
                            if (paymentScreenshotInputRef.current) {
                              paymentScreenshotInputRef.current.value = "";
                            }
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                          <XCircle size={12} />
                          Remove Screenshot
                        </button>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canUploadProof || submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                      {submitting ? "Submitting..." : paymentStatus === "Rejected" ? "Submit New Proof" : "Submit Payment Proof"}
                    </button>

                    {!details?.canSubmitPayment ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Only the registration owner or team leader can submit payment proof.
                      </p>
                    ) : null}
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
