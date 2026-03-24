const listeners = new Set();
let nextToastId = 0;

export const emitToast = (payload = {}) => {
  const text = String(payload?.text || "").trim();
  if (!text) return "";

  const toast = {
    id: `toast-${Date.now()}-${nextToastId += 1}`,
    type: String(payload?.type || "info").trim().toLowerCase() || "info",
    text,
    duration:
      Number(payload?.duration) > 0
        ? Number(payload.duration)
        : String(payload?.type || "").trim().toLowerCase() === "error"
          ? 5200
          : 4200,
  };

  listeners.forEach((listener) => {
    listener(toast);
  });

  return toast.id;
};

export const subscribeToasts = (listener) => {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
