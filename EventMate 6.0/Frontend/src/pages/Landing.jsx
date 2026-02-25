import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ContactUs from "../components/ContactUs";
import { motion, useReducedMotion, useScroll } from "framer-motion";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { extractEventList } from "../lib/backendAdapters";

// --- Icons ---
const SearchIcon = () => (
  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const CalendarIcon = () => (
  <svg className="w-5 h-5 text-indigo-500 dark:text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
);
const MapPinIcon = () => (
  <svg className="w-5 h-5 text-purple-500 dark:text-purple-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
);
const ArrowRight = () => (
  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
);

const normalizeText = (value) => (value ?? "").toString().trim().toLowerCase();

const fallbackImages = {
  Technical: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format",
  Cultural: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format",
  Sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format",
  Workshop: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format",
};

const formatEventDate = (value) => {
  if (!value) return "Date TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
};

const mapDbEvent = (event) => {
  const fee = Number(event?.registration?.fee || 0);
  const category = event?.category || "Workshop";

  return {
    id: event?._id,
    title: event?.title || "Untitled Event",
    description: event?.description || "Details will be announced soon.",
    date: formatEventDate(event?.schedule?.startDate),
    time: event?.schedule?.startTime || "Time TBD",
    location: event?.venue?.location || "Venue TBD",
    price: fee <= 0 ? "Free" : `Rs ${fee}`,
    category,
    image: event?.posterUrl || fallbackImages[category] || fallbackImages.Workshop,
    link: "#",
  };
};

// --- Animations ---
// 1. Staggered Text Reveal for Hero
const textReveal = {
  hidden: { opacity: 0, y: 50, filter: "blur(10px)", rotateX: -10 },
  show: { opacity: 1, y: 0, filter: "blur(0px)", rotateX: 0, transition: { duration: 1, ease: [0.16, 1, 0.3, 1] } },
};
const containerReveal = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.5 } }, // Wait for loader to finish
};

// 2. Standard Fade Up
const fadeUp = {
  hidden: { opacity: 0, y: 40, filter: "blur(10px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

export default function Landing() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState(null);
  const reduceMotion = useReducedMotion();
  const location = useLocation();

  // --- Parallax & Scroll Logic ---
  const { scrollYProgress } = useScroll();
  const scaleX = scrollYProgress;
  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      setIsLoadingEvents(true);
      setEventsError(null);
      try {
        const response = await api({
          ...SummaryApi.get_public_events,
          skipAuth: true,
        });
        if (isMounted) {
          const mapped = extractEventList(response.data).map(mapDbEvent);
          setEvents(mapped);
        }
      } catch (err) {
        if (isMounted) {
          setEvents([]);
          setEventsError(err.response?.data?.message || "Unable to load events right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingEvents(false);
        }
      }
    };

    fetchEvents();
    return () => {
      isMounted = false;
    };
  }, []);
  const categories = useMemo(() => {
    const seen = new Map();
    events.forEach((event) => {
      const raw = event?.category;
      const key = normalizeText(raw);
      if (!key) return;
      if (!seen.has(key)) {
        seen.set(key, raw.toString().trim());
      }
    });
    return ["All", ...Array.from(seen.values())];
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = normalizeText(searchQuery);
    const selectedKey = normalizeText(selectedCategory);
    return events.filter((event) => {
      const title = normalizeText(event?.title);
      const description = normalizeText(event?.description);
      const matchesSearch =
        !query || title.includes(query) || description.includes(query);
      const matchesCategory = selectedKey === "all" || normalizeText(event?.category) === selectedKey;
      return matchesSearch && matchesCategory;
    });
  }, [events, searchQuery, selectedCategory]);

  const handleRegister = () => {
    navigate("/login");
  };

  useEffect(() => {
    const { hash } = location;
    if (!hash) return;

    const target = document.querySelector(hash);
    if (!target) return;

    const scrollToTarget = () => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    requestAnimationFrame(scrollToTarget);
  }, [location.hash]);

  const viewportOnce = { once: true, amount: 0.25 };

  return (
    <div className="min-h-screen relative bg-white dark:bg-[#030712] text-gray-900 dark:text-white overflow-x-hidden selection:bg-indigo-500 selection:text-white font-sans transition-colors duration-300">
      
      {/* --- SCROLL PROGRESS BAR --- */}
      <motion.div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-50 origin-left"
        style={{ scaleX: scaleX }}
      />

      {/* --- PARALLAX BACKGROUND --- */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-50 dark:from-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-slate-900 dark:via-[#0B1026] dark:to-[#000000]" />
        <div className="absolute inset-0 opacity-[0.3] dark:opacity-20" 
             style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-indigo-400/15 dark:bg-indigo-600/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[700px] h-[700px] bg-purple-400/15 dark:bg-purple-600/15 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-pink-300/10 dark:bg-pink-600/10 rounded-full blur-[100px]" />
      </div>

      {/* --- HERO SECTION (Synced Animation) --- */}
      <section className="relative z-10 pt-32 pb-16 lg:pt-48 lg:pb-24 px-6">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="hero-spotlight hero-spotlight--one" />
          <div className="hero-spotlight hero-spotlight--two" />
          <div className="hero-spotlight hero-spotlight--three" />
          <div className="hero-stars" />
          <div className="hero-beam" />
        </div>

        <div className="max-w-5xl mx-auto text-center">
          
          <motion.div
            initial="hidden"
            animate="show"
            variants={containerReveal}
            className="w-full"
          >
              {/* Badge */}
              <motion.span
                variants={textReveal}
                className="inline-block py-1 px-4 rounded-full bg-indigo-50 dark:bg-white/5 border border-indigo-100 dark:border-white/10 text-indigo-600 dark:text-indigo-300 text-xs font-bold uppercase tracking-[0.2em] mb-8 backdrop-blur-md"
              >
                Campus Event Management
              </motion.span>

              {/* Main Title (Word by word effect) */}
              <motion.h1
                variants={textReveal}
                className="hero-title text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 leading-[1.05] text-transparent bg-clip-text bg-gradient-to-b from-gray-900 to-gray-600 dark:from-white dark:to-white/40"
              >
                Manage Campus Events <br />
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.2, duration: 0.8, type: "spring" }}
                  className="hero-accent inline-block bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"
                >
                  Seamlessly
                </motion.span>
              </motion.h1>

              {/* Description */}
              <motion.p variants={textReveal} className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
                The all-in-one platform for students and organizers. Discover events, register instantly, check-in with QR codes, and earn digital certificates.
              </motion.p>

              {/* Buttons */}
              <motion.div variants={textReveal} className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
                <Link
                  to="/signup"
                  className="group relative p-[2px] rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 cta-glow"
                >
                  <div className="relative bg-white dark:bg-[#030712] rounded-full px-8 py-4 group-hover:bg-opacity-0 transition-all duration-300">
                    <span className="relative z-10 text-gray-900 dark:text-white font-bold text-lg flex items-center">
                      Get Started Free <ArrowRight />
                    </span>
                  </div>
                </Link>

                <Link 
                  to="/login"
                  className="cta-secondary px-8 py-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white rounded-full font-bold text-lg transition-all"
                >
                  Login
                </Link>
              </motion.div>
          </motion.div>
        </div>
      </section>

      {/* --- INFINITE MARQUEE --- */}
      <section className="relative z-10 py-8 overflow-hidden border-y border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
        <div className="flex whitespace-nowrap gap-12">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex flex-wrap gap-6 md:gap-12 min-w-full justify-center">
              <span className="text-2xl font-bold text-gray-300 dark:text-white/10 uppercase tracking-widest">Hackathon</span>
              <span className="text-2xl font-bold text-indigo-300 dark:text-indigo-500/20 uppercase tracking-widest">•</span>
              <span className="text-2xl font-bold text-gray-300 dark:text-white/10 uppercase tracking-widest">Quiz Competition</span>
              <span className="text-2xl font-bold text-indigo-300 dark:text-indigo-500/20 uppercase tracking-widest">•</span>
              <span className="text-2xl font-bold text-gray-300 dark:text-white/10 uppercase tracking-widest">Cultural Fest</span>
              <span className="text-2xl font-bold text-indigo-300 dark:text-indigo-500/20 uppercase tracking-widest">•</span>
              <span className="text-2xl font-bold text-gray-300 dark:text-white/10 uppercase tracking-widest">Workshop</span>
              <span className="text-2xl font-bold text-indigo-300 dark:text-indigo-500/20 uppercase tracking-widest">•</span>
              <span className="text-2xl font-bold text-gray-300 dark:text-white/10 uppercase tracking-widest">Seminar</span>
              <span className="text-2xl font-bold text-indigo-300 dark:text-indigo-500/20 uppercase tracking-widest">•</span>
            </div>
          ))}
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger}
          className="text-center mb-20"
        >
          <motion.p variants={fadeUp} className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs mb-4">How It Works</motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-6">How EventMate Works</motion.h2>
          <motion.div variants={fadeUp} className="w-20 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 mx-auto rounded-full"></motion.div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger}
          className="grid md:grid-cols-3 gap-8"
        >
          {[
            { icon: "🔍", title: "Discover Events", desc: "Browse all upcoming campus events with full details.", color: "from-indigo-100/50 to-transparent dark:from-indigo-500/20" },
            { icon: "📝", title: "Register Securely", desc: "Login → Select Event → Confirm Registration", color: "from-purple-100/50 to-transparent dark:from-purple-500/20" },
            { icon: "🎓", title: "Attend & Get Certified", desc: "QR Scan → Attendance Marked → Certificate Generated", color: "from-pink-100/50 to-transparent dark:from-pink-500/20" },
          ].map((card) => (
            <motion.div
              key={card.title}
              variants={fadeUp}
              whileHover={reduceMotion ? {} : { y: -10 }}
              className="group relative bg-white dark:bg-white/5 backdrop-blur-xl rounded-[2rem] p-10 border border-gray-200 dark:border-white/10 text-center overflow-hidden hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 shadow-sm dark:shadow-none"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className="w-24 h-24 mx-auto bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-3xl flex items-center justify-center text-5xl mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500">
                  {card.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{card.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* --- BENTO GRID LAYOUT (Why EventMate) --- */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger}
          className="mb-16 text-center"
        >
          <motion.p variants={fadeUp} className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs mb-4">Why Choose Us</motion.p>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white">Why EventMate?</motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger}
          className="grid md:grid-cols-4 md:grid-rows-2 gap-6 h-auto md:h-[600px]"
        >
          {/* Large Span Card */}
          <motion.div variants={fadeUp} whileHover={{ scale: 0.98 }} className="md:col-span-2 md:row-span-2 relative bg-indigo-50 dark:bg-indigo-600/10 backdrop-blur-3xl rounded-[2.5rem] p-10 border border-indigo-100 dark:border-indigo-500/20 overflow-hidden group">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/50 to-transparent dark:from-indigo-600/20 opacity-0 group-hover:opacity-100 transition duration-500"></div>
             <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <div className="w-16 h-16 bg-white dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-sm dark:shadow-none">⚡</div>
                  <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4">Lightning Fast</h3>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">Automated workflows that save hours of manual admin work. No more Excel sheets.</p>
                </div>
                <div className="mt-8">
                  <div className="w-full h-32 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
                    <span className="text-4xl">⚡</span>
                  </div>
                </div>
             </div>
          </motion.div>

          {/* Standard Card 1 */}
          <motion.div variants={fadeUp} whileHover={{ y: -5 }} className="bg-gray-50 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all">
             <div className="w-12 h-12 bg-white dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-xl mb-4 shadow-sm dark:shadow-none">🔐</div>
             <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Secure Access</h3>
             <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">Role-based protection ensures data stays safe.</p>
          </motion.div>

          {/* Standard Card 2 */}
          <motion.div variants={fadeUp} whileHover={{ y: -5 }} className="bg-gray-50 dark:bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all">
             <div className="w-12 h-12 bg-white dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-xl mb-4 shadow-sm dark:shadow-none">🌱</div>
             <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Paperless</h3>
             <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">Digital tickets and certificates.</p>
          </motion.div>

          {/* Wide Card at Bottom */}
          <motion.div variants={fadeUp} whileHover={{ y: -5 }} className="md:col-span-2 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-white/10 dark:to-purple-900/20 backdrop-blur-xl rounded-[2rem] p-8 border border-transparent dark:border-white/10 flex items-center justify-between group">
             <div className="z-10">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ready to transform your campus?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Join 500+ clubs today.</p>
             </div>
             <div className="w-16 h-16 rounded-full bg-white dark:bg-white/10 flex items-center justify-center group-hover:scale-110 transition shadow-md dark:shadow-none">
                <ArrowRight />
             </div>
          </motion.div>
        </motion.div>
      </section>

      {/* --- UPCOMING EVENTS --- */}
      <section id="events" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <motion.div initial="hidden" whileInView="show" viewport={viewportOnce} variants={stagger} className="mb-16">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-12">
            <div>
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4">Upcoming Events</h2>
              <div className="w-24 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
            </div>

            <div className="relative w-full md:w-96">
              <div className="absolute inset-y-0 left-4 pl-3 flex items-center pointer-events-none">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wide transition-all duration-300 border ${
                  selectedCategory === cat
                    ? "bg-gray-900 dark:bg-white text-white dark:text-black border-transparent shadow-[0_0_20px_rgba(0,0,0,0.2)]"
                    : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/30 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.1 }}
          variants={stagger}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {isLoadingEvents ? (
            <div className="col-span-3 flex flex-col items-center justify-center py-24 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
              <p className="text-xl text-gray-500 dark:text-gray-400">Loading events...</p>
            </div>
          ) : eventsError ? (
            <div className="col-span-3 flex flex-col items-center justify-center py-24 bg-red-50 dark:bg-red-500/15 rounded-3xl border border-red-200 dark:border-red-400/30">
              <p className="text-xl text-red-600 dark:text-red-300">{eventsError}</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="col-span-3 flex flex-col items-center justify-center py-24 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
              <p className="text-xl text-gray-500 dark:text-gray-400">No events found matching your search.</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <motion.div
                key={event.id}
                variants={fadeUp}
                whileHover={reduceMotion ? {} : { y: -10 }}
                className="group relative bg-white dark:bg-white/5 backdrop-blur-md rounded-[2rem] border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all duration-500 shadow-xl dark:shadow-none"
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover transition duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div
                    className={`absolute top-6 right-6 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg backdrop-blur-md ${
                      event.price === "Free" ? "bg-emerald-600" : "bg-indigo-600"
                    }`}
                  >
                    {event.price}
                  </div>
                </div>

                <div className="p-8 flex flex-col flex-grow">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4 uppercase tracking-wider bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10">
                    {event.category}
                  </span>

                  <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 line-clamp-2 text-sm leading-relaxed">
                    {event.description}
                  </p>

                  <div className="space-y-3 mb-8 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center"><CalendarIcon /> {event.date} | {event.time}</div>
                    <div className="flex items-center"><MapPinIcon /> {event.location}</div>
                  </div>

                  <div className="mt-auto flex gap-3">
                    <button
                      onClick={() => handleRegister(event.title)}
                      className="flex-1 border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white py-3 rounded-xl font-bold hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition duration-300"
                    >
                      Register
                    </button>

                    <Link
                      to={event.link || "#"}
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-center hover:bg-indigo-700 transition duration-300 flex items-center justify-center"
                    >
                      Details <ArrowRight />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <motion.h2 initial="hidden" whileInView="show" viewport={viewportOnce} variants={fadeUp} className="text-4xl md:text-5xl font-black text-center mb-16 text-gray-900 dark:text-white">
          Everything you need to run events
        </motion.h2>

        <motion.div initial="hidden" whileInView="show" viewport={viewportOnce} variants={stagger} className="grid md:grid-cols-3 gap-8">
          {[
            { icon: "📱", title: "QR Check-in", desc: "Fast, contactless attendance marking with real-time sync." },
            { icon: "🏆", title: "Instant Certificates", desc: "Auto-generated digital certificates after feedback." },
            { icon: "📊", title: "Real-time Analytics", desc: "Track registrations and attendance instantly." },
          ].map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              whileHover={reduceMotion ? {} : { y: -6 }}
              className="bg-gray-50 dark:bg-white/5 backdrop-blur-md rounded-3xl p-10 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all shadow-lg dark:shadow-none"
            >
              <div className="text-5xl mb-6">{f.icon}</div>
              <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{f.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* --- CONTACT SECTION --- */}
      <section id="contact" className="relative z-10 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="show" viewport={viewportOnce} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-6">Get in Touch</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">Need to talk to us? Send us a message.</p>
          </motion.div>
          <ContactUs />
        </div>
      </section>                                                                                                                     

      <style>{`
        .hero-spotlight {
          position: absolute;
          border-radius: 9999px;
          filter: blur(40px);
          opacity: 0.5;
        }
        .hero-spotlight--one {
          width: 420px;
          height: 420px;
          top: -120px;
          left: 8%;
          background: radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%);
        }
        .hero-spotlight--two {
          width: 520px;
          height: 520px;
          bottom: -200px;
          right: 5%;
          background: radial-gradient(circle, rgba(236,72,153,0.25), transparent 70%);
        }
        .hero-spotlight--three {
          width: 360px;
          height: 360px;
          top: 30%;
          right: 18%;
          background: radial-gradient(circle, rgba(168,85,247,0.25), transparent 70%);
        }
        .hero-stars {
          position: absolute;
          inset: 0;
          opacity: 0.2;
          background-image:
            radial-gradient(rgba(99,102,241,0.35) 1px, transparent 1px),
            radial-gradient(rgba(236,72,153,0.25) 1px, transparent 1px);
          background-size: 140px 140px, 220px 220px;
          background-position: 0 0, 80px 100px;
          mix-blend-mode: screen;
        }
        .hero-beam {
          position: absolute;
          left: -10%;
          right: -10%;
          top: -30%;
          height: 280px;
          background: linear-gradient(120deg, rgba(99,102,241,0.12), rgba(236,72,153,0.12), transparent 70%);
          filter: blur(40px);
        }
        .hero-title {
          text-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
        }
        .hero-accent {
          text-shadow: 0 0 20px rgba(99,102,241,0.35);
        }
        .cta-glow {
          box-shadow: 0 14px 28px rgba(99,102,241,0.2);
        }
        .cta-secondary {
          position: relative;
          overflow: hidden;
        }
        .cta-secondary::before {
          content: "";
          position: absolute;
          inset: -60%;
          background: radial-gradient(circle, rgba(99,102,241,0.2), transparent 60%);
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .cta-secondary:hover::before {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
