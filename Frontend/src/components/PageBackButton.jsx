import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PageBackButton({
  to = "/",
  fallbackTo,
  label = "Back",
  ariaLabel,
  className = "",
  iconSize = 16,
  onClick,
  preferHistory = false,
  replace = false,
  showLabel = true,
}) {
  const navigate = useNavigate();

  const baseClassName = showLabel
    ? "inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition " +
      "hover:bg-white hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-indigo-300"
    : "inline-flex items-center justify-center rounded-full text-slate-600 transition " +
      "hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300";

  const handleClick = () => {
    if (typeof onClick === "function") {
      onClick();
      return;
    }

    if (preferHistory && typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo || to, { replace });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel || label}
      className={`${baseClassName} ${className}`.trim()}
    >
      <ArrowLeft size={iconSize} />
      {showLabel ? label : null}
    </button>
  );
}
