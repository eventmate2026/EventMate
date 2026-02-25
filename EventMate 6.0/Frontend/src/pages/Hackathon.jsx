// src/pages/Hackathon.jsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Hackathon() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("About")

  const tabs = ["About", "Contact", "Mentor & Judge"]

  const handleRegister = () => {
    navigate("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/20 via-white to-purple-50/20 dark:from-[#0f0f17] dark:via-[#1a1a2e] dark:to-[#16213e] pt-24">

      {/* Hero Banner */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
              alt="Hackathon 2025 Banner"
              className="w-full h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 text-white">
              <p className="text-sm md:text-base font-medium mb-2 opacity-90">
                Team Event • Technical
              </p>
              <h1 className="text-5xl md:text-7xl font-extrabold mb-4 drop-shadow-2xl">
                HACKATHON <br />
                <span className="text-4xl md:text-6xl text-yellow-400">2025</span>
              </h1>

              <div className="flex flex-wrap gap-6 md:gap-12 text-sm md:text-base mt-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="font-semibold">Date & Time</p>
                    <p>Nov 12, 2025 • 9:00 AM</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="font-semibold">Venue</p>
                    <p>Computer Lab A</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">👥</span>
                  <div>
                    <p className="font-semibold">Organized By</p>
                    <p>Computer Science Dept.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-10">

          {/* Left: Tabs Content */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-8 border-b border-gray-200 dark:border-gray-700 mb-8">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 px-2 font-medium text-lg transition-all duration-300 relative ${
                    activeTab === tab
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-8">
              {activeTab === "About" && (
                <>
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl p-8">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                      About the Event
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      Join us for the biggest university hackathon of the year! Hackathon 2025 brings together the brightest minds in engineering, design, and business to solve real-world problems.
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                      Whether you're a coding wizard, a design guru, or a pitching pro, there's a place for you here.
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                      Over the course of 24 hours, you'll form teams, brainstorm ideas, and build functional prototypes. This read-only view provides all necessary details for participation.
                    </p>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-2xl p-8">
                    <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                      Event Requirements
                    </h2>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-4">
                        <span className="text-2xl">👥</span>
                        <div>
                          <p className="font-semibold">Team Size</p>
                          <p className="text-gray-600 dark:text-gray-400">
                            Minimum 2 members, Maximum 4 members per team.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-4">
                        <span className="text-2xl">💻</span>
                        <div>
                          <p className="font-semibold">Tools & Equipment</p>
                          <p className="text-gray-600 dark:text-gray-400">
                            Participants must bring their own laptops and chargers. Wi-Fi will be provided.
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </>
              )}

              {activeTab === "Contact" && (
                <div className="bg-white/90 dark:bg-gray-800/90 rounded-2xl p-8">
                  <h2 className="text-2xl font-bold mb-6">Event Coordinators</h2>
                  <div className="space-y-4">
                    <p>📧 eventcoordinator@college.edu</p>
                    <p>📞 +91 98765 43210</p>
                  </div>
                </div>
              )}

              {activeTab === "Mentor & Judge" && (
                <div className="bg-white/90 dark:bg-gray-800/90 rounded-2xl p-8">
                  <h2 className="text-2xl font-bold mb-6">Mentors & Judges</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Industry experts and faculty members will be available for guidance and final judging.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Register Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 sticky top-24 border border-gray-200/50 dark:border-gray-700/50">
              <div className="text-center mb-8">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Entry Fee</p>
                <p className="text-5xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  ₹300
                </p>
              </div>

              <button
                onClick={handleRegister}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xl rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-500 transform hover:scale-105"
              >
                Register
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
                By registering, you agree to the event rules
              </p>

              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-yellow-500 text-xl">🔒</span>
                  <p className="text-gray-600 dark:text-gray-400">
                    Security & Privacy: Attendance is verified via QR code. Personal data is accessible only after successful registration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
