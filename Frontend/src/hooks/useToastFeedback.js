import { useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";

const VALID_TYPES = new Set(["success", "error", "info"]);

const normalizeFeedback = (value, defaultType) => {
  if (!value) return null;

  if (typeof value === "string") {
    const text = value.trim();
    return text ? { type: defaultType, text } : null;
  }

  const text = String(value?.text || value?.message || "").trim();
  if (!text) return null;

  const nextType = String(value?.type || defaultType || "info").trim().toLowerCase();
  return {
    type: VALID_TYPES.has(nextType) ? nextType : defaultType,
    text,
  };
};

export function useToastFeedback(value, { defaultType = "info" } = {}) {
  const toast = useToast();
  const lastShownRef = useRef("");

  useEffect(() => {
    const payload = normalizeFeedback(value, defaultType);
    if (!payload) {
      lastShownRef.current = "";
      return;
    }

    const key = `${payload.type}:${payload.text}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;

    if (payload.type === "success") {
      toast.success(payload.text);
      return;
    }

    if (payload.type === "error") {
      toast.error(payload.text);
      return;
    }

    toast.info(payload.text);
  }, [defaultType, toast, value]);
}
