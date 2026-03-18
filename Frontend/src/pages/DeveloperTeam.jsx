import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

/* ─── Team Data ─────────────────────────────────────────── */
const TEAM_MEMBERS = [
  {
    name: "Aditya Jambhulkar",
    role: "Leader & UI/UX Designer",
    emoji: "🎨",
    githubUrl: "https://github.com/adityaj143",
    bio: "Visionary leader who shapes product direction and crafts pixel-perfect experiences from idea to interface.",
    skills: ["UI/UX", "Figma", "React", "Leadership"],
    gradient: "from-amber-500 via-orange-500 to-yellow-400",
    glowColor: "rgba(245,158,11,0.4)",
    avatarBg: "from-amber-400 to-orange-500",
    isLead: true,
    linkedinUrl: "#",
  },
  {
    name: "Dakshat Nagrale",
    role: "Frontend Developer",
    emoji: "⚡",
    githubUrl: "https://github.com/DakshatNagrale",
    bio: "Brings designs to life with blazing-fast React components, smooth animations and responsive layouts.",
    skills: ["React", "Tailwind", "Framer Motion", "Vite"],
    gradient: "from-indigo-500 via-purple-500 to-blue-400",
    glowColor: "rgba(99,102,241,0.4)",
    avatarBg: "from-indigo-400 to-purple-500",
    linkedinUrl: "#",
  },
  {
    name: "Abhinay Borkar",
    role: "Backend Developer",
    emoji: "🔧",
    githubUrl: "https://github.com/off-abhi-1287",
    bio: "Architects robust APIs and server-side logic that powers every feature silently and reliably.",
    skills: ["Node.js", "Express", "MongoDB", "REST API"],
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    glowColor: "rgba(16,185,129,0.4)",
    avatarBg: "from-emerald-400 to-teal-500",
    linkedinUrl: "#",
  },
  {
    name: "Saksham Khaire",
    role: "Database Administrator",
    emoji: "🗄️",
    githubUrl: "https://github.com/off-saksham-2007",
    bio: "Designs and maintains the data architecture, ensuring every byte is stored, secured and fast.",
    skills: ["MongoDB", "Mongoose", "Schema Design", "Indexing"],
    gradient: "from-pink-500 via-rose-500 to-red-400",
    glowColor: "rgba(236,72,153,0.4)",
    avatarBg: "from-pink-400 to-rose-500",
    linkedinUrl: "#",
  },
];

const VALUE_PANELS = [
  {
    icon: "🎯",
    title: "Product Vision",
    description: "We map every feature to real student outcomes and measurable campus impact.",
    gradient: "from-indigo-500/10 to-purple-500/10",
    border: "border-indigo-300/20 dark:border-indigo-500/20",
    iconBg: "from-indigo-500 to-purple-600",
  },
  {
    icon: "⚙️",
    title: "Engineering Craft",
    description: "Clean systems, reliable flows, and interactions that feel intuitive and effortless.",
    gradient: "from-emerald-500/10 to-teal-500/10",
    border: "border-emerald-300/20 dark:border-emerald-500/20",
    iconBg: "from-emerald-500 to-teal-600",
  },
  {
    icon: "🤝",
    title: "Team Energy",
    description: "We build with shared ownership, rapid iteration, and a culture of mutual respect.",
    gradient: "from-pink-500/10 to-rose-500/10",
    border: "border-pink-300/20 dark:border-pink-500/20",
    iconBg: "from-pink-500 to-rose-600",
  },
  {
    icon: "🚀",
    title: "Continuous Delivery",
    description: "Shipping improvements every week, gathering feedback to make things better constantly.",
    gradient: "from-amber-500/10 to-orange-500/10",
    border: "border-amber-300/20 dark:border-amber-500/20",
    iconBg: "from-amber-500 to-orange-600",
  },
];

const TECH_STACK = [
  { name: "React 18", icon: "⚛️", color: "text-cyan-500" },
  { name: "Node.js", icon: "🟢", color: "text-green-500" },
  { name: "MongoDB", icon: "🍃", color: "text-emerald-500" },
  { name: "Tailwind", icon: "💨", color: "text-sky-500" },
  { name: "Framer Motion", icon: "✨", color: "text-purple-500" },
  { name: "Vite", icon: "⚡", color: "text-yellow-500" },
  { name: "Express", icon: "🔗", color: "text-gray-400" },
  { name: "Socket.io", icon: "🔌", color: "text-rose-400" },
];

/* ─── Helpers ─────────────────────────────────────────────── */
const buildInitials = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const formatHandle = (url) => {
  const m = String(url || "").match(/github\.com\/([^/]+)$/i);
  return m ? `@${m[1]}` : url;
};

/* ─── Particle Field ─────────────────────────────────────── */
function ParticleField({ count = 40 }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        size: Math.random() * 3 + 1.5,
        x: Math.random() * 100,
        y: Math.random() * 100,
        dur: Math.random() * 12 + 8,
        delay: Math.random() * -20,
        px: (Math.random() - 0.5) * 160,
        py: -(Math.random() * 180 + 60),
        color: [
          "rgba(99,102,241,0.7)",
          "rgba(139,92,246,0.7)",
          "rgba(236,72,153,0.6)",
          "rgba(245,158,11,0.6)",
          "rgba(16,185,129,0.6)",
        ][Math.floor(Math.random() * 5)],
      })),
    [count]
  );

  return (
    <div className="particle-container">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            "--dur": `${p.dur}s`,
            "--delay": `${p.delay}s`,
            "--px": `${p.px}px`,
            "--py": `${p.py}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── 3D Tilt Hook ──────────────────────────────────────── */
function useTilt(strength = 12) {
  const ref = useRef(null);
  const handle = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (y - 0.5) * -strength;
    const ry = (x - 0.5) * strength;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.03)`;
    el.style.setProperty("--mx", x * 100);
    el.style.setProperty("--my", y * 100);
  };
  const reset = () => {
    if (ref.current)
      ref.current.style.transform =
        "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
  };
  return { ref, onMouseMove: handle, onMouseLeave: reset };
}

/* ─── Avatar Component ──────────────────────────────────── */
function Avatar({ member, size = "lg" }) {
  const sz = size === "lg" ? "h-24 w-24 text-3xl" : "h-16 w-16 text-xl";
  return (
    <div className={`relative ${sz}`}>
      {/* Outer spinning ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, ease: "linear", repeat: Infinity }}
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${member.glowColor}, transparent, ${member.glowColor})`,
        }}
      />
      {/* Inner ring */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 12, ease: "linear", repeat: Infinity }}
        className="absolute inset-[3px] rounded-full"
        style={{
          border: "1px dashed rgba(255,255,255,0.2)",
        }}
      />
      {/* Avatar circle */}
      <div
        className={`absolute inset-[4px] rounded-full bg-gradient-to-br ${member.avatarBg} flex items-center justify-center font-black text-white shadow-lg`}
        style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
      >
        {member.emoji}
      </div>
      {/* Glow pulse */}
      <div
        className="absolute inset-0 rounded-full blur-md opacity-50 animate-pulse"
        style={{ background: member.glowColor }}
      />
    </div>
  );
}

/* ─── Member Card ────────────────────────────────────────── */
function MemberCard({ member, index, reduceMotion }) {
  const tilt = useTilt(10);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotateX: 15, scale: 0.9 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        tilt.onMouseLeave();
      }}
    >
      <div
        ref={tilt.ref}
        onMouseMove={!reduceMotion ? tilt.onMouseMove : undefined}
        className="group relative overflow-hidden rounded-3xl border border-white/10 dark:border-white/5 glass-3d holo-card h-full"
        style={{
          transition: "transform 0.15s ease-out, box-shadow 0.3s ease",
          boxShadow: hovered
            ? `0 20px 60px ${member.glowColor}, 0 0 0 1px ${member.glowColor}`
            : "0 4px 24px rgba(0,0,0,0.15)",
        }}
      >
        {/* Gradient background blob */}
        <div
          className={`absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 bg-gradient-to-br ${member.gradient}`}
        />
        <div
          className={`absolute -bottom-16 -left-16 h-40 w-40 rounded-full blur-3xl opacity-10 group-hover:opacity-30 transition-opacity duration-500 bg-gradient-to-br ${member.gradient}`}
        />

        {/* Shine overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{
            background: `radial-gradient(circle at calc(var(--mx, 50) * 1%) calc(var(--my, 50) * 1%), rgba(255,255,255,0.08) 0%, transparent 60%)`,
          }}
        />

        {/* Top accent line */}
        <div
          className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${member.gradient} opacity-60`}
        />

        <div className="relative z-10 p-7 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <Avatar member={member} size="lg" />

            {member.isLead && (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400"
              >
                <span>👑</span> Team Leader
              </motion.div>
            )}
          </div>

          {/* Name & Role */}
          <div className="mb-4">
            <h3 className="text-xl font-black text-white mb-1">{member.name}</h3>
            <p
              className={`text-xs font-bold uppercase tracking-[0.2em] bg-gradient-to-r ${member.gradient} bg-clip-text text-transparent`}
            >
              {member.role}
            </p>
          </div>

          {/* Bio */}
          <p className="text-sm text-gray-400 leading-relaxed mb-5 flex-grow">
            {member.bio}
          </p>

          {/* Skills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {member.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-300 backdrop-blur-sm"
              >
                {skill}
              </span>
            ))}
          </div>

          {/* Links */}
          <div className="flex items-center gap-3 mt-auto">
            <a
              href={member.githubUrl}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:border-white/30 hover:bg-white/10 transition-all duration-200`}
            >
              {/* GitHub icon */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              {formatHandle(member.githubUrl)}
            </a>
            {/* Status dot */}
            <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export default function DeveloperTeam() {
  const prefersReducedMotion = useReducedMotion();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.4]);

  // Typewriter effect for hero subtitle
  const phrases = ["Crafting the future.", "Building with passion.", "Shipping excellence."];
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayed(phrases[0]);
      return;
    }
    const target = phrases[phraseIdx];
    let timer;
    if (typing) {
      if (displayed.length < target.length) {
        timer = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 65);
      } else {
        timer = setTimeout(() => setTyping(false), 1800);
      }
    } else {
      if (displayed.length > 0) {
        timer = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 35);
      } else {
        setPhraseIdx((i) => (i + 1) % phrases.length);
        setTyping(true);
      }
    }
    return () => clearTimeout(timer);
  }, [displayed, typing, phraseIdx, prefersReducedMotion]);

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-x-hidden selection:bg-indigo-500 selection:text-white">
      {/* ── Fixed BG Layer ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 grid-3d-bg opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#050b1a] to-[#030712]" />
        {/* Orbs */}
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[150px] animate-morph" />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] animate-morph"
          style={{ animationDelay: "-5s" }}
        />
        <div
          className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-pink-600/8 blur-[100px] animate-float3d"
          style={{ animationDelay: "-3s" }}
        />
        {/* Particles */}
        {!prefersReducedMotion && <ParticleField count={35} />}
      </div>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative z-10 pt-28 pb-20 px-4 sm:px-6 overflow-hidden">
        <motion.div
          style={!prefersReducedMotion ? { y: heroY, opacity: heroOpacity } : {}}
          className="max-w-5xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-5 py-2 text-xs font-bold uppercase tracking-[0.25em] text-indigo-300 mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-indigo-400" />
            </span>
            EliteX &amp; Team · EventMate 2026
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6"
          >
            <span className="block text-white">The builders</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-neon">
              behind EventMate
            </span>
          </motion.h1>

          {/* Typewriter */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="h-10 flex items-center justify-center mb-6"
          >
            <span className="text-xl sm:text-2xl font-bold text-gray-300">
              {displayed}
              <span
                className="inline-block w-0.5 h-6 bg-indigo-400 ml-1 align-middle"
                style={{ animation: "typewriterBlink 0.9s step-end infinite" }}
              />
            </span>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="max-w-2xl mx-auto text-base sm:text-lg text-gray-400 leading-relaxed mb-10"
          >
            A compact, high-ownership squad building an event platform that feels modern, reliable,
            and human. Meet the people shaping every experience you see every day.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to="/"
              className="btn-glow-3d inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 backdrop-blur-md px-7 py-3.5 text-sm font-bold text-white hover:bg-white/15 transition-all duration-300"
            >
              ← Back to EventMate
            </Link>
            <Link
              to="/signup"
              className="btn-glow-3d inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-500/30"
            >
              Join the journey →
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-px h-8 bg-gradient-to-b from-indigo-500 to-transparent"
          />
        </motion.div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="relative z-10 px-4 sm:px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            { number: "4", label: "Developers", icon: "👨‍💻" },
            { number: "1", label: "Team Leader", icon: "👑" },
            { number: "8+", label: "Technologies", icon: "🛠️" },
            { number: "∞", label: "Dedication", icon: "🔥" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              whileHover={!prefersReducedMotion ? { y: -4, scale: 1.04 } : {}}
              className="stats-3d relative glass-3d rounded-2xl p-5 text-center holo-card border border-white/5"
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-1">
                {s.number}
              </div>
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── TEAM GRID ── */}
      <section className="relative z-10 px-4 sm:px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-indigo-400 mb-3">Developer Crew</p>
            <h2 className="text-3xl sm:text-5xl font-black mb-4">
              <span className="text-white">Meet </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                the Team
              </span>
            </h2>
            <div className="line-accent-3d w-32 mx-auto mb-4" />
            <p className="text-gray-400 max-w-lg mx-auto">
              Every pixel, every API, every database schema — crafted with care by these four.
            </p>
          </motion.div>

          {/* Lead card - full width */}
          <div className="mb-6">
            <MemberCard
              member={TEAM_MEMBERS[0]}
              index={0}
              reduceMotion={prefersReducedMotion}
            />
          </div>

          {/* Other 3 cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM_MEMBERS.slice(1).map((m, i) => (
              <MemberCard key={m.name} member={m} index={i + 1} reduceMotion={prefersReducedMotion} />
            ))}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ── */}
      <section className="relative z-10 px-4 sm:px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-purple-400 mb-3">Powered By</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
              Our Tech Stack
            </h2>
            <div className="line-accent-3d w-20 mx-auto" />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            className="flex flex-wrap justify-center gap-4"
          >
            {TECH_STACK.map((tech, i) => (
              <motion.div
                key={tech.name}
                variants={{
                  hidden: { opacity: 0, scale: 0.8, y: 20 },
                  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
                }}
                whileHover={!prefersReducedMotion ? { y: -6, scale: 1.08 } : {}}
                className="group flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-3 cursor-default holo-card"
                style={{ transition: "transform 0.2s ease, box-shadow 0.2s ease" }}
              >
                <span className="text-xl">{tech.icon}</span>
                <span className={`text-sm font-bold ${tech.color}`}>{tech.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── VALUES GRID ── */}
      <section className="relative z-10 px-4 sm:px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-pink-400 mb-3">Our Values</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">What drives us</h2>
            <div className="line-accent-3d w-24 mx-auto" />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
            style={{ perspective: "1200px" }}
          >
            {VALUE_PANELS.map((panel, i) => (
              <motion.div
                key={panel.title}
                variants={{
                  hidden: { opacity: 0, y: 40, rotateX: 15 },
                  show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
                }}
                whileHover={!prefersReducedMotion ? { y: -8, rotateX: -4 } : {}}
                className={`group relative glass-3d rounded-2xl border ${panel.border} p-6 holo-card overflow-hidden`}
                style={{ transition: "transform 0.25s ease, box-shadow 0.3s ease" }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${panel.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative z-10">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${panel.iconBg} text-xl mb-5 shadow-lg`}>
                    {panel.icon}
                  </div>
                  <h4 className="text-sm font-black uppercase tracking-[0.15em] text-white mb-3">{panel.title}</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">{panel.description}</p>
                  <div className="mt-5 h-px w-0 group-hover:w-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="relative z-10 px-4 sm:px-6 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="relative glass-3d rounded-[2.5rem] p-10 sm:p-14 overflow-hidden rotating-gradient-bg border border-white/8">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(rgba(99,102,241,0.5) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="relative z-10">
              <motion.div
                animate={!prefersReducedMotion ? { rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="text-6xl mb-6"
              >
                🚀
              </motion.div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Want to be part of this?
              </h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                We're always looking for passionate developers and designers to make EventMate even better.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/signup"
                  className="btn-glow-3d inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-indigo-500/30"
                >
                  🎉 Join EventMate
                </Link>
                <Link
                  to="/"
                  className="btn-glow-3d inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-8 py-4 text-base font-bold text-white hover:bg-white/15 transition-all"
                >
                  ← Explore Platform
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FOOTER ROW ── */}
      <div className="relative z-10 border-t border-white/5 py-6 px-4 text-center">
        <p className="text-xs text-gray-600">
          © 2026 EventMate · Crafted with{" "}
          <span className="text-pink-500">♥</span> by EliteX &amp; Team
        </p>
      </div>
    </div>
  );
}
