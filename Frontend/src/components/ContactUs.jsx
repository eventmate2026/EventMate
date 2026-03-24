import { useEffect, useState } from "react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser } from "../lib/auth";
import { emitToast } from "../lib/toastBus";

export default function ContactUs() {
  const [user, setUser] = useState(() => getStoredUser());
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const profile = getStoredUser();
    setUser(profile);
    setFormData((prev) => ({
      ...prev,
      name: prev.name || profile?.fullName || "",
      email: prev.email || profile?.email || "",
    }));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      emitToast({ type: "error", text: "Please fill in all fields." });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      emitToast({ type: "error", text: "Please enter a valid email address." });
      return;
    }

    setIsLoading(true);

    try {
      const response = await api({
        ...SummaryApi.submit_contact,
        skipSuccessToast: true,
        skipErrorToast: true,
        data: {
          fullName: formData.name.trim(),
          email: formData.email.trim(),
          message: formData.message.trim(),
        },
      });
      emitToast({
        type: "success",
        text: response.data?.message || "Message sent successfully.",
      });

      setFormData({
        name: user?.fullName || "",
        email: user?.email || "",
        message: "",
      });
    } catch (error) {
      emitToast({
        type: "error",
        text: error.response?.data?.message || error.message || "Unable to send your message right now.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="eventmate-page relative py-20 px-4 sm:px-6 overflow-hidden bg-gray-50 dark:bg-gray-900">
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-400/30 dark:bg-indigo-900/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-400/30 dark:bg-purple-900/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in-up">
          <span className="inline-block py-1 px-3 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 text-xs font-bold tracking-wider uppercase mb-4">
            Contact Us
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 mb-6">
            Let's start a conversation
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Whether you have feedback, a question, or just want to say hi, our team is always ready to chat.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 items-start">
          {/* Contact Form */}
          <div className="w-full max-w-3xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 md:p-10 rounded-[2rem] shadow-2xl border border-white/50 dark:border-gray-700 relative overflow-hidden">
              
              {/* Decorative top gradient line */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Send us a message</h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                      disabled={isLoading}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white disabled:opacity-50"
                    />
                  </div>
                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john@example.com"
                      required
                      disabled={isLoading}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all dark:text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Message</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Write your message here..."
                    rows="4"
                    required
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all resize-none dark:text-white disabled:opacity-50"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
          opacity: 0; /* Start hidden */
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
          opacity: 0;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </section>
  );
}
