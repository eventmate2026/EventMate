import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  Menu, 
  X, 
  LogOut, 
  Moon,
  Sun
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

  useEffect(() => {
    let mounted = true;
    const userId = String(user?._id || user?.id || "").trim();

    const syncUnread = async () => {
      if (!getStoredToken() || !userId) {
        if (mounted) setUnreadCount(0);
        return;
      }

      try {
        const response = await api({ ...SummaryApi.get_my_notifications, cacheTTL: 20000 });
        const nextUnread = Number(response?.data?.unreadCount || 0);
        if (mounted) setUnreadCount(nextUnread);
      } catch {
        if (mounted) setUnreadCount(0);
      }
    };

    const onUnreadCount = (event) => {
      const nextUnread = Number(event?.detail ?? 0);
      setUnreadCount(Number.isFinite(nextUnread) ? Math.max(0, nextUnread) : 0);
    };

    window.addEventListener("eventmate:student-unread-count", onUnreadCount);
    syncUnread();

    let intervalId = null;
    if (userId) {
      intervalId = setInterval(syncUnread, 30000);
    }

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("eventmate:student-unread-count", onUnreadCount);
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
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsMobileProfileOpen(false);
    window.scrollTo(0, 0);
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
  const desktopLinkClass = (pageName) =>
    `inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${
      isActivePage(pageName)
        ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300"
        : "text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20"
    }`;
  const mobileLinkClass = (pageName) =>
    `mx-2 block w-[calc(100%-1rem)] rounded-xl px-4 py-3 text-left text-base font-medium transition ${
      isActivePage(pageName)
        ? "bg-purple-50 text-purple-700 dark:bg-indigo-500/10 dark:text-indigo-300"
        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-indigo-300"
    }`;

  const renderAvatar = (className, textClassName) => (
    <AvatarWithFrame
      src={avatarUrl}
      alt={`${displayName} avatar`}
      className={className}
      coreClassName="h-full w-full bg-purple-100 dark:bg-indigo-500/20 flex items-center justify-center text-purple-700 dark:text-indigo-200 font-bold"
      fallback={<span className={textClassName}>{avatarText}</span>}
    />
  );

  return (
    <>
    <nav className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-white/10 fixed inset-x-0 top-0 z-[110] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          
          {/* --- LEFT SIDE: Logo & Desktop Nav --- */}
          <div className="flex">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => handleNavClick('home')}>
              <span className="font-extrabold text-2xl tracking-tight relative">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">
                  EventMate
                </span>
                <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-indigo-400/25 blur-lg" />
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

            {/* User Profile Dropdown */}
            <div className="relative ml-3">
              <div>
                <button
                  type="button"
                  className="flex text-sm border-2 border-transparent rounded-full focus:outline-none focus:border-purple-300 transition duration-150 ease-in-out"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <span className="sr-only">Open user menu</span>
                  {renderAvatar("h-8 w-8", "text-sm")}
                  </button>
              </div>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-900 ring-1 ring-black ring-opacity-5 dark:ring-white/10 focus:outline-none z-50 animate-fade-in-down">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-white/10">
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-bold">{displayName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || 'student@college.com'}</p>
                  </div>
                  <button
                    onClick={() => {
                      onLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left block px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* --- MOBILE MENU BUTTON --- */}
          <div className="-mr-2 flex items-center gap-2 sm:hidden">
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
              type="button"
              aria-label="Toggle theme"
              onClick={() => {
                setIsMobileProfileOpen(false);
                toggleTheme();
              }}
              className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-white p-2 text-indigo-700 shadow-sm hover:text-indigo-800 hover:bg-indigo-50 dark:border-indigo-400/40 dark:bg-slate-800 dark:text-indigo-100 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={handleMobileProfileClick}
                aria-label="Open profile menu"
                aria-expanded={isMobileProfileOpen}
                aria-haspopup="menu"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {renderAvatar("h-8 w-8", "text-sm")}
              </button>
              <AnimatePresence>
                {isMobileProfileOpen && (
                  <motion.div
                    initial={mobileProfilePanelMotion.initial}
                    animate={mobileProfilePanelMotion.animate}
                    exit={mobileProfilePanelMotion.exit}
                    transition={mobileProfilePanelTransition}
                    role="menu"
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[120] w-64 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-950"
                  >
                    <div className="px-3 py-2.5 border-b border-slate-200/70 dark:border-white/10">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300 truncate">
                        {user?.email || "student@college.com"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileProfileOpen(false);
                        navigate("/profile");
                      }}
                      className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                      Your Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLogout();
                        setIsMobileProfileOpen(false);
                      }}
                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15 flex items-center gap-2"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={() => {
                setIsMobileProfileOpen(false);
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-indigo-300 hover:bg-gray-100 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE MENU PANEL --- */}
      {isMobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close mobile menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-x-0 top-16 bottom-0 z-[105] bg-slate-950/45 sm:hidden"
          />
          <div className="fixed inset-x-0 top-16 bottom-0 z-[109] overflow-y-auto border-b border-gray-200 bg-white pb-6 shadow-2xl dark:border-white/10 dark:bg-gray-950 sm:hidden">
            <div className="pt-2 pb-3 space-y-1">
            <button
              onClick={() => handleNavClick('home')}
              className={mobileLinkClass("home")}
            >
              Home
            </button>
            <button
              onClick={() => handleNavClick('events')}
              className={mobileLinkClass("events")}
            >
              Events
            </button>
            <button
              onClick={() => handleNavClick('my-events')}
              className={mobileLinkClass("my-events")}
            >
              My Events
            </button>
            
            <button
              onClick={() => handleNavClick("contact-us")}
              className={mobileLinkClass("contact-us")}
            >
              Contact us
            </button>
            </div>
          </div>
        </>
      )}
    </nav>
    <div aria-hidden="true" className="h-16 shrink-0" />
    </>
  );
};

export default Navbar;
