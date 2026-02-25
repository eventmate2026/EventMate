import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, UploadCloud, UserCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { storeAuth } from "../lib/auth";
import AvatarWithFrame from "../components/AvatarWithFrame";
import { normalizeAvatarFrame } from "../constants/profileCustomization";

const yearOptions = ["1st", "2nd", "3rd", "4th"];

const ROLE_LABELS = {
  MAIN_ADMIN: "Main Admin",
  ORGANIZER: "Organizer",
  STUDENT_COORDINATOR: "Student Coordinator",
  STUDENT: "Student",
};

const PROFILE_CUSTOMIZATION_PATH = "/profile/customization";

const COORDINATOR_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "SUSPENDED", label: "Suspended" },
];

const emptyForm = {
  fullName: "",
  mobileNumber: "",
  collegeName: "",
  academicBranch: "",
  academicYear: "",
  professionalDepartment: "",
  professionalOccupation: "",
  coordinatorAssignedEventId: "",
  coordinatorScope: "",
  coordinatorStatus: "ACTIVE",
};

const userToForm = (user) => ({
  fullName: user?.fullName || "",
  mobileNumber: user?.mobileNumber || "",
  collegeName: user?.collegeName || "",
  academicBranch: user?.academicProfile?.branch || "",
  academicYear: user?.academicProfile?.year || "",
  professionalDepartment: user?.professionalProfile?.department || "",
  professionalOccupation: user?.professionalProfile?.occupation || "",
  coordinatorAssignedEventId: user?.coordinatorProfile?.assignedEventId || "",
  coordinatorScope: user?.coordinatorProfile?.scope || "",
  coordinatorStatus: user?.coordinatorProfile?.status || "ACTIVE",
});

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState({ profile: true, save: false, avatar: false });
  const [message, setMessage] = useState(null);

  const role = profile?.role || "";
  const isStudent = role === "STUDENT";
  const isCoordinator = role === "STUDENT_COORDINATOR";
  const isOrganizer = role === "ORGANIZER";
  const isAdmin = role === "MAIN_ADMIN";
  const canEditProfessional = isOrganizer || isAdmin || isCoordinator;
  const selectedAvatarFrame = normalizeAvatarFrame(profile?.profilePreferences?.avatarFrame);

  const roleBadgeClass = useMemo(() => {
    if (isAdmin) return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200";
    if (isOrganizer) return "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200";
    if (isCoordinator) return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200";
  }, [isAdmin, isCoordinator, isOrganizer]);

  const loadProfile = async () => {
    setLoading((prev) => ({ ...prev, profile: true }));
    setMessage(null);
    try {
      const response = await api({ ...SummaryApi.get_profile });
      const user = response.data?.user || null;
      setProfile(user);
      setFormData(userToForm(user));
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to load profile.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, profile: false }));
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setLoading((prev) => ({ ...prev, save: true }));
    setMessage(null);
    try {
      const payload = {
        fullName: formData.fullName.trim(),
        mobileNumber: formData.mobileNumber.trim() || undefined,
        collegeName: formData.collegeName.trim() || undefined,
      };

      if (isStudent) {
        payload.academicProfile = {
          branch: formData.academicBranch.trim() || undefined,
          year: formData.academicYear || undefined,
        };
      }

      if (canEditProfessional) {
        payload.professionalProfile = {
          department: formData.professionalDepartment.trim() || undefined,
          occupation: formData.professionalOccupation.trim() || undefined,
        };
      }

      if (isCoordinator) {
        payload.coordinatorProfile = {
          assignedEventId: formData.coordinatorAssignedEventId.trim() || undefined,
          scope: formData.coordinatorScope.trim() || undefined,
          status: formData.coordinatorStatus || undefined,
        };
      }

      const response = await api({ ...SummaryApi.update_profile, data: payload });
      const updated = response.data?.user;
      if (updated) {
        setProfile(updated);
        setFormData(userToForm(updated));
        storeAuth({ user: updated });
      }

      setMessage({ type: "success", text: response.data?.message || "Profile updated successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to update profile.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setMessage({ type: "error", text: "Please select an image first." });
      return;
    }

    setLoading((prev) => ({ ...prev, avatar: true }));
    setMessage(null);
    try {
      const form = new FormData();
      form.append("avatar", avatarFile);

      const response = await api({
        ...SummaryApi.upload_avatar,
        data: form,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newAvatar = response.data?.avatar;
      if (newAvatar) {
        const nextProfile = { ...profile, avatar: newAvatar };
        setProfile(nextProfile);
        storeAuth({ user: nextProfile });
      }

      setAvatarFile(null);
      setMessage({ type: "success", text: response.data?.message || "Avatar updated successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error.response?.data?.message || "Unable to upload avatar.",
      });
    } finally {
      setLoading((prev) => ({ ...prev, avatar: false }));
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                Manage your account details, role-specific profile info, and avatar.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClass}`}>
              <ShieldCheck size={13} />
              {ROLE_LABELS[role] || "User"}
            </div>
          </div>
        </section>

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

        <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account</h2>

            <div className="mt-4 flex items-center gap-4">
              <AvatarWithFrame
                src={profile?.avatar || ""}
                alt="Avatar"
                frame={selectedAvatarFrame}
                className="h-20 w-20 shrink-0"
                coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5"
                fallback={<UserCircle2 className="h-10 w-10 text-slate-400" />}
              />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{profile?.fullName || "User"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{profile?.email || "user@eventmate.com"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ROLE_LABELS[role] || "User"}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                className="w-full text-sm text-slate-600 dark:text-slate-300"
              />
              <button
                type="button"
                onClick={handleAvatarUpload}
                disabled={loading.avatar}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70"
              >
                {loading.avatar ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {loading.avatar ? "Uploading..." : "Upload Avatar"}
              </button>
            </div>
          </section>

          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Profile Details</h2>

            {loading.profile ? (
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Loading profile...
              </p>
            ) : (
              <form className="mt-5 space-y-5" onSubmit={handleSave}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</span>
                    <input
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mobile Number</span>
                    <input
                      name="mobileNumber"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                      placeholder="10-digit number"
                    />
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
                    <input
                      value={profile?.email || ""}
                      readOnly
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-600 dark:text-slate-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Role</span>
                    <input
                      value={ROLE_LABELS[role] || "User"}
                      readOnly
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-600 dark:text-slate-300"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 p-4">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Profile Customization Studio</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Open the dedicated page to explore wing frames and animated avatar borders.
                  </p>
                  <div className="mt-4">
                    <Link
                      to={PROFILE_CUSTOMIZATION_PATH}
                      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Open Customization Studio
                    </Link>
                  </div>
                </div>

                {isStudent && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">College Name</span>
                        <input
                          name="collegeName"
                          value={formData.collegeName}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Academic Branch</span>
                        <input
                          name="academicBranch"
                          value={formData.academicBranch}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                        />
                      </label>
                    </div>
                    <label className="block sm:max-w-xs">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Academic Year</span>
                      <select
                        name="academicYear"
                        value={formData.academicYear}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                      >
                        <option value="">Select year</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                {canEditProfessional && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</span>
                      <input
                        name="professionalDepartment"
                        value={formData.professionalDepartment}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Occupation</span>
                      <input
                        name="professionalOccupation"
                        value={formData.professionalOccupation}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                      />
                    </label>
                  </div>
                )}

                {isCoordinator && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Assigned Event ID</span>
                        <input
                          name="coordinatorAssignedEventId"
                          value={formData.coordinatorAssignedEventId}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Scope</span>
                        <input
                          name="coordinatorScope"
                          value={formData.coordinatorScope}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                        />
                      </label>
                    </div>
                    <label className="block sm:max-w-xs">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Coordinator Status</span>
                      <select
                        name="coordinatorStatus"
                        value={formData.coordinatorStatus}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                      >
                        {COORDINATOR_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading.save}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700 disabled:opacity-70"
                >
                  {loading.save ? <Loader2 size={16} className="animate-spin" /> : null}
                  {loading.save ? "Saving..." : "Save Changes"}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}


