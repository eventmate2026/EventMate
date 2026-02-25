import SummaryApi from "../api/SummaryApi";
import api from "./api";

const toList = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.registrations)) return payload.registrations;
  if (Array.isArray(payload?.data?.registrations)) return payload.data.registrations;
  return [];
};

const resolveEventId = (item) =>
  String(item?.event?._id || item?.eventId || item?.event || item?._id || "")
    .trim();

export const fetchRegisteredEventIds = async () => {
  try {
    const response = await api({ ...SummaryApi.get_my_registered_events });
    const rows = toList(response.data);
    return {
      ids: new Set(rows.map(resolveEventId).filter(Boolean)),
      supported: true,
      warning: null,
    };
  } catch (error) {
    const status = Number(error?.response?.status);
    if (status === 404) {
      return {
        ids: new Set(),
        supported: false,
        warning: "My registration history endpoint is not available in this backend build.",
      };
    }
    throw error;
  }
};
