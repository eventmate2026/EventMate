import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCcw,
  Upload,
  UserCircle2,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventList } from "../lib/backendAdapters";
import { useToastFeedback } from "../hooks/useToastFeedback";

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const parseRegistrationRows = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.registrations)) return payload.registrations;
  if (Array.isArray(payload?.data?.registrations)) return payload.data.registrations;
  return [];
};

const parseAttendanceToken = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  try {
    const parsedUrl = new URL(value);
    const queryToken = String(parsedUrl.searchParams.get("token") || "").trim();
    if (queryToken) return queryToken;

    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    const attendanceIndex = parts.findIndex((item) => item.toLowerCase() === "attendance");
    if (attendanceIndex >= 0 && parts[attendanceIndex + 1]) {
      return decodeURIComponent(parts[attendanceIndex + 1]);
    }

    return decodeURIComponent(parts[parts.length - 1] || "");
  } catch {
    return value.replace(/^.*\/attendance\//i, "").trim();
  }
};

const resolveTokenFromQrImageUrl = (value) => {
  const qrImageUrl = String(value || "").trim();
  if (!qrImageUrl) return "";

  const fromQuery = qrImageUrl.match(/[?&]token=([^&]+)/i)?.[1];
  if (fromQuery) return decodeURIComponent(fromQuery);

  const fromPath = qrImageUrl.match(/\/attendance\/([^/?#]+)/i)?.[1];
  if (fromPath) return decodeURIComponent(fromPath);

  // Cloudinary public_id is saved as "qr_<token>", so recover token from URL path.
  const fromCloudinaryFile = qrImageUrl.match(/\/qr_([a-z0-9]{24,})(?:\.[a-z0-9]+)?(?:[?#].*)?$/i)?.[1];
  if (fromCloudinaryFile) return fromCloudinaryFile;

  const fromCloudinarySegment = qrImageUrl.match(/\/qr_([a-z0-9]{24,})(?:[./?#]|$)/i)?.[1];
  if (fromCloudinarySegment) return fromCloudinarySegment;

  return "";
};

const resolveParticipantToken = (participant) => {
  const explicitToken = String(participant?.token || "").trim();
  if (explicitToken) return explicitToken;
  return resolveTokenFromQrImageUrl(participant?.qrImageUrl);
};

const toParticipantRows = (registration) => {
  const registrationId = normalizeId(registration?._id || registration?.id);
  const registrationStatus = String(registration?.status || "").trim() || "Pending";
  const departmentLookup = new Map();
  const structuredParticipants = [
    registration?.teamLeader,
    ...(Array.isArray(registration?.teamMembers) ? registration.teamMembers : []),
  ].filter(Boolean);
  structuredParticipants.forEach((participant) => {
    const email = normalizeEmail(participant?.email);
    if (!email) return;
    const department = String(participant?.branch || participant?.department || "").trim();
    if (department) departmentLookup.set(email, department);
  });

  const listedParticipants =
    Array.isArray(registration?.participants) && registration.participants.length > 0
      ? registration.participants
      : [
          {
            name:
              registration?.teamLeader?.name ||
              registration?.participantName ||
              registration?.studentName ||
              registration?.student?.name ||
              registration?.user?.name ||
              "Participant",
            email:
              registration?.teamLeader?.email ||
              registration?.participantEmail ||
              registration?.student?.email ||
              registration?.user?.email ||
              "",
            role: "participant",
            qrImageUrl: registration?.qr?.qrImageUrl || "",
            attendanceMarked: Boolean(registration?.qr?.attendanceMarked),
            attendanceMarkedAt: registration?.qr?.attendanceMarkedAt || null,
          },
        ];

  return listedParticipants.map((participant, index) => {
    const participantEmail = String(participant?.email || "").trim();
    const participantDepartment = departmentLookup.get(normalizeEmail(participantEmail)) || "";

    return {
      id: normalizeId(participant?._id || participant?.id || `${registrationId}-${participantEmail || index}`),
      registrationId,
      registrationStatus,
      participantName: String(participant?.name || "Participant").trim() || "Participant",
      participantEmail,
      participantDepartment,
      role: String(participant?.role || "participant").trim(),
      attendanceMarked: Boolean(participant?.attendanceMarked),
      attendanceMarkedAt: participant?.attendanceMarkedAt || null,
      token: resolveParticipantToken(participant),
    };
  });
};

const parseParticipantRows = (payload) => parseRegistrationRows(payload).flatMap((registration) => toParticipantRows(registration));

const formatDate = (value) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return date.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" });
};

const formatClock = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatRelative = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "Now";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 15000) return "Just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes <= 0) return "Now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} mins ago`;
};

const extractParticipantNameFromError = (text) => {
  const value = String(text || "").trim();
  if (!value) return "";
  const match = value.match(/attendance\s+already\s+marked\s+for\s+(.+)$/i);
  if (!match?.[1]) return "";
  return String(match[1]).trim();
};

const loadImageElementFromFile = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to load image."));
    };
    image.src = url;
  });

const createQrDetector = async () => {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) return null;
  try {
    if (typeof window.BarcodeDetector.getSupportedFormats === "function") {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (Array.isArray(formats) && !formats.includes("qr_code")) return null;
    }
    return new window.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
};

const loadJsQrDecoder = async () => {
  try {
    const module = await import("https://esm.sh/jsqr@1.4.0?bundle");
    const decoder = module?.default || module?.jsQR || module;
    return typeof decoder === "function" ? decoder : null;
  } catch {
    return null;
  }
};

const decodeSourceWithJsQr = async (source, decoder, canvasRef) => {
  if (!source || typeof decoder !== "function") return "";

  const sourceWidth = Number(source?.videoWidth || source?.naturalWidth || source?.width || 0);
  const sourceHeight = Number(source?.videoHeight || source?.naturalHeight || source?.height || 0);
  if (!sourceWidth || !sourceHeight) return "";

  const maxDimension = 1280;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  const height = Math.max(1, Math.floor(sourceHeight * scale));

  if (!canvasRef.current && typeof document !== "undefined") {
    canvasRef.current = document.createElement("canvas");
  }

  const canvas = canvasRef.current;
  if (!canvas) return "";

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "";

  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const result = decoder(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
  return String(result?.data || "").trim();
};

export default function CoordinatorAttendanceScanner() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const jsQrRef = useRef(null);
  const decodeCanvasRef = useRef(null);
  const detectorBusyRef = useRef(false);
  const scanRafRef = useRef(0);
  const lastScanAttemptAtRef = useRef(0);
  const pendingScanRef = useRef(null);
  const lookupRef = useRef(new Map());
  const duplicateScanGuardRef = useRef({ token: "", at: 0 });

  const [eventData, setEventData] = useState(null);
  const [participantRows, setParticipantRows] = useState([]);
  const [canReadRegistrations, setCanReadRegistrations] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [scannerEngineLabel, setScannerEngineLabel] = useState("Auto");
  useToastFeedback(message);
  useToastFeedback(error, { defaultType: "error" });
  useToastFeedback(cameraError, { defaultType: "error" });

  const [pendingScan, setPendingScan] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [scanTimestamps, setScanTimestamps] = useState([]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const assignedResponse = await api({
          ...SummaryApi.get_my_assigned_events,
          skipCache: true,
        });

        const registrationResponse = await api({
          ...SummaryApi.get_event_registrations,
          url: SummaryApi.get_event_registrations.url.replace(":eventId", encodeURIComponent(eventId || "")),
        }).catch((registrationError) => {
          const status = Number(registrationError?.response?.status);
          if (status === 403) return null;
          throw registrationError;
        });

        const event =
          extractEventList(assignedResponse.data).find(
            (item) => normalizeId(item?._id) === normalizeId(eventId)
          ) || null;
        const participants = registrationResponse ? parseParticipantRows(registrationResponse.data) : null;

        if (!event) {
          setError("Event not found in your assigned events.");
          setEventData(null);
          setParticipantRows([]);
          return;
        }

        setEventData(event);
        setCanReadRegistrations(Boolean(registrationResponse));
        if (participants) {
          setParticipantRows(participants);
        }
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || "Unable to load event scan dashboard.");
        setEventData(null);
        setParticipantRows([]);
        setCanReadRegistrations(false);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const map = new Map();
    participantRows.forEach((row) => {
      if (row.token) map.set(row.token, row);
    });
    lookupRef.current = map;
  }, [participantRows]);

  useEffect(() => {
    pendingScanRef.current = pendingScan;
  }, [pendingScan]);

  const stopCamera = useCallback(() => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = 0;
    }
    detectorBusyRef.current = false;

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.pause?.();
      video.srcObject = null;
    }

    setCameraActive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const queuePendingToken = useCallback(async (rawValue, sourceLabel) => {
    const token = parseAttendanceToken(rawValue);
    if (!token) {
      setMessage({ type: "error", text: "QR detected, but attendance token could not be parsed." });
      return false;
    }

    const now = Date.now();
    if (
      duplicateScanGuardRef.current.token === token &&
      now - duplicateScanGuardRef.current.at < 2500
    ) {
      return false;
    }
    duplicateScanGuardRef.current = { token, at: now };

    const participant = lookupRef.current.get(token);
    const initialPendingScan = {
      token,
      sourceLabel,
      participantName: participant?.participantName || "Unknown participant",
      participantEmail: participant?.participantEmail || "",
      participantDepartment: participant?.participantDepartment || "",
      registrationStatus: participant?.registrationStatus || "Unknown",
      alreadyMarked: Boolean(participant?.attendanceMarked),
    };
    pendingScanRef.current = initialPendingScan;
    setPendingScan(initialPendingScan);
    setMessage(null);

    try {
      const response = await api({
        ...SummaryApi.preview_attendance_by_token,
        url: SummaryApi.preview_attendance_by_token.url.replace(":token", encodeURIComponent(token)),
      });
      const preview = response?.data?.data || {};

      setPendingScan((current) => {
        if (String(current?.token || "").trim() !== token) return current;
        return {
          ...current,
          participantName: preview?.participantName || current.participantName,
          participantEmail: preview?.email || current.participantEmail,
          participantDepartment: preview?.participantDepartment || current.participantDepartment,
          registrationStatus: preview?.registrationStatus || current.registrationStatus,
          alreadyMarked: Boolean(preview?.attendanceMarked),
        };
      });
    } catch (previewError) {
      const previewMessage =
        previewError?.response?.data?.message || "Unable to verify this QR code right now.";
      const hasFallbackDetails =
        Boolean(initialPendingScan.participantEmail) ||
        initialPendingScan.participantName !== "Unknown participant";

      if (!hasFallbackDetails) {
        pendingScanRef.current = null;
        setPendingScan(null);
        setMessage({ type: "error", text: previewMessage });
        return false;
      }
    }

    return true;
  }, []);

  const resolveJsQrDecoder = useCallback(async () => {
    if (typeof jsQrRef.current === "function") return jsQrRef.current;
    const decoder = await loadJsQrDecoder();
    if (decoder) jsQrRef.current = decoder;
    return decoder;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setMessage(null);

    let detector = detectorRef.current;
    if (!detector) {
      detector = await createQrDetector();
      detectorRef.current = detector;
    }

    const jsQrWarmup = resolveJsQrDecoder();
    void jsQrWarmup;
    const jsQrDecoder = detector ? null : await jsQrWarmup;
    if (!detector && !jsQrDecoder) {
      setCameraSupported(false);
      setCameraError("Live QR scanner is not supported in this browser. Use image upload instead.");
      return;
    }

    setCameraSupported(true);
    setScannerEngineLabel(detector ? "Native" : "Compatibility");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks?.()[0];
      if (track?.getCapabilities && track?.applyConstraints) {
        const capabilities = track.getCapabilities();
        const advanced = {};
        if (Array.isArray(capabilities?.focusMode) && capabilities.focusMode.includes("continuous")) {
          advanced.focusMode = "continuous";
        }
        if (Object.keys(advanced).length > 0) {
          try {
            await track.applyConstraints({ advanced: [advanced] });
          } catch {
            // Ignore focus constraint errors.
          }
        }
      }
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }

      video.srcObject = stream;
      await video.play();
      setCameraActive(true);

      const detectLoop = async () => {
        const videoNode = videoRef.current;
        if (!videoNode || !streamRef.current) return;

        if (pendingScanRef.current) {
          scanRafRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        if (videoNode.readyState < 2) {
          scanRafRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        if (detectorBusyRef.current) {
          scanRafRef.current = requestAnimationFrame(detectLoop);
          return;
        }

        const now = Date.now();
        if (now - lastScanAttemptAtRef.current < 220) {
          scanRafRef.current = requestAnimationFrame(detectLoop);
          return;
        }
        lastScanAttemptAtRef.current = now;

        detectorBusyRef.current = true;
        try {
          let rawValue = "";

          if (detectorRef.current) {
            const barcodes = await detectorRef.current.detect(videoNode);
            const match = Array.isArray(barcodes)
              ? barcodes.find((item) => String(item?.rawValue || "").trim())
              : null;
            rawValue = String(match?.rawValue || "").trim();
          }

          if (!rawValue && (jsQrRef.current || jsQrDecoder)) {
            const resolvedDecoder = jsQrRef.current || jsQrDecoder;
            rawValue = await decodeSourceWithJsQr(videoNode, resolvedDecoder, decodeCanvasRef);
          }

          if (rawValue) void queuePendingToken(rawValue, "Live camera");
        } catch {
          // Swallow scanner frame errors to keep loop alive.
        } finally {
          detectorBusyRef.current = false;
          scanRafRef.current = requestAnimationFrame(detectLoop);
        }
      };

      scanRafRef.current = requestAnimationFrame(detectLoop);
    } catch (cameraErr) {
      stopCamera();
      if (cameraErr?.name === "NotAllowedError") {
        setCameraError("Camera permission is blocked. Allow camera access to scan live QR.");
      } else if (cameraErr?.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError("Unable to start camera scanner.");
      }
    }
  }, [queuePendingToken, resolveJsQrDecoder, stopCamera]);

  const addRecentScan = useCallback((entry, { countForRate = false } = {}) => {
    const now = Date.now();
    setRecentScans((prev) => [{ ...entry, at: now }, ...prev].slice(0, 8));
    if (countForRate) {
      setScanTimestamps((prev) => [now, ...prev.filter((value) => now - value < 60000)].slice(0, 120));
    }
  }, []);

  const markAttendanceWithToken = useCallback(
    async (rawToken, sourceLabel) => {
      const token = parseAttendanceToken(rawToken);
      if (!token) {
        setMessage({ type: "error", text: "Scan or enter a valid attendance token." });
        return false;
      }

      setMarking(true);
      setMessage(null);

      const participant = lookupRef.current.get(token);

      try {
        const response = await api({
          ...SummaryApi.mark_attendance_by_token,
          url: SummaryApi.mark_attendance_by_token.url.replace(":token", encodeURIComponent(token)),
        });

        const payload = response?.data?.data || {};
        const participantName = String(payload?.participantName || participant?.participantName || "Participant");
        const participantEmail = String(payload?.email || participant?.participantEmail || "");
        const participantDepartment = participant?.participantDepartment || "";
        const markedAt = payload?.markedAt || new Date().toISOString();
        const successText = response.data?.message || `Attendance marked for ${participantName}.`;

        setLastResult({
          type: "success",
          participantName,
          participantEmail,
          participantDepartment,
          text: successText,
          sourceLabel,
          at: Date.now(),
        });

        addRecentScan(
          {
            type: "success",
            participantName,
            participantEmail,
            participantDepartment,
            sourceLabel,
          },
          { countForRate: true }
        );

        setParticipantRows((prev) => {
          const tokenText = String(token || "").trim();
          const index = prev.findIndex((row) => String(row?.token || "").trim() === tokenText);
          if (index >= 0) {
            const next = [...prev];
            next[index] = {
              ...next[index],
              participantName: participantName || next[index].participantName,
              participantEmail: participantEmail || next[index].participantEmail,
              participantDepartment: participantDepartment || next[index].participantDepartment,
              attendanceMarked: true,
              attendanceMarkedAt: markedAt,
              token: tokenText || next[index].token,
            };
            return next;
          }

          return [
            {
              id: `session-${tokenText || Date.now()}`,
              registrationId: "",
              registrationStatus: "Confirmed",
              participantName: participantName || "Participant",
              participantEmail,
              participantDepartment,
              role: String(payload?.role || "participant").trim(),
              attendanceMarked: true,
              attendanceMarkedAt: markedAt,
              token: tokenText,
            },
            ...prev,
          ];
        });

        setMessage({ type: "success", text: successText });
        if (canReadRegistrations) {
          await load({ silent: true });
        }
        return true;
      } catch (attendanceError) {
        const errorText = attendanceError.response?.data?.message || "Unable to mark attendance for this token.";
        const parsedName = extractParticipantNameFromError(errorText);
        const participantName = participant?.participantName || parsedName || "Unknown participant";
        const participantEmail = participant?.participantEmail || "";
        const participantDepartment = participant?.participantDepartment || "";

        setLastResult({
          type: "error",
          participantName,
          participantEmail,
          participantDepartment,
          text: errorText,
          sourceLabel,
          at: Date.now(),
        });

        addRecentScan({
          type: "error",
          participantName,
          participantEmail,
          participantDepartment,
          sourceLabel,
        });

        setMessage({ type: "error", text: errorText });
        return false;
      } finally {
        setMarking(false);
      }
    },
    [addRecentScan, canReadRegistrations, load]
  );

  const handleConfirmPending = async () => {
    if (!pendingScan?.token) return;
    await markAttendanceWithToken(pendingScan.token, pendingScan.sourceLabel || "Live camera");
    setPendingScan(null);
  };

  useEffect(() => {
    if (!pendingScan?.token) return;
    const source = String(pendingScan.sourceLabel || "").toLowerCase();
    if (!source.includes("live") && !source.includes("image")) return;
    if (pendingScan.alreadyMarked) return;
    void handleConfirmPending();
  }, [pendingScan]);

  const handleScanImageFile = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMessage(null);
    setCameraError(null);

    let detector = detectorRef.current;
    if (!detector) {
      detector = await createQrDetector();
      detectorRef.current = detector;
    }

    let decoder = jsQrRef.current;
    if (!detector && !decoder) {
      decoder = await resolveJsQrDecoder();
      if (decoder) jsQrRef.current = decoder;
    }

    if (!detector && !decoder) {
      setCameraSupported(false);
      setMessage({ type: "error", text: "Image QR scan is not supported in this browser." });
      return;
    }

    setCameraSupported(true);
    setScannerEngineLabel(detector ? "Native" : "Compatibility");

    try {
      let targetImage = null;
      let shouldCloseImage = false;

      if (typeof createImageBitmap === "function") {
        targetImage = await createImageBitmap(file);
        shouldCloseImage = true;
      } else {
        targetImage = await loadImageElementFromFile(file);
      }

      let rawValue = "";
      if (detector) {
        const barcodes = await detector.detect(targetImage);
        const match = Array.isArray(barcodes)
          ? barcodes.find((item) => String(item?.rawValue || "").trim())
          : null;
        rawValue = String(match?.rawValue || "").trim();
      }

      if (!rawValue && (decoder || jsQrRef.current)) {
        rawValue = await decodeSourceWithJsQr(targetImage, decoder || jsQrRef.current, decodeCanvasRef);
      }

      if (shouldCloseImage && targetImage?.close) targetImage.close();

      if (!rawValue) {
        setMessage({ type: "error", text: "No QR code found in this image." });
        return;
      }

      await queuePendingToken(rawValue, "Image upload");
    } catch {
      setMessage({ type: "error", text: "Unable to scan QR from image. Try another image." });
    }
  }, [queuePendingToken, resolveJsQrDecoder]);

  const stats = useMemo(() => {
    const total = participantRows.length;
    const checkedIn = participantRows.filter((row) => row.attendanceMarked).length;
    const remaining = Math.max(0, total - checkedIn);
    const progress = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const now = Date.now();
    const scanRate = scanTimestamps.filter((value) => now - value < 60000).length;

    return { total, checkedIn, remaining, progress, scanRate };
  }, [participantRows, scanTimestamps]);

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate(`/coordinator-dashboard/event/${encodeURIComponent(eventId || "")}/details`)}
          className="inline-flex items-center rounded-md p-1 text-slate-600 dark:text-slate-300 hover:bg-white/70 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>

        {loading && (
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Loading scan workspace...
          </section>
        )}

        {error && !loading && (
          <section className="eventmate-panel rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            {error}
          </section>
        )}

        {!loading && !error && eventData && (
          <>
            <section className="px-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Attendance Scanner</h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    Scan student QR codes to mark attendance for {eventData?.title || "this event"}.
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                    <CalendarDays size={12} />
                    {formatDate(eventData?.schedule?.startDate)}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold ${
                    cameraActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {cameraActive ? "Camera Active" : "Camera Off"}
                </span>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
              <div className="space-y-4">
                <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                      <QrCode size={15} className="text-indigo-500" />
                      Live Scanner
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={cameraActive ? stopCamera : startCamera}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                        title={cameraActive ? "Stop Camera" : "Start Camera"}
                      >
                        {cameraActive ? <CameraOff size={13} /> : <Camera size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => load({ silent: true })}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                        title="Refresh"
                      >
                        {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 relative overflow-hidden rounded-lg border border-slate-200 dark:border-white/10 bg-slate-900 aspect-[16/9]">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className={`h-full w-full object-cover transition-opacity duration-200 ${
                        cameraActive ? "opacity-100" : "opacity-0 pointer-events-none"
                      }`}
                    />
                    {!cameraActive && (
                      <div className="absolute inset-0 h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(224,231,255,0.8),rgba(38,38,38,0.9)_38%),linear-gradient(125deg,#dedf77,#243f16)] flex items-center justify-center">
                        <p className="text-sm text-slate-100 text-center px-4">
                          {cameraError
                            ? cameraError
                            : "Start camera or scan an image file to detect attendance QR."}
                        </p>
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-36 w-36 sm:h-44 sm:w-44 rounded-md border-2 border-indigo-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.42)]" />
                    </div>

                    <div className="absolute left-1/2 -translate-x-1/2 bottom-3 rounded-full bg-slate-900/75 px-3 py-1 text-[11px] font-medium text-slate-100">
                      Align QR code within the frame
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <Upload size={12} />
                      Scan Image File
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleScanImageFile}
                      className="hidden"
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-300">Engine: {scannerEngineLabel}</p>
                    {!cameraSupported && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Browser QR support is limited. Use image upload instead.
                      </p>
                    )}
                  </div>
                </section>

              </div>

              <aside className="space-y-3">
                <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-3">
                  {pendingScan ? (
                    <div className={`rounded-lg border-l-4 p-3 ${pendingScan.alreadyMarked ? "border-l-amber-500 bg-amber-50/70 dark:bg-amber-500/10" : "border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/10"}`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-[11px] font-semibold ${pendingScan.alreadyMarked ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                          Verified
                        </p>
                        <p className="text-[10px] text-slate-400">{formatRelative(Date.now())}</p>
                      </div>
                      <div className="mt-2 flex items-start gap-2">
                        <UserCircle2 className="text-slate-500 dark:text-slate-300" size={34} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{pendingScan.participantName}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate">{pendingScan.participantEmail || "Email unavailable"}</p>
                          {pendingScan.participantDepartment ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate">{pendingScan.participantDepartment}</p>
                          ) : null}
                          <div className="mt-2 inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                            Event Status: {pendingScan.registrationStatus}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleConfirmPending}
                          disabled={marking || pendingScan.alreadyMarked}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-70 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30"
                        >
                          {marking ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Confirm Entry
                        </button>
                      </div>
                    </div>
                  ) : lastResult ? (
                    <div className={`rounded-lg border-l-4 p-3 ${lastResult.type === "success" ? "border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-500/10" : "border-l-red-500 bg-red-50/70 dark:bg-red-500/10"}`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-[11px] font-semibold ${lastResult.type === "success" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                          {lastResult.type === "success" ? "Verified" : "Failed"}
                        </p>
                        <p className="text-[10px] text-slate-400">{formatRelative(lastResult.at)}</p>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{lastResult.participantName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-300">{lastResult.participantEmail || "Email unavailable"}</p>
                      {lastResult.participantDepartment ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-300">{lastResult.participantDepartment}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{lastResult.text}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                      <p className="text-xs text-slate-500 dark:text-slate-300">No scan recorded yet in this session.</p>
                    </div>
                  )}
                </section>

                <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Session Stats</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                      <span>Total Checked In</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {stats.checkedIn} / {stats.total}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${stats.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <article className="rounded-md border border-slate-200 dark:border-white/10 bg-indigo-50/60 dark:bg-indigo-500/10 px-3 py-2">
                      <p className="text-slate-500 dark:text-slate-300">Remaining</p>
                      <p className="mt-1 text-xl font-bold text-indigo-600 dark:text-indigo-300">{stats.remaining}</p>
                    </article>
                    <article className="rounded-md border border-slate-200 dark:border-white/10 bg-violet-50/60 dark:bg-violet-500/10 px-3 py-2">
                      <p className="text-slate-500 dark:text-slate-300">Scan Rate</p>
                      <p className="mt-1 text-xl font-bold text-violet-600 dark:text-violet-300">{stats.scanRate}/min</p>
                    </article>
                  </div>
                </section>

                <section className="eventmate-panel rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Recent Scans</p>
                  <div className="mt-3 space-y-2">
                    {recentScans.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-300">No scans captured yet.</p>
                    ) : (
                      recentScans.map((scan, index) => (
                        <article
                          key={`${scan.participantEmail}-${scan.at}-${index}`}
                          className="flex items-start justify-between gap-2 rounded-md border border-slate-200 dark:border-white/10 px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{scan.participantName}</p>
                            {scan.participantDepartment ? (
                              <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate">{scan.participantDepartment}</p>
                            ) : null}
                            <p className="text-[11px] text-slate-500 dark:text-slate-300">{formatClock(scan.at)}</p>
                          </div>
                          {scan.type === "success" ? (
                            <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </aside>
            </section>

          </>
        )}
      </div>
    </div>
  );
}
