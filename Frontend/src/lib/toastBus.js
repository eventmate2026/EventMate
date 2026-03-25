const listeners = new Set();
let nextToastId = 0;
const recentToastSignatures = new Map();
const DUPLICATE_TOAST_WINDOW_MS = 1600;

const pruneRecentToasts = (now) => {
  recentToastSignatures.forEach((timestamp, signature) => {
    if (now - timestamp > DUPLICATE_TOAST_WINDOW_MS) {
      recentToastSignatures.delete(signature);
    }
  });
};

export const emitToast = (payload = {}) => {
  const text = String(payload?.text || "").trim();
  if (!text) return "";
  const now = Date.now();
  const type = String(payload?.type || "info").trim().toLowerCase() || "info";
  const signature = `${type}::${text.toLowerCase()}`;

  pruneRecentToasts(now);
  if (recentToastSignatures.has(signature)) {
    return "";
  }
  recentToastSignatures.set(signature, now);

  const toast = {
    id: `toast-${now}-${nextToastId += 1}`,
    type,
    text,
    duration:
      Number(payload?.duration) > 0
        ? Number(payload.duration)
        : type === "error"
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
