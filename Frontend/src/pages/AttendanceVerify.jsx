import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredToken, getStoredUser } from "../lib/auth";
import { useToast } from "../context/ToastContext";

const parseToken = (value) => String(value || "").trim();

export default function AttendanceVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = parseToken(searchParams.get("token"));
  const toast = useToast();

  const user = useMemo(() => getStoredUser(), []);
  const accessToken = useMemo(() => getStoredToken(), []);

  const [loading, setLoading] = useState(false);
  const [eventName, setEventName] = useState("");

  useEffect(() => {
    const markFromToken = async () => {
      if (!token) {
        toast.error("Attendance token is missing in this QR link.");
        return;
      }

      if (!user || !accessToken) {
        toast.error("Please log in as organizer or assigned coordinator to verify attendance.");
        return;
      }

      if (!["ORGANIZER", "STUDENT_COORDINATOR"].includes(user.role)) {
        toast.error("Only organizers or assigned coordinators can verify attendance.");
        return;
      }

      setLoading(true);

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
        toast.success(
          response?.data?.message ||
            `Attendance marked for ${payload?.participantName || "participant"}.`
        );
      } catch (error) {
        toast.error(
          error?.response?.data?.message ||
            "Unable to verify attendance from this QR link."
        );
      } finally {
        setLoading(false);
      }
    };

    markFromToken();
  }, [accessToken, toast, token, user]);

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
          ) : null}
        </div>
      </article>
    </section>
  );
}
