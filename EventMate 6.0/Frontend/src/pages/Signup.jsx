import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";

export default function Signup() {
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
  const [successMessage, setSuccessMessage] = useState("");

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

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
    setSuccessMessage("");
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      const email = formData.email;
      const response = await api({
        ...SummaryApi.register,
        data: {
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
        },
      });

      const apiMessage =
        response.data?.message || "Registration successful. Check your email for the OTP.";
      const otp = response.data?.otp;
      setSuccessMessage(otp ? `${apiMessage} OTP: ${otp}` : apiMessage);
      setFormData({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
        agree: false,
      });

      setTimeout(() => navigate("/verify-email", { state: { email } }), 800);
    } catch (error) {
      const apiError =
        error.response?.data?.errors?.[0] ||
        error.response?.data?.message ||
        "Registration failed. Please try again.";
      setErrors({ submit: apiError });
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

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200">Full Name</label>
                  <input
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Your Name"
                    required
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                  />
                  {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="xyz@gmail.com"
                    required
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                  />
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-200">Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="mt-1 w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500/40 focus:border-transparent outline-none transition"
                  />
                  {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    name="agree"
                    checked={formData.agree}
                    onChange={handleChange}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <span>
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
                {errors.agree && <p className="text-xs text-red-600">{errors.agree}</p>}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-3.5 rounded-xl font-semibold transition-all transform hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {isLoading ? "Signing up..." : "Sign Up"}
                </button>

                {errors.submit && (
                  <p className="text-sm text-red-600 dark:text-red-300 text-center bg-red-50 dark:bg-red-500/15 py-2 rounded-lg">
                    {errors.submit}
                  </p>
                )}
                {successMessage && (
                  <p className="text-sm text-green-700 dark:text-emerald-300 text-center bg-green-50 dark:bg-emerald-500/15 py-2 rounded-lg">
                    {successMessage}
                  </p>
                )}
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

