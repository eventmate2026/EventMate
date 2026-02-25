import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaRegEyeSlash, FaRegEye } from "react-icons/fa6";
import { ArrowLeft, Lock, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import api from "../lib/api";
import { storeAuth } from "../lib/auth";
import SummaryApi from "../api/SummaryApi";

const dashboardRoutes = {
  MAIN_ADMIN: "/admin-dashboard",
  ORGANIZER: "/organizer-dashboard",
  STUDENT_COORDINATOR: "/coordinator-dashboard",
  STUDENT: "/student-dashboard",
};

export default function Login() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const finalizeLogin = async ({ accessToken, refreshToken, role, user }) => {
    const finalAccessToken = accessToken;
    if (!finalAccessToken) {
      throw new Error("Login failed. Missing access token.");
    }

    storeAuth({ accessToken: finalAccessToken, refreshToken, user: user || (role ? { role } : undefined) });

    let profileUser = user || null;
    try {
      if (!profileUser) {
        const profileResponse = await api({ ...SummaryApi.get_profile });
        profileUser = profileResponse.data?.user || null;
      }
      if (profileUser) {
        storeAuth({ user: profileUser });
      }
    } catch {
      profileUser = null;
    }

    const currentRole = profileUser?.role || role || user?.role;
    navigate(dashboardRoutes[currentRole] || "/student-dashboard", { replace: true });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prev) => ({
      ...prev,
      [name]: value.trimStart(),
    }));
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (!data.email || !data.password) {
      setErrors({
        email: !data.email ? "Email is required" : "",
        password: !data.password ? "Password is required" : "",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await api({ ...SummaryApi.login, data });
      const { accessToken, refreshToken, role, token, user } = response.data || {};
      await finalizeLogin({ accessToken: accessToken || token, refreshToken, role, user });
    } catch (error) {
      const status = error.response?.status;
      const retryAfter = Number(error.response?.data?.retryAfterSeconds);
      const rateLimitMessage =
        status === 429 && Number.isFinite(retryAfter)
          ? `Too many attempts. Try again in ${retryAfter} seconds.`
          : error.response?.data?.message;
      setErrors({ submit: rateLimitMessage || error.message || "Login failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = Object.values(data).every((el) => el);

  return (
    <section className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(79,70,229,0.18)_0.45px,transparent_0.45px)] opacity-[0.08] [background-size:18px_18px] dark:opacity-[0.16]" />
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-10 right-0 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-500/15 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-2 pb-8 sm:px-6 sm:pt-3">
        <Link
          to="/"
          className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/70 p-2 text-slate-700 shadow-sm backdrop-blur transition hover:border-indigo-200 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:text-indigo-300"
          aria-label="Back to home"
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="mx-auto mt-2 grid w-full max-w-5xl gap-5 lg:grid-cols-[1.08fr_1fr] lg:items-start">
          <div className="hidden rounded-[26px] bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 p-[1px] shadow-[0_20px_45px_-35px_rgba(79,70,229,0.8)] lg:block">
            <div className="rounded-[25px] border border-white/70 bg-white/85 p-7 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300">
                EventMate Secure Login
                <Sparkles size={12} />
              </div>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight text-slate-900 dark:text-slate-100">
                Manage your events with{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  clarity and control
                </span>
              </h2>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                One login for Admins, Organizers, Coordinators, and Students with role-based access.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  { icon: ShieldCheck, title: "Protected Access", text: "Secure authentication with refresh sessions." },
                  { icon: Users, title: "Role Specific Dashboards", text: "Auto-redirect based on your role." },
                  { icon: Sparkles, title: "Unified Event Platform", text: "Manage events, reports, and notifications." },
                ].map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-indigo-100/80 bg-white/90 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/85"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 rounded-lg p-1.5 ${
                          index === 0
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                            : index === 1
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                        }`}
                      >
                        <item.icon size={14} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: "Events", value: "Live" },
                  { label: "Security", value: "Strong" },
                  { label: "Access", value: "Role-based" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-800/70">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] bg-gradient-to-br from-blue-500/25 via-indigo-500/25 to-purple-500/25 p-[1px] shadow-[0_25px_50px_-35px_rgba(79,70,229,0.85)]">
            <div className="relative overflow-hidden rounded-[25px] border border-slate-200/80 bg-white px-6 py-7 sm:px-8 sm:py-8 dark:border-slate-800 dark:bg-slate-900">
              <div className="pointer-events-none absolute -top-14 -right-10 h-28 w-28 rounded-full bg-indigo-200/45 blur-2xl dark:bg-indigo-500/15" />
              <div className="pointer-events-none absolute -bottom-14 -left-10 h-24 w-24 rounded-full bg-purple-200/40 blur-2xl dark:bg-purple-500/15" />

              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
                  Sign In
                </p>
                <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-slate-100">Welcome Back</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Please enter your details to Login.</p>
              </div>

              <form className="relative mt-6 space-y-4" onSubmit={handleSubmit} autoComplete="on">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-500/30">
                    <Mail size={16} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="xyz@gmail.com"
                      className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                      value={data.email}
                      onChange={handleChange}
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-500/30">
                    <Lock size={16} className="text-slate-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      placeholder="********"
                      className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                      value={data.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <FaRegEye /> : <FaRegEyeSlash />}
                    </button>
                  </div>
                  <div className="mt-2 text-right">
                    <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <p className="rounded-lg border border-indigo-100 bg-indigo-50/65 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  Admins, Organizers, Coordinators, and Students login here. Access is provided by role after
                  authentication.
                </p>

                {errors.submit && (
                  <p className="rounded-lg bg-red-50 py-2 text-center text-sm text-red-600">
                    {errors.submit}
                  </p>
                )}

                <button
                  disabled={!isValid || isLoading}
                  className={`w-full rounded-xl py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition ${
                    isValid && !isLoading
                      ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-lg shadow-indigo-300/60 hover:-translate-y-0.5 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700"
                      : "cursor-not-allowed bg-slate-400 dark:bg-slate-700"
                  }`}
                >
                  {isLoading ? "Logging in..." : "Login"}
                </button>

                <div className="pt-1 text-center text-sm text-slate-500 dark:text-slate-400">
                  Not a member yet?{" "}
                  <Link
                    to="/signup"
                    className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Create an account
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

