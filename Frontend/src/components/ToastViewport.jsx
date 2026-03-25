import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { subscribeToasts } from "../lib/toastBus";

const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-white text-slate-900 shadow-[0_18px_40px_-24px_rgba(16,185,129,0.55)] dark:border-emerald-500/30 dark:bg-slate-900/95 dark:text-slate-100",
    iconClassName: "text-emerald-500 dark:text-emerald-300",
  },
  error: {
    icon: AlertCircle,
    className:
      "border-rose-200 bg-white text-slate-900 shadow-[0_18px_40px_-24px_rgba(244,63,94,0.45)] dark:border-rose-500/30 dark:bg-slate-900/95 dark:text-slate-100",
    iconClassName: "text-rose-500 dark:text-rose-300",
  },
  info: {
    icon: Info,
    className:
      "border-indigo-200 bg-white text-slate-900 shadow-[0_18px_40px_-24px_rgba(79,70,229,0.45)] dark:border-indigo-500/30 dark:bg-slate-900/95 dark:text-slate-100",
    iconClassName: "text-indigo-500 dark:text-indigo-300",
  },
};

export default function ToastViewport() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const clearToastTimer = (toastId) => {
    const timeoutId = timersRef.current.get(toastId);
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timersRef.current.delete(toastId);
  };

  useEffect(() => {
    const unsubscribe = subscribeToasts((toast) => {
      setToasts((current) => {
        current.forEach((item) => clearToastTimer(item.id));
        const activeToast = current[0];

        if (
          activeToast &&
          activeToast.type === toast.type &&
          activeToast.text === toast.text
        ) {
          return [{ ...activeToast, id: toast.id, duration: toast.duration }];
        }

        return [toast];
      });

      const timeoutId = setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
        clearToastTimer(toast.id);
      }, toast.duration);

      timersRef.current.set(toast.id, timeoutId);
    });

    return () => {
      unsubscribe();
      timersRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      timersRef.current.clear();
    };
  }, []);

  const dismissToast = (toastId) => {
    clearToastTimer(toastId);
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[140] flex items-center justify-center px-4"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col items-center justify-center">
        {toasts.map((toast) => {
          const variant = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
          const Icon = variant.icon;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto w-full rounded-2xl border px-5 py-4 backdrop-blur ${variant.className}`}
            >
              <div className="flex items-start gap-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${variant.iconClassName}`} />
                <p className="flex-1 text-center text-sm font-medium leading-6 sm:text-left">{toast.text}</p>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-full p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
