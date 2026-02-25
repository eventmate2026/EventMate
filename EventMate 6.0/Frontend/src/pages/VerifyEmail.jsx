import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const presetEmail = location.state?.email || "";

  const [formData, setFormData] = useState({
    email: presetEmail,
    otp: "",
  });
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value.trim() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!formData.email || !formData.otp) {
      setMessage({ type: "error", text: "Email and OTP are required." });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api({ ...SummaryApi.verify_email, data: formData });
      setMessage({ type: "success", text: response.data?.message || "Email verified successfully." });
      setTimeout(() => navigate("/login", { replace: true }), 900);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Verification failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
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
            />
          </div>
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

          {message && (
            <p
              className={`text-sm text-center rounded-lg py-2 ${
                message.type === "success"
                  ? "text-green-700 bg-green-50 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "text-red-600 bg-red-50 dark:bg-red-500/15 dark:text-red-300"
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-70"
          >
            {isLoading ? "Verifying..." : "Verify Email"}
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

