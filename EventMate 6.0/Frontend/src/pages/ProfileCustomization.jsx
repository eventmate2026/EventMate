import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { storeAuth } from "../lib/auth";
import AvatarWithFrame from "../components/AvatarWithFrame";
import {
  DEFAULT_AVATAR_FRAME,
  getAvatarFrameOptionsForRole,
  isAvatarFrameAllowedForRole,
  normalizeAvatarFrame,
} from "../constants/profileCustomization";

const ROLE_LABELS = {
  MAIN_ADMIN: "Main Admin",
  ORGANIZER: "Organizer",
  STUDENT_COORDINATOR: "Student Coordinator",
  STUDENT: "Student",
};

const ROLE_PROFILE_PATHS = {
  MAIN_ADMIN: "/profile",
  ORGANIZER: "/organizer-dashboard/profile",
  STUDENT_COORDINATOR: "/coordinator-dashboard/profile",
  STUDENT: "/profile",
};

export default function ProfileCustomization() {
  const [profile, setProfile] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(DEFAULT_AVATAR_FRAME);
  const [loading, setLoading] = useState({ profile: true, save: false });
  const [message, setMessage] = useState(null);

  const role = profile?.role || "";
  const profilePath = ROLE_PROFILE_PATHS[role] || "/profile";
  const profileInitial = (profile?.fullName || "U").trim().charAt(0).toUpperCase();
  const availableFrameOptions = useMemo(() => getAvatarFrameOptionsForRole(role), [role]);

  const groupedOptions = useMemo(
    () =>
      availableFrameOptions.reduce((acc, option) => {
        const groupName = option.group || "Other";
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(option);
        return acc;
      }, {}),
    [availableFrameOptions]
  );

  const selectedOption = useMemo(
    () =>
      availableFrameOptions.find((option) => option.value === selectedFrame) ||
      availableFrameOptions[0] || { label: "No Frame", description: "Default avatar look." },
    [availableFrameOptions, selectedFrame]
  );

  const loadProfile = async () => {
    setLoading((prev) => ({ ...prev, profile: true }));
    setMessage(null);
    try {
      const response = await api({ ...SummaryApi.get_profile });
      const user = response.data?.user || null;
      setProfile(user);
      const nextFrame = normalizeAvatarFrame(user?.profilePreferences?.avatarFrame);
      setSelectedFrame(
        isAvatarFrameAllowedForRole(nextFrame, user?.role) ? nextFrame : DEFAULT_AVATAR_FRAME
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to load profile customization.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, profile: false }));
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!isAvatarFrameAllowedForRole(selectedFrame, role)) {
      setSelectedFrame(DEFAULT_AVATAR_FRAME);
    }
  }, [role, selectedFrame]);

  const handleSave = async () => {
    setLoading((prev) => ({ ...prev, save: true }));
    setMessage(null);
    try {
      const response = await api({
        ...SummaryApi.update_profile,
        data: { profilePreferences: { avatarFrame: selectedFrame } },
      });

      const updated = response.data?.user || null;
      if (updated) {
        setProfile(updated);
        setSelectedFrame(normalizeAvatarFrame(updated?.profilePreferences?.avatarFrame));
        storeAuth({ user: updated });
      }

      setMessage({
        type: "success",
        text: response.data?.message || "Profile customization saved.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to save profile customization.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  return (
    <section className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-semibold dark:bg-indigo-500/20 dark:text-indigo-200">
                <Sparkles size={13} />
                Customization Studio
              </span>
              <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Avatar Frame Customization</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Choose from animated and wing-style frames, then apply your selection instantly to your profile.
              </p>
            </div>

            <Link
              to={profilePath}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ArrowLeft size={14} />
              Back to Profile
            </Link>
          </div>
        </div>

        {message && (
          <p
            className={`text-sm rounded-lg py-2 px-3 ${
              message.type === "success"
                ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15"
                : "text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-500/15"
            }`}
          >
            {message.text}
          </p>
        )}

        {loading.profile ? (
          <div className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-8 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            Loading customization options...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <aside className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6 space-y-4">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Live Preview</p>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-6 flex flex-col items-center justify-center gap-4">
                <AvatarWithFrame
                  src={profile?.avatar || ""}
                  alt="Avatar preview"
                  frame={selectedFrame}
                  className="h-28 w-28"
                  coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5"
                  fallback={<span className="text-3xl font-bold text-slate-500 dark:text-slate-300">{profileInitial || "U"}</span>}
                />
                <div className="text-center">
                  <p className="text-base font-semibold text-slate-900 dark:text-white">{profile?.fullName || "User"}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {ROLE_LABELS[role] || "User"} | {selectedOption?.label || "No Frame"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedOption?.label || "No Frame"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedOption?.description || "Default avatar look."}</p>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={loading.save}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                {loading.save ? <Loader2 size={15} className="animate-spin" /> : null}
                {loading.save ? "Saving..." : "Save Frame Selection"}
              </button>
            </aside>

            <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6 space-y-5">
              {Object.entries(groupedOptions).map(([groupName, options]) => (
                <div key={groupName} className="space-y-3">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{groupName}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {options.map((option) => {
                      const active = selectedFrame === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setSelectedFrame(option.value)}
                          className={`rounded-xl border px-3 py-3 text-left transition ${
                            active
                              ? "border-indigo-400 bg-indigo-50/80 dark:border-indigo-400 dark:bg-indigo-500/15"
                              : "border-slate-200 bg-white hover:border-indigo-200 dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-500/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <AvatarWithFrame
                              src={profile?.avatar || ""}
                              alt={`${option.label} preview`}
                              frame={option.value}
                              className="h-10 w-10 shrink-0"
                              coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10"
                              fallback={
                                <span className="text-sm font-semibold text-slate-500 dark:text-slate-300">
                                  {profileInitial || "U"}
                                </span>
                              }
                            />
                            <span>
                              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{option.label}</span>
                              <span className="block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
                              {Array.isArray(option.roles) && option.roles.includes("ORGANIZER") ? (
                                <span className="mt-1 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                                  Organizer Only
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
