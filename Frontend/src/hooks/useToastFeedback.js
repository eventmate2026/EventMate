import { useEffect } from "react";

import { getSafeSuccessMessage, sanitizeUserMessage } from "../lib/safeMessage";
import { emitToast } from "../lib/toastBus";

const resolveToastPayload = (value, defaultType, successFallback, errorFallback, infoFallback) => {
  if (!value) return null;

  const isObjectValue = typeof value === "object" && !Array.isArray(value);
  const rawType = isObjectValue ? String(value.type || defaultType || "info").toLowerCase() : defaultType;
  const rawText = isObjectValue ? value.text ?? value.message ?? "" : value;

  if (!rawText) return null;

  const type =
    rawType === "success" ? "success" : rawType === "error" ? "error" : "info";

  const fallback =
    type === "success"
      ? successFallback || "Completed successfully."
      : type === "error"
        ? errorFallback || "We couldn't complete that request right now."
        : infoFallback || "Update available.";

  const text =
    type === "success"
      ? getSafeSuccessMessage(rawText, fallback)
      : sanitizeUserMessage(rawText, fallback);

  return { type, text };
};

export const useToastFeedback = (
  value,
  {
    defaultType = "info",
    successFallback = "Completed successfully.",
    errorFallback = "We couldn't complete that request right now.",
    infoFallback = "Update available.",
  } = {}
) => {
  useEffect(() => {
    const payload = resolveToastPayload(
      value,
      defaultType,
      successFallback,
      errorFallback,
      infoFallback
    );

    if (!payload) return;

    emitToast(payload);
  }, [defaultType, errorFallback, infoFallback, successFallback, value]);
};

export default useToastFeedback;
