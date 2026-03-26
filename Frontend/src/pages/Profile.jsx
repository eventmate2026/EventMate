import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, ShieldCheck, UploadCloud, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { storeAuth } from "../lib/auth";
import AvatarWithFrame from "../components/AvatarWithFrame";
import useToastFeedback from "../hooks/useToastFeedback";
import { resolveUserDepartment } from "../lib/userDepartment";

const yearOptions = ["1st", "2nd", "3rd", "4th"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MOBILE_NUMBER_REGEX = /^[6-9]\d{9}$/;

const ROLE_LABELS = {
  MAIN_ADMIN: "Main Admin",
  ORGANIZER: "Organizer",
  STUDENT_COORDINATOR: "Student Coordinator",
  STUDENT: "Student",
};

const EDUCATION_LEVELS = ["10th", "12th", "Diploma", "Engineering"];
const DEPARTMENT_OPTIONS = ["COMPUTER", "CIVIL", "MECHANICAL", "ELECTRICAL", "ELECTRONICS", "MINING"];

const normalizeDepartment = (value) => {
  const next = String(value || "").trim();
  if (!next) return "";
  const upper = next.toUpperCase();
  if (DEPARTMENT_OPTIONS.includes(upper)) return upper;
  if (upper.includes("COMPUTER")) return "COMPUTER";
  if (upper.includes("CIVIL")) return "CIVIL";
  if (upper.includes("MECHANICAL")) return "MECHANICAL";
  if (upper.includes("ELECTRICAL") || upper.includes("EEE")) return "ELECTRICAL";
  if (upper.includes("MINING")) return "MINING";
  return "";
};

const sanitizeMobileNumber = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 10);

const emptyForm = {
  fullName: "",
  mobileNumber: "",
  collegeName: "",
  academicBranch: "",
  academicYear: "",
  educationLevel: "",
  professionalDepartment: "",
  professionalOccupation: "",
};

const userToForm = (user) => ({
  fullName: user?.fullName || "",
  mobileNumber: sanitizeMobileNumber(user?.mobileNumber || ""),
  collegeName: user?.collegeName || "",
  academicBranch: normalizeDepartment(user?.academicProfile?.branch),
  academicYear: user?.academicProfile?.year || "",
  educationLevel: user?.educationLevel || "",
  professionalDepartment: normalizeDepartment(user?.professionalProfile?.department),
  professionalOccupation: user?.professionalProfile?.occupation || "",
});

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState({ profile: true, save: false, avatar: false });
  const [message, setMessage] = useState(null);
  const avatarInputRef = useRef(null);

  const role = profile?.role || "";
  const isStudent = role === "STUDENT";
  const isCoordinator = role === "STUDENT_COORDINATOR";
  const isOrganizer = role === "ORGANIZER";
  const isAdmin = role === "MAIN_ADMIN";
  const canEditProfessional = isOrganizer || isAdmin || isCoordinator;
  const profileDepartment = resolveUserDepartment(profile);
  const educationLevel = formData.educationLevel;
  const hideAcademicYear = educationLevel === "10th" || educationLevel === "12th";
  const academicYearOptions =
    educationLevel === "Diploma" ? yearOptions.slice(0, 3) : yearOptions;
  const roleHomePath = {
    MAIN_ADMIN: "/admin-dashboard",
    ORGANIZER: "/organizer-dashboard",
    STUDENT_COORDINATOR: "/coordinator-dashboard",
    STUDENT: "/student-dashboard",
  };

  useToastFeedback(message, {
    successFallback: "Profile updated successfully.",
    errorFallback: "We couldn't update the profile right now.",
  });

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(roleHomePath[role] || "/");
  };

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

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "mobileNumber") {
      setFormData((prev) => ({ ...prev, mobileNumber: sanitizeMobileNumber(value) }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEducationLevelSelect = (level) => {
    setFormData((prev) => {
      let nextYear = prev.academicYear;
      if (level === "10th" || level === "12th") {
        nextYear = "";
      }
      if (level === "Diploma" && nextYear === "4th") {
        nextYear = "";
      }
      return { ...prev, educationLevel: level, academicYear: nextYear };
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setLoading((prev) => ({ ...prev, save: true }));
    setMessage(null);
    try {
      const academicDepartment = normalizeDepartment(formData.academicBranch);
      const professionalDepartment = normalizeDepartment(formData.professionalDepartment);
      const mobileNumber = sanitizeMobileNumber(formData.mobileNumber);

      if (mobileNumber && !MOBILE_NUMBER_REGEX.test(mobileNumber)) {
        setMessage({ type: "error", text: "Mobile number must be a valid 10-digit number." });
        setLoading((prev) => ({ ...prev, save: false }));
        return;
      }

      const payload = {
        fullName: formData.fullName.trim(),
        mobileNumber: mobileNumber || undefined,
        collegeName: formData.collegeName.trim() || undefined,
        educationLevel: formData.educationLevel || undefined,
      };

      if (isStudent) {
        payload.academicProfile = {
          branch: academicDepartment || undefined,
          year: formData.academicYear || undefined,
        };
      }

      if (canEditProfessional) {
        payload.professionalProfile = {
          department: professionalDepartment || undefined,
          occupation: formData.professionalOccupation.trim() || undefined,
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

      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarFile(null);
      setAvatarPreview("");
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
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

  const handleAvatarSelect = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please choose a valid image file." });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setMessage({ type: "error", text: "Image must be 2 MB or smaller." });
      event.target.value = "";
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setMessage(null);
  };

  const clearAvatarSelection = () => {
    setAvatarFile(null);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview("");
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  return (
    <div className="eventmate-page min-h-screen bg-slate-100/80 dark:bg-gray-900 px-3 sm:px-6 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Back
              </button>
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

        <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
          <section className="eventmate-panel rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gray-900/70 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Account</h2>

            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                <AvatarWithFrame
                  src={avatarPreview || profile?.avatar || ""}
                  alt="Avatar"
                  className="h-20 w-20"
                  coreClassName="h-full w-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5"
                  fallback={<UserCircle2 className="h-10 w-10 text-slate-400" />}
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-400/50"
                  aria-label="Change avatar"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{profile?.fullName || "User"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 break-all">{profile?.email || "user@eventmate.com"}</p>
                {profileDepartment ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{profileDepartment}</p>
                ) : null}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ROLE_LABELS[role] || "User"}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <input
                ref={avatarInputRef}
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <span className="truncate">{avatarFile ? avatarFile.name : "No file selected"}</span>
                <button
                  type="button"
                  onClick={clearAvatarSelection}
                  disabled={!avatarFile}
                  className="text-xs font-semibold text-slate-500 hover:text-indigo-600 disabled:opacity-50 dark:text-slate-400 dark:hover:text-indigo-300"
                >
                  Remove
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG, or WebP up to 2 MB.</p>
              <button
                type="button"
                onClick={handleAvatarUpload}
                disabled={loading.avatar || !avatarFile}
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
                      type="tel"
                      inputMode="numeric"
                      pattern="[6-9][0-9]{9}"
                      maxLength={10}
                      autoComplete="tel"
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
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Education Level</span>
                    <div className="mt-1 grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 sm:grid-cols-4">
                      {EDUCATION_LEVELS.map((level) => {
                        const isSelected = formData.educationLevel === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => handleEducationLevelSelect(level)}
                            aria-pressed={isSelected}
                            className={`rounded-xl border px-2 sm:px-3 py-2 text-[10px] min-[360px]:text-[11px] sm:text-xs font-semibold transition ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                            }`}
                          >
                            {level}
                          </button>
                        );
                      })}
                    </div>
                  </label>
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
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</span>
                        <select
                          name="academicBranch"
                          value={formData.academicBranch}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                        >
                          <option value="">Select department</option>
                          {DEPARTMENT_OPTIONS.map((department) => (
                            <option key={department} value={department}>
                              {department}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {!hideAcademicYear && (
                      <label className="block sm:max-w-xs">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Academic Year</span>
                        <select
                          name="academicYear"
                          value={formData.academicYear}
                          onChange={handleChange}
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                        >
                          <option value="">Select year</option>
                          {academicYearOptions.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </>
                )}

                {canEditProfessional && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</span>
                      <select
                        name="professionalDepartment"
                        value={formData.professionalDepartment}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/30"
                      >
                        <option value="">Select department</option>
                        {DEPARTMENT_OPTIONS.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
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
