import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api, { primeBackendConnection } from "../lib/api";
import {
  clearPendingVerificationEmail,
  getPendingVerificationEmail,
  storePendingVerificationEmail,
} from "../lib/pendingVerification";
import SummaryApi from "../api/SummaryApi";
import { useToast } from "../context/ToastContext";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const resolvePresetEmail = () => {
    const searchEmail = new URLSearchParams(location.search).get("email");
    return String(location.state?.email || searchEmail || getPendingVerificationEmail() || "")
      .trim()
      .toLowerCase();
  };
  const presetEmail = resolvePresetEmail();

  const [formData, setFormData] = useState({
    email: presetEmail,
    otp: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const hasVerificationEmail = Boolean(formData.email);

  useEffect(() => {
    const nextEmail = resolvePresetEmail();
    if (!nextEmail) return;
    setFormData((prev) => (prev.email ? prev : { ...prev, email: nextEmail }));
    storePendingVerificationEmail(nextEmail);
  }, [location.search, location.state]);

  useEffect(() => {
    const initialMessage = String(location.state?.message || "").trim();
    if (!initialMessage) return;
    toast.info(initialMessage);
  }, [location.state, toast]);

  useEffect(() => {
    void primeBackendConnection();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value.trim(),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!hasVerificationEmail) {
      toast.error("Verification email not found. Please sign up or log in again.");
      return;
    }

    if (!formData.otp) {
      toast.error("Please enter the OTP sent to your email.");
      return;
    }

    setIsLoading(true);
    try {
      await primeBackendConnection({ maxWaitMs: 2500 });
      const response = await api({ ...SummaryApi.verify_email, data: formData });
      clearPendingVerificationEmail();
      toast.success(response.data?.message || "Email verified successfully.");
      setTimeout(
        () => navigate(`/login?email=${encodeURIComponent(formData.email)}`, { replace: true }),
        900
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!hasVerificationEmail) {
      toast.error("Verification email not found. Please sign up or log in again.");
      return;
    }

    setIsResending(true);
    try {
      await primeBackendConnection({ maxWaitMs: 2500 });
      const response = await api({
        ...SummaryApi.resend_verification_otp,
        data: { email: formData.email },
      });
      storePendingVerificationEmail(formData.email);
      const apiMessage = response.data?.message || "A new OTP has been sent to your email.";
      const deliveryPending =
        Boolean(response.data?.deliveryPending) || Number(response.status) === 202;
      if (deliveryPending) {
        toast.info(apiMessage);
      } else {
        toast.success(apiMessage);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to resend OTP right now.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <section className="eventmate-page min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/60 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full bg-white/90 dark:bg-slate-900/85 backdrop-blur rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 p-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300 font-semibold">Verify Email</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Confirm your account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 mt-2">
            Enter the OTP sent to your email to activate your EventMate account.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} autoComplete="on">
          <div>
            <label htmlFor="verify-email-address" className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
            <input
              id="verify-email-address"
              name="email"
              type="email"
              readOnly
              value={formData.email || "No verification email found"}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-3 text-sm text-slate-900 dark:text-slate-100"
            />
            {!hasVerificationEmail && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                Go back to signup or login and request a fresh OTP first.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="verify-email-otp" className="text-sm font-medium text-slate-700 dark:text-slate-200">OTP</label>
            <input
              id="verify-email-otp"
              name="otp"
              value={formData.otp}
              onChange={handleChange}
              placeholder="Enter 6 digit code"
              autoComplete="one-time-code"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/40"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !hasVerificationEmail}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-70"
          >
            {isLoading ? "Verifying..." : "Verify Email"}
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={isResending || isLoading || !hasVerificationEmail}
            className="w-full py-3 rounded-xl border border-indigo-200 text-indigo-700 font-semibold hover:bg-indigo-50 transition disabled:opacity-70 dark:border-indigo-400/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
          >
            {isResending ? "Sending OTP..." : "Resend OTP"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-500 dark:text-slate-300">
          <Link to="/signup" className="hover:text-indigo-600 dark:hover:text-indigo-300">Back to signup</Link>
          <Link to="/login" className="font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">Go to login</Link>
        </div>
      </div>
    </section>
  );
}

