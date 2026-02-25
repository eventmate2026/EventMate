import { useState } from "react";

export default function ContactUs() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [status, setStatus] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (status.message) setStatus({ type: "", message: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setStatus({ type: "error", message: "Please fill in all fields." });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "", message: "" });

    try {
      // 🔗 BACKEND INTEGRATION POINT
      /*
      const response = await fetch('YOUR_API_ENDPOINT_HERE', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to send');
      */

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulation

      setStatus({
        type: "success",
        message: "Message sent successfully! We'll be in touch soon.",
      });
      setFormData({ name: "", email: "", message: "" });
    } catch (error) {
      console.error(error);
      setStatus({
        type: "error",
        message: "Something went wrong. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="relative py-20 px-4 sm:px-6 overflow-hidden bg-gray-50 dark:bg-gray-900">
      
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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
          
          {/* Left Side: Contact Info Cards */}
          <div className="lg:col-span-2 space-y-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            
            <div className="bg-white dark:bg-gray-800/60 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:border-indigo-500/30 transition-all duration-300 group">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Email</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">support@eventmate.com</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/60 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:border-purple-500/30 transition-all duration-300 group">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-purple-50 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Phone</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">+91 98765 43210</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800/60 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:border-pink-500/30 transition-all duration-300 group">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-pink-50 dark:bg-pink-500/10 rounded-2xl flex items-center justify-center text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Office</h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">Main Campus, Block B</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Side: Form */}
          <div className="lg:col-span-3 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
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

                {/* Status Alert */}
                {status.message && (
                  <div className={`p-4 rounded-xl text-sm font-semibold animate-fade-in ${
                    status.type === "success" 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800" 
                      : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800"
                  }`}>
                    {status.message}
                  </div>
                )}

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