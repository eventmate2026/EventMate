import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredToken, getStoredUser } from "../lib/auth";

const parseToken = (value) => String(value || "").trim();

export default function AttendanceVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = parseToken(searchParams.get("token"));

  const user = useMemo(() => getStoredUser(), []);
  const accessToken = useMemo(() => getStoredToken(), []);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [eventName, setEventName] = useState("");

  useEffect(() => {
    const markFromToken = async () => {
      if (!token) {
        setMessage("Attendance token is missing in this QR link.");
        return;
      }

      if (!user || !accessToken) {
        setMessage("Please log in as organizer or assigned coordinator to verify attendance.");
        return;
      }

      if (!["ORGANIZER", "STUDENT_COORDINATOR", "STUDENT"].includes(user.role)) {
        setMessage("Only organizers or assigned coordinators can verify attendance.");
        return;
      }

      setLoading(true);
      setMessage("");
      setSuccess(false);

      try {
        const response = await api({
          ...SummaryApi.mark_attendance_by_token,
          url: SummaryApi.mark_attendance_by_token.url.replace(
            ":token",
            encodeURIComponent(token)
          )
        });

        const payload = response?.data?.data || {};
        setEventName(String(payload?.eventName || "").trim());
        setMessage(
          response?.data?.message ||
            `Attendance marked for ${payload?.participantName || "participant"}.`
        );
        setSuccess(true);
      } catch (error) {
        setMessage(
          error?.response?.data?.message ||
            "Unable to verify attendance from this QR link."
        );
      } finally {
        setLoading(false);
      }
    };

    markFromToken();
  }, [accessToken, token, user]);

  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        Back
      </button>

      <article className="mt-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Attendance Verification
        </h1>
        {eventName ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Event: {eventName}
          </p>
        ) : null}

        <div className="mt-5">
          {loading ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin" />
              Verifying attendance...
            </p>
          ) : (
            <p
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                success
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
              }`}
            >
              {success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {message || "No verification response."}
            </p>
          )}
        </div>

        {!token ? null : (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 break-all">
            Token: {token}
          </p>
        )}
      </article>
    </section>
  );
}
