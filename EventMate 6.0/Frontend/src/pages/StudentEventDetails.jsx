import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import api from "../lib/api";
import SummaryApi from "../api/SummaryApi";
import { getStoredUser } from "../lib/auth";
import { formatEventDate, mapApiEventToDetails } from "../data/studentEventApiData";
import { extractEventItem } from "../lib/backendAdapters";
import { fetchRegisteredEventIds } from "../lib/registrationApi";

const registrationTypeLabels = {
  INDIVIDUAL: "Single Participant",
  TEAM: "Team",
};

const createBlankProfile = () => ({
  fullName: "",
  email: "",
  mobileNumber: "",
  collegeName: "",
  branch: "",
  year: "",
});

const createDefaultProfile = (user) => ({
  fullName: user?.fullName || "",
  email: user?.email || "",
  mobileNumber: user?.mobileNumber || "",
  collegeName: user?.collegeName || "",
  branch: user?.academicProfile?.branch || "",
  year: user?.academicProfile?.year || "",
});

const validateProfile = (profile, label) => {
  if (!String(profile.fullName || "").trim()) return `${label} full name is required.`;
  if (!String(profile.email || "").trim()) return `${label} email is required.`;
  if (!String(profile.mobileNumber || "").trim()) return `${label} mobile number is required.`;
  if (!/^[6-9]\d{9}$/.test(String(profile.mobileNumber || "").trim())) return `${label} mobile number must be 10 digits.`;
  if (!String(profile.collegeName || "").trim()) return `${label} college name is required.`;
  if (!String(profile.branch || "").trim()) return `${label} branch is required.`;
  if (!String(profile.year || "").trim()) return `${label} year is required.`;
  return null;
};

const profileToParticipant = (profile) => ({
  name: String(profile?.fullName || "").trim(),
  email: String(profile?.email || "").trim(),
  mobileNumber: String(profile?.mobileNumber || "").trim(),
  college: String(profile?.collegeName || "").trim(),
  branch: String(profile?.branch || "").trim(),
  year: String(profile?.year || "").trim(),
});

export default function StudentEventDetails({ mode = "details" }) {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const isRegistrationMode = mode === "register";
  const normalizedEventId = String(eventId || "").trim();
  const detailsPath = `/student-dashboard/events/${encodeURIComponent(normalizedEventId)}`;
  const registerPath = `${detailsPath}/register`;

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [registrationWarning, setRegistrationWarning] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("about");

  const [registrationType, setRegistrationType] = useState("INDIVIDUAL");
  const [teamName, setTeamName] = useState("");
  const [leaderProfile, setLeaderProfile] = useState(() => createDefaultProfile(user));
  const [teamMembers, setTeamMembers] = useState([]);
  const [declarations, setDeclarations] = useState({
    studentAuthenticity: false,
    certificateAwareness: false,
  });

  useEffect(() => {
    const fetchEventDetails = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      setRegistrationWarning(null);
      try {
        const detailsResponse = await api({
          ...SummaryApi.get_public_event_details,
          url: SummaryApi.get_public_event_details.url.replace(":eventId", eventId),
        });

        const responseEvent = extractEventItem(detailsResponse.data);
        if (!responseEvent) {
          throw new Error("Event not found.");
        }
        const mappedEvent = mapApiEventToDetails(responseEvent);
        setEvent(mappedEvent);
        setActiveDetailTab("about");

        const registrationInfo = await fetchRegisteredEventIds();
        const registeredIds = registrationInfo.ids;
        setRegistrationWarning(registrationInfo.warning);
        setIsRegistered(
          registeredIds.has(String(responseEvent?._id || responseEvent?.id || responseEvent?.eventId || "").trim())
        );

        const participationMode = mappedEvent?.participationMode || "INDIVIDUAL";
        const defaultType = participationMode === "TEAM" ? "TEAM" : "INDIVIDUAL";
        setRegistrationType(defaultType);
        setTeamMembers(defaultType === "TEAM" ? [createBlankProfile()] : []);
        setTeamName("");
        setLeaderProfile(createDefaultProfile(user));
        setDeclarations({
          studentAuthenticity: false,
          certificateAwareness: false,
        });
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load event details.");
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId]);

  const allowedRegistrationTypes = useMemo(() => {
    const participationMode = event?.participationMode || "INDIVIDUAL";
    if (participationMode === "TEAM") return ["TEAM"];
    if (participationMode === "BOTH") return ["INDIVIDUAL", "TEAM"];
    return ["INDIVIDUAL"];
  }, [event?.participationMode]);

  useEffect(() => {
    if (!allowedRegistrationTypes.includes(registrationType)) {
      const next = allowedRegistrationTypes[0] || "INDIVIDUAL";
      setRegistrationType(next);
      setTeamMembers(next === "TEAM" ? [createBlankProfile()] : []);
    }
  }, [allowedRegistrationTypes, registrationType]);

  const isTeamRegistration = registrationType === "TEAM";
  const maxAdditionalMembers = Math.max(Number(event?.maxTeamMembers || 4) - 1, 1);
  const registerCtaLabel = isRegistered
    ? "Registered"
    : event?.registrationOpen
      ? "Register"
      : "Registration Closed";
  const coordinatorList = Array.isArray(event?.coordinators) ? event.coordinators : [];

  const updateLeaderField = (field, value) => {
    setLeaderProfile((prev) => ({ ...prev, [field]: value }));
  };

  const updateMemberField = (index, field, value) => {
    setTeamMembers((prev) =>
      prev.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [field]: value } : member
      )
    );
  };

  const addMember = () => {
    if (teamMembers.length >= maxAdditionalMembers) return;
    setTeamMembers((prev) => [...prev, createBlankProfile()]);
  };

  const removeMember = (index) => {
    setTeamMembers((prev) => prev.filter((_, memberIndex) => memberIndex !== index));
  };

  const validateRegistration = () => {
    const leaderError = validateProfile(leaderProfile, isTeamRegistration ? "Team leader" : "Participant");
    if (leaderError) return leaderError;

    if (isTeamRegistration) {
      if (!String(teamName || "").trim()) return "Team name is required.";
      if (teamMembers.length === 0) return "Add at least one team member.";
      if (teamMembers.length > maxAdditionalMembers) {
        return `Maximum ${maxAdditionalMembers} additional team members are allowed.`;
      }

      for (let index = 0; index < teamMembers.length; index += 1) {
        const memberError = validateProfile(teamMembers[index], `Team member ${index + 1}`);
        if (memberError) return memberError;
      }
    }

    if (!declarations.studentAuthenticity || !declarations.certificateAwareness) {
      return "Please accept all declarations before registration.";
    }
    return null;
  };

  const handleRegister = async () => {
    if (!event || isRegistered || isRegistering || !event.registrationOpen) return;
    const validationError = validateRegistration();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }

    setIsRegistering(true);
    setMessage(null);
    try {
      const response = await api({
        ...SummaryApi.register_for_event,
        url: SummaryApi.register_for_event.url.replace(":eventId", eventId),
        data: {
          teamName: isTeamRegistration ? String(teamName || "").trim() : undefined,
          teamLeader: profileToParticipant(leaderProfile),
          teamMembers: isTeamRegistration ? teamMembers.map(profileToParticipant) : [],
        },
      });

      const headCount =
        Number(response.data?.data?.totalParticipants) ||
        (isTeamRegistration ? teamMembers.length + 1 : 1);

      setMessage({ type: "success", text: response.data?.message || "Registered successfully." });
      setIsRegistered(true);
      setEvent((prev) =>
        prev
          ? { ...prev, participantCount: Number(prev.participantCount || 0) + headCount }
          : prev
      );
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Unable to register for this event." });
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-sm text-gray-600 dark:text-gray-300 inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        Loading event details...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event not found</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">{error || "This event is not available."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f8] py-6 sm:py-8 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate(isRegistrationMode ? detailsPath : "/student-dashboard/events")}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-indigo-300"
        >
          <ArrowLeft size={16} />
          {isRegistrationMode ? "Back to details" : "Back to events"}
        </button>

        <section
          className={
            isRegistrationMode
              ? "mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900"
              : "mt-4"
          }
        >
          {isRegistrationMode && (
            <div className="border-b border-gray-200 bg-indigo-50/80 px-4 py-3 dark:border-white/10 dark:bg-indigo-500/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:border-indigo-500/30 dark:bg-gray-900 dark:text-indigo-300">
                  <BadgeCheck size={12} />
                  Student Event Registration
                </span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-300">
                  Certificates issued after verified attendance
                </span>
              </div>
            </div>
          )}

          {isRegistrationMode && (
            <div className="border-b border-gray-200 px-4 py-4 dark:border-white/10 sm:px-6">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Event Name</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{event.title}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Event Type</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">{event.audience}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Date & Venue</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                    {formatEventDate(event.startDate)} | {event.venue}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={isRegistrationMode ? "px-4 py-5 sm:px-6" : ""}>
            {isRegistrationMode ? (
              <>
                {message && (
                  <p
                    className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                      message.type === "success"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
                    }`}
                  >
                    {message.text}
                  </p>
                )}

                {registrationWarning && (
                  <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200">
                    {registrationWarning}
                  </p>
                )}

                {isRegistered ? (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                    You are already registered for this event.
                  </div>
                ) : (
                  <>
                    {event.participationMode === "BOTH" && (
                      <div className="mb-4 grid grid-cols-2 gap-2">
                        {["INDIVIDUAL", "TEAM"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setRegistrationType(type);
                              setTeamMembers(type === "TEAM" ? [createBlankProfile()] : []);
                            }}
                            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                              registrationType === type
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/20 dark:text-indigo-300"
                                : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                            }`}
                          >
                            {registrationTypeLabels[type]}
                          </button>
                        ))}
                      </div>
                    )}

                    {isTeamRegistration && (
                      <div className="mb-4">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Team Name *</label>
                        <input
                          value={teamName}
                          onChange={(inputEvent) => setTeamName(inputEvent.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input placeholder="Full Name *" value={leaderProfile.fullName} onChange={(eventValue) => updateLeaderField("fullName", eventValue.target.value)} className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
                      <input type="email" placeholder="Email Address *" value={leaderProfile.email} onChange={(eventValue) => updateLeaderField("email", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
                      <input placeholder="Mobile Number *" value={leaderProfile.mobileNumber} onChange={(eventValue) => updateLeaderField("mobileNumber", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
                      <input placeholder="College Name *" value={leaderProfile.collegeName} onChange={(eventValue) => updateLeaderField("collegeName", eventValue.target.value)} className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
                      <input placeholder="Branch *" value={leaderProfile.branch} onChange={(eventValue) => updateLeaderField("branch", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
                      <input placeholder="Year *" value={leaderProfile.year} onChange={(eventValue) => updateLeaderField("year", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
                    </div>

                    {isTeamRegistration && (
                      <div className="mt-5 rounded-xl border border-slate-200 dark:border-white/10 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Team Members</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">Max {maxAdditionalMembers} additional members</p>
                        </div>

                        <div className="mt-3 space-y-3">
                          {teamMembers.map((member, index) => (
                            <div key={`member-${index}`} className="rounded-lg border border-slate-200 dark:border-white/10 p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Member {index + 1}</p>
                                {teamMembers.length > 1 && (
                                  <button type="button" onClick={() => removeMember(index)} className="text-rose-600 dark:text-rose-300">
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input placeholder="Full Name *" value={member.fullName} onChange={(eventValue) => updateMemberField(index, "fullName", eventValue.target.value)} className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100" />
                                <input placeholder="Email Address *" value={member.email} onChange={(eventValue) => updateMemberField(index, "email", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100" />
                                <input placeholder="Mobile Number *" value={member.mobileNumber} onChange={(eventValue) => updateMemberField(index, "mobileNumber", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100" />
                                <input placeholder="College Name *" value={member.collegeName} onChange={(eventValue) => updateMemberField(index, "collegeName", eventValue.target.value)} className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100" />
                                <input placeholder="Branch *" value={member.branch} onChange={(eventValue) => updateMemberField(index, "branch", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100" />
                                <input placeholder="Year *" value={member.year} onChange={(eventValue) => updateMemberField(index, "year", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100" />
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={addMember}
                          disabled={teamMembers.length >= maxAdditionalMembers}
                          className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60"
                        >
                          <Plus size={12} />
                          Add Team Member
                        </button>
                      </div>
                    )}

                    <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      <label className="flex items-start gap-2">
                        <input type="checkbox" checked={declarations.studentAuthenticity} onChange={(eventValue) => setDeclarations((prev) => ({ ...prev, studentAuthenticity: eventValue.target.checked }))} className="mt-0.5 h-4 w-4" />
                        I confirm that the submitted details are genuine.
                      </label>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" checked={declarations.certificateAwareness} onChange={(eventValue) => setDeclarations((prev) => ({ ...prev, certificateAwareness: eventValue.target.checked }))} className="mt-0.5 h-4 w-4" />
                        I understand certificates are issued only after attendance verification.
                      </label>
                    </div>

                    {!event.registrationOpen && (
                      <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        <AlertCircle size={13} />
                        Registration is currently closed for this event.
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={isRegistering || !event.registrationOpen}
                      className="mt-5 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
                    >
                      {isRegistering ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Submitting...</span> : isTeamRegistration ? "Register Team" : "Register"}
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <section className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900">
                  <div className="relative h-56 sm:h-72 lg:h-80">
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute top-3 left-3 inline-flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        {event.type}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        {event.audience}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white">
                      <h2 className="text-2xl sm:text-3xl font-bold">{event.title}</h2>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-white/10">
                    <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/10">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                        <CalendarDays size={13} />
                        Date & Time
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {formatEventDate(event.startDate)} • {event.time}
                      </p>
                    </div>
                    <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/10">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                        <MapPin size={13} />
                        Venue
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{event.venue}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                        <Building2 size={13} />
                        Organized By
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{event.organizerName}</p>
                    </div>
                  </div>
                </section>

                <div className="border-b border-gray-200 dark:border-white/10">
                  <div className="flex items-center gap-6 text-sm">
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("about")}
                      className={`pb-2 border-b-2 transition-colors ${
                        activeDetailTab === "about"
                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-300 dark:border-indigo-300"
                          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      }`}
                    >
                      About
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("contact")}
                      className={`pb-2 border-b-2 transition-colors ${
                        activeDetailTab === "contact"
                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-300 dark:border-indigo-300"
                          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      }`}
                    >
                      Contact
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("mentor")}
                      className={`pb-2 border-b-2 transition-colors ${
                        activeDetailTab === "mentor"
                          ? "border-indigo-600 text-indigo-600 dark:text-indigo-300 dark:border-indigo-300"
                          : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      }`}
                    >
                      Mentor & Judge
                    </button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
                  <div className="space-y-4">
                    {activeDetailTab === "about" && (
                      <>
                        <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-4 sm:p-5">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">About the Event</h3>
                          <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
                            {event.longDescription}
                          </p>
                        </section>

                        <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-4 sm:p-5">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Event Requirements</h3>
                          <div className="mt-3 space-y-3">
                            {Array.isArray(event.requirements) && event.requirements.length > 0 ? (
                              event.requirements.map((item, index) => (
                                <div key={`requirement-${index}`} className="rounded-lg">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white inline-flex items-center gap-2">
                                    <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-300" />
                                    {item.title || "Requirement"}
                                  </p>
                                  <p className="mt-1 ml-6 text-sm text-gray-600 dark:text-gray-300">
                                    {item.description || "Details will be announced soon."}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-gray-600 dark:text-gray-300">No additional requirements are listed for this event.</p>
                            )}
                          </div>
                        </section>
                      </>
                    )}

                    {activeDetailTab === "contact" && (
                      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-4 sm:p-5">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Organizer & Coordinator Contact</h3>

                        <div className="mt-4 grid md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Organizer</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white inline-flex items-center gap-2">
                              <Building2 size={14} className="text-indigo-600 dark:text-indigo-300" />
                              {event.organizerName}
                            </p>
                            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-2 break-all">
                              <Mail size={13} className="text-indigo-600 dark:text-indigo-300 shrink-0" />
                              {event.contact?.email || "Not available"}
                            </p>
                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-2">
                              <Phone size={13} className="text-indigo-600 dark:text-indigo-300 shrink-0" />
                              {event.contact?.phone || "Not available"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Student Coordinators</p>
                            <div className="mt-2 space-y-2">
                              {Array.isArray(event.coordinators) && event.coordinators.length > 0 ? (
                                event.coordinators.map((coordinator, index) => (
                                  <div key={`contact-coordinator-${index}`} className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white inline-flex items-center gap-2">
                                      <UserRound size={13} className="text-indigo-600 dark:text-indigo-300" />
                                      {coordinator.name || "Coordinator"}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-2 break-all">
                                      <Mail size={12} className="text-indigo-600 dark:text-indigo-300 shrink-0" />
                                      {coordinator.email || "Email not available"}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-300">Coordinator details are not available yet.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {activeDetailTab === "mentor" && (
                      <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-4 sm:p-5">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Mentor & Judge</h3>
                        <div className="mt-4 grid md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Mentors</p>
                            <div className="mt-2 space-y-2">
                              {Array.isArray(event.mentors) && event.mentors.length > 0 ? (
                                event.mentors.map((mentor, index) => (
                                  <p key={`mentor-${index}`} className="text-sm text-gray-700 dark:text-gray-200 inline-flex items-center gap-2">
                                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-300" />
                                    {mentor}
                                  </p>
                                ))
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-300">Mentors will be announced soon.</p>
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-gray-200 dark:border-white/10 p-3">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Judges</p>
                            <div className="mt-2 space-y-2">
                              {Array.isArray(event.judges) && event.judges.length > 0 ? (
                                event.judges.map((judge, index) => (
                                  <p key={`judge-${index}`} className="text-sm text-gray-700 dark:text-gray-200 inline-flex items-center gap-2">
                                    <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-300" />
                                    {judge}
                                  </p>
                                ))
                              ) : (
                                <p className="text-sm text-gray-600 dark:text-gray-300">Judges will be announced soon.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-4">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Entry Fee</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{event.isFree ? "Free" : `Rs ${event.price}`}</p>

                      <button
                        type="button"
                        onClick={() => navigate(registerPath)}
                        disabled={isRegistered || !event.registrationOpen}
                        className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
                      >
                        {registerCtaLabel}
                      </button>

                      <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                        By registering, you agree to event rules.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-4">
                      <p className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-start gap-2">
                        <ShieldCheck size={14} className="mt-0.5 text-amber-500 shrink-0" />
                        Security & Process: Attendance is verified via QR scanning. Feedback and certificates are available only after successful participation.
                      </p>
                    </div>

                    {Array.isArray(event.coordinators) && event.coordinators.length > 0 && (
                      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-4">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Coordinator Name & Contact</p>
                        <div className="mt-3 space-y-2">
                          {event.coordinators.map((coordinator, index) => (
                            <div key={`sidebar-coordinator-${index}`} className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{coordinator.name || "Coordinator"}</p>
                              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300 break-all">{coordinator.email || "Email not available"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </aside>
                </div>

                {isRegistered ? (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                    You are already registered for this event.
                  </div>
                ) : null}

                {!event.registrationOpen && !isRegistered && (
                  <p className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    <AlertCircle size={13} />
                    Registration is currently closed for this event.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {isRegistrationMode && (
          <section className="mt-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">About Event</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{event.longDescription}</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
              <p className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300"><CalendarDays size={14} /> {event.time}</p>
              <p className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300"><MapPin size={14} /> {event.venue}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
