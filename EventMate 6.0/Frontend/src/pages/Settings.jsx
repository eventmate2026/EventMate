import { Bell, Lock, Palette, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const upcoming = [
  { title: "Notification Preferences", detail: "Choose email and push alert granularity.", icon: Bell },
  { title: "Account Security", detail: "Configure MFA and active device controls.", icon: Lock },
  { title: "Interface Theme", detail: "Save preferred theme and accessibility contrast.", icon: Palette },
  { title: "Avatar Frame Studio", detail: "Apply wing-style and animated profile frames.", icon: Sparkles },
];

export default function Settings() {
  return (
    <section className="eventmate-page min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="eventmate-panel rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                <SlidersHorizontal size={13} />
                Account Settings
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Settings Center</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                We are preparing advanced controls. For now, you can update identity details in your profile.
              </p>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
            >
              Go to Profile
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {upcoming.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="eventmate-kpi rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 flex items-center justify-center">
                  <Icon size={18} />
                </div>
                <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{item.title}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.detail}</p>
              </article>
            );
          })}
        </div>

        <div className="eventmate-panel rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-300" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Your account is currently protected with role-based access controls.
              </p>
            </div>
            <Link
              to="/profile/customization"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
            >
              Open Avatar Studio
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
