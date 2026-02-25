import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import StudentNavbar from "../components/StudentNavbar";
import { getStoredUser, subscribeAuthUpdates } from "../lib/auth";
import { logoutUser } from "../lib/logout";

const resolveActivePage = (pathname) => {
  if (pathname === "/student-dashboard" || pathname === "/student-dashboard/") return "home";
  if (pathname.startsWith("/student-dashboard/events")) return "events";
  if (pathname.startsWith("/student-dashboard/my-events")) return "my-events";
  if (pathname.startsWith("/student-dashboard/my-certificates")) return "my-events";
  if (pathname.startsWith("/student-dashboard/contact-us")) return "contact-us";
  return "home";
};

export default function StudentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(
    () => getStoredUser() || { fullName: "Student", email: "student@college.com", role: "STUDENT" }
  );
  const activePage = resolveActivePage(location.pathname);

  useEffect(() => {
    const unsubscribe = subscribeAuthUpdates(() => {
      setUser(getStoredUser() || { fullName: "Student", email: "student@college.com", role: "STUDENT" });
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login", { replace: true });
  };

  return (
    <div className="eventmate-page min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col transition-colors">
      <StudentNavbar activePage={activePage} user={user} onLogout={handleLogout} />
      <main className="flex-grow">
        <Outlet />
      </main>
    </div>
  );
}

