import SummaryApi from "../api/SummaryApi";
import api from "./api";

const REG_CACHE_TTL_MS = 60000;
let cachedMyRegistrations = null;
let cachedMyRegistrationsExpiresAt = 0;
let pendingMyRegistrationsPromise = null;
let pendingMyRegistrationsRequestId = 0;
let cacheGeneration = 0;

export const invalidateMyRegistrationsCache = () => {
  cacheGeneration += 1;
  cachedMyRegistrations = null;
  cachedMyRegistrationsExpiresAt = 0;
  pendingMyRegistrationsPromise = null;
};

const toList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.registrations)) return payload.registrations;
  if (Array.isArray(payload?.data?.registrations)) return payload.data.registrations;
  return [];
};

const resolveEventId = (item) => {
  const event = item?.event;
  if (typeof event === "string") return event.trim();
  if (event && typeof event === "object") {
    const fromEvent = String(event._id || event.id || "").trim();
    if (fromEvent) return fromEvent;
  }
  return String(item?.eventId || item?._id || item?.id || "").trim();
};

const resolveEventLocation = (eventDoc, item) => {
  const venue = eventDoc?.venue;
  if (typeof venue === "string") return venue.trim();
  if (venue && typeof venue === "object") {
    const venueText = String(venue.location || venue.name || venue.address || "").trim();
    if (venueText) return venueText;
  }
  return String(eventDoc?.location || item?.eventLocation || "").trim();
};

const normalizeRegistration = (item) => {
  const qrImageUrl = String(item?.qr?.qrImageUrl || "").trim();
  const eventDoc = item?.event && typeof item.event === "object" ? item.event : {};
  const eventLocation = resolveEventLocation(eventDoc, item);
  const eventStartDate = eventDoc?.schedule?.startDate || null;
  const eventStartTime = String(eventDoc?.schedule?.startTime || "").trim();
  const eventEndTime = String(eventDoc?.schedule?.endTime || "").trim();
  return {
    id: String(item?._id || item?.id || "").trim(),
    eventId: resolveEventId(item),
    eventTitle: String(item?.event?.title || "").trim(),
    eventCategory: String(eventDoc?.category || "").trim(),
    eventIsTeamEvent: Boolean(eventDoc?.isTeamEvent),
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
    participantName: String(item?.participantName || item?.qr?.name || "").trim() || null,
    participantEmail: String(item?.participantEmail || item?.qr?.email || "").trim().toLowerCase() || null,
    feedbackSubmitted: Boolean(item?.feedbackSubmitted),
    feedbackSubmittedAt: item?.feedbackSubmittedAt || null,
    certificateIssued: Boolean(item?.certificateIssued),
    certificateIssuedAt: item?.certificateIssuedAt || null,
    certificateUrl: String(item?.certificateUrl || "").trim() || null,
    certificateType: String(item?.certificateType || "").trim() || null,
    qr: qrImageUrl
      ? {
          qrImageUrl,
          role: String(item?.qr?.role || "").trim(),
          attendanceMarked: Boolean(item?.qr?.attendanceMarked),
        }
      : null,
  };
};

export const fetchMyRegistrations = async (options = {}) => {
  const { bypassCache = false } = options;

  if (!bypassCache && cachedMyRegistrations && cachedMyRegistrationsExpiresAt > Date.now()) {
    return cachedMyRegistrations;
  }

  if (pendingMyRegistrationsPromise) {
    return pendingMyRegistrationsPromise;
  }

  const requestGeneration = cacheGeneration;
  const requestId = ++pendingMyRegistrationsRequestId;

  pendingMyRegistrationsPromise = (async () => {
    try {
      const response = await api({ ...SummaryApi.get_my_registered_events, cacheTTL: REG_CACHE_TTL_MS });
      const rows = toList(response.data).map(normalizeRegistration);
      const result = {
        rows,
        supported: true,
        warning: null,
      };
      if (requestGeneration === cacheGeneration) {
        cachedMyRegistrations = result;
        cachedMyRegistrationsExpiresAt = Date.now() + REG_CACHE_TTL_MS;
      }
      return result;
    } catch (error) {
      const status = Number(error?.response?.status);
      if (status === 404) {
        const result = {
          rows: [],
          supported: false,
          warning: "Your registration history is unavailable right now.",
        };
        if (requestGeneration === cacheGeneration) {
          cachedMyRegistrations = result;
          cachedMyRegistrationsExpiresAt = Date.now() + REG_CACHE_TTL_MS;
        }
        return result;
      }
      throw error;
    } finally {
      if (pendingMyRegistrationsRequestId === requestId) {
        pendingMyRegistrationsPromise = null;
      }
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
