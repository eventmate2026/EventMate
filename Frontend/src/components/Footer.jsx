import { motion, useReducedMotion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";

const reveal = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const EVENT_LINKS = ["Sports", "Cultural", "Technical", "Workshops", "Seminars"];
const CAMPUS_LINKS = ["Registrations", "Check-ins", "Feedback", "Certificates"];
const MOBILE_GROUPS = [
  { title: "Events", items: EVENT_LINKS },
  { title: "Campus", items: ["Registrations", "Check-ins", "Feedback", "Certificates"] },
  { title: "Support", items: ["Contact Us", "Help Center", "Report Issue"] },
  {
    title: "Policies",
    items: [
      { label: "Privacy Policy" },
      { label: "Developed by EliteX & Team", to: "/developers" },
      { label: "Terms of Service" },
    ],
  },
];

export default function Footer() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.footer
      key={location.pathname}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="show"
      variants={reveal}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-gray-950 border-t border-gray-300/90 dark:border-indigo-300/20 shadow-[inset_0_1px_0_rgba(99,102,241,0.08)]"
    >
      <div className="pointer-events-none absolute -top-24 -left-24 h-56 w-56 rounded-full bg-blue-400/10 blur-3xl dark:bg-cyan-400/15" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-56 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-500/20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="sm:hidden">
          <div className="rounded-2xl border border-slate-200/70 bg-white/95 px-6 py-7 text-slate-900 shadow-2xl dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-100">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">EventMate</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">Campus events, simplified.</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Making campus events smarter, simpler, and more rewarding for everyone.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
              {MOBILE_GROUPS.map((group) => (
                <div key={group.title}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {group.title}
                  </h4>
                  <ul className="mt-3 space-y-2 text-slate-600 dark:text-slate-200">
                    {group.items.map((item) => {
                      const label = typeof item === "string" ? item : item.label;
                      const to = typeof item === "string" ? "" : item.to || "";
                      return (
                      <li
                        key={label}
                        className="transition-colors hover:text-slate-900 dark:hover:text-white"
                      >
                        {to ? (
                          <Link to={to} className="text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">
                            {label}
                          </Link>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-200">{label}</span>
                        )}
                      </li>
                    );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-slate-200/70 pt-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              Copyright 2026 EventMate Inc. All rights reserved.
            </div>
          </div>
        </div>

        <div className="hidden sm:grid gap-10 lg:gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.1fr] text-left">
          <motion.div variants={reveal} transition={{ delay: prefersReducedMotion ? 0 : 0.03 }}>
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 dark:from-cyan-300 dark:via-indigo-300 dark:to-fuchsia-300 bg-clip-text text-transparent">
              EventMate
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-slate-300 max-w-sm">
              Making campus events smarter, simpler, and more rewarding for everyone.
            </p>
          </motion.div>

          <motion.div variants={reveal} transition={{ delay: prefersReducedMotion ? 0 : 0.08 }}>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Events
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-slate-300">
              {EVENT_LINKS.map((label) => (
                <li
                  key={label}
                  className="transition-all duration-300 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={reveal} transition={{ delay: prefersReducedMotion ? 0 : 0.12 }}>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Campus
            </h4>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-slate-300">
              {CAMPUS_LINKS.map((label) => (
                <li
                  key={label}
                  className="transition-all duration-300 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={reveal} transition={{ delay: prefersReducedMotion ? 0 : 0.16 }}>
            <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Contact
            </h4>
            <div className="mt-4 space-y-2 text-sm text-gray-600 dark:text-slate-300">
              <p>
                <span className="font-medium text-indigo-600 dark:text-cyan-300">Email: </span>
                eventmate2026@gmail.com
              </p>
              <p>
                <span className="font-medium text-indigo-600 dark:text-indigo-300">Address: </span>
                Balaji Ward, Chandrapur
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="hidden sm:block border-t border-gray-300/80 dark:border-indigo-300/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col items-center sm:flex-row sm:items-center justify-between gap-3 text-sm text-gray-600 dark:text-slate-300 text-center sm:text-left">
          <p>Copyright 2026 EventMate Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="cursor-pointer transition-colors hover:text-indigo-600 dark:hover:text-cyan-300">Privacy Policy</span>
            <Link
              to="/developers"
              className="transition-colors hover:text-indigo-600 dark:hover:text-cyan-300"
            >
              Developed by EliteX &amp; Team
            </Link>
            <span className="cursor-pointer transition-colors hover:text-indigo-600 dark:hover:text-violet-300">Terms of Service</span>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
