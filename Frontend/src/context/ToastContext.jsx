import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    shell:
      "border-emerald-200/80 bg-white/95 text-slate-900 shadow-[0_18px_40px_-24px_rgba(16,185,129,0.55)] dark:border-emerald-400/20 dark:bg-slate-900/95 dark:text-slate-100",
    iconWrap: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    accent: "from-emerald-500 via-teal-500 to-cyan-500",
  },
  error: {
    icon: AlertCircle,
    shell:
      "border-rose-200/80 bg-white/95 text-slate-900 shadow-[0_18px_40px_-24px_rgba(244,63,94,0.55)] dark:border-rose-400/20 dark:bg-slate-900/95 dark:text-slate-100",
    iconWrap: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    accent: "from-rose-500 via-pink-500 to-orange-500",
  },
  info: {
    icon: Info,
    shell:
      "border-indigo-200/80 bg-white/95 text-slate-900 shadow-[0_18px_40px_-24px_rgba(99,102,241,0.55)] dark:border-indigo-400/20 dark:bg-slate-900/95 dark:text-slate-100",
    iconWrap: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    accent: "from-indigo-500 via-blue-500 to-cyan-500",
  },
};

const normalizeToastPayload = (input) => {
  if (typeof input === "string") {
    return { type: "info", text: input };
  }

  const type = String(input?.type || "info").trim().toLowerCase();
  return {
    type: TOAST_STYLES[type] ? type : "info",
    text: String(input?.text || "").trim(),
    duration: Number(input?.duration) > 0 ? Number(input.duration) : undefined,
  };
};

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 px-4 sm:px-6">
      {toasts.map((toast) => {
        const palette = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
        const Icon = palette.icon;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${palette.shell}`}
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${palette.accent}`} />
            <div className="flex items-start gap-3 px-4 py-3.5">
              <span className={`mt-0.5 rounded-xl p-2 ${palette.iconWrap}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-6">{toast.text}</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-black/5 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const idRef = useRef(0);

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((payload) => {
    const next = normalizeToastPayload(payload);
    if (!next.text) return "";

    idRef.current += 1;
    const id = `toast-${idRef.current}`;
    const duration = next.duration ?? (next.type === "error" ? 5200 : 3600);
    const toast = { ...next, id };

    setToasts((prev) => [...prev, toast]);
    const timer = window.setTimeout(() => dismissToast(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [dismissToast]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    },
    []
  );

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
      success: (text, options = {}) => showToast({ ...options, type: "success", text }),
      error: (text, options = {}) => showToast({ ...options, type: "error", text }),
      info: (text, options = {}) => showToast({ ...options, type: "info", text }),
    }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
