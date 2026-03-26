import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const baseClassName =
  "inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition " +
  "hover:bg-white hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-indigo-300";

export default function PageBackButton({
  to = "/",
  label = "Back",
  ariaLabel,
  className = "",
  iconSize = 16,
  onClick,
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (typeof onClick === "function") {
      onClick();
      return;
    }

    navigate(to);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel || label}
      className={`${baseClassName} ${className}`.trim()}
    >
      <ArrowLeft size={iconSize} />
      {label}
    </button>
  );
}
