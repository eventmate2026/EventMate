import { useNavigate } from "react-router-dom";

const sections = [
  {
    key: "my-events",
    label: "My Events",
    path: "/student-dashboard/my-events",
  },
  {
    key: "my-certificates",
    label: "My Certificates",
    path: "/student-dashboard/my-certificates",
  },
  {
    key: "feedback-pending",
    label: "Feedback Pending",
    path: "/student-dashboard/feedback-pending",
  },
];

export default function StudentWorkflowSectionLinks({ currentSection }) {
  const navigate = useNavigate();

  return (
    <section className="eventmate-panel rounded-2xl border border-slate-200/80 bg-white/75 p-3 sm:p-4 dark:border-white/10 dark:bg-slate-900/65">
      <div className="flex flex-wrap items-center gap-2">
        {sections.map((section) => {
          const isActive = section.key === currentSection;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => navigate(section.path)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/10"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
