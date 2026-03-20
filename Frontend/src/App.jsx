import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "framer-motion";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import api from "./lib/api";
import SummaryApi from "./api/SummaryApi";
import {
  clearAuth,
  getStoredRefreshToken,
  getStoredToken,
  getStoredUser,
  storeAuth,
  subscribeAuthUpdates,
} from "./lib/auth";
import { logoutUser } from "./lib/logout";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyRegistration from "./pages/VerifyRegistration";
import TeamInvite from "./pages/TeamInvite";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import ProfileCustomization from "./pages/ProfileCustomization";
import NotFound from "./pages/NotFound";
import DeveloperTeam from "./pages/DeveloperTeam";

const AdminDashboard = lazy(() =>
  import("./pages/AdminDashboard").catch(() => ({
    default: () => <div>Dashboard loading...</div>,
  }))
);

const AdminUserManagement = lazy(() =>
  import("./pages/AdminUserManagement").catch(() => ({
    default: () => <div>User management loading...</div>,
  }))
);

const AdminOrganizerManagement = lazy(() =>
  import("./pages/AdminOrganizerManagement").catch(() => ({
    default: () => <div>Organizer management loading...</div>,
  }))
);

const AdminCoordinatorManagement = lazy(() =>
  import("./pages/AdminCoordinatorManagement").catch(() => ({
    default: () => <div>Coordinator management loading...</div>,
  }))
);

const AdminNotifications = lazy(() =>
  import("./pages/AdminNotifications").catch(() => ({
    default: () => <div>Notifications loading...</div>,
  }))
);

const AdminContactCenter = lazy(() =>
  import("./pages/AdminContactCenter").catch(() => ({
    default: () => <div>Contact center loading...</div>,
  }))
);

const AdminSystemOversight = lazy(() =>
  import("./pages/AdminSystemOversight").catch(() => ({
    default: () => <div>System oversight loading...</div>,
  }))
);

const AdminCertificatesAuditLogs = lazy(() =>
  import("./pages/AdminCertificatesAuditLogs").catch(() => ({
    default: () => <div>Certificates and audit logs loading...</div>,
  }))
);

const AdminSecurityReports = lazy(() =>
  import("./pages/AdminSecurityReports").catch(() => ({
    default: () => <div>Security and reports loading...</div>,
  }))
);

const AdminProfile = lazy(() =>
  import("./pages/AdminProfile").catch(() => ({
    default: () => <div>Admin profile loading...</div>,
  }))
);

const OrganizerDashboard = lazy(() =>
  import("./pages/OrganizerDashboard").catch(() => ({
    default: () => <div>Dashboard loading...</div>,
  }))
);

const OrganizerCreateEvent = lazy(() =>
  import("./pages/OrganizerCreateEvent").catch(() => ({
    default: () => <div>Create event loading...</div>,
  }))
);

const OrganizerEditEvent = lazy(() =>
  import("./pages/OrganizerEditEvent").catch(() => ({
    default: () => <div>Edit event loading...</div>,
  }))
);

const OrganizerEventDetails = lazy(() =>
  import("./pages/OrganizerEventDetails").catch(() => ({
    default: () => <div>Event details loading...</div>,
  }))
);

const OrganizerEventContactCenter = lazy(() =>
  import("./pages/OrganizerEventContactCenter").catch(() => ({
    default: () => <div>Contact center loading...</div>,
  }))
);

const OrganizerEventScanQR = lazy(() =>
  import("./pages/OrganizerEventScanQR").catch(() => ({
    default: () => <div>Scan QR loading...</div>,
  }))
);

const OrganizerEventViewList = lazy(() =>
  import("./pages/OrganizerEventViewList").catch(() => ({
    default: () => <div>View list loading...</div>,
  }))
);

const OrganizerEventFeedback = lazy(() =>
  import("./pages/OrganizerEventFeedback").catch(() => ({
    default: () => <div>Feedback loading...</div>,
  }))
);

const OrganizerCertificateManagement = lazy(() =>
  import("./pages/OrganizerCertificateManagement").catch(() => ({
    default: () => <div>Certificate management loading...</div>,
  }))
);

const OrganizerCoordinatorManagement = lazy(() =>
  import("./pages/OrganizerCoordinatorManagement").catch(() => ({
    default: () => <div>Coordinator management loading...</div>,
  }))
);

const OrganizerContactAdmin = lazy(() =>
  import("./pages/OrganizerContactAdmin").catch(() => ({
    default: () => <div>Contact admin loading...</div>,
  }))
);

const OrganizerNotifications = lazy(() =>
  import("./pages/OrganizerNotifications").catch(() => ({
    default: () => <div>Notifications loading...</div>,
  }))
);

const CoordinatorDashboard = lazy(() =>
  import("./pages/CoordinatorDashboard").catch(() => ({
    default: () => <div>Dashboard loading...</div>,
  }))
);

const CoordinatorEventDetails = lazy(() =>
  import("./pages/CoordinatorEventDetails").catch(() => ({
    default: () => <div>Event details loading...</div>,
  }))
);

const CoordinatorContactAdmin = lazy(() =>
  import("./pages/CoordinatorContactAdmin").catch(() => ({
    default: () => <div>Contact admin loading...</div>,
  }))
);

const CoordinatorRegistrations = lazy(() =>
  import("./pages/CoordinatorRegistrations").catch(() => ({
    default: () => <div>Registrations loading...</div>,
  }))
);

const CoordinatorAttendanceScanner = lazy(() =>
  import("./pages/CoordinatorAttendanceScanner").catch(() => ({
    default: () => <div>Attendance scanner loading...</div>,
  }))
);

const CoordinatorEventFeedback = lazy(() =>
  import("./pages/CoordinatorEventFeedback").catch(() => ({
    default: () => <div>Feedback loading...</div>,
  }))
);

const CoordinatorNotifications = lazy(() =>
  import("./pages/CoordinatorNotifications").catch(() => ({
    default: () => <div>Notifications loading...</div>,
  }))
);

const StudentDashboard = lazy(() =>
  import("./pages/StudentDashboard").catch(() => ({
    default: () => <div>Dashboard loading...</div>,
  }))
);

const StudentLayout = lazy(() =>
  import("./pages/StudentLayout").catch(() => ({
    default: () => <div>Dashboard loading...</div>,
  }))
);

const StudentEvents = lazy(() =>
  import("./pages/StudentEvents").catch(() => ({
    default: () => <div>Events loading...</div>,
  }))
);

const StudentEventDetails = lazy(() =>
  import("./pages/StudentEventDetails").catch(() => ({
    default: () => <div>Event details loading...</div>,
  }))
);

const StudentMyEvents = lazy(() =>
  import("./pages/StudentMyEvents").catch(() => ({
    default: () => <div>My events loading...</div>,
  }))
);

const StudentEventQRCode = lazy(() =>
  import("./pages/StudentEventQRCode").catch(() => ({
    default: () => <div>QR pass loading...</div>,
  }))
);

const StudentTeamRegistration = lazy(() =>
  import("./pages/StudentTeamRegistration").catch(() => ({
    default: () => <div>Team registration loading...</div>,
  }))
);

const StudentRegistrationPayment = lazy(() =>
  import("./pages/StudentRegistrationPayment").catch(() => ({
    default: () => <div>Payment loading...</div>,
  }))
);

const StudentContactUs = lazy(() =>
  import("./pages/StudentContactUs").catch(() => ({
    default: () => <div>Contact loading...</div>,
  }))
);

const StudentFeedbackPending = lazy(() =>
  import("./pages/StudentFeedbackPending").catch(() => ({
    default: () => <div>Feedback loading...</div>,
  }))
);

const StudentNotifications = lazy(() =>
  import("./pages/StudentNotifications").catch(() => ({
    default: () => <div>Notifications loading...</div>,
  }))
);

const MyCertificates = lazy(() =>
  import("./pages/MyCertificates").catch(() => ({
    default: () => <div>Loading certificates...</div>,
  }))
);

const AttendanceVerify = lazy(() =>
  import("./pages/AttendanceVerify").catch(() => ({
    default: () => <div>Attendance verification loading...</div>,
  }))
);

const PublicEventDetails = lazy(() =>
  import("./pages/PublicEventDetails").catch(() => ({
    default: () => <div>Event details loading...</div>,
  }))
);

const routeMotionVariants = {
  initial: { opacity: 0, y: 18, scale: 0.996, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -10, scale: 0.998, filter: "blur(4px)" },
};

const routeMotionTransition = {
  duration: 0.32,
  ease: [0.22, 1, 0.36, 1],
};

const clampPercentage = (value) => Math.max(0, Math.min(100, value));

function ProtectedRoute({ children, requiredRole }) {
  const readAuthSnapshot = () => ({
    user: getStoredUser(),
    token: getStoredToken(),
    refreshToken: getStoredRefreshToken(),
  });

  const [{ ready, user, token }, setAuthState] = useState(() => {
    const snapshot = readAuthSnapshot();
    return {
      ready: Boolean(snapshot.user && snapshot.token),
      user: snapshot.user,
      token: snapshot.token,
    };
  });

  useEffect(() => {
    let cancelled = false;

    const syncAuthState = (nextReady = true) => {
      if (cancelled) return;
      const snapshot = readAuthSnapshot();
      setAuthState({
        ready: nextReady,
        user: snapshot.user,
        token: snapshot.token,
      });
    };

    const bootstrapAuth = async () => {
      let snapshot = readAuthSnapshot();
      let shouldClearAuth = false;

      try {
        if (!snapshot.token && snapshot.refreshToken) {
          const response = await api({
            ...SummaryApi.refresh_token,
            data: { refreshToken: snapshot.refreshToken },
            skipAuth: true,
          });

          const nextAccessToken = response.data?.accessToken;
          const nextRefreshToken = response.data?.refreshToken;
          if (!nextAccessToken) {
            throw new Error("Missing access token.");
          }

          storeAuth({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
          snapshot = readAuthSnapshot();
        }

        if (snapshot.token && !snapshot.user) {
          try {
            const profileResponse = await api({
              ...SummaryApi.get_profile,
              cacheTTL: 0,
              skipCache: true,
              skipDedupe: true,
            });
            const profileUser = profileResponse.data?.user || null;
            if (profileUser) {
              storeAuth({ user: profileUser });
            }
          } catch {
            // Keep any existing stored session instead of forcing logout on a transient reload failure.
          }
        }
      } catch (error) {
        const status = Number(error?.response?.status || 0);
        shouldClearAuth = status === 401 || status === 403;
      } finally {
        if (shouldClearAuth) {
          clearAuth();
        }
        syncAuthState(true);
      }
    };

    const unsubscribe = subscribeAuthUpdates(() => syncAuthState(true));
    const snapshot = readAuthSnapshot();

    if (snapshot.user && snapshot.token) {
      syncAuthState(true);
    } else {
      void bootstrapAuth();
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (!ready) {
    return <div className="p-8 text-center">Checking session...</div>;
  }

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  const toRoleKey = (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : String(value || "").toUpperCase();

  const allowedRoles = Array.isArray(requiredRole)
    ? requiredRole.map(toRoleKey)
    : requiredRole
      ? [toRoleKey(requiredRole)]
      : null;

  const currentRole = toRoleKey(user?.role);

  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AmbientBackdrop({ variant = "dashboard" }) {
  return (
    <div className={`eventmate-ambient eventmate-ambient-${variant}`} aria-hidden="true">
      <span className="eventmate-orb eventmate-orb-one" />
      <span className="eventmate-orb eventmate-orb-two" />
      <span className="eventmate-orb eventmate-orb-three" />
      <span className="eventmate-scanline" />
    </div>
  );
}

function ScrollProgressBeam() {
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 170,
    damping: 34,
    mass: 0.18,
  });

  return (
    <motion.div
      aria-hidden="true"
      className="eventmate-scroll-progress"
      style={prefersReducedMotion ? { scaleX: 0 } : { scaleX: smoothProgress }}
    />
  );
}

function AnimatedOutlet() {
  const location = useLocation();
  const routeShellRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const routeShell = routeShellRef.current;
    if (!routeShell) return undefined;

    const revealTargets = Array.from(
      routeShell.querySelectorAll(".eventmate-panel, .eventmate-kpi")
    ).filter((node) => !node.classList.contains("eventmate-reveal-static"));

    revealTargets.forEach((node, index) => {
      node.classList.add("eventmate-reveal-ready");
      node.classList.remove("eventmate-reveal-visible");
      node.style.setProperty("--eventmate-reveal-delay", `${Math.min(index, 14) * 28}ms`);
    });

    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
      revealTargets.forEach((node) => node.classList.add("eventmate-reveal-visible"));
      return undefined;
    }

    let observer = null;

    const showAllTargets = () => {
      revealTargets.forEach((node) => node.classList.add("eventmate-reveal-visible"));
    };

    try {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("eventmate-reveal-visible");
              observer?.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.12,
          rootMargin: "0px 0px -10% 0px",
        }
      );

      revealTargets.forEach((node) => observer.observe(node));
    } catch {
      showAllTargets();
      return undefined;
    }

    return () => observer?.disconnect();
  }, [location.pathname, location.search, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const routeShell = routeShellRef.current;
    if (!routeShell) return undefined;

    routeShell.style.setProperty("--eventmate-pointer-alpha", "0");

    const handlePointer = (event) => {
      const bounds = routeShell.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const pointerX = clampPercentage(((event.clientX - bounds.left) / bounds.width) * 100);
      const pointerY = clampPercentage(((event.clientY - bounds.top) / bounds.height) * 100);

      routeShell.style.setProperty("--eventmate-pointer-x", `${pointerX}%`);
      routeShell.style.setProperty("--eventmate-pointer-y", `${pointerY}%`);
      routeShell.style.setProperty("--eventmate-pointer-alpha", "1");
    };

    const handlePointerLeave = () => {
      routeShell.style.setProperty("--eventmate-pointer-alpha", "0");
    };

    routeShell.addEventListener("pointermove", handlePointer);
    routeShell.addEventListener("pointerenter", handlePointer);
    routeShell.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      routeShell.removeEventListener("pointermove", handlePointer);
      routeShell.removeEventListener("pointerenter", handlePointer);
      routeShell.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [location.pathname, location.search, prefersReducedMotion]);

  return (
    <AnimatePresence mode="wait" initial={!prefersReducedMotion}>
      <motion.div
        ref={routeShellRef}
        key={`${location.pathname}${location.search}`}
        variants={routeMotionVariants}
        initial={prefersReducedMotion ? false : "initial"}
        animate="animate"
        exit={prefersReducedMotion ? "animate" : "exit"}
        transition={prefersReducedMotion ? { duration: 0 } : routeMotionTransition}
        className="eventmate-route-shell"
      >
        <span className="eventmate-interaction-glow" aria-hidden="true" />
        <span className="eventmate-interaction-grain" aria-hidden="true" />
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

function ScrollToTop() {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (location.hash) {
      const targetId = decodeURIComponent(location.hash.slice(1));
      let frameA = 0;
      let frameB = 0;

      const scrollToHashTarget = () => {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            block: "start",
            behavior: prefersReducedMotion ? "auto" : "smooth",
          });
          return true;
        }

        return false;
      };

      if (scrollToHashTarget()) {
        return;
      }

      frameA = window.requestAnimationFrame(() => {
        frameB = window.requestAnimationFrame(() => {
          if (!scrollToHashTarget()) {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          }
        });
      });

      return () => {
        window.cancelAnimationFrame(frameA);
        window.cancelAnimationFrame(frameB);
      };
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [location.pathname, location.search, location.hash, prefersReducedMotion]);

  return null;
}

function MainLayout() {
  const location = useLocation();
  const showSharedFooter = location.pathname !== "/";

  return (
    <div className="eventmate-app-shell eventmate-app-shell-public relative isolate flex min-h-screen flex-col overflow-x-hidden transition-colors duration-500">
      <ScrollToTop />
      <ScrollProgressBeam />
      <AmbientBackdrop variant="public" />
      <Navbar variant="public" />
      <main className="relative z-[1] flex-1">
        <AnimatedOutlet />
      </main>
      {showSharedFooter && <Footer />}
    </div>
  );
}

function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());
  const hideTopNav = location.pathname.startsWith("/student-dashboard");

  useEffect(() => {
    const unsubscribe = subscribeAuthUpdates(() => {
      setUser(getStoredUser());
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };

  return (
    <div className="eventmate-app-shell eventmate-app-shell-dashboard relative isolate flex min-h-screen flex-col overflow-x-hidden">
      <ScrollToTop />
      <AmbientBackdrop variant="dashboard" />
      {!hideTopNav && (
        <Navbar
          activePage={null}
          setActivePage={() => {}}
          user={user}
          onLogout={handleLogout}
        />
      )}
      <main className="relative z-[1] flex-1">
        <AnimatedOutlet />
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Landing />} />
        <Route
          path="/events/:eventId"
          element={
            <Suspense fallback={<div className="p-8 text-center">Loading event details...</div>}>
              <PublicEventDetails />
            </Suspense>
          }
        />
        <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/developers" element={<DeveloperTeam />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-registration" element={<VerifyRegistration />} />
          <Route path="/team-invite" element={<TeamInvite />} />
          <Route
            path="/attendance/verify"
            element={
              <Suspense fallback={<div className="p-8 text-center">Loading attendance verification...</div>}>
                <AttendanceVerify />
              </Suspense>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<DashboardLayout />}>
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading Dashboard...</div>}>
                  <AdminDashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/user-management"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading User Management...</div>}>
                  <AdminUserManagement />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/organizer-management"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading Organizer Management...</div>}>
                  <AdminOrganizerManagement />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/coordinator-management"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading Coordinator Management...</div>}>
                  <AdminCoordinatorManagement />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/notifications"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading Notifications...</div>}>
                  <AdminNotifications />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/contact-center"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading Contact Center...</div>}>
                  <AdminContactCenter />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/system-oversight"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading System Oversight...</div>}>
                  <AdminSystemOversight />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/certificates-audit"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading Certificates & Audit Logs...</div>}>
                  <AdminCertificatesAuditLogs />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/security-reports"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading Security & Reports...</div>}>
                  <AdminSecurityReports />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin-dashboard/profile"
            element={
              <ProtectedRoute requiredRole="MAIN_ADMIN">
                <Suspense fallback={<div className="p-8 text-center">Loading Admin Profile...</div>}>
                  <AdminProfile />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Dashboard...</div>}>
                  <OrganizerDashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/create-event"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Create Event...</div>}>
                  <OrganizerCreateEvent />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/edit-event/:eventId"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Edit Event...</div>}>
                  <OrganizerEditEvent />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/event/:eventId/details"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Event Details...</div>}>
                  <OrganizerEventDetails />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/event/:eventId/contact-center"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Contact Center...</div>}>
                  <OrganizerEventContactCenter />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/event/:eventId/scan-qr"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Scan QR...</div>}>
                  <OrganizerEventScanQR />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/event/:eventId/view-list"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading View List...</div>}>
                  <OrganizerEventViewList />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/event/:eventId/feedback"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Feedback...</div>}>
                  <OrganizerEventFeedback />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/event/:eventId/certificates"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Certificate Management...</div>}>
                  <OrganizerCertificateManagement />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/coordinator-management"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Coordinator Management...</div>}>
                  <OrganizerCoordinatorManagement />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/contact-admin"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Contact Admin...</div>}>
                  <OrganizerContactAdmin />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/notifications"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Suspense fallback={<div className="p-8 text-center">Loading Notifications...</div>}>
                  <OrganizerNotifications />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer-dashboard/profile"
            element={
              <ProtectedRoute requiredRole="ORGANIZER">
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Dashboard...</div>}>
                  <CoordinatorDashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/contact-admin"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Contact Admin...</div>}>
                  <CoordinatorContactAdmin />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/registrations"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Registrations...</div>}>
                  <CoordinatorRegistrations />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/event/:eventId/registrations"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Registrations...</div>}>
                  <CoordinatorRegistrations />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/event/:eventId/details"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Event Details...</div>}>
                  <CoordinatorEventDetails />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/event/:eventId/scan"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Attendance Scanner...</div>}>
                  <CoordinatorAttendanceScanner />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/event/:eventId/scan-qr"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Attendance Scanner...</div>}>
                  <CoordinatorAttendanceScanner />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/event/:eventId/feedback"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Feedback...</div>}>
                  <CoordinatorEventFeedback />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/notifications"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Suspense fallback={<div className="p-8 text-center">Loading Notifications...</div>}>
                  <CoordinatorNotifications />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/profile"
            element={
              <ProtectedRoute requiredRole={["STUDENT_COORDINATOR", "STUDENT"]}>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student-dashboard"
            element={
              <ProtectedRoute requiredRole="STUDENT">
                <Suspense fallback={<div className="p-8 text-center">Loading Dashboard...</div>}>
                  <StudentLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Dashboard...</div>}>
                  <StudentDashboard />
                </Suspense>
              }
            />
            <Route
              path="events"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Events...</div>}>
                  <StudentEvents />
                </Suspense>
              }
            />
            <Route
              path="events/:eventId"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Event Details...</div>}>
                  <StudentEventDetails />
                </Suspense>
              }
            />
            <Route
              path="events/:eventId/register"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Registration Form...</div>}>
                  <StudentEventDetails mode="register" />
                </Suspense>
              }
            />
            <Route
              path="my-events"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading My Events...</div>}>
                  <StudentMyEvents />
                </Suspense>
              }
            />
            <Route
              path="my-events/qr/:registrationId"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading QR Pass...</div>}>
                  <StudentEventQRCode />
                </Suspense>
              }
            />
            <Route
              path="my-events/payment/:registrationId"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Payment...</div>}>
                  <StudentRegistrationPayment />
                </Suspense>
              }
            />
            <Route
              path="team-registration/:registrationId"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Team Registration...</div>}>
                  <StudentTeamRegistration />
                </Suspense>
              }
            />
            <Route
              path="contact-us"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Contact...</div>}>
                  <StudentContactUs />
                </Suspense>
              }
            />
            <Route
              path="feedback-pending"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Feedback...</div>}>
                  <StudentFeedbackPending />
                </Suspense>
              }
            />
            <Route
              path="notifications"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Notifications...</div>}>
                  <StudentNotifications />
                </Suspense>
              }
            />
            <Route
              path="my-certificates"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Certificates...</div>}>
                  <MyCertificates />
                </Suspense>
              }
            />
          </Route>

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile/customization"
            element={
              <ProtectedRoute>
                <ProfileCustomization />
              </ProtectedRoute>
            }
          />

        </Route>
      </Routes>
    </Router>
  );
}

