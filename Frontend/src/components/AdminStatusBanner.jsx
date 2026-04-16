import { AlertTriangle, Info, RefreshCcw } from "lucide-react";

const TONE_STYLES = {
  error: {
    wrapper:
      "border-rose-200 bg-rose-50/90 dark:border-rose-500/30 dark:bg-rose-500/10",
    title: "text-rose-700 dark:text-rose-200",
    body: "text-rose-600 dark:text-rose-100",
    button: "bg-rose-600 hover:bg-rose-700",
    Icon: AlertTriangle,
  },
  warning: {
    wrapper:
      "border-amber-200 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-500/10",
    title: "text-amber-700 dark:text-amber-200",
    body: "text-amber-700 dark:text-amber-100",
    button: "bg-amber-600 hover:bg-amber-700",
    Icon: AlertTriangle,
  },
  info: {
    wrapper:
      "border-sky-200 bg-sky-50/90 dark:border-sky-500/30 dark:bg-sky-500/10",
    title: "text-sky-700 dark:text-sky-200",
    body: "text-sky-700 dark:text-sky-100",
    button: "bg-sky-600 hover:bg-sky-700",
    Icon: Info,
  },
};

export default function AdminStatusBanner({
  title,
  message,
  actionLabel = "",
  onAction,
  tone = "error",
  className = "",
}) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.error;
  const Icon = styles.Icon;

  return (
    <article
      className={`eventmate-panel rounded-2xl border p-4 sm:p-5 ${styles.wrapper} ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon size={18} className={`mt-0.5 shrink-0 ${styles.title}`} />
          <div>
            <h2 className={`text-base font-semibold ${styles.title}`}>{title}</h2>
            <p className={`mt-1 text-sm ${styles.body}`}>{message}</p>
          </div>
        </div>

        {typeof onAction === "function" && actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white ${styles.button}`}
          >
            <RefreshCcw size={14} />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}
