import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { getStoredToken, getStoredUser, subscribeAuthUpdates } from "./lib/auth";
import { logoutUser } from "./lib/logout";

import Landing from "./pages/Landing";
import Hackathon from "./pages/Hackathon";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyRegistration from "./pages/VerifyRegistration";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import ProfileCustomization from "./pages/ProfileCustomization";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

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

const CoordinatorDashboard = lazy(() =>
  import("./pages/CoordinatorDashboard").catch(() => ({
    default: () => <div>Dashboard loading...</div>,
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

const StudentContactUs = lazy(() =>
  import("./pages/StudentContactUs").catch(() => ({
    default: () => <div>Contact loading...</div>,
  }))
);

const MyCertificates = lazy(() =>
  import("./pages/MyCertificates").catch(() => ({
    default: () => <div>Loading certificates...</div>,
  }))
);

const routeMotionVariants = {
  initial: { opacity: 0, y: 18, scale: 0.992, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, scale: 0.996, filter: "blur(4px)" },
};

const routeMotionTransition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1],
};

function ProtectedRoute({ children, requiredRole }) {
  const user = getStoredUser();
  const token = getStoredToken();

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = Array.isArray(requiredRole)
    ? requiredRole
    : requiredRole
      ? [requiredRole]
      : null;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
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

function AnimatedOutlet() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${location.pathname}${location.search}`}
        variants={routeMotionVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={routeMotionTransition}
        className="eventmate-route-shell"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

function MainLayout() {
  return (
    <div className="eventmate-app-shell eventmate-app-shell-public relative isolate flex min-h-screen flex-col overflow-x-hidden transition-colors duration-500">
      <AmbientBackdrop variant="public" />
      <Navbar variant="public" />
      <main className="relative z-[1] flex-1">
        <AnimatedOutlet />
      </main>
      <Footer />
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
          <Route path="/hackathon" element={<Hackathon />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/verify-registration" element={<VerifyRegistration />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
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
              <ProtectedRoute requiredRole="STUDENT_COORDINATOR">
                <Suspense fallback={<div className="p-8 text-center">Loading Dashboard...</div>}>
                  <CoordinatorDashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/contact-admin"
            element={
              <ProtectedRoute requiredRole="STUDENT_COORDINATOR">
                <Suspense fallback={<div className="p-8 text-center">Loading Contact Admin...</div>}>
                  <CoordinatorContactAdmin />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/registrations"
            element={
              <ProtectedRoute requiredRole="STUDENT_COORDINATOR">
                <Suspense fallback={<div className="p-8 text-center">Loading Registrations...</div>}>
                  <CoordinatorRegistrations />
                </Suspense>
              </ProtectedRoute>
            }
          />

          <Route
            path="/coordinator-dashboard/profile"
            element={
              <ProtectedRoute requiredRole="STUDENT_COORDINATOR">
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
              path="contact-us"
              element={
                <Suspense fallback={<div className="p-8 text-center">Loading Contact...</div>}>
                  <StudentContactUs />
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

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
