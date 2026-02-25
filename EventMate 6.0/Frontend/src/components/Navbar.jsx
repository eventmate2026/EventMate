import React, { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  Bell, 
  Menu, 
  X, 
  LogOut, 
  ChevronDown,
  Moon,
  Sun
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from '../context/ThemeContext';
import AvatarWithFrame from './AvatarWithFrame';
import { normalizeAvatarFrame } from '../constants/profileCustomization';

const Navbar = ({ activePage, setActivePage, user, onLogout, variant = "auto" }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAdminUsersMenuOpen, setIsAdminUsersMenuOpen] = useState(false);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const adminUsersMenuCloseTimeoutRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // useLocation helps us highlight the active link based on the URL
  const location = useLocation();
  const isPublic = variant === "public";
  const isAuthenticated = !isPublic && Boolean(user?.role);
  const isAdmin = isAuthenticated && user?.role === "MAIN_ADMIN";
  const isOrganizer = isAuthenticated && user?.role === "ORGANIZER";
  const isCoordinator = isAuthenticated && user?.role === "STUDENT_COORDINATOR";
  const isStudent = isAuthenticated && user?.role === "STUDENT";
  const isPrivileged = isAdmin || isOrganizer;
  const displayName = user?.fullName || user?.name || 'User';
  const avatarUrl = user?.avatar || "";
  const avatarFrame = normalizeAvatarFrame(user?.profilePreferences?.avatarFrame);
  const avatarInitials = (displayName || "US")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();
  const themeToggleClass =
    "p-2 rounded-full border border-indigo-200/80 bg-white/80 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 transition " +
    "dark:border-indigo-300/40 dark:bg-indigo-500/15 dark:text-indigo-100 dark:hover:bg-indigo-500/30 dark:hover:text-white";

  const roleHomePath = {
    MAIN_ADMIN: "/admin-dashboard",
    ORGANIZER: "/organizer-dashboard",
    STUDENT_COORDINATOR: "/coordinator-dashboard",
    STUDENT: "/student-dashboard",
  };

  const roleProfilePath = {
    MAIN_ADMIN: "/profile",
    ORGANIZER: "/organizer-dashboard/profile",
    STUDENT_COORDINATOR: "/coordinator-dashboard/profile",
    STUDENT: "/profile",
  };
  const roleCustomizationPath = {
    MAIN_ADMIN: "/profile/customization",
    ORGANIZER: "/profile/customization",
    STUDENT_COORDINATOR: "/profile/customization",
    STUDENT: "/profile/customization",
  };
  const currentProfilePath = roleProfilePath[user?.role] || "/profile";
  const currentCustomizationPath = roleCustomizationPath[user?.role] || "/profile/customization";

  const studentRouteMap = {
    home: "/student-dashboard",
    events: "/student-dashboard/events",
    "my-events": "/student-dashboard/my-events",
    "contact-us": "/student-dashboard/contact-us",
  };

  useEffect(() => {
    return () => {
      if (adminUsersMenuCloseTimeoutRef.current) {
        clearTimeout(adminUsersMenuCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAdminUnreadCount(0);
      return undefined;
    }

    setAdminUnreadCount(0);

    const handleUnreadEvent = (event) => {
      const nextCount = Number(event?.detail);
      if (!Number.isNaN(nextCount)) {
        setAdminUnreadCount(nextCount);
      }
    };
    window.addEventListener("eventmate:admin-unread-count", handleUnreadEvent);

    return () => {
      window.removeEventListener("eventmate:admin-unread-count", handleUnreadEvent);
    };
  }, [isAdmin, location.pathname]);

  const openAdminUsersMenu = () => {
    if (adminUsersMenuCloseTimeoutRef.current) {
      clearTimeout(adminUsersMenuCloseTimeoutRef.current);
      adminUsersMenuCloseTimeoutRef.current = null;
    }
    setIsAdminUsersMenuOpen(true);
  };

  const closeAdminUsersMenu = () => {
    if (adminUsersMenuCloseTimeoutRef.current) {
      clearTimeout(adminUsersMenuCloseTimeoutRef.current);
    }
    adminUsersMenuCloseTimeoutRef.current = setTimeout(() => {
      setIsAdminUsersMenuOpen(false);
      adminUsersMenuCloseTimeoutRef.current = null;
    }, 220);
  };

  const closeAdminUsersMenuImmediately = () => {
    if (adminUsersMenuCloseTimeoutRef.current) {
      clearTimeout(adminUsersMenuCloseTimeoutRef.current);
      adminUsersMenuCloseTimeoutRef.current = null;
    }
    setIsAdminUsersMenuOpen(false);
  };

  const handleNavClick = (pageName) => {
    if (typeof setActivePage === "function") {
      setActivePage(pageName);
    }

    if (isPublic && pageName === "home") {
      navigate("/");
    } else if (isStudent && studentRouteMap[pageName]) {
      navigate(studentRouteMap[pageName]);
    } else if (isAuthenticated && pageName === "home") {
      navigate(roleHomePath[user?.role] || "/");
    }

    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    closeAdminUsersMenuImmediately();
    window.scrollTo(0, 0);
  };

  // Helper to check active state
  const isActive = (pageName) => {
    if (isStudent) {
      const targetPath = studentRouteMap[pageName];
      if (!targetPath) {
        return "text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20";
      }
      const isCurrent =
        pageName === "home"
          ? location.pathname === "/student-dashboard" || location.pathname === "/student-dashboard/"
          : location.pathname.startsWith(targetPath);

      return isCurrent
        ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300"
        : "text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20";
    }

    if (pageName === 'my-events') {
      return location.pathname === '/my-events'
        ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300"
        : "text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20";
    }
    // For internal dashboard views (Home/Events), use the prop state
    return activePage === pageName 
      ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300" 
      : "text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20";
  };

  const navClass = isPublic
    ? "relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10 sticky top-0 z-50"
    : isPrivileged
      ? "relative bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10 sticky top-0 z-50"
    : "relative bg-white/85 dark:bg-gray-900/80 backdrop-blur-xl border-b border-white/60 dark:border-white/10 sticky top-0 z-50 shadow-[0_12px_30px_-20px_rgba(79,70,229,0.6)]";
  const isAdminUsersRoute =
    location.pathname.startsWith("/admin-dashboard/user-management") ||
    location.pathname.startsWith("/admin-dashboard/organizer-management") ||
    location.pathname.startsWith("/admin-dashboard/coordinator-management");
  const isAdminNotificationsRoute = location.pathname.startsWith("/admin-dashboard/notifications");
  const chromeMotion = prefersReducedMotion
    ? {
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
      }
    : {
        initial: { opacity: 0, y: -12 },
        animate: { opacity: 1, y: 0 },
      };
  const chromeTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.35, ease: [0.22, 1, 0.36, 1] };

  return (
    <motion.nav
      key={location.pathname}
      initial={chromeMotion.initial}
      animate={chromeMotion.animate}
      transition={chromeTransition}
      className={navClass}
    >
      {!isPublic && !isPrivileged && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent pointer-events-none" />
          <div className="absolute -top-24 right-10 w-40 h-40 bg-indigo-400/15 blur-3xl rounded-full pointer-events-none" />
        </>
      )}
      {isAdmin && (
        <>
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 opacity-80 animate-admin-line pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent pointer-events-none" />
          <div className="absolute -top-24 left-1/3 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl animate-admin-glow pointer-events-none" />
          <div className="absolute -top-28 right-24 h-48 w-48 rounded-full bg-purple-400/15 blur-3xl animate-admin-glow-delay pointer-events-none" />
        </>
      )}
      {isOrganizer && (
        <>
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 opacity-70 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent pointer-events-none" />
        </>
      )}
      {isPublic && !isPrivileged && (
        <>
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 opacity-80 animate-nav-beam" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
        </>
      )}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-[72px]">
          
          {/* LEFT SIDE: Logo & Desktop Nav */}
          <div className="flex items-center gap-4">
            {/* Logo - Links to Home */}
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => handleNavClick('home')}>
              <span className="font-extrabold text-2xl tracking-tight relative">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-nav-gradient">
                  EventMate
                </span>
                <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-indigo-400/25 blur-lg animate-logo-glow" />
              </span>
            </div>

            {/* Desktop Navigation Links */}
            {!isPublic && !isPrivileged && (
              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                <button
                  onClick={() => handleNavClick('home')}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${isActive('home')}`}
                >
                  Home
                </button>
                {isCoordinator && (
                  <>
                    <Link
                      to="/coordinator-dashboard/contact-admin"
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${
                        location.pathname.startsWith("/coordinator-dashboard/contact-admin")
                          ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300"
                          : "text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20"
                      }`}
                    >
                      Contact Admin
                    </Link>
                    <Link
                      to="/coordinator-dashboard/profile"
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${
                        location.pathname.startsWith("/coordinator-dashboard/profile")
                          ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300"
                          : "text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20"
                      }`}
                    >
                      Profile
                    </Link>
                    <Link
                      to="/coordinator-dashboard/registrations"
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${
                        location.pathname.startsWith("/coordinator-dashboard/registrations")
                          ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300"
                          : "text-gray-600 hover:text-purple-600 dark:text-gray-300 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20"
                      }`}
                    >
                      Registrations
                    </Link>
                  </>
                )}
                {isStudent && (
                  <>
                    <button
                      onClick={() => handleNavClick('events')}
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${isActive('events')}`}
                    >
                      Events
                    </button>
                    <Link
                      to="/student-dashboard/my-events"
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${isActive('my-events')}`}
                    >
                      My Events
                    </Link>
                    <Link
                      to="/student-dashboard/contact-us"
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${isActive('contact-us')}`}
                    >
                      Contact us
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {isPublic && !isPrivileged && (
            <div className="hidden md:flex flex-1 items-center justify-center gap-8">
              {[
                { label: "Home", to: "/" , key: "home" },
                { label: "Events", to: "/#events", key: "events" },
                { label: "Contact us", to: "/#contact", key: "contact" },
              ].map((item) => {
                const isCurrent =
                  (item.key === "home" && location.pathname === "/" && !location.hash) ||
                  (item.key === "events" && location.hash === "#events") ||
                  (item.key === "contact" && location.hash === "#contact");

                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`relative text-sm font-medium transition-all duration-300 ${
                      isCurrent ? "text-indigo-600 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300"
                    }`}
                  >
                    <span className="relative z-10">{item.label}</span>
                    <span
                      className={`absolute -bottom-2 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-300 ${
                        isCurrent ? "opacity-100 scale-100" : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          )}

          {isAdmin && (
            <div className="hidden md:flex flex-1 items-center justify-center gap-6">
              <Link
                to="/admin-dashboard"
                className={`group relative text-sm font-medium transition-all duration-300 ${
                  location.pathname === "/admin-dashboard" && !location.hash
                    ? "text-indigo-600 dark:text-indigo-300"
                    : "text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300"
                }`}
              >
                <span className="relative z-10">Home</span>
                <span
                  className={`absolute -bottom-2 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 transition-all duration-300 ${
                    location.pathname === "/admin-dashboard" && !location.hash
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100"
                  }`}
                />
              </Link>

              <Link
                to="/admin-dashboard#system"
                className={`group relative text-sm font-medium transition-all duration-300 ${
                  location.hash === "#system"
                    ? "text-indigo-600 dark:text-indigo-300"
                    : "text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300"
                }`}
              >
                <span className="relative z-10">System Oversight</span>
                <span
                  className={`absolute -bottom-2 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 transition-all duration-300 ${
                    location.hash === "#system"
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100"
                  }`}
                />
              </Link>

              <div
                className="group relative"
                onMouseEnter={openAdminUsersMenu}
                onMouseLeave={closeAdminUsersMenu}
              >
                <button
                  type="button"
                  onClick={() => (isAdminUsersMenuOpen ? closeAdminUsersMenuImmediately() : openAdminUsersMenu())}
                  className={`inline-flex items-center gap-1 relative text-sm font-medium transition-all duration-300 ${
                    isAdminUsersRoute
                      ? "text-indigo-600 dark:text-indigo-300"
                      : "text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300"
                  }`}
                >
                  <span className="relative z-10">User Management</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isAdminUsersMenuOpen ? "rotate-180" : ""}`} />
                  <span
                    className={`absolute -bottom-2 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 transition-all duration-300 ${
                      isAdminUsersRoute
                        ? "opacity-100 scale-100"
                        : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100"
                    }`}
                  />
                </button>

                {isAdminUsersMenuOpen && (
                  <div className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl dark:border-white/10 dark:bg-gray-900/95">
                    <Link
                      to="/admin-dashboard/user-management"
                      onClick={closeAdminUsersMenuImmediately}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        location.pathname.startsWith("/admin-dashboard/user-management")
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      All Users
                    </Link>
                    <Link
                      to="/admin-dashboard/organizer-management"
                      onClick={closeAdminUsersMenuImmediately}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        location.pathname.startsWith("/admin-dashboard/organizer-management")
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      Organizer Management
                    </Link>
                    <Link
                      to="/admin-dashboard/coordinator-management"
                      onClick={closeAdminUsersMenuImmediately}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        location.pathname.startsWith("/admin-dashboard/coordinator-management")
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                      }`}
                    >
                      Coordinator Management
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/admin-dashboard#certificates"
                className={`group relative text-sm font-medium transition-all duration-300 ${
                  location.hash === "#certificates"
                    ? "text-indigo-600 dark:text-indigo-300"
                    : "text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300"
                }`}
              >
                <span className="relative z-10">Certificates & Audit Logs</span>
                <span
                  className={`absolute -bottom-2 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 transition-all duration-300 ${
                    location.hash === "#certificates"
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100"
                  }`}
                />
              </Link>

              <Link
                to="/admin-dashboard#security"
                className={`group relative text-sm font-medium transition-all duration-300 ${
                  location.hash === "#security"
                    ? "text-indigo-600 dark:text-indigo-300"
                    : "text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300"
                }`}
              >
                <span className="relative z-10">Security & Reports</span>
                <span
                  className={`absolute -bottom-2 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 transition-all duration-300 ${
                    location.hash === "#security"
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100"
                  }`}
                />
              </Link>

              <Link
                to="/admin-dashboard/notifications"
                className={`group relative text-sm font-medium transition-all duration-300 ${
                  isAdminNotificationsRoute
                    ? "text-indigo-600 dark:text-indigo-300"
                    : "text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300"
                }`}
              >
                <span className="relative z-10">Notifications</span>
                <span
                  className={`absolute -bottom-2 left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-purple-500 transition-all duration-300 ${
                    isAdminNotificationsRoute
                      ? "opacity-100 scale-100"
                      : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100"
                  }`}
                />
              </Link>
            </div>
          )}
          {isOrganizer && (
            <div className="hidden md:flex flex-1 items-center justify-center gap-8">
              {[
                { label: "Home", to: "/organizer-dashboard", key: "home" },
                { label: "My Events", to: "/organizer-dashboard#my-events", key: "my-events" },
                { label: "Coordinators", to: "/organizer-dashboard/coordinator-management", key: "coordinator-management" },
                { label: "Contact Admin", to: "/organizer-dashboard/contact-admin", key: "contact-admin" },
                { label: "Profile", to: "/organizer-dashboard/profile", key: "profile" },
              ].map((item) => {
                const isCurrent =
                  (item.key === "home" && location.pathname === "/organizer-dashboard" && !location.hash) ||
                  (item.key === "my-events" && location.hash === "#my-events") ||
                  (item.key === "coordinator-management" && location.pathname.startsWith("/organizer-dashboard/coordinator-management")) ||
                  (item.key === "contact-admin" && location.pathname.startsWith("/organizer-dashboard/contact-admin")) ||
                  (item.key === "profile" && location.pathname.startsWith("/organizer-dashboard/profile"));

                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={`text-sm font-medium transition-colors ${
                      isCurrent ? "text-indigo-600 dark:text-indigo-300" : "text-gray-600 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* RIGHT SIDE: Search, Notifications, User */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center gap-4">
            {isAdmin ? (
              <>
                <Link
                  to="/admin-dashboard/notifications"
                  className="relative p-2 rounded-full text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300 transition"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {adminUnreadCount > 0 && (
                    <>
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-indigo-500 animate-admin-ping" />
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white text-center">
                        {adminUnreadCount > 99 ? "99+" : adminUnreadCount}
                      </span>
                    </>
                  )}
                </Link>
                <button
                  type="button"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                  className={themeToggleClass}
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <div className="relative h-9 w-9">
                  <span className="absolute inset-0 rounded-full bg-indigo-400/20 blur-md animate-admin-avatar" />
                  <AvatarWithFrame
                    src={avatarUrl}
                    alt="Profile"
                    frame={avatarFrame}
                    className="relative h-9 w-9"
                    coreClassName="h-full w-full border border-indigo-300 text-indigo-700 bg-indigo-50 dark:border-indigo-400/60 dark:bg-indigo-500/20 dark:text-indigo-200 flex items-center justify-center text-xs font-semibold"
                    fallback={<span>{avatarInitials || "AD"}</span>}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onLogout?.()}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/15"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </>
            ) : isOrganizer ? (
              <>
                <button className="p-2 rounded-full text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-300 transition" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                  className={themeToggleClass}
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
                <AvatarWithFrame
                  src={avatarUrl}
                  alt="Profile"
                  frame={avatarFrame}
                  className="h-9 w-9"
                  coreClassName="h-full w-full border border-indigo-300 text-indigo-700 bg-indigo-50 dark:border-indigo-400/60 dark:bg-indigo-500/20 dark:text-indigo-200 flex items-center justify-center text-xs font-semibold"
                  fallback={<span>{avatarInitials || "OR"}</span>}
                />
                <button
                  type="button"
                  onClick={() => onLogout?.()}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-500/15"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </>
            ) : isAuthenticated ? (
              <>
                {/* Search Bar */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400 group-focus-within:text-purple-600 dark:text-gray-500 dark:group-focus-within:text-indigo-300 transition-colors" />
                  </div>
                  <input 
                    type="text" 
                    className="block w-48 lg:w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-full leading-5 bg-gray-50 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-purple-500 dark:focus:ring-indigo-400 focus:border-purple-500 dark:focus:border-indigo-400 sm:text-sm transition-all duration-200" 
                    placeholder="Search events..."
                  />
                </div>

                {/* Notifications Bell */}
                <button className="p-1 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-indigo-300 focus:outline-none relative">
                  <Bell className="h-6 w-6" />
                  <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900"></span>
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
                      className="flex text-sm border-2 border-transparent rounded-full focus:outline-none focus:border-purple-300 dark:focus:border-indigo-300 transition duration-150 ease-in-out"
                      onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    >
                      <span className="sr-only">Open user menu</span>
                      <AvatarWithFrame
                        src={avatarUrl}
                        alt="Profile"
                        frame={avatarFrame}
                        className="h-8 w-8"
                        coreClassName="h-full w-full bg-purple-100 dark:bg-indigo-500/20 flex items-center justify-center text-purple-700 dark:text-indigo-200 font-bold text-sm"
                        fallback={<span>{avatarInitials.charAt(0) || "U"}</span>}
                      />
                </button>
              </div>

              {/* Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-900 ring-1 ring-black ring-opacity-5 dark:ring-white/10 focus:outline-none z-50">
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-white/10">
                        <p className="text-sm text-gray-900 dark:text-gray-100 font-bold">{displayName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || 'student@college.com'}</p>
                      </div>
                      
                      <Link to={currentProfilePath} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">Your Profile</Link>
                      <Link to={currentCustomizationPath} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">Customize Avatar</Link>
                      <Link to="/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">Settings</Link>
                      <button
                        onClick={() => { onLogout?.(); setIsUserMenuOpen(false); }}
                        className="w-full text-left block px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <LogOut size={16} /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-indigo-300 transition"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="relative px-5 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition"
                >
                  <span className="relative z-10">Sign Up</span>
                  <span className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition login-cta-sheen" />
                </Link>
                <button
                  type="button"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                  className={themeToggleClass}
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
              </>
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-indigo-300 hover:bg-gray-100 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500"
            >
              {isMobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE MENU PANEL --- */}
      {isMobileMenuOpen && (
        <div className="sm:hidden bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-white/10 backdrop-blur">
          <div className="pt-2 pb-3 space-y-1">
            {isAdmin ? (
              <>
                <Link to="/admin-dashboard" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Home
                </Link>
                <Link to="/admin-dashboard#system" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  System Oversight
                </Link>
                <Link to="/admin-dashboard/user-management" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  User Management
                </Link>
                <Link to="/admin-dashboard/organizer-management" className="w-full block pl-7 pr-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-300 hover:bg-gray-50 dark:hover:bg-white/5">
                  Organizer Management
                </Link>
                <Link to="/admin-dashboard/coordinator-management" className="w-full block pl-7 pr-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-300 hover:bg-gray-50 dark:hover:bg-white/5">
                  Coordinator Management
                </Link>
                <Link to="/admin-dashboard/notifications" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Notifications
                </Link>
                <Link to="/admin-dashboard#certificates" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Certificates & Audit Logs
                </Link>
                <Link to="/admin-dashboard#security" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Security & Reports
                </Link>
              </>
            ) : isOrganizer ? (
              <>
                <Link to="/organizer-dashboard" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Home
                </Link>
                <Link to="/organizer-dashboard#my-events" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  My Events
                </Link>
                <Link to="/organizer-dashboard/coordinator-management" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Coordinators
                </Link>
                <Link to="/organizer-dashboard/contact-admin" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Contact Admin
                </Link>
                <Link to="/organizer-dashboard/profile" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Profile
                </Link>
              </>
            ) : (
              <>
                <button onClick={() => handleNavClick('home')} className="w-full text-left block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">Home</button>
                {isCoordinator && (
                  <>
                    <Link to="/coordinator-dashboard/contact-admin" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                      Contact Admin
                    </Link>
                    <Link to="/coordinator-dashboard/profile" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                      Profile
                    </Link>
                    <Link to="/coordinator-dashboard/registrations" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                      Registrations
                    </Link>
                  </>
                )}
                {isStudent && (
                  <>
                    <button onClick={() => handleNavClick('events')} className="w-full text-left block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                      Events
                    </button>
                    <Link to="/student-dashboard/my-events" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                      My Events
                    </Link>
                    <Link to="/student-dashboard/contact-us" className="w-full block pl-3 pr-4 py-3 border-l-4 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                      Contact us
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
          <div className="pt-4 pb-4 border-t border-gray-200 dark:border-white/10">
            {isAuthenticated ? (
              <>
                <div className="flex items-center px-4">
                  <AvatarWithFrame
                    src={avatarUrl}
                    alt="Profile"
                    frame={avatarFrame}
                    className="h-10 w-10"
                    coreClassName="h-full w-full bg-purple-100 dark:bg-indigo-500/20 flex items-center justify-center text-purple-700 dark:text-indigo-200 font-bold"
                    fallback={<span>{avatarInitials.charAt(0) || "U"}</span>}
                  />
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800 dark:text-gray-100">{displayName}</div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{user?.email || 'student@college.com'}</div>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-2 px-4 py-2 text-base font-medium text-gray-700 dark:text-indigo-100 hover:bg-indigo-50 dark:hover:bg-indigo-500/25"
                  >
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    Toggle theme
                  </button>
                  <button onClick={() => { onLogout?.(); setIsMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-base font-medium text-red-600 hover:bg-red-50 hover:text-red-800 flex items-center gap-2">
                    <LogOut size={18} /> Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="px-4 space-y-2">
                <Link to="/login" className="block w-full text-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5">
                  Login
                </Link>
                <Link to="/signup" className="block w-full text-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
                  Sign Up
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-indigo-100 hover:bg-indigo-50 dark:hover:bg-indigo-500/25"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  Toggle theme
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!isPublic && (
        <style jsx>{`
        .animate-nav-gradient {
          background-size: 200% 200%;
          animation: navGradient 6s ease infinite;
        }
        .animate-button-sheen {
          background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.7), transparent);
          background-size: 200% 100%;
          animation: buttonSheen 2.6s ease infinite;
        }
        @keyframes navGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes buttonSheen {
          0% { background-position: 0% 0%; opacity: 0.2; }
          50% { background-position: 100% 0%; opacity: 0.6; }
          100% { background-position: 0% 0%; opacity: 0.2; }
        }
      `}</style>
      )}
      {isPublic && (
        <style jsx>{`
        .animate-nav-gradient {
          background-size: 200% 200%;
          animation: navGradient 6s ease infinite;
        }
        .login-cta-sheen {
          background: linear-gradient(120deg, transparent, rgba(255,255,255,0.7), transparent);
          background-size: 200% 100%;
          animation: ctaSheen 3.2s ease infinite;
        }
        .animate-nav-beam {
          animation: navBeam 6s ease-in-out infinite;
          background-size: 200% 100%;
        }
        .animate-logo-glow {
          animation: logoGlow 4s ease-in-out infinite;
        }
        @keyframes navGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ctaSheen {
          0% { background-position: 0% 0%; opacity: 0.2; }
          50% { background-position: 100% 0%; opacity: 0.7; }
          100% { background-position: 0% 0%; opacity: 0.2; }
        }
        @keyframes navBeam {
          0% { filter: hue-rotate(0deg); opacity: 0.7; }
          50% { filter: hue-rotate(20deg); opacity: 1; }
          100% { filter: hue-rotate(0deg); opacity: 0.7; }
        }
        @keyframes logoGlow {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
      `}</style>
      )}
      {isAdmin && (
        <style jsx>{`
        .animate-admin-line {
          background-size: 200% 100%;
          animation: adminLine 6s ease-in-out infinite;
        }
        .animate-admin-glow {
          animation: adminGlow 10s ease-in-out infinite;
        }
        .animate-admin-glow-delay {
          animation: adminGlow 12s ease-in-out infinite 2s;
        }
        .animate-admin-ping {
          animation: adminPing 1.8s ease-out infinite;
        }
        .animate-admin-avatar {
          animation: adminAvatar 3s ease-in-out infinite;
        }
        @keyframes adminLine {
          0% { filter: hue-rotate(0deg); opacity: 0.7; }
          50% { filter: hue-rotate(20deg); opacity: 1; }
          100% { filter: hue-rotate(0deg); opacity: 0.7; }
        }
        @keyframes adminGlow {
          0%, 100% { transform: translateY(0px); opacity: 0.6; }
          50% { transform: translateY(10px); opacity: 1; }
        }
        @keyframes adminPing {
          0% { transform: scale(1); opacity: 0.8; }
          70% { transform: scale(2); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes adminAvatar {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
      `}</style>
      )}
    </motion.nav>
  );
};

export default Navbar;
