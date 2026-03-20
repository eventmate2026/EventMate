import SummaryApi from "../api/SummaryApi";
import api from "./api";
import { getStoredUser } from "./auth";

const REG_CACHE_TTL_MS = 60000;
const REG_CACHE_STORAGE_KEY = "eventmate:my-registrations-cache";
let cachedMyRegistrations = null;
let cachedMyRegistrationsExpiresAt = 0;
let pendingMyRegistrationsPromise = null;
let pendingMyRegistrationsRequestId = 0;
let cacheGeneration = 0;
let didHydrateMyRegistrationsCache = false;

const getSessionStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getRegistrationCacheOwnerKey = () => {
  const user = getStoredUser();
  return String(user?._id || user?.id || user?.email || "")
    .trim()
    .toLowerCase();
};

const hydrateMyRegistrationsCache = () => {
  if (didHydrateMyRegistrationsCache) return;
  didHydrateMyRegistrationsCache = true;

  const storage = getSessionStorage();
  if (!storage) return;

  try {
    const raw = storage.getItem(REG_CACHE_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const ownerKey = String(parsed?.ownerKey || "").trim().toLowerCase();
    const currentOwnerKey = getRegistrationCacheOwnerKey();

    if (ownerKey && currentOwnerKey && ownerKey !== currentOwnerKey) {
      storage.removeItem(REG_CACHE_STORAGE_KEY);
      return;
    }

    if (!parsed?.result || !Array.isArray(parsed.result.rows)) {
      return;
    }

    cachedMyRegistrations = parsed.result;
    cachedMyRegistrationsExpiresAt = Number(parsed?.expiresAt || 0) || 0;
  } catch {
    try {
      storage.removeItem(REG_CACHE_STORAGE_KEY);
    } catch {
      // Ignore invalid cache cleanup failures.
    }
  }
};

const persistMyRegistrationsCache = (result, expiresAt) => {
  const storage = getSessionStorage();
  if (!storage || !result) return;

  try {
    storage.setItem(
      REG_CACHE_STORAGE_KEY,
      JSON.stringify({
        ownerKey: getRegistrationCacheOwnerKey(),
        expiresAt: Number(expiresAt || 0) || 0,
        result,
      })
    );
  } catch {
    // Ignore storage write failures and keep fetch results in memory.
  }
};

const clearPersistedMyRegistrationsCache = () => {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(REG_CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
};

const isTransientRegistrationFetchError = (error) => {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || "").trim().toUpperCase();
  const message = String(error?.message || "").trim();

  return (
    !status ||
    status >= 500 ||
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    /network error|failed to fetch|load failed|connection.*closed|socket hang up|timeout/i.test(message)
  );
};

export const invalidateMyRegistrationsCache = () => {
  cacheGeneration += 1;
  cachedMyRegistrations = null;
  cachedMyRegistrationsExpiresAt = 0;
  pendingMyRegistrationsPromise = null;
  clearPersistedMyRegistrationsCache();
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
  const eventTitle = String(item?.event?.title || "").trim();
  const eventId = resolveEventId(item);

  if (!eventId || !eventTitle) {
    return null;
  }

  const eventLocation = resolveEventLocation(eventDoc, item);
  const eventStartDate = eventDoc?.schedule?.startDate || null;
  const eventEndDate = eventDoc?.schedule?.endDate || eventDoc?.schedule?.startDate || null;
  const eventStartTime = String(eventDoc?.schedule?.startTime || "").trim();
  const eventEndTime = String(eventDoc?.schedule?.endTime || "").trim();
  const certificate = item?.certificate && typeof item.certificate === "object" ? item.certificate : null;
  const paymentConfig =
    eventDoc?.registration?.paymentConfig && typeof eventDoc.registration.paymentConfig === "object"
      ? eventDoc.registration.paymentConfig
      : {};
  const payment = item?.payment && typeof item.payment === "object" ? item.payment : {};
  return {
    id: String(item?._id || item?.id || "").trim(),
    eventId,
    eventTitle,
    eventCategory: String(eventDoc?.category || "").trim(),
    eventStatus: String(eventDoc?.status || "").trim(),
    eventPosterUrl: String(eventDoc?.posterUrl || "").trim(),
    eventLocation,
    eventStartDate,
    eventEndDate,
    eventStartTime,
    eventEndTime,
    status: String(item?.status || "").trim(),
    totalParticipants: Number(item?.totalParticipants || 0) || 0,
    createdAt: item?.createdAt || null,
    isTeamLeader: Boolean(item?.isTeamLeader),
    isTeamEvent: Boolean(eventDoc?.isTeamEvent),
    eventFee: Number(eventDoc?.registration?.fee || 0) || 0,
    feedbackSubmitted: Boolean(item?.feedbackSubmitted),
    certificate,
    payment: {
      amount: Number(payment?.amount || eventDoc?.registration?.fee || 0) || 0,
      method: String(payment?.method || paymentConfig?.method || "FREE").trim() || "FREE",
      paymentStatus: String(payment?.paymentStatus || "NotRequired").trim() || "NotRequired",
      transactionId: String(payment?.transactionId || "").trim(),
      paymentScreenshot: String(payment?.paymentScreenshot || "").trim(),
      rejectionReason: String(payment?.rejectionReason || "").trim(),
      verifiedAt: payment?.verifiedAt || null,
    },
    paymentConfig: {
      accountName: String(paymentConfig?.accountName || "").trim(),
      upiId: String(paymentConfig?.upiId || "").trim(),
      qrImageUrl: String(paymentConfig?.qrImageUrl || "").trim(),
      instructions: String(paymentConfig?.instructions || "").trim(),
    },
    qr: qrImageUrl
      ? {
          qrImageUrl,
          role: String(item?.qr?.role || "").trim(),
          attendanceMarked: Boolean(item?.qr?.attendanceMarked),
          attendanceMarkedAt: item?.qr?.attendanceMarkedAt || null,
        }
      : null,
  };
};

export const fetchMyRegistrations = async (options = {}) => {
  const { bypassCache = false } = options;
  hydrateMyRegistrationsCache();

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
      const sourceRows = toList(response.data);
      const rows = sourceRows.map(normalizeRegistration).filter(Boolean);
      const result = {
        rows,
        supported: true,
        warning: null,
      };
      if (requestGeneration === cacheGeneration) {
        cachedMyRegistrations = result;
        cachedMyRegistrationsExpiresAt = Date.now() + REG_CACHE_TTL_MS;
        persistMyRegistrationsCache(result, cachedMyRegistrationsExpiresAt);
      }
      return result;
    } catch (error) {
      const status = Number(error?.response?.status);
      if (status === 404) {
        const result = {
          rows: [],
          supported: false,
          warning: "Your registration history is not available right now.",
        };
        if (requestGeneration === cacheGeneration) {
          cachedMyRegistrations = result;
          cachedMyRegistrationsExpiresAt = Date.now() + REG_CACHE_TTL_MS;
          persistMyRegistrationsCache(result, cachedMyRegistrationsExpiresAt);
        }
        return result;
      }

      if (cachedMyRegistrations && isTransientRegistrationFetchError(error)) {
        return {
          ...cachedMyRegistrations,
          warning:
            cachedMyRegistrations.warning ||
            "Showing your latest saved registrations while EventMate reconnects.",
        };
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
