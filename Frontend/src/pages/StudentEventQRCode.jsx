import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Loader2,
  MapPin,
  QrCode,
} from "lucide-react";
import { fetchMyRegistrations } from "../lib/registrationApi";

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value || "").trim();
  if (!text) return null;

  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return "Date TBD";
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

const formatTimeRange = (start, end) => {
  const startText = String(start || "").trim();
  const endText = String(end || "").trim();
  if (startText && endText) return `${startText} - ${endText}`;
  if (startText) return startText;
  if (endText) return endText;
  return "Time TBD";
};

const normalizeStatus = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "Pending";
  if (normalized === "PendingMemberVerification") return "Pending Team Acceptance";
  return normalized.replace(/([a-z])([A-Z])/g, "$1 $2");
};

export default function StudentEventQRCode() {
  const navigate = useNavigate();
  const { registrationId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [warning, setWarning] = useState(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let isActive = true;
    const requestId = ++requestIdRef.current;

    const loadRegistration = async () => {
      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        const response = await fetchMyRegistrations();
        if (!isActive || requestIdRef.current !== requestId) return;
        if (response?.supported === false) {
          setError(response?.warning || "Registration history is unavailable right now.");
          setRegistration(null);
          return;
        }
        setWarning(response.warning);
        const selected = response.rows.find(
          (item) => String(item?.id || "").trim() === String(registrationId || "").trim()
        );

        if (!selected) {
          setError("QR pass not found for this registration.");
          setRegistration(null);
        } else {
          setRegistration(selected);
        }
      } catch (fetchError) {
        if (!isActive || requestIdRef.current !== requestId) return;
        setError(fetchError?.response?.data?.message || "Unable to load QR pass.");
        setRegistration(null);
      } finally {
        if (!isActive || requestIdRef.current !== requestId) return;
        setLoading(false);
      }
    };

    loadRegistration();

    return () => {
      isActive = false;
    };
  }, [registrationId]);

  const canShowQr = Boolean(registration?.qr?.qrImageUrl);
  const attendanceMarked = Boolean(registration?.qr?.attendanceMarked);
  const registrationStatus = useMemo(
    () => normalizeStatus(registration?.status),
    [registration?.status]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-gray-900 dark:text-gray-100">
      <button
        type="button"
        onClick={() => navigate("/student-dashboard/my-events")}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-indigo-300"
      >
        <ArrowLeft size={16} />
        Back to My Events
      </button>

      {warning && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
          {warning}
        </p>
      )}

      {loading ? (
        <div className="mt-8 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-300">
          <Loader2 size={14} className="animate-spin" />
          Loading QR pass...
        </div>
      ) : error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
          {error}
        </div>
      ) : (
        <section className="mt-6 mx-auto max-w-xl rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-5 sm:p-6 shadow-sm">
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 px-4 py-3 text-center">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-200">
              <BadgeCheck size={14} />
              Event Attendance QR Code
            </p>
            <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">
              This QR code is valid only for this event.
            </p>
          </div>

          <h1 className="mt-5 text-center text-2xl font-bold text-gray-900 dark:text-white">
            {registration?.eventTitle || "Registered Event"}
          </h1>

          <div className="mt-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-2">
              <CalendarDays size={13} className="text-indigo-500 dark:text-indigo-300" />
              {formatDate(registration?.eventStartDate)} |{" "}
              {formatTimeRange(registration?.eventStartTime, registration?.eventEndTime)}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-2">
              <MapPin size={13} className="text-indigo-500 dark:text-indigo-300" />
              {registration?.eventLocation || "Venue TBD"}
            </p>
          </div>

          {canShowQr ? (
            <div className="mt-6 flex flex-col items-center">
              <div className="rounded-[18px] p-[3px] bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500">
                <div className="rounded-[14px] bg-white p-2">
                  <img
                    src={registration.qr.qrImageUrl}
                    alt={`Attendance QR for ${registration?.eventTitle || "event"}`}
                    className="h-48 w-48 rounded-lg border border-slate-200 object-contain"
                  />
                </div>
              </div>

              <p
                className={`mt-4 text-xs font-semibold ${
                  attendanceMarked
                    ? "text-emerald-600 dark:text-emerald-300"
                    : "text-rose-600 dark:text-rose-300"
                }`}
              >
                {attendanceMarked ? "Attendance already marked" : "Attendance Status: Not Marked"}
              </p>
              <p className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
                Show this QR code at the event entrance for attendance verification.
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
              QR is not available yet. Current registration status:{" "}
              <span className="font-semibold">{registrationStatus}</span>.
            </div>
          )}

          <div className="mt-6 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
            <p className="inline-flex items-center gap-2 font-semibold">
              <AlertTriangle size={13} />
              Do not share, forward, or screenshot this QR code.
            </p>
            <p className="mt-1">It is valid for one student and one event only.</p>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <QrCode size={13} />
            Registration Status: {registrationStatus}
          </div>
        </section>
      )}
    </div>
  );
}
