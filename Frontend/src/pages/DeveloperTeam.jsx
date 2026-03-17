import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Rocket, Sparkles, Users2 } from "lucide-react";

const TEAM_MEMBERS = [
  {
    name: "Aditya Jambhulkar",
    role: "Leader & UI/UX Designer",
    githubUrl: "https://github.com/adityaj143",
    isLead: true,
  },
  {
    name: "Dakshat Nagrale",
    role: "Frontend Developer",
    githubUrl: "https://github.com/DakshatNagrale",
  },
  {
    name: "Abhinay Borkar",
    role: "Backend Developer",
    githubUrl: "https://github.com/off-abhi-1287",
  },
  {
    name: "Saksham Khaire",
    role: "Database Admin",
    githubUrl: "https://github.com/off-saksham-2007",
  },
];

const VALUE_PANELS = [
  {
    title: "Product vision",
    description: "We map each feature to student outcomes and campus impact.",
    icon: Sparkles,
  },
  {
    title: "Engineering craft",
    description: "Clean systems, reliable flows, and details that feel effortless.",
    icon: Rocket,
  },
  {
    title: "Team energy",
    description: "We build with shared ownership and fast, friendly iteration.",
    icon: Users2,
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const buildInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const formatGithubHandle = (url) => {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/github\.com\/([^/]+)$/i);
  return match ? match[1] : trimmed;
};

export default function DeveloperTeam() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="eventmate-page min-h-screen px-4 sm:px-6 py-12 sm:py-16">
      <div className="relative max-w-6xl mx-auto">
        <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.08),transparent_45%)]" />

        <section className="relative overflow-hidden rounded-[32px] border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-slate-950/80 p-6 sm:p-10 shadow-2xl backdrop-blur">
          <div className="absolute -top-24 right-10 h-44 w-44 rounded-full bg-indigo-400/25 blur-3xl" />
          <div className="absolute -bottom-24 left-6 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />

          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            animate="show"
            variants={containerVariants}
            className="relative z-[1]"
          >
            <motion.p
              variants={itemVariants}
              className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500/80 dark:text-cyan-200/80"
            >
              EliteX &amp; Team
            </motion.p>
            <motion.h1
              variants={itemVariants}
              className="mt-4 text-3xl sm:text-5xl font-bold text-slate-900 dark:text-white"
            >
              The builders behind EventMate
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="mt-4 max-w-2xl text-sm sm:text-base text-slate-600 dark:text-slate-300"
            >
              We are a focused developer crew crafting a campus platform that feels modern,
              reliable, and human. This page celebrates the people shaping the experience you
              see every day.
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="mt-6 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-indigo-400/50"
              >
                Back to EventMate
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-700"
              >
                Join the journey
              </Link>
            </motion.div>
          </motion.div>
        </section>

        <section className="mt-12 sm:mt-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Developer crew
              </p>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Meet the team
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-xl">
                A compact, high-ownership squad driving the platform from idea to launch.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
              {TEAM_MEMBERS.length} contributors
            </div>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : "hidden"}
            animate="show"
            variants={containerVariants}
            className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {TEAM_MEMBERS.map((member, index) => (
              <motion.article
                key={member.name}
                variants={itemVariants}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-5 shadow-lg transition hover:-translate-y-1 hover:border-indigo-300/60 dark:border-white/10 dark:bg-slate-900/70 dark:hover:border-cyan-400/40"
              >
                <div className="absolute -top-20 right-0 h-32 w-32 rounded-full bg-indigo-400/10 blur-3xl" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600/10 text-sm font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                      {buildInitials(member.name)}
                    </div>
                    {member.isLead && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200">
                        Team Leader
                      </span>
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                    {member.name}
                  </h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                    {member.role}
                  </p>
                  {member.githubUrl && (
                    <a
                      href={member.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-cyan-200 dark:hover:text-cyan-100"
                    >
                      GitHub: {formatGithubHandle(member.githubUrl)}
                    </a>
                  )}
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    Building EventMate experiences
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </section>

        <section className="mt-12 sm:mt-16">
          <div className="grid gap-4 sm:grid-cols-3">
            {VALUE_PANELS.map((panel) => {
              const Icon = panel.icon;
              return (
                <div
                  key={panel.title}
                  className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-md dark:border-white/10 dark:bg-slate-900/70"
                >
                  <div className="absolute -top-14 right-4 h-24 w-24 rounded-full bg-cyan-400/15 blur-2xl" />
                  <div className="relative">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                      <Icon size={18} />
                    </div>
                    <h4 className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {panel.title}
                    </h4>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      {panel.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
