import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api from "../lib/api";

export default function VerifyRegistration() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "info", text: "Verifying registration..." });

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setMessage({ type: "error", text: "Missing verification token." });
        setLoading(false);
        return;
      }

      try {
        const response = await api({
          url: `/api/registrations/verify/${encodeURIComponent(token)}`,
          method: "post",
          skipAuth: true,
        });
        setMessage({
          type: "success",
          text: response.data?.message || "Registration verified successfully.",
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error.response?.data?.message || "Unable to verify registration.",
        });
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <section className="eventmate-page min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/60 flex items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full bg-white/90 dark:bg-slate-900/85 backdrop-blur rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-indigo-500 dark:text-indigo-300 font-semibold">Event Registration</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">Member Verification</h1>

        <div className="mt-6">
          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Verifying...
            </p>
          ) : (
            <p
              className={`text-sm rounded-lg py-2 px-3 ${
                message.type === "success"
                  ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "text-red-600 bg-red-50 dark:bg-red-500/15 dark:text-red-300"
              }`}
            >
              {message.text}
            </p>
          )}
        </div>

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
