export const extractEventList = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.data?.events)) return payload.data.events;
  return [];
};

export const extractEventItem = (payload) => {
  if (payload?.data && !Array.isArray(payload.data)) return payload.data;
  if (payload?.event && !Array.isArray(payload.event)) return payload.event;
  return null;
};

export const extractUsersList = (payload) => {
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.data?.users)) return payload.data.users;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const filterUsersByRole = (users, role) =>
  users.filter((user) => String(user?.role || "").toUpperCase() === String(role || "").toUpperCase());

export const extractCreatedUser = (payload) => {
  if (payload?.user) return payload.user;
  if (payload?.data && !Array.isArray(payload.data)) return payload.data;
  return null;
};

export const isRouteMissing = (error) => Number(error?.response?.status) === 404;
