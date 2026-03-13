import SummaryApi from "../api/SummaryApi";
import api from "./api";

const REG_CACHE_TTL_MS = 60000;
let cachedMyRegistrations = null;
let cachedMyRegistrationsExpiresAt = 0;
let pendingMyRegistrationsPromise = null;

export const invalidateMyRegistrationsCache = () => {
  cachedMyRegistrations = null;
  cachedMyRegistrationsExpiresAt = 0;
};

const toList = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.registrations)) return payload.registrations;
  if (Array.isArray(payload?.data?.registrations)) return payload.data.registrations;
  return [];
};

const resolveEventId = (item) =>
  String(item?.event?._id || item?.eventId || item?.event || item?._id || "")
    .trim();

const normalizeRegistration = (item) => {
  const qrImageUrl = String(item?.qr?.qrImageUrl || "").trim();
  const eventDoc = item?.event || {};
  const eventLocation = String(eventDoc?.venue?.location || eventDoc?.venue || "").trim();
  const eventStartDate = eventDoc?.schedule?.startDate || null;
  const eventStartTime = String(eventDoc?.schedule?.startTime || "").trim();
  const eventEndTime = String(eventDoc?.schedule?.endTime || "").trim();
  return {
    id: String(item?._id || item?.id || "").trim(),
    eventId: resolveEventId(item),
    eventTitle: String(item?.event?.title || "").trim(),
    eventCategory: String(eventDoc?.category || "").trim(),
    eventStatus: String(eventDoc?.status || "").trim(),
    eventPosterUrl: String(eventDoc?.posterUrl || "").trim(),
    eventLocation,
    eventStartDate,
    eventStartTime,
    eventEndTime,
    status: String(item?.status || "").trim(),
    totalParticipants: Number(item?.totalParticipants || 0) || 0,
    createdAt: item?.createdAt || null,
    isTeamLeader: Boolean(item?.isTeamLeader),
    qr: qrImageUrl
      ? {
          qrImageUrl,
          role: String(item?.qr?.role || "").trim(),
          attendanceMarked: Boolean(item?.qr?.attendanceMarked),
        }
      : null,
  };
};

export const fetchMyRegistrations = async () => {
  if (cachedMyRegistrations && cachedMyRegistrationsExpiresAt > Date.now()) {
    return cachedMyRegistrations;
  }

  if (pendingMyRegistrationsPromise) {
    return pendingMyRegistrationsPromise;
  }

  pendingMyRegistrationsPromise = (async () => {
  try {
    const response = await api({ ...SummaryApi.get_my_registered_events, cacheTTL: REG_CACHE_TTL_MS });
    const rows = toList(response.data).map(normalizeRegistration);
    const result = {
      rows,
      supported: true,
      warning: null,
    };
    cachedMyRegistrations = result;
    cachedMyRegistrationsExpiresAt = Date.now() + REG_CACHE_TTL_MS;
    return result;
  } catch (error) {
    const status = Number(error?.response?.status);
    if (status === 404) {
      const result = {
        rows: [],
        supported: false,
        warning: "My registration history endpoint is not available in this backend build.",
      };
      cachedMyRegistrations = result;
      cachedMyRegistrationsExpiresAt = Date.now() + REG_CACHE_TTL_MS;
      return result;
    }
    throw error;
  } finally {
    pendingMyRegistrationsPromise = null;
  }
  })();

  return pendingMyRegistrationsPromise;
};

export const fetchRegisteredEventIds = async () => {
  const result = await fetchMyRegistrations();
  return {
    ids: new Set(result.rows.map((row) => row.eventId).filter(Boolean)),
    supported: result.supported,
    warning: result.warning,
  };
};
