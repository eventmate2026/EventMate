import { useEffect, useRef, useState, Suspense, lazy } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const Spline = lazy(() => import("@splinetool/react-spline"));

/* ─── Team Data ─────────────────────────────────────────────────── */
const TEAM = [
  {
    id: "AJ",
    name: "Aditya Jambhulkar",
    handle: "@adityaj143",
    role: "LEADER // UI·UX DESIGNER",
    quote: "\"Design is not just what it looks like — it's how it works.\" — S. Jobs",
    mission: "Spearheading EventMate v3.0 interface overhaul",
    bio: "Visionary architect of the EventMate experience. Maps product direction, crafts pixel-perfect interfaces and leads the crew to ship excellence.",
    skills: ["UI/UX", "Figma", "React", "Leadership", "Design Systems"],
    skillBars: [
      { label: "UI/UX Design", pct: 95 },
      { label: "React", pct: 88 },
      { label: "Leadership", pct: 98 },
    ],
    activity: [3,5,4,7,6,8,5,9,7,8,6,9,10,8,7],
    githubUrl: "https://github.com/adityaj143",
    email: "adityajambhulkar513@gmail.com",
    xp: 9800,
    level: 42,
    isLead: true,
    accentColor: "#f59e0b",
    glowRgb: "245,158,11",
    rank: "COMMANDER",
    status: "ONLINE",
    clearance: "ALPHA-7",
    specialty: "INTERFACE ARCHITECT",
  },
  {
    id: "DN",
    name: "Dakshat Nagrale",
    handle: "@DakshatNagrale",
    role: "FRONTEND ENGINEER",
    quote: "\"Move fast, animate everything, break nothing.\"",
    mission: "Building 3D animated component library for EventMate",
    bio: "Translates designs into blazing-fast React components with smooth animations, responsive layouts and immersive interactive experiences.",
    skills: ["React 18", "Tailwind", "Framer Motion", "Vite", "GSAP"],
    skillBars: [
      { label: "React Ecosystem", pct: 92 },
      { label: "CSS Animations", pct: 90 },
      { label: "Performance", pct: 85 },
    ],
    activity: [2,4,6,5,8,7,9,6,8,10,7,9,8,10,9],
    githubUrl: "https://github.com/DakshatNagrale",
    email: "dakshatnagrale296@gmail.com",
    xp: 8200,
    level: 37,
    accentColor: "#6366f1",
    glowRgb: "99,102,241",
    rank: "SPECIALIST",
    status: "ONLINE",
    clearance: "BETA-3",
    specialty: "UI WEAPONS EXPERT",
  },
  {
    id: "AB",
    name: "Abhinay Borkar",
    handle: "@off-abhi-1287",
    role: "BACKEND ARCHITECT",
    quote: "\"If the API is slow, nothing else matters.\"",
    mission: "Designing high-throughput real-time event processing engine",
    bio: "Engineers robust server-side systems, secure APIs and reliable data flows that power every EventMate feature silently and efficiently.",
    skills: ["Node.js", "Express", "REST API", "JWT", "Middleware"],
    skillBars: [
      { label: "API Architecture", pct: 91 },
      { label: "Node.js", pct: 89 },
      { label: "Security", pct: 86 },
    ],
    activity: [5,3,7,6,4,8,5,7,9,6,8,10,7,9,8],
    githubUrl: "https://github.com/off-abhi-1287",
    email: "abhinayborkar1287@gmail.com",
    xp: 7900,
    level: 35,
    accentColor: "#10b981",
    glowRgb: "16,185,129",
    rank: "SPECIALIST",
    status: "ONLINE",
    clearance: "BETA-4",
    specialty: "SYSTEMS ENGINEER",
  },
  {
    id: "SK",
    name: "Saksham Khaire",
    handle: "@off-saksham-2007",
    role: "DATABASE ADMINISTRATOR",
    quote: "\"Every query counts. Index everything twice.\"",
    mission: "Optimising MongoDB aggregation pipelines for 10x throughput",
    bio: "Designs the data architecture, optimises queries and ensures every byte of campus event data is stored securely, indexed fast, and retrieved reliably.",
    skills: ["MongoDB", "Mongoose", "Schema Design", "Aggregation", "Indexing"],
    skillBars: [
      { label: "MongoDB", pct: 93 },
      { label: "Schema Design", pct: 90 },
      { label: "Query Optimisation", pct: 88 },
    ],
    activity: [4,6,5,8,7,5,9,6,8,7,10,8,9,7,10],
    githubUrl: "https://github.com/off-saksham-2007",
    email: "sakshamkhaire2007@gmail.com",
    xp: 7600,
    level: 33,
    accentColor: "#ec4899",
    glowRgb: "236,72,153",
    rank: "SPECIALIST",
    status: "ONLINE",
    clearance: "BETA-5",
    specialty: "DATA WARDEN",
  },
];

const TECH_STACK = [
  { name: "React 18", color: "#61dafb" },
  { name: "Node.js", color: "#87cf3e" },
  { name: "MongoDB", color: "#4db33d" },
  { name: "Express", color: "#999" },
  { name: "Tailwind CSS", color: "#38bdf8" },
  { name: "Framer Motion", color: "#a78bfa" },
  { name: "Vite", color: "#fbbf24" },
  { name: "Socket.io", color: "#fb7185" },
  { name: "JWT Auth", color: "#34d399" },
  { name: "Lucide React", color: "#e879f9" },
];

/* ─── Scanlines overlay ─────────────────────────────────────────── */
function Scanlines() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[5] opacity-[0.035]"
      style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.15) 2px, rgba(0,255,200,0.15) 4px)",
      }}
    />
  );
}

/* ─── Matrix rain canvas ─────────────────────────────────────────── */
function MatrixRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ";
    const fontSize = 13;
    const cols = Math.floor(canvas.width / fontSize);
    const drops = Array(cols).fill(1);

    let frame;
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(0,255,180,0.15)";
      ctx.font = `${fontSize}px monospace`;
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, y * fontSize);
        if (y * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[1] opacity-30" />;
}

/* ─── HUD Corner brackets ───────────────────────────────────────── */
function HUDCorners({ color = "#00ffcc", size = 14 }) {
  const s = `${size}px`;
  const w = "2px";
  const base = { position: "absolute", width: s, height: s, borderColor: color };
  return (
    <>
      <span style={{ ...base, top: 0, left: 0, borderTop: `${w} solid`, borderLeft: `${w} solid` }} />
      <span style={{ ...base, top: 0, right: 0, borderTop: `${w} solid`, borderRight: `${w} solid` }} />
      <span style={{ ...base, bottom: 0, left: 0, borderBottom: `${w} solid`, borderLeft: `${w} solid` }} />
      <span style={{ ...base, bottom: 0, right: 0, borderBottom: `${w} solid`, borderRight: `${w} solid` }} />
    </>
  );
}

/* ─── Glitch text ───────────────────────────────────────────────── */
function GlitchText({ children, className = "", color = "#00ffcc" }) {
  return (
    <span className={`relative inline-block ${className}`} style={{ color }}>
      {children}
      <span className="absolute inset-0 glitch-1" style={{ color: "#ff0080", clipPath: "polygon(0 20%, 100% 20%, 100% 45%, 0 45%)" }} aria-hidden>{children}</span>
      <span className="absolute inset-0 glitch-2" style={{ color: "#00eeff", clipPath: "polygon(0 60%, 100% 60%, 100% 78%, 0 78%)" }} aria-hidden>{children}</span>
    </span>
  );
}

/* ─── Typing terminal text ──────────────────────────────────────── */
function TerminalText({ lines, className = "" }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= lines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 380);
    return () => clearTimeout(t);
  }, [shown, lines.length]);

  return (
    <div className={`font-mono text-xs space-y-0.5 ${className}`}>
      {lines.slice(0, shown).map((line, i) => (
        <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span className="text-green-500 mr-2">&gt;</span>
          <span className="text-green-300">{line}</span>
        </motion.div>
      ))}
      {shown < lines.length && (
        <div>
          <span className="text-green-500 mr-2">&gt;</span>
          <span className="inline-block w-2 h-3 bg-green-400 animate-pulse align-middle" />
        </div>
      )}
    </div>
  );
}

/* ─── Skill Bar ─────────────────────────────────────────────────── */
function SkillBar({ label, pct, color, rgb, delay = 0 }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className="font-mono text-[9px] tracking-[0.15em] text-gray-500">{label}</span>
        <span className="font-mono text-[9px] tracking-[0.1em]" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-[3px] w-full rounded-full" style={{ background: `rgba(${rgb},0.12)` }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: `linear-gradient(to right, rgba(${rgb},0.5), ${color})`, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  );
}

/* ─── Activity Mini Graph ────────────────────────────────────────── */
function ActivityDots({ data, color, rgb }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-[3px] h-6">
      {data.map((v, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0, opacity: 0 }}
          whileInView={{ scaleY: 1, opacity: v / max }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: i * 0.04, ease: "easeOut" }}
          className="w-1.5 rounded-sm origin-bottom"
          style={{
            height: `${(v / max) * 100}%`,
            minHeight: 2,
            background: color,
            boxShadow: `0 0 4px rgba(${rgb},0.6)`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Member HUD card ───────────────────────────────────────────── */
function MemberCard({ member, index, reduceMotion }) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyEmail = (e) => {
    e.preventDefault();
    navigator.clipboard.writeText(member.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const tiltRef = useRef(null);
  const handleMouseMove = (e) => {
    if (reduceMotion || !tiltRef.current) return;
    const r = tiltRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    tiltRef.current.style.transform = `perspective(800px) rotateY(${(x - 0.5) * 10}deg) rotateX(${(y - 0.5) * -8}deg) scale(1.02)`;
  };
  const handleMouseLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)";
    setHovered(false);
  };

  const xpForNext = 10000;
  const xpPct = Math.min((member.xp / xpForNext) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotateX: 20 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.8, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: "1000px" }}
    >
      <div
        ref={tiltRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={handleMouseLeave}
        className="relative h-full rounded-sm overflow-hidden flex flex-col"
        style={{
          transition: "transform 0.15s ease, box-shadow 0.3s ease",
          background: "linear-gradient(145deg, rgba(2,4,16,0.95) 0%, rgba(5,12,30,0.95) 100%)",
          border: `1px solid rgba(${member.glowRgb},${hovered ? 0.5 : 0.25})`,
          boxShadow: hovered
            ? `0 0 40px rgba(${member.glowRgb},0.3), 0 0 80px rgba(${member.glowRgb},0.1), inset 0 0 30px rgba(${member.glowRgb},0.04)`
            : `0 0 10px rgba(${member.glowRgb},0.1)`,
        }}
      >
        <HUDCorners color={member.accentColor} size={16} />

        {/* ── TOP STATUS BAR ── */}
        <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: `rgba(${member.glowRgb},0.15)`, background: `rgba(${member.glowRgb},0.04)` }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="font-mono text-[9px] text-green-400 tracking-[0.2em]">{member.status}</span>
            </div>
            <span className="font-mono text-[9px] text-gray-700">|</span>
            <span className="font-mono text-[9px] tracking-[0.15em] text-gray-500">{member.specialty}</span>
          </div>
          <span className="font-mono text-[9px] tracking-[0.12em]" style={{ color: member.accentColor }}>
            CLR·{member.clearance}
          </span>
        </div>

        <div className="p-5 flex flex-col gap-4 flex-1">

          {/* ── AVATAR + IDENTITY ── */}
          <div className="flex items-start gap-4">
            {/* Avatar with XP ring */}
            <div className="relative shrink-0 w-[72px] h-[72px]">
              {/* XP progress ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="33" fill="none" stroke={`rgba(${member.glowRgb},0.1)`} strokeWidth="2" />
                <motion.circle
                  cx="36" cy="36" r="33" fill="none"
                  stroke={member.accentColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 33}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 33 }}
                  whileInView={{ strokeDashoffset: 2 * Math.PI * 33 * (1 - xpPct / 100) }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: `drop-shadow(0 0 4px ${member.accentColor})` }}
                />
              </svg>
              {/* Spinning conic ring */}
              <motion.div
                animate={!reduceMotion ? { rotate: 360 } : {}}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[4px] rounded-full"
                style={{ background: `conic-gradient(from 0deg, transparent 70%, ${member.accentColor}60)` }}
              />
              {/* Avatar face */}
              <div
                className="absolute inset-[8px] rounded-full flex items-center justify-center font-black text-lg"
                style={{
                  background: `radial-gradient(circle at 35% 35%, rgba(${member.glowRgb},0.4) 0%, rgba(0,0,0,0.95) 60%)`,
                  color: member.accentColor,
                  fontFamily: "monospace",
                  textShadow: `0 0 16px ${member.accentColor}, 0 0 32px rgba(${member.glowRgb},0.5)`,
                  border: `1px solid rgba(${member.glowRgb},0.4)`,
                }}
              >
                {member.id}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[8px] tracking-[0.25em]" style={{ color: member.accentColor }}>[{member.rank}]</span>
                {member.isLead && (
                  <motion.span
                    animate={!reduceMotion ? { opacity: [1, 0.4, 1] } : {}}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="font-mono text-[8px] tracking-[0.1em] border px-1.5 py-0.5 rounded-sm"
                    style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.08)" }}
                  >★ CMD</motion.span>
                )}
              </div>
              <h3 className="font-black text-white text-[15px] leading-tight tracking-wide">{member.name}</h3>
              <div className="font-mono text-[9px] tracking-widest mt-0.5" style={{ color: `rgba(${member.glowRgb},0.75)` }}>
                {member.role}
              </div>
              {/* XP bar under name */}
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[8px] text-gray-600">LVL·{member.level}</span>
                <div className="flex-1 h-[2px] rounded-full" style={{ background: `rgba(${member.glowRgb},0.12)` }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${xpPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ background: `linear-gradient(to right, rgba(${member.glowRgb},0.5), ${member.accentColor})` }}
                  />
                </div>
                <span className="font-mono text-[8px] text-gray-600">{member.xp.toLocaleString()}XP</span>
              </div>
            </div>
          </div>

          {/* ── QUOTE ── */}
          <div className="rounded-sm px-3 py-2 relative" style={{ background: `rgba(${member.glowRgb},0.04)`, border: `1px solid rgba(${member.glowRgb},0.1)` }}>
            <span className="font-mono text-[8px] tracking-[0.2em] text-gray-600 block mb-1">// PERSONAL LOG</span>
            <p className="font-mono text-[10px] italic" style={{ color: `rgba(${member.glowRgb},0.8)` }}>{member.quote}</p>
          </div>

          {/* ── BIO ── */}
          <p className="text-[11px] text-gray-400 leading-relaxed border-l-2 pl-3" style={{ borderColor: `rgba(${member.glowRgb},0.35)` }}>
            {member.bio}
          </p>

          {/* ── MISSION ASSIGNMENT ── */}
          <div className="flex items-start gap-2 rounded-sm px-3 py-2" style={{ background: "rgba(0,255,200,0.03)", border: "1px solid rgba(0,255,200,0.1)" }}>
            <motion.span
              animate={!reduceMotion ? { opacity: [1, 0.3, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="font-mono text-[9px] text-cyan-500 shrink-0 mt-0.5"
            >▶ MISSION:</motion.span>
            <span className="font-mono text-[9px] text-cyan-300/70 leading-relaxed">{member.mission}</span>
          </div>

          {/* ── SKILL PROFICIENCY BARS ── */}
          <div className="space-y-2">
            <span className="font-mono text-[9px] tracking-[0.25em] text-gray-600">// PROFICIENCY MATRIX</span>
            {member.skillBars.map((sb, i) => (
              <SkillBar key={sb.label} label={sb.label} pct={sb.pct} color={member.accentColor} rgb={member.glowRgb} delay={0.2 + i * 0.15} />
            ))}
          </div>

          {/* ── TECH SKILL TAGS ── */}
          <div className="flex flex-wrap gap-1.5">
            {member.skills.map((skill) => (
              <span
                key={skill}
                className="font-mono text-[9px] tracking-wider px-2 py-0.5 rounded-sm transition-all hover:scale-105"
                style={{ color: member.accentColor, background: `rgba(${member.glowRgb},0.07)`, border: `1px solid rgba(${member.glowRgb},0.2)` }}
              >
                {skill}
              </span>
            ))}
          </div>

          {/* ── ACTIVITY GRAPH ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[9px] tracking-[0.2em] text-gray-600">// DEPLOYMENT ACTIVITY</span>
              <span className="font-mono text-[8px] text-gray-700">LAST 15 CYCLES</span>
            </div>
            <ActivityDots data={member.activity} color={member.accentColor} rgb={member.glowRgb} />
          </div>

          {/* ── CONTACT LINKS ── */}
          <div className="flex items-center gap-2 flex-wrap mt-auto pt-1 border-t" style={{ borderColor: `rgba(${member.glowRgb},0.12)` }}>
            {/* GitHub */}
            <a
              href={member.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-mono text-[10px] px-3 py-1.5 rounded-sm transition-all hover:scale-105"
              style={{ color: member.accentColor, border: `1px solid rgba(${member.glowRgb},0.3)`, background: `rgba(${member.glowRgb},0.06)` }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 shrink-0">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              {member.handle}
            </a>

            {/* Email — click to copy */}
            <button
              onClick={copyEmail}
              title="Click to copy email"
              className="flex items-center gap-1.5 font-mono text-[10px] px-3 py-1.5 rounded-sm transition-all hover:scale-105 cursor-pointer"
              style={{ color: copied ? "#4ade80" : "rgba(200,200,220,0.7)", border: `1px solid ${copied ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.08)"}`, background: copied ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.03)" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 shrink-0">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M22 7l-10 7L2 7"/>
              </svg>
              <AnimatePresence mode="wait">
                {copied
                  ? <motion.span key="copied" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>COPIED ✓</motion.span>
                  : <motion.span key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="truncate max-w-[120px]">{member.email}</motion.span>
                }
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* ── SCAN LINE ── */}
        {hovered && !reduceMotion && (
          <motion.div
            initial={{ top: 0 }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
            className="absolute left-0 right-0 h-[2px] pointer-events-none z-20"
            style={{ background: `linear-gradient(to right, transparent, ${member.accentColor}, transparent)`, opacity: 0.5 }}
          />
        )}

        {/* ── DATA STREAM PARTICLES ── */}
        {hovered && !reduceMotion && (
          <div className="absolute top-0 right-3 w-px h-full pointer-events-none overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-px text-[8px] font-mono"
                style={{ color: member.accentColor, opacity: 0.4 }}
                animate={{ y: ["-10%", "110%"], opacity: [0, 0.5, 0] }}
                transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.4, ease: "linear" }}
              >
                {Math.random() > 0.5 ? "1" : "0"}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function DeveloperTeam() {
  const reduceMotion = useReducedMotion();
  const [systemBoot, setSystemBoot] = useState(false);
  const [splineLoaded, setSplineLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSystemBoot(true), 300);
    return () => clearTimeout(t);
  }, []);

  const bootLines = [
    "INITIALIZING EVENTMATE SYSTEM...",
    "LOADING CREW MANIFEST v2.6.0",
    "CONNECTING TO ELITEX NETWORK...",
    "VERIFYING SECURITY CLEARANCE...",
    "ALL SYSTEMS OPERATIONAL",
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>

      {/* ── Fixed Effects ── */}
      {!reduceMotion && <Scanlines />}
      {!reduceMotion && <MatrixRain />}

      {/* ── Grid overlay ── */}
      <div className="fixed inset-0 z-[2] pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(0,255,200,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,0.03) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* ── Spline 3D Scene ── */}
      <div className="fixed inset-0 z-[3] pointer-events-none">
        <Suspense fallback={null}>
          <Spline
            scene="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode"
            onLoad={() => setSplineLoaded(true)}
            style={{ width: "100%", height: "100%", opacity: splineLoaded ? 0.45 : 0 }}
          />
        </Suspense>
      </div>

      {/* ── Radial vignette ── */}
      <div className="fixed inset-0 z-[4] pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)" }} />

      {/* ─────────────────────────── PAGE CONTENT ─────────────────── */}
      <div className="relative z-10">

        {/* ── HERO ── */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-24 relative">
          {/* Corner HUD decorations */}
          <div className="absolute inset-0 pointer-events-none">
            <HUDCorners color="#00ffcc" size={28} />
          </div>

          {/* Top ticker */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 mb-10 font-mono text-[11px] tracking-[0.3em] text-cyan-500"
          >
            <span className="h-px w-12 bg-cyan-500" />
            <motion.span
              animate={!reduceMotion ? { opacity: [1, 0.4, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ◈
            </motion.span>
            ELITEX &amp; TEAM · MISSION CONTROL · EVENTMATE 2026
            <motion.span
              animate={!reduceMotion ? { opacity: [1, 0.4, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            >
              ◈
            </motion.span>
            <span className="h-px w-12 bg-cyan-500" />
          </motion.div>

          {/* Main title */}
          <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(20px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-6"
          >
            <div style={{ fontFamily: "inherit" }} className="text-[10px] sm:text-xs tracking-[0.5em] text-cyan-500 mb-4 uppercase">
              // THE BUILDERS BEHIND //
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-none uppercase">
              <GlitchText color="#00ffcc" className="block sm:inline">Event</GlitchText>
              <span className="block sm:inline text-white"> Mate</span>
            </h1>
            <div className="mt-4 h-px max-w-xs mx-auto" style={{ background: "linear-gradient(to right, transparent, #00ffcc, transparent)" }} />
          </motion.div>

          {/* Terminal boot */}
          {systemBoot && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8 }}
              className="relative mt-8 max-w-sm w-full rounded-sm p-4 mx-auto"
              style={{ background: "rgba(0,20,15,0.85)", border: "1px solid rgba(0,255,200,0.2)", backdropFilter: "blur(10px)" }}
            >
              <HUDCorners color="#00ffcc" size={10} />
              <div className="font-mono text-[9px] tracking-[0.2em] text-cyan-500 mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                TERMINAL v2.6 · ELITEX SYSTEMS
              </div>
              <TerminalText lines={bootLines} />
            </motion.div>
          )}

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to="/"
              className="relative group font-mono text-xs tracking-[0.2em] uppercase px-6 py-3 rounded-sm transition-all overflow-hidden"
              style={{ border: "1px solid rgba(0,255,200,0.4)", color: "#00ffcc", background: "rgba(0,255,200,0.05)" }}
            >
              <span className="relative z-10">← BACK TO BASE</span>
              <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" style={{ background: "rgba(0,255,200,0.1)" }} />
            </Link>
            <Link
              to="/signup"
              className="relative group font-mono text-xs tracking-[0.2em] uppercase px-6 py-3 rounded-sm transition-all"
              style={{ background: "linear-gradient(135deg, #00ffcc 0%, #6366f1 100%)", color: "#000", fontWeight: 900 }}
            >
              ENLIST NOW →
            </Link>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="font-mono text-[9px] tracking-[0.4em] text-cyan-600">SCROLL</span>
            <motion.div
              animate={!reduceMotion ? { y: [0, 8, 0], opacity: [0.5, 1, 0.5] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-px h-10"
              style={{ background: "linear-gradient(to bottom, #00ffcc, transparent)" }}
            />
          </motion.div>
        </section>

        {/* ── STATS HUD BAR ── */}
        <section className="px-4 sm:px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {[
              { val: "04", label: "CREW MEMBERS", color: "#00ffcc" },
              { val: "01", label: "COMMANDER", color: "#f59e0b" },
              { val: "10+", label: "TECHNOLOGIES", color: "#6366f1" },
              { val: "∞", label: "DEDICATION", color: "#ec4899" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={!reduceMotion ? { y: -4, scale: 1.04 } : {}}
                className="relative rounded-sm p-4 text-center overflow-hidden"
                style={{ background: "rgba(0,10,20,0.8)", border: `1px solid rgba(${s.color === "#00ffcc" ? "0,255,200" : s.color === "#f59e0b" ? "245,158,11" : s.color === "#6366f1" ? "99,102,241" : "236,72,153"},0.25)`, backdropFilter: "blur(10px)", transition: "transform 0.2s ease" }}
              >
                <HUDCorners color={s.color} size={8} />
                <div className="font-black text-3xl mb-1" style={{ color: s.color, textShadow: `0 0 20px ${s.color}` }}>{s.val}</div>
                <div className="font-mono text-[9px] tracking-[0.2em] text-gray-500">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── CREW MANIFEST ── */}
        <section className="px-4 sm:px-6 pb-24">
          <div className="max-w-6xl mx-auto">
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-12 text-center"
            >
              <div className="inline-flex items-center gap-3 font-mono text-[10px] tracking-[0.4em] text-cyan-600 mb-4">
                <span className="h-px w-8 bg-cyan-800" />
                CREW MANIFEST // CLASSIFIED
                <span className="h-px w-8 bg-cyan-800" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider text-white">
                Meet the <span style={{ color: "#00ffcc", textShadow: "0 0 20px #00ffcc" }}>Team</span>
              </h2>
              <div className="mt-3 h-px max-w-[120px] mx-auto" style={{ background: "linear-gradient(to right, transparent, #00ffcc, transparent)" }} />
            </motion.div>

            {/* Lead card — full width */}
            <div className="mb-5">
              <MemberCard member={TEAM[0]} index={0} reduceMotion={reduceMotion} />
            </div>

            {/* Other 3 */}
            <div className="grid gap-5 sm:grid-cols-3">
              {TEAM.slice(1).map((m, i) => (
                <MemberCard key={m.id} member={m} index={i + 1} reduceMotion={reduceMotion} />
              ))}
            </div>
          </div>
        </section>

        {/* ── TECH STACK ── */}
        <section className="px-4 sm:px-6 pb-24">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <div className="font-mono text-[10px] tracking-[0.4em] text-cyan-600 mb-3">// ARSENAL //</div>
              <h2 className="text-3xl font-black uppercase tracking-wider text-white">Tech <span style={{ color: "#00ffcc" }}>Stack</span></h2>
              <div className="mt-3 h-px max-w-[80px] mx-auto" style={{ background: "linear-gradient(to right, transparent, #00ffcc, transparent)" }} />
            </motion.div>
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              className="flex flex-wrap justify-center gap-3"
            >
              {TECH_STACK.map((tech) => (
                <motion.div
                  key={tech.name}
                  variants={{ hidden: { opacity: 0, scale: 0.7, y: 15 }, show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
                  whileHover={!reduceMotion ? { y: -5, scale: 1.06 } : {}}
                  className="relative font-mono text-xs tracking-wider px-4 py-2 rounded-sm cursor-default"
                  style={{ color: tech.color, border: `1px solid ${tech.color}33`, background: `${tech.color}0a`, transition: "transform 0.2s ease" }}
                >
                  <span style={{ textShadow: `0 0 10px ${tech.color}` }}>{tech.name}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── MISSION VALUES ── */}
        <section className="px-4 sm:px-6 pb-24">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <div className="font-mono text-[10px] tracking-[0.4em] text-cyan-600 mb-3">// MISSION DIRECTIVES //</div>
              <h2 className="text-3xl font-black uppercase tracking-wider text-white">Core <span style={{ color: "#00ffcc" }}>Values</span></h2>
            </motion.div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "🎯", title: "PRODUCT VISION", desc: "Every feature mapped to measurable student outcomes and real campus impact.", color: "#6366f1", rgb: "99,102,241" },
                { icon: "⚙️", title: "ENGINEERING", desc: "Clean systems, reliable flows, and interactions that feel invisible and effortless.", color: "#10b981", rgb: "16,185,129" },
                { icon: "🤝", title: "TEAMWORK", desc: "Shared ownership, rapid iteration, and a culture of mutual respect and velocity.", color: "#00ffcc", rgb: "0,255,200" },
                { icon: "🚀", title: "DELIVERY", desc: "Shipping improvements every cycle, gathering signal to iterate and compound quality.", color: "#ec4899", rgb: "236,72,153" },
              ].map((v, i) => (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={!reduceMotion ? { y: -6, scale: 1.02 } : {}}
                  className="relative rounded-sm p-5 overflow-hidden group"
                  style={{ background: "rgba(0,10,20,0.8)", border: `1px solid rgba(${v.rgb},0.2)`, backdropFilter: "blur(10px)", transition: "transform 0.25s ease, box-shadow 0.25s ease" }}
                >
                  <HUDCorners color={v.color} size={10} />
                  <div className="text-2xl mb-3">{v.icon}</div>
                  <div className="font-mono text-[10px] tracking-[0.2em] mb-2" style={{ color: v.color }}>{v.title}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{v.desc}</p>
                  <div className="mt-4 h-px w-0 group-hover:w-full transition-all duration-500" style={{ background: `linear-gradient(to right, ${v.color}, transparent)` }} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA TERMINAL ── */}
        <section className="px-4 sm:px-6 pb-28">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <div
              className="relative rounded-sm p-8 sm:p-12 text-center overflow-hidden"
              style={{ background: "rgba(0,10,20,0.9)", border: "1px solid rgba(0,255,200,0.25)", backdropFilter: "blur(20px)" }}
            >
              <HUDCorners color="#00ffcc" size={20} />
              {/* Scan animation */}
              <motion.div
                animate={!reduceMotion ? { top: ["-2px", "calc(100% + 2px)"] } : {}}
                transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                className="absolute left-0 right-0 h-px pointer-events-none"
                style={{ background: "linear-gradient(to right, transparent, #00ffcc, transparent)", opacity: 0.5 }}
              />
              <div className="relative z-10">
                <motion.div
                  animate={!reduceMotion ? { rotate: [0, 360] } : {}}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="text-5xl mb-5 inline-block"
                >
                  🛸
                </motion.div>
                <div className="font-mono text-[10px] tracking-[0.4em] text-cyan-600 mb-3">// TRANSMISSION //</div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-white mb-3">
                  Want to <span style={{ color: "#00ffcc", textShadow: "0 0 20px #00ffcc" }}>Join</span> the Mission?
                </h2>
                <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
                  We're building the future of campus events. If you code, design, or just care about great software — we want to hear from you.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link
                    to="/signup"
                    className="font-mono text-xs tracking-[0.2em] uppercase px-8 py-3.5 rounded-sm font-black"
                    style={{ background: "linear-gradient(135deg, #00ffcc, #6366f1)", color: "#000" }}
                  >
                    ENLIST NOW
                  </Link>
                  <Link
                    to="/"
                    className="font-mono text-xs tracking-[0.2em] uppercase px-8 py-3.5 rounded-sm"
                    style={{ border: "1px solid rgba(0,255,200,0.4)", color: "#00ffcc", background: "rgba(0,255,200,0.05)" }}
                  >
                    ← RETURN TO BASE
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── FOOTER LINE ── */}
        <div className="border-t py-6 px-4 text-center" style={{ borderColor: "rgba(0,255,200,0.1)" }}>
          <p className="font-mono text-[10px] tracking-[0.25em] text-gray-700">
            © 2026 EVENTMATE · ELITEX &amp; TEAM · ALL SYSTEMS ONLINE
            <span className="text-cyan-800 mx-2">//</span>
            CRAFTED WITH <span className="text-pink-700">♥</span> IN CHANDRAPUR
          </p>
        </div>
      </div>

      {/* ── GLOBAL SCIFI STYLES ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');

        .glitch-1 { animation: g1 4s infinite; }
        .glitch-2 { animation: g2 4s infinite; }

        @keyframes g1 {
          0%,95%,100% { transform: translate(0); opacity: 0; }
          96% { transform: translate(-3px, 1px); opacity: 1; }
          97% { transform: translate(2px, -1px); opacity: 1; }
          98% { transform: translate(0); opacity: 0; }
        }
        @keyframes g2 {
          0%,92%,100% { transform: translate(0); opacity: 0; }
          93% { transform: translate(3px, 1px); opacity: 1; }
          94% { transform: translate(-2px, -1px); opacity: 1; }
          95% { transform: translate(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
