import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import api from "../lib/api";
import { storePendingVerificationEmail } from "../lib/pendingVerification";
import SummaryApi from "../api/SummaryApi";
import { emitToast } from "../lib/toastBus";
import PageBackButton from "../components/PageBackButton";

export default function Signup() {
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agree: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const nextEmail = String(new URLSearchParams(location.search).get("email") || "")
      .trim()
      .toLowerCase();
    if (!nextEmail) return;
    setFormData((prev) => ({ ...prev, email: prev.email || nextEmail }));
  }, [location.search]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.fullName) newErrors.fullName = "Full name is required";
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (formData.confirmPassword !== formData.password) newErrors.confirmPassword = "Passwords do not match";
    if (!formData.agree) newErrors.agree = "Please accept the terms to continue";
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      emitToast({
        type: "error",
        text: Object.values(validationErrors)[0] || "Please review the form and try again.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const email = formData.email;
      const response = await api({
        ...SummaryApi.register,
        skipSuccessToast: true,
        skipErrorToast: true,
        data: {
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
        },
      });

      const apiMessage =
        response.data?.message || "Registration successful. Check your email for the OTP.";
      emitToast({ type: "success", text: apiMessage });
      storePendingVerificationEmail(email);
      setFormData({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        agree: false,
      });

      setTimeout(
        () =>
          navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
            state: { email },
          }),
        800
      );
    } catch (error) {
      const apiError =
        error.response?.data?.errors?.[0] ||
        error.response?.data?.message ||
        "Registration failed. Please try again.";
      emitToast({ type: "error", text: apiError });
    } finally {
      setIsLoading(false);
    }
  };

  const parallaxX = (mousePosition.x - window.innerWidth / 2) / 50;
  const parallaxY = (mousePosition.y - window.innerHeight / 2) / 50;

  return (
    <main className="eventmate-page min-h-[calc(100vh-72px)] bg-gradient-to-br from-gray-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/60 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] top-[-200px] left-[-200px] rounded-full opacity-50 blur-3xl animate-blob-slow"
          style={{
            background: "linear-gradient(135deg, #a78bfa, #818cf8, #c084fc)",
            transform: `translate(${parallaxX * 1.5}px, ${parallaxY * 1.5}px)`,
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] bottom-[-100px] right-[-100px] rounded-full opacity-40 blur-3xl animate-blob-medium"
          style={{
            background: "linear-gradient(120deg, #f472b6, #ec4899, #d946ef)",
            transform: `translate(${parallaxX * -1.2}px, ${parallaxY * -1.2}px)`,
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] top-[20%] left-[30%] rounded-full opacity-30 blur-3xl animate-blob-fast"
          style={{
            background: "linear-gradient(90deg, #60a5fa, #3b82f6, #818cf8)",
            transform: `translate(${parallaxX}px, ${parallaxY}px)`,
          }}
        />
        <div
          className="absolute w-[700px] h-[700px] top-[50%] right-[10%] rounded-full opacity-20 blur-3xl animate-blob-slow-reverse"
          style={{
            background: "linear-gradient(45deg, #c084fc, #a855f7, #e879f9)",
            transform: `translate(${parallaxX * -0.8}px, ${parallaxY * -0.8}px)`,
          }}
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-white/20 dark:from-slate-950/40 dark:via-transparent dark:to-slate-900/20 pointer-events-none" />

      <section className="relative z-10 max-w-7xl mx-auto px-3 min-[360px]:px-4 sm:px-6 py-4 sm:py-6 lg:py-7 lg:min-h-[calc(100vh-72px)]">
        <div className="mb-4 sm:mb-6">
          <PageBackButton
            to="/"
            fallbackTo="/"
            preferHistory
            showLabel={false}
            iconSize={22}
            ariaLabel="Back to home"
            className="h-14 w-14 border border-white/15 bg-slate-900/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_14px_32px_-20px_rgba(15,23,42,0.95)] backdrop-blur-md hover:-translate-y-0.5 hover:border-white/25 hover:bg-slate-900/50 hover:text-white dark:border-white/12 dark:bg-slate-900/45 dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-slate-900/60"
          />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,420px)] lg:items-center xl:gap-8">
          <div className="space-y-6 lg:pr-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-100/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 backdrop-blur dark:border-indigo-400/30 dark:bg-indigo-500/15 dark:text-indigo-200">
              <Sparkles size={12} />
              Join the Community
            </span>

            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Student onboarding for campus event participation
              </p>
              <h1 className="text-3xl min-[360px]:text-4xl xl:text-5xl font-extrabold leading-tight text-gray-900 dark:text-slate-100">
                Manage Campus <br />
                Events Like a{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                  Pro.
                </span>
              </h1>

              <p className="mt-4 sm:mt-6 text-gray-700 dark:text-slate-300 max-w-md leading-relaxed text-base sm:text-lg">
                EventMate connects students and organizers. Discover, plan, and
                attend the best events happening on your campus today.
              </p>
            </div>

            <div className="grid gap-3 sm:max-w-xl sm:grid-cols-2">
              <div className="rounded-2xl border border-white/60 bg-white/10 px-4 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <ShieldCheck size={16} className="text-emerald-500 dark:text-emerald-300" />
                  Secure onboarding
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Email verification is required before the account becomes active.
                </p>
              </div>

              <div className="rounded-2xl border border-white/60 bg-white/10 px-4 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/20">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Sparkles size={16} className="text-indigo-500 dark:text-indigo-300" />
                  Student-first access
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  Students can self-register here while organizer accounts stay admin-managed.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end animate-slideUp">
            <div className="w-full max-w-[420px] bg-white/90 dark:bg-slate-900/85 backdrop-blur-lg rounded-2xl shadow-2xl hover:shadow-3xl transition duration-500 border border-white/20 dark:border-white/10">
              <div className="h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

              <div className="p-5 min-[360px]:p-6 sm:p-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-200">
                  <Sparkles size={12} />
                  Student Sign Up
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">
                  Student Registration
                </h2>

                <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
                  Only students can self-register. Organizers are registered by Admin.
                </p>

                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Join EventMate to start your journey.
                </p>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-slate-200">Full Name</label>
                  <input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Your Name"
                    required
                    autoComplete="name"
                    aria-invalid={Boolean(errors.fullName)}
                    aria-describedby={errors.fullName ? "signup-fullName-error" : undefined}
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                  />
                  {errors.fullName && (
                    <p id="signup-fullName-error" className="mt-1 text-xs font-medium text-rose-500">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-slate-200">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="xyz@gmail.com"
                    required
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "signup-email-error" : undefined}
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                  />
                  {errors.email && (
                    <p id="signup-email-error" className="mt-1 text-xs font-medium text-rose-500">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-slate-200">Password</label>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? "signup-password-error" : undefined}
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-300 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="signup-password-error" className="mt-1 text-xs font-medium text-rose-500">
                      {errors.password}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-slate-200">Confirm Password</label>
                  <div className="relative mt-1">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      autoComplete="new-password"
                      aria-invalid={Boolean(errors.confirmPassword)}
                      aria-describedby={errors.confirmPassword ? "signup-confirmPassword-error" : undefined}
                      className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-300 transition"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p id="signup-confirmPassword-error" className="mt-1 text-xs font-medium text-rose-500">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    name="agree"
                    checked={formData.agree}
                    onChange={handleChange}
                    aria-invalid={Boolean(errors.agree)}
                    aria-describedby={errors.agree ? "signup-agree-error" : undefined}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <span className="leading-relaxed">
                    I agree to the{" "}
                    <span className="text-indigo-600 dark:text-indigo-300 font-medium hover:underline cursor-pointer">
                      Terms
                    </span>{" "}
                    and{" "}
                    <span className="text-indigo-600 dark:text-indigo-300 font-medium hover:underline cursor-pointer">
                      Privacy Policy
                    </span>
                  </span>
                </div>
                {errors.agree && (
                  <p id="signup-agree-error" className="-mt-3 text-xs font-medium text-rose-500">
                    {errors.agree}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-3.5 rounded-xl font-semibold transition-all transform hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {isLoading ? "Signing up..." : "Sign Up"}
                </button>

                </form>

                <div className="my-6 flex items-center">
                  <div className="h-px flex-1 bg-gray-300 dark:bg-slate-700" />
                  <span className="px-4 text-xs font-medium text-gray-500 dark:text-slate-400">
                    Already have an account?
                  </span>
                  <div className="h-px flex-1 bg-gray-300 dark:bg-slate-700" />
                </div>

                <p className="text-center">
                  <Link
                    to="/login"
                    className="text-indigo-600 dark:text-indigo-300 font-semibold hover:underline text-base"
                  >
                    Login
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes blob-slow {
          0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
          50% { transform: translate(80px, -80px) rotate(10deg); }
        }
        @keyframes blob-medium {
          0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
          50% { transform: translate(-60px, 100px) rotate(-15deg); }
        }
        @keyframes blob-fast {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(50px, -50px) scale(1.1); }
          66% { transform: translate(-40px, 60px) scale(0.9); }
        }
        @keyframes blob-slow-reverse {
          0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
          50% { transform: translate(-100px, 80px) rotate(-8deg); }
        }

        .animate-blob-slow { animation: blob-slow 20s infinite ease-in-out; }
        .animate-blob-medium { animation: blob-medium 18s infinite ease-in-out; }
        .animate-blob-fast { animation: blob-fast 15s infinite ease-in-out; }
        .animate-blob-slow-reverse { animation: blob-slow-reverse 25s infinite ease-in-out; }

        .animate-fadeIn { animation: fadeIn 1s ease-out; }
        .animate-slideUp { animation: slideUp 0.8s ease-out; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
