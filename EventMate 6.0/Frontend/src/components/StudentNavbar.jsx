import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Menu, 
  X, 
  LogOut, 
  Moon,
  Sun
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import AvatarWithFrame from './AvatarWithFrame';
import { normalizeAvatarFrame } from '../constants/profileCustomization';

const Navbar = ({ activePage, setActivePage, user, onLogout }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isStudent = user?.role === "STUDENT";
  const displayName = user?.fullName || user?.name || 'Student';
  const avatarUrl = user?.avatar || "";
  const avatarFrame = normalizeAvatarFrame(user?.profilePreferences?.avatarFrame);
  const avatarText = displayName.charAt(0).toUpperCase();
  const isDark = theme === "dark";
  const themeToggleClass =
    "p-2 rounded-full border border-indigo-200/80 bg-white/80 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 transition " +
    "dark:border-indigo-300/40 dark:bg-indigo-500/15 dark:text-indigo-100 dark:hover:bg-indigo-500/30 dark:hover:text-white";

  if (!isStudent) {
    return null;
  }

  const pageToPath = {
    home: "/student-dashboard",
    events: "/student-dashboard/events",
    "my-events": "/student-dashboard/my-events",
    "contact-us": "/student-dashboard/contact-us",
  };

  // Handle route navigation for student dashboard pages
  const handleNavClick = (pageName) => {
    if (typeof setActivePage === "function") {
      setActivePage(pageName);
    }

    navigate(pageToPath[pageName] || "/student-dashboard");
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    window.scrollTo(0, 0);
  };

  const isActivePage = (pageName) => activePage === pageName;
  const desktopLinkClass = (pageName) =>
    `inline-flex items-center px-1 pt-1 text-sm font-medium transition-all duration-200 ${
      isActivePage(pageName)
        ? "text-purple-600 dark:text-indigo-300 border-b-2 border-purple-600 dark:border-indigo-300"
        : "text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-indigo-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-white/20"
    }`;
  const mobileLinkClass = (pageName) =>
    `w-full text-left block pl-3 pr-4 py-3 border-l-4 text-base font-medium ${
      isActivePage(pageName)
        ? "bg-purple-50 dark:bg-indigo-500/10 border-purple-600 dark:border-indigo-300 text-purple-700 dark:text-indigo-300"
        : "border-transparent text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-700 dark:hover:text-indigo-300"
    }`;

  const renderAvatar = (className, textClassName) => (
    <AvatarWithFrame
      src={avatarUrl}
      alt={`${displayName} avatar`}
      frame={avatarFrame}
      className={className}
      coreClassName="h-full w-full bg-purple-100 dark:bg-indigo-500/20 flex items-center justify-center text-purple-700 dark:text-indigo-200 font-bold"
      fallback={<span className={textClassName}>{avatarText}</span>}
    />
  );

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10 sticky top-0 z-50 shadow-sm">
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

          {/* --- RIGHT SIDE: Search, Notifications, User --- */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center gap-4">
            
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
                  
                  <Link to="/profile" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">
                    Your Profile
                  </Link>
                  <Link to="/profile/customization" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">
                    Customize Avatar
                  </Link>
                  <Link to="/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5">
                    Settings
                  </Link>
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
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
        <div className="sm:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10">
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
          
          <div className="pt-4 pb-4 border-t border-gray-200">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                {renderAvatar("h-10 w-10", "text-base")}
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800 dark:text-gray-100">{displayName}</div>
                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{user?.email || 'student@college.com'}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <button
                type="button"
                onClick={toggleTheme}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-700 dark:text-indigo-100 hover:bg-indigo-50 dark:hover:bg-indigo-500/25 flex items-center gap-2"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} Toggle theme
              </button>
              <button
                onClick={() => {
                  onLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-base font-medium text-red-600 hover:bg-red-50 hover:text-red-800 flex items-center gap-2"
              >
                <LogOut size={18} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
