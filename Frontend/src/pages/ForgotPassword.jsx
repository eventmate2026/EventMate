import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { emitToast } from "../lib/toastBus";
import PageBackButton from "../components/PageBackButton";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email");
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const submitEmail = async () => {
    if (!formData.email) {
      setErrors({ email: "Email is required" });
      emitToast({ type: "error", text: "Email is required." });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api({
        ...SummaryApi.forgot_password,
        skipSuccessToast: true,
        skipErrorToast: true,
        data: { email: formData.email },
      });
      const apiMessage = response.data?.message || "A verification code has been sent to your email.";
      emitToast({ type: "success", text: apiMessage });
      setStep("reset");
    } catch (error) {
      emitToast({
        type: "error",
        text:
          error.response?.data?.message ||
          error.message ||
          "Unable to send the verification code. Try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const submitReset = async () => {
    const newErrors = {};
    if (!formData.otp) newErrors.otp = "OTP is required";
    if (!formData.newPassword) newErrors.newPassword = "New password is required";
    if (formData.newPassword.length < 8) newErrors.newPassword = "Password must be at least 8 characters";
    if (formData.confirmPassword !== formData.newPassword) newErrors.confirmPassword = "Passwords do not match";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      emitToast({
        type: "error",
        text: Object.values(newErrors)[0] || "Please review the form and try again.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api({
        ...SummaryApi.reset_password,
        skipSuccessToast: true,
        skipErrorToast: true,
        data: {
          email: formData.email,
          otp: formData.otp,
          newPassword: formData.newPassword,
        },
      });
      emitToast({
        type: "success",
        text: response.data?.message || "Password reset successful.",
      });
      setTimeout(() => navigate("/login"), 900);
    } catch (error) {
      emitToast({
        type: "error",
        text:
          error.response?.data?.message ||
          error.message ||
          "Unable to reset the password. Try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === "email") {
      await submitEmail();
    } else {
      await submitReset();
    }
  };

  return (
    <section className="eventmate-page min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950/60 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full space-y-4">
        <PageBackButton to="/login" label="Back to Login" />

        <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 p-8">
          <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300 font-semibold">Reset Password</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {step === "email" ? "Request OTP" : "Set a new password"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 mt-2">
            {step === "email"
              ? "Enter your email and we will send you a reset OTP."
              : "Enter the OTP and your new password to complete the reset."}
          </p>
        </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@college.edu"
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/40"
              disabled={step === "reset"}
            />
          </div>

          {step === "reset" && (
            <>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">OTP</label>
                <input
                  name="otp"
                  value={formData.otp}
                  onChange={handleChange}
                  placeholder="Enter 6 digit code"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">New Password</label>
                <div className="relative mt-1">
                  <input
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={handleChange}
                    placeholder="Minimum 8 characters"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3 pr-11 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-300 transition"
                    tabIndex={-1}
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Confirm Password</label>
                <div className="relative mt-1">
                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter new password"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-3 pr-11 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-300 transition"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-70"
          >
            {isLoading ? "Please wait..." : step === "email" ? "Send OTP" : "Reset Password"}
          </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm text-slate-500 dark:text-slate-300">
            <Link to="/login" className="hover:text-indigo-600 dark:hover:text-indigo-300">Back to login</Link>
            {step === "reset" && (
              <button
                type="button"
                className="font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                onClick={() => setStep("email")}
              >
                Resend OTP
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
