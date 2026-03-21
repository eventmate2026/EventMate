import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  Menu, 
  X, 
  LogOut, 
  Moon,
  Sun,
  Home,
  Calendar,
  Mail
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import AvatarWithFrame from './AvatarWithFrame';
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredToken } from "../lib/auth";

const Navbar = ({ activePage, setActivePage, user, onLogout }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const isStudent = user?.role === "STUDENT";
  const displayName = user?.fullName || user?.name || 'Student';
  const avatarUrl = user?.avatar || "";
  const avatarText = displayName.charAt(0).toUpperCase();
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();
  const themeToggleClass =
    "p-2 rounded-full border border-indigo-200 bg-white text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 transition " +
    "dark:border-indigo-400/40 dark:bg-slate-800 dark:text-indigo-100 dark:hover:bg-slate-700 dark:hover:text-white";
  const mobileProfilePanelMotion = prefersReducedMotion
    ? {
        initial: false,
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 0 },
      }
    : {
        initial: { opacity: 0, y: -10, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -6, scale: 0.98 },
      };
  const mobileProfilePanelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.22, 1, 0.36, 1] };
  const mobileMenuPanelMotion = prefersReducedMotion
    ? {
        initial: false,
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 0, scale: 1 },
      }
    : {
        initial: { opacity: 0, y: -12, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -10, scale: 0.985 },
      };
  const mobileMenuPanelTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.22, 1, 0.36, 1] };
  const mobileMenuItemClass = (active = false) =>
    `group flex w-full items-start gap-3 rounded-[22px] border px-3.5 py-3.5 text-left transition-all duration-200 ${
      active
        ? "border-indigo-200 bg-indigo-50/90 text-indigo-700 shadow-[0_16px_30px_-24px_rgba(79,70,229,0.65)] dark:border-indigo-400/35 dark:bg-indigo-500/15 dark:text-indigo-200"
        : "border-transparent bg-slate-50/80 text-slate-700 hover:border-slate-200 hover:bg-white dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/10 dark:hover:bg-white/[0.07]"
    }`;
  const mobileMenuIconShellClass = (active = false) =>
    `mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition ${
      active
        ? "border-indigo-200 bg-white text-indigo-600 dark:border-indigo-400/30 dark:bg-slate-950/60 dark:text-indigo-200"
        : "border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300"
    }`;
  const mobileQuickActionClass =
    "inline-flex min-h-[2.75rem] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/50 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:border-indigo-400/30 dark:hover:text-indigo-200";

  if (!isStudent) {
    return null;
  }

  const pageToPath = {
    home: "/student-dashboard",
    events: "/student-dashboard/events",
    "my-events": "/student-dashboard/my-events",
    notifications: "/student-dashboard/notifications",
    "contact-us": "/student-dashboard/contact-us",
  };
  const closeMenus = () => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsMobileProfileOpen(false);
  };

  useEffect(() => {
    let mounted = true;
    let requestInFlight = false;
    let activeController = null;
    const userId = String(user?._id || user?.id || "").trim();

    const syncUnread = async () => {
      if (!getStoredToken() || !userId) {
        if (mounted) setUnreadCount(0);
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      if (requestInFlight) {
        return;
      }

      activeController?.abort?.();
      activeController = new AbortController();
      requestInFlight = true;

      try {
        const response = await api({
          ...SummaryApi.get_my_notifications,
          cacheTTL: 20000,
          skipRetry: true,
          timeout: 8000,
          signal: activeController.signal,
        });
        const nextUnread = Number(response?.data?.unreadCount || 0);
        if (mounted) setUnreadCount(nextUnread);
      } catch (error) {
        if (activeController?.signal?.aborted || error?.code === "ERR_CANCELED") {
          return;
        }
        if (mounted) setUnreadCount(0);
      } finally {
        requestInFlight = false;
      }
    };

    const onUnreadCount = (event) => {
      const nextUnread = Number(event?.detail ?? 0);
      setUnreadCount(Number.isFinite(nextUnread) ? Math.max(0, nextUnread) : 0);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncUnread();
      }
    };

    window.addEventListener("eventmate:student-unread-count", onUnreadCount);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    syncUnread();

    let intervalId = null;
    if (userId) {
      intervalId = setInterval(syncUnread, 30000);
    }

    return () => {
      mounted = false;
      activeController?.abort?.();
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("eventmate:student-unread-count", onUnreadCount);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [user?._id, user?.id]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const shouldLockScroll = isMobileMenuOpen || isMobileProfileOpen;
    if (!shouldLockScroll) {
      return undefined;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isMobileMenuOpen, isMobileProfileOpen]);

  // Handle route navigation for student dashboard pages
  const handleNavClick = (pageName) => {
    if (typeof setActivePage === "function") {
      setActivePage(pageName);
    }

    navigate(pageToPath[pageName] || "/student-dashboard");
    closeMenus();
    const resetScroll = { top: 0, left: 0, behavior: "auto" };
    window.scrollTo(resetScroll);
    document.documentElement?.scrollTo?.(resetScroll);
    document.body?.scrollTo?.(resetScroll);
  };
  const toggleMobileProfileMenu = () => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    setIsMobileProfileOpen((prev) => !prev);
  };
  const handleMobileProfileClick = () => {
    toggleMobileProfileMenu();
  };

  const isActivePage = (pageName) => activePage === pageName;
  const mobileMenuSections = [
    {
      title: "Explore",
      items: [
        {
          key: "home",
          label: "Home",
          description: "Return to your student dashboard overview.",
          icon: Home,
          active: isActivePage("home"),
          onSelect: () => handleNavClick("home"),
        },
        {
          key: "events",
          label: "Events",
          description: "Browse upcoming events and open registrations.",
          icon: Calendar,
          active: isActivePage("events"),
          onSelect: () => handleNavClick("events"),
        },
        {
          key: "my-events",
          label: "My Events",
          description: "Open your registered and completed events.",
          icon: Calendar,
          active: isActivePage("my-events"),
          onSelect: () => handleNavClick("my-events"),
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          key: "contact-us",
          label: "Contact us",
          description: "Reach the EventMate team whenever you need help.",
          icon: Mail,
          active: isActivePage("contact-us"),
          onSelect: () => handleNavClick("contact-us"),
        },
      ],
    },
  ];
  const mobileQuickActions = [
    {
      key: "profile",
      label: "Profile",
      onSelect: () => {
        navigate("/profile");
        closeMenus();
      },
    },
    {
      key: "theme",
      label: isDark ? "Light" : "Dark",
      onSelect: () => {
        toggleTheme();
        closeMenus();
      },
    },
  ];
  const renderMobileMenuEntry = (item) => {
    const Icon = item.icon || Home;
    return (
      <button
        key={item.key}
        type="button"
        onClick={item.onSelect}
        className={mobileMenuItemClass(item.active)}
      >
        <span className={mobileMenuIconShellClass(item.active)}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold leading-5">{item.label}</span>
          <span
            className={`mt-1 block text-[11px] leading-5 ${
              item.active ? "text-indigo-500/90 dark:text-indigo-200/80" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {item.description}
          </span>
        </span>
      </button>
    );
  };
  const desktopLinkClass = (pageName) =>
    `inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${
      isActivePage(pageName)
        ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300"
        : "text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20"
    }`;

  return (
    <>
    <nav className="sticky inset-x-0 top-0 z-[110] bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          
          {/* --- LEFT SIDE: Logo & Desktop Nav --- */}
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => handleNavClick('home')}>
              <span className="relative font-extrabold text-[clamp(1.05rem,6.2vw,1.5rem)] leading-none tracking-[-0.045em] max-[320px]:text-[0.95rem] sm:text-2xl">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">
                  EventMate
                </span>
                <span className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-indigo-400/25 blur-lg max-[320px]:-left-1.5 max-[320px]:-top-1.5 max-[320px]:h-3.5 max-[320px]:w-3.5 min-[380px]:-left-3 min-[380px]:-top-3 min-[380px]:h-6 min-[380px]:w-6" />
              </span>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
              <button
                onClick={() => handleNavClick('home')}
                className={desktopLinkClass("home")}
              >
                Home
              </button>
              <button
                onClick={() => handleNavClick('events')}
                className={desktopLinkClass("events")}
              >
                Events
              </button>
              <button
                onClick={() => handleNavClick('my-events')}
                className={desktopLinkClass("my-events")}
              >
                My Events
              </button>
              
              <button
                onClick={() => handleNavClick("contact-us")}
                className={desktopLinkClass("contact-us")}
              >
                Contact us
              </button>
            </div>
          </div>

          {/* --- RIGHT SIDE: Notifications, User --- */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center gap-4">

            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => handleNavClick("notifications")}
              className="p-1 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-indigo-300 focus:outline-none relative"
            >
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center px-1 ring-2 ring-white dark:ring-gray-900">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className={themeToggleClass}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/15"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>

          {/* --- MOBILE MENU BUTTON --- */}
          <div className="-mr-2 flex items-center gap-1.5 max-[360px]:gap-1 sm:hidden">
            <button
              type="button"
              onClick={() => handleNavClick("notifications")}
              className="relative rounded-full p-2 text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-indigo-300 focus:outline-none"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center px-1 ring-2 ring-white dark:ring-gray-900">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setIsMobileProfileOpen(false);
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white/90 p-1.5 text-slate-500 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-indigo-400/40 dark:hover:text-indigo-200 max-[320px]:p-1"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE MENU PANEL --- */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close mobile menu"
              onClick={closeMenus}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
              className="fixed inset-0 top-16 z-[105] bg-slate-950/40 backdrop-blur-[2px] sm:hidden"
            />
            <motion.div
              initial={mobileMenuPanelMotion.initial}
              animate={mobileMenuPanelMotion.animate}
              exit={mobileMenuPanelMotion.exit}
              transition={mobileMenuPanelTransition}
              className="fixed right-3 top-[4.35rem] z-[109] w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(30rem,calc(100svh-5.5rem))] overflow-y-auto overscroll-contain rounded-[30px] border border-slate-200/80 bg-white/96 shadow-[0_32px_80px_-38px_rgba(15,23,42,0.6)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/96 sm:hidden"
            >
              <div className="p-3">
                <div className="rounded-[26px] border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-white p-4 dark:border-white/10 dark:from-white/[0.08] dark:via-white/[0.04] dark:to-transparent">
                  <div className="flex items-start gap-3">
                    <AvatarWithFrame
                      src={avatarUrl}
                      alt={`${displayName} avatar`}
                      className="h-11 w-11 shrink-0"
                      coreClassName="h-full w-full border border-indigo-200 bg-white text-indigo-700 dark:border-indigo-400/40 dark:bg-slate-950/70 dark:text-indigo-200 flex items-center justify-center text-sm font-semibold"
                      fallback={<span>{avatarText || "S"}</span>}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                        Student Menu
                      </p>
                      <h2 className="mt-1 truncate text-base font-semibold text-slate-900 dark:text-white">
                        {displayName}
                      </h2>
                      <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-300">
                        {user?.email || "student@college.com"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {mobileQuickActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={action.onSelect}
                        className={mobileQuickActionClass}
                      >
                        <span className="block max-w-full truncate whitespace-nowrap">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {mobileMenuSections.map((section) => (
                    <div key={section.title} className="space-y-2.5">
                      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                        {section.title}
                      </p>
                      <div className="space-y-2">
                        {section.items.map((item) => renderMobileMenuEntry(item))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    closeMenus();
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[22px] border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/12 dark:text-red-300 dark:hover:bg-red-500/18"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
    </>
  );
};

export default Navbar;
