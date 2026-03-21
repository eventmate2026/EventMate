import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { FaRegEye, FaRegEyeSlash } from "react-icons/fa6";
import api, { primeBackendConnection } from "../lib/api";
import { storePendingVerificationEmail } from "../lib/pendingVerification";
import SummaryApi from "../api/SummaryApi";
import { useToast } from "../context/ToastContext";
import { getSafeApiErrorText } from "../lib/safeMessage";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  const navigate = useNavigate();
  const toast = useToast();
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
  const submitLockRef = useRef(false);
  const fullNameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);
  const agreeInputRef = useRef(null);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    void primeBackendConnection();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === "checkbox" ? checked : value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  const validateForm = () => {
    const normalizedFullName = String(formData.fullName || "").trim();
    const normalizedEmail = String(formData.email || "").trim().toLowerCase();
    const password = String(formData.password || "");
    const confirmPassword = String(formData.confirmPassword || "");
    const newErrors = {};
    let firstField = "";
    let firstMessage = "";

    const addError = (field, message) => {
      newErrors[field] = message;
      if (!firstField) {
        firstField = field;
        firstMessage = message;
      }
    };

    if (!normalizedFullName) {
      addError("fullName", "Full name is required.");
    } else if (normalizedFullName.length < 3) {
      addError("fullName", "Full name must be at least 3 characters.");
    }

    if (!normalizedEmail) {
      addError("email", "Email is required.");
    } else if (!EMAIL_REGEX.test(normalizedEmail)) {
      addError("email", "Enter a valid email address.");
    }

    if (!password) {
      addError("password", "Password is required.");
    } else if (password.length < 8) {
      addError("password", "Password must be at least 8 characters.");
    }

    if (!confirmPassword) {
      addError("confirmPassword", "Please confirm your password.");
    } else if (confirmPassword !== password) {
      addError("confirmPassword", "Passwords do not match.");
    }

    if (!formData.agree) {
      addError("agree", "Please accept the terms to continue.");
    }

    return {
      errors: newErrors,
      firstField,
      firstMessage,
      normalizedFullName,
      normalizedEmail,
    };
  };

  const focusField = (field) => {
    const focusMap = {
      fullName: fullNameInputRef,
      email: emailInputRef,
      password: passwordInputRef,
      confirmPassword: confirmPasswordInputRef,
      agree: agreeInputRef,
    };

    focusMap[field]?.current?.focus?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current || isLoading) return;
    setErrors({});
    const { errors: validationErrors, firstField, firstMessage, normalizedFullName, normalizedEmail } =
      validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusField(firstField);
      if (firstMessage) {
        toast.error(firstMessage);
      }
      return;
    }

    const email = normalizedEmail;
    submitLockRef.current = true;
    setIsLoading(true);
    try {
      await primeBackendConnection({ maxWaitMs: 2500 });

      const response = await api({
        ...SummaryApi.register,
        data: {
          fullName: normalizedFullName,
          email,
          password: String(formData.password || ""),
        },
      });

      const apiMessage =
        response.data?.message || "Registration successful. Check your email for the OTP.";
      const nextStep = String(response.data?.nextStep || "verify_email").trim().toLowerCase();
      const isFreshRegistration = Number(response.status) === 201;

      if (nextStep === "login") {
        toast.info(apiMessage, { duration: 4200 });
        setTimeout(
          () => navigate(`/login?email=${encodeURIComponent(email)}`, { replace: true }),
          800
        );
        return;
      }

      if (isFreshRegistration) {
        toast.success(apiMessage, { duration: 4200 });
      } else {
        toast.info(apiMessage, { duration: 4200 });
      }
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
            state: { email, message: apiMessage },
          }),
        800
      );
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      const hasNetworkFailure = !error?.response;
      const networkMessage =
        "The service is taking longer than usual. Please wait a few seconds and try again.";
      const apiError =
        error.response?.data?.errors?.[0] ||
        getSafeApiErrorText(error, hasNetworkFailure ? networkMessage : "Registration failed. Please try again.");
      const verifyEmailFallbackMessage =
        "This email is already linked to an account. Continue to email verification to resend the OTP, or log in if your account is already verified.";
      const delayedOtpMessage =
        "Your account may already be created, but the verification OTP could not be delivered right now. Continue to email verification and try resend OTP in a few minutes.";

      if (status === 409) {
        const conflictMessage =
          /verify|contact admin/i.test(apiError) || !/already registered/i.test(apiError)
            ? apiError || verifyEmailFallbackMessage
            : verifyEmailFallbackMessage;
        storePendingVerificationEmail(email);
        toast.info(conflictMessage, { duration: 5200 });
        setTimeout(
          () =>
            navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
              state: { email, message: conflictMessage },
            }),
          800
        );
        return;
      }

      if (status === 503) {
        storePendingVerificationEmail(email);
        toast.info(delayedOtpMessage, { duration: 5200 });
        setTimeout(
          () =>
            navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
              state: { email, message: delayedOtpMessage },
            }),
          800
        );
        return;
      }

      setErrors((prev) => ({ ...prev, submit: apiError }));
      toast.error(apiError);
    } finally {
      submitLockRef.current = false;
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

      <section className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 px-6 py-6 sm:py-8 lg:py-10 items-start lg:items-center min-h-[calc(100vh-72px)]">
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
            >
              <ArrowLeft size={16} /> Back
            </Link>

            <span className="inline-block px-5 py-1.5 text-xs font-semibold tracking-wider uppercase rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/30">
              Join the Community
            </span>
          </div>

          <div>
            <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight text-gray-900 dark:text-slate-100">
              Manage Campus <br />
              Events Like a{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                Pro.
              </span>
            </h1>

            <p className="mt-6 text-gray-700 dark:text-slate-300 max-w-md leading-relaxed text-lg">
              EventMate connects students and organizers. Discover, plan, and
              attend the best events happening on your campus today.
            </p>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end animate-slideUp">
          <div className="w-full max-w-[420px] bg-white/90 dark:bg-slate-900/85 backdrop-blur-lg rounded-2xl shadow-2xl hover:shadow-3xl transition duration-500 border border-white/20 dark:border-white/10">
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">
                Student Registration
              </h2>

              <p className="text-sm text-gray-600 dark:text-slate-300 mt-2">
                Only students can self-register. Organizers are registered by Admin.
              </p>

              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Join EventMate to start your journey.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5" autoComplete="on">
                <div>
                  <label htmlFor="signup-full-name" className="text-sm font-medium text-gray-700 dark:text-slate-200">Full Name</label>
                  <input
                    id="signup-full-name"
                    ref={fullNameInputRef}
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Your Name"
                    autoComplete="name"
                    required
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                  />
                  {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="signup-email" className="text-sm font-medium text-gray-700 dark:text-slate-200">Email Address</label>
                  <input
                    id="signup-email"
                    ref={emailInputRef}
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="xyz@gmail.com"
                    autoComplete="email"
                    required
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="signup-password" className="text-sm font-medium text-gray-700 dark:text-slate-200">Password</label>
                  <div className="relative mt-1">
                    <input
                      id="signup-password"
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <FaRegEye className="eventmate-icon" /> : <FaRegEyeSlash className="eventmate-icon" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                </div>

                <div>
                  <label htmlFor="signup-confirm-password" className="text-sm font-medium text-gray-700 dark:text-slate-200">Confirm Password</label>
                  <div className="relative mt-1">
                    <input
                      id="signup-confirm-password"
                      ref={confirmPasswordInputRef}
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                    >
                      {showConfirmPassword ? <FaRegEye className="eventmate-icon" /> : <FaRegEyeSlash className="eventmate-icon" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-300">
                  <input
                    id="signup-agree"
                    ref={agreeInputRef}
                    type="checkbox"
                    name="agree"
                    checked={formData.agree}
                    onChange={handleChange}
                    autoComplete="off"
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <label htmlFor="signup-agree">
                    I agree to the{" "}
                    <span className="text-indigo-600 dark:text-indigo-300 font-medium hover:underline cursor-pointer">
                      Terms
                    </span>{" "}
                    and{" "}
                    <span className="text-indigo-600 dark:text-indigo-300 font-medium hover:underline cursor-pointer">
                      Privacy Policy
                    </span>
                  </label>
                </div>
                {errors.agree && <p className="text-xs text-red-600">{errors.agree}</p>}
                {errors.submit && <p className="text-xs text-red-600">{errors.submit}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-3.5 rounded-xl font-semibold transition-all transform hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {isLoading ? "Signing up..." : "Sign Up"}
                </button>
              </form>

              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-gray-300 dark:bg-slate-700" />
                <span className="px-4 text-xs text-gray-500 dark:text-slate-400 font-medium">
                  Already have an account?
                </span>
                <div className="flex-1 h-px bg-gray-300 dark:bg-slate-700" />
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

