import { useEffect, useMemo, useRef, useState } from "react";
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
import { extractEventItem, extractEventList } from "../lib/backendAdapters";
import useToastFeedback from "../hooks/useToastFeedback";
import { fetchMyRegistrations, invalidateMyRegistrationsCache } from "../lib/registrationApi";

const registrationTypeLabels = {
  INDIVIDUAL: "Single Participant",
  TEAM: "Team",
};

const DEPARTMENT_OPTIONS = ["COMPUTER", "CIVIL", "MECHANICAL", "ELECTRICAL", "ELECTRONICS", "MINING"];

const createBlankProfile = (department = "") => ({
  fullName: "",
  email: "",
  mobileNumber: "",
  collegeName: "",
  branch: department || "",
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
  if (!String(profile.branch || "").trim()) return `${label} department is required.`;
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

const normalizeId = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const getEventId = (event) =>
  normalizeId(event?._id || event?.id || event?.eventId);

const getRegistrationList = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.registrations)) return payload.registrations;
  if (Array.isArray(payload?.data?.registrations)) return payload.data.registrations;
  return [];
};

const findEventInPublicList = async (eventId) => {
  const response = await api({ ...SummaryApi.get_public_events, cacheTTL: 90000 });
  const normalizedEventId = normalizeId(eventId);
  return (
    extractEventList(response.data).find(
      (eventItem) => getEventId(eventItem) === normalizedEventId
    ) || null
  );
};

const findEventInMyRegistrations = async (eventId) => {
  const response = await api({ ...SummaryApi.get_my_registered_events, cacheTTL: 90000 });
  const normalizedEventId = normalizeId(eventId);
  const registration = getRegistrationList(response.data).find((item) => {
    const nestedEventId =
      typeof item?.event === "object" && item?.event !== null
        ? getEventId(item.event)
        : "";
    const directEventId = normalizeId(item?.eventId);
    const eventFieldId =
      typeof item?.event === "string" ? normalizeId(item.event) : "";
    return (
      nestedEventId === normalizedEventId ||
      directEventId === normalizedEventId ||
      eventFieldId === normalizedEventId
    );
  });

  if (registration && typeof registration?.event === "object" && registration.event !== null) {
    return registration.event;
  }
  return null;
};

export default function StudentEventDetails({ mode = "details" }) {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const lockedDepartment = String(user?.academicProfile?.branch || "").trim();
  const isRegistrationMode = mode === "register";
  const normalizedEventId = String(eventId || "").trim();
  const detailsPath = `/student-dashboard/events/${encodeURIComponent(normalizedEventId)}`;
  const registerPath = `${detailsPath}/register`;

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [modal, setModal] = useState(null);
  const [pendingRegistrationId, setPendingRegistrationId] = useState("");
  const [pendingTeamRegistrationId, setPendingTeamRegistrationId] = useState("");
  const [registrationWarning, setRegistrationWarning] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [teamRegistrationInfo, setTeamRegistrationInfo] = useState(null);
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
  const [memberLookupErrors, setMemberLookupErrors] = useState({});
  const [memberLookupLoading, setMemberLookupLoading] = useState({});
  const memberLookupCache = useRef(new Map());
  const pendingMemberLookup = useRef({});

  useEffect(() => {
    const fetchEventDetails = async () => {
      setLoading(true);
      setError(null);
      setMessage(null);
      setPendingRegistrationId("");
      setPendingTeamRegistrationId("");
      setRegistrationWarning(null);
      setTeamRegistrationInfo(null);
      try {
        const registrationInfoPromise = fetchMyRegistrations();
        let responseEvent = null;
        let primaryError = null;

        try {
          const detailsResponse = await api({
            ...SummaryApi.get_public_event_details,
            url: SummaryApi.get_public_event_details.url.replace(":eventId", eventId),
            cacheTTL: 90000,
          });
          responseEvent = extractEventItem(detailsResponse.data);
        } catch (detailsError) {
          primaryError = detailsError;
        }

        if (!responseEvent) {
          try {
            responseEvent = await findEventInPublicList(eventId);
          } catch {
            // Intentionally ignored: fallback to registration history next.
          }
        }

        if (!responseEvent) {
          try {
            responseEvent = await findEventInMyRegistrations(eventId);
          } catch {
            // Intentionally ignored: fall through to final error.
          }
        }

        if (!responseEvent) {
          throw primaryError || new Error("Event not found.");
        }
        const mappedEvent = mapApiEventToDetails(responseEvent);
        setEvent(mappedEvent);
        setActiveDetailTab("about");

        const registrationInfo = await registrationInfoPromise;
        const registrationRows = Array.isArray(registrationInfo?.rows) ? registrationInfo.rows : [];
        const registeredIds = new Set(registrationRows.map((row) => row.eventId).filter(Boolean));
        setRegistrationWarning(registrationInfo.warning);
        const eventKey = getEventId(responseEvent);
        setIsRegistered(registeredIds.has(eventKey));
        const matchedRegistration = registrationRows.find(
          (row) => normalizeId(row.eventId) === normalizeId(eventKey)
        );
        setTeamRegistrationInfo(matchedRegistration || null);

        const participationMode = mappedEvent?.participationMode || "INDIVIDUAL";
        const defaultType = participationMode === "TEAM" ? "TEAM" : "INDIVIDUAL";
        const mappedVisibilityScope = String(mappedEvent?.visibilityScope || "COLLEGE").toUpperCase();
        const mappedVisibilityDepartment = String(mappedEvent?.visibilityDepartment || "").trim();
        const isDepartmentVisibility =
          mappedVisibilityScope === "DEPARTMENT" && Boolean(mappedVisibilityDepartment);
        setRegistrationType(defaultType);
        setTeamMembers(
          defaultType === "TEAM"
            ? [createBlankProfile(isDepartmentVisibility ? mappedVisibilityDepartment : "")]
            : []
        );
        setMemberLookupErrors({});
        setMemberLookupLoading({});
        memberLookupCache.current.clear();
        pendingMemberLookup.current = {};
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

  useToastFeedback(message, {
    successFallback: "Registration updated successfully.",
    errorFallback: "We couldn't complete the registration request right now.",
  });
  useToastFeedback(error, {
    defaultType: "error",
    errorFallback: "We couldn't load event details right now.",
  });
  useToastFeedback(registrationWarning, {
    defaultType: "info",
    infoFallback: "Registration status updated.",
  });

  const handleModalClose = () => {
    setModal(null);
  };

  const allowedRegistrationTypes = useMemo(() => {
    const participationMode = event?.participationMode || "INDIVIDUAL";
    if (participationMode === "TEAM") return ["TEAM"];
    if (participationMode === "BOTH") return ["INDIVIDUAL", "TEAM"];
    return ["INDIVIDUAL"];
  }, [event?.participationMode]);

  const eventVisibilityScope = String(event?.visibilityScope || "COLLEGE").toUpperCase();
  const eventVisibilityDepartment = String(event?.visibilityDepartment || "").trim();
  const isDepartmentEvent = eventVisibilityScope === "DEPARTMENT" && Boolean(eventVisibilityDepartment);
  const departmentOptions = useMemo(() => {
    const base = [...DEPARTMENT_OPTIONS];
    if (isDepartmentEvent && eventVisibilityDepartment) {
      const exists = base.some(
        (option) => option.toLowerCase() === eventVisibilityDepartment.toLowerCase()
      );
      if (!exists) return [eventVisibilityDepartment, ...base];
    }
    return base;
  }, [isDepartmentEvent, eventVisibilityDepartment]);

  useEffect(() => {
    if (!lockedDepartment) return;
    setLeaderProfile((prev) =>
      prev.branch === lockedDepartment ? prev : { ...prev, branch: lockedDepartment }
    );
  }, [lockedDepartment]);


  useEffect(() => {
    if (!allowedRegistrationTypes.includes(registrationType)) {
      const next = allowedRegistrationTypes[0] || "INDIVIDUAL";
      setRegistrationType(next);
      setTeamMembers(
        next === "TEAM"
          ? [createBlankProfile(isDepartmentEvent ? eventVisibilityDepartment : "")]
          : []
      );
    }
  }, [allowedRegistrationTypes, registrationType, isDepartmentEvent, eventVisibilityDepartment]);

  const isTeamRegistration = registrationType === "TEAM";
  const maxAdditionalMembers = Math.max(Number(event?.maxTeamMembers || 4) - 1, 1);
  const coordinatorList = Array.isArray(event?.coordinators) ? event.coordinators : [];
  const isCoordinatorAccount = String(user?.role || "").toUpperCase() === "STUDENT_COORDINATOR";
  const normalizedUserId = normalizeId(user?._id || user?.id);
  const normalizedUserEmail = normalizeEmail(user?.email);
  const isAssignedCoordinator = coordinatorList.some((coordinator) => {
    const coordinatorId = normalizeId(coordinator?.id || coordinator?.coordinatorId);
    const coordinatorEmail = normalizeEmail(coordinator?.email);
    return (
      (normalizedUserId && coordinatorId && coordinatorId === normalizedUserId) ||
      (normalizedUserEmail && coordinatorEmail && coordinatorEmail === normalizedUserEmail)
    );
  });
  const isCoordinatorBlocked = isAssignedCoordinator || (isCoordinatorAccount && isTeamRegistration);
  const registerCtaLabel = isRegistered
    ? "Registered"
    : isAssignedCoordinator
      ? "Coordinator Assigned"
      : isCoordinatorAccount && isTeamRegistration
        ? "Coordinator Account"
      : event?.registrationOpen
        ? "Register"
        : "Registration Closed";
  const canRegister = Boolean(event?.registrationOpen) && !isRegistered && !isCoordinatorBlocked;
  const showSidebarRegisterButton = Boolean(event?.registrationOpen || isRegistered || isCoordinatorBlocked);
  const organizerLabel = [event?.organizerName, event?.organizerDepartment].filter(Boolean).join(" • ") || event?.organizerName || "Organizer";
  const coordinatorEmailSet = useMemo(() => {
    const emails = coordinatorList.map((coordinator) => normalizeEmail(coordinator?.email)).filter(Boolean);
    return new Set(emails);
  }, [coordinatorList]);
  const organizerEmail = normalizeEmail(event?.contact?.email);
  const canViewTeamInvites = Boolean(
    teamRegistrationInfo?.isTeamLeader &&
      teamRegistrationInfo?.status === "PendingMemberVerification" &&
      teamRegistrationInfo?.id
  );

  useEffect(() => {
    if (!normalizedUserEmail) return;
    setLeaderProfile((prev) =>
      normalizeEmail(prev.email) === normalizedUserEmail
        ? prev
        : { ...prev, email: user?.email || "" }
    );
  }, [normalizedUserEmail, user?.email]);

  useEffect(() => {
    if (!isDepartmentEvent) return;
    setTeamMembers((prev) =>
      prev.map((member) =>
        member.branch === eventVisibilityDepartment
          ? member
          : { ...member, branch: eventVisibilityDepartment }
      )
    );
  }, [isDepartmentEvent, eventVisibilityDepartment]);

  const updateLeaderField = (field, value) => {
    if (field === "branch" || field === "email") return;
    setLeaderProfile((prev) => ({ ...prev, [field]: value }));
  };

  const updateMemberField = (index, field, value) => {
    setTeamMembers((prev) =>
      prev.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [field]: value } : member
      )
    );
  };

  const applyMemberProfile = (index, profile) => {
    if (!profile) return;
    setTeamMembers((prev) =>
      prev.map((member, memberIndex) => {
        if (memberIndex !== index) return member;
        return {
          ...member,
          fullName: profile.fullName || member.fullName,
          email: profile.email || member.email,
          mobileNumber: profile.mobileNumber || member.mobileNumber,
          collegeName: profile.collegeName || member.collegeName,
          branch: profile.branch || member.branch,
          year: profile.year || member.year,
        };
      })
    );
  };

  const handleMemberEmailChange = (index, value) => {
    updateMemberField(index, "email", value);
    setMemberLookupErrors((prev) => ({ ...prev, [index]: "" }));
    setMemberLookupLoading((prev) => ({ ...prev, [index]: false }));
  };

  const lookupMemberProfile = async (index, emailValue) => {
    const rawEmail = String(emailValue || "").trim();
    if (!rawEmail) return;
    const normalized = normalizeEmail(rawEmail);

    pendingMemberLookup.current[index] = normalized;
    setMemberLookupErrors((prev) => ({ ...prev, [index]: "" }));

    if (memberLookupCache.current.has(normalized)) {
      const cached = memberLookupCache.current.get(normalized);
      if (pendingMemberLookup.current[index] === normalized && cached) {
        applyMemberProfile(index, cached);
      }
      return;
    }

    setMemberLookupLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const response = await api({
        ...SummaryApi.lookup_team_member_profile,
        url: SummaryApi.lookup_team_member_profile.url.replace(
          ":eventId",
          encodeURIComponent(eventId || "")
        ),
        params: { email: rawEmail },
      });
      if (pendingMemberLookup.current[index] !== normalized) return;
      const payload = response.data?.data;
      setMemberLookupLoading((prev) => ({ ...prev, [index]: false }));

      if (payload?.exists && payload?.profile) {
        memberLookupCache.current.set(normalized, payload.profile);
        applyMemberProfile(index, payload.profile);
      } else {
        memberLookupCache.current.set(normalized, null);
      }
    } catch (lookupError) {
      if (pendingMemberLookup.current[index] !== normalized) return;
      setMemberLookupLoading((prev) => ({ ...prev, [index]: false }));
      setMemberLookupErrors((prev) => ({
        ...prev,
        [index]:
          lookupError.response?.data?.message ||
          "Unable to fetch saved profile for this email.",
      }));
    }
  };

  const addMember = () => {
    if (teamMembers.length >= maxAdditionalMembers) return;
    setTeamMembers((prev) => [
      ...prev,
      createBlankProfile(isDepartmentEvent ? eventVisibilityDepartment : "")
    ]);
  };

  const removeMember = (index) => {
    setTeamMembers((prev) => prev.filter((_, memberIndex) => memberIndex !== index));
  };

  const validateRegistration = () => {
    const leaderError = validateProfile(leaderProfile, isTeamRegistration ? "Team leader" : "Participant");
    if (leaderError) return leaderError;
    if (!normalizedUserEmail) return "Your account email is missing. Please log in again.";
    if (normalizeEmail(leaderProfile.email) !== normalizedUserEmail) {
      return "Please use your account email for registration.";
    }

    if (isTeamRegistration) {
      const leaderEmail = normalizeEmail(leaderProfile.email);
      if (organizerEmail && leaderEmail && leaderEmail === organizerEmail) {
        return "Organizer email cannot be used as a team leader.";
      }
      if (coordinatorEmailSet.size > 0) {
        if (leaderEmail && coordinatorEmailSet.has(leaderEmail)) {
          return "Assigned coordinators cannot be added as team leaders.";
        }
      }
      if (isDepartmentEvent) {
        const leaderDepartment = String(leaderProfile.branch || "").trim();
        if (!leaderDepartment || leaderDepartment.toLowerCase() !== eventVisibilityDepartment.toLowerCase()) {
          return `Team leader must belong to the ${eventVisibilityDepartment} department.`;
        }
      }
      if (!String(teamName || "").trim()) return "Team name is required.";
      if (teamMembers.length === 0) return "Add at least one team member.";
      if (teamMembers.length > maxAdditionalMembers) {
        return `Maximum ${maxAdditionalMembers} additional team members are allowed.`;
      }

      for (let index = 0; index < teamMembers.length; index += 1) {
        const memberEmail = normalizeEmail(teamMembers[index]?.email);
        if (organizerEmail && memberEmail && memberEmail === organizerEmail) {
          return `Team member ${index + 1} cannot use the organizer email.`;
        }
        if (coordinatorEmailSet.size > 0) {
          if (memberEmail && coordinatorEmailSet.has(memberEmail)) {
            return `Team member ${index + 1} cannot be an assigned coordinator for this event.`;
          }
        }
        const memberError = validateProfile(teamMembers[index], `Team member ${index + 1}`);
        if (memberError) return memberError;
        if (isDepartmentEvent) {
          const memberDepartment = String(teamMembers[index]?.branch || "").trim();
          if (!memberDepartment || memberDepartment.toLowerCase() !== eventVisibilityDepartment.toLowerCase()) {
            return `Team member ${index + 1} must belong to the ${eventVisibilityDepartment} department.`;
          }
        }
      }
    }

    if (!declarations.studentAuthenticity || !declarations.certificateAwareness) {
      return "Please accept all declarations before registration.";
    }
    return null;
  };

  const handleRegister = async () => {
    if (!event || isRegistered || isRegistering) return;
    if (isCoordinatorBlocked) {
      const payload = {
        type: "error",
        text: isAssignedCoordinator
          ? "You are assigned as a coordinator for this event. Coordinators cannot register."
          : "Coordinator accounts cannot register for team events.",
      };
      setMessage(payload);
      return;
    }
    if (!event.registrationOpen) return;
    const validationError = validateRegistration();
    if (validationError) {
      const payload = { type: "error", text: validationError };
      setMessage(payload);
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
          teamLeader: profileToParticipant({
            ...leaderProfile,
            email: user?.email || leaderProfile.email,
            branch: lockedDepartment || leaderProfile.branch,
          }),
          teamMembers: isTeamRegistration ? teamMembers.map(profileToParticipant) : [],
        },
      });

      const headCount =
        Number(response.data?.data?.totalParticipants) ||
        (isTeamRegistration ? teamMembers.length + 1 : 1);

      const registrationStatus = String(response.data?.data?.status || "").trim();
      const qrReadyNow = registrationStatus === "Confirmed";
      const popupPayload = {
        type: "success",
        text: qrReadyNow
          ? "Registered successfully. Your QR pass is now available in My Events."
          : isTeamRegistration
            ? "Team registration created. Invitations go to members with accounts; others will get an invite after signup and login. Track accept/reject status and registration will auto-confirm once everyone accepts."
            : "Registered successfully. Your QR pass will appear in My Events once registration is confirmed.",
      };
      setMessage(popupPayload);
      setModal(popupPayload);
      invalidateMyRegistrationsCache();
      setIsRegistered(true);
      setEvent((prev) =>
        prev
          ? { ...prev, participantCount: Number(prev.participantCount || 0) + headCount }
          : prev
      );

      const registrationId = response.data?.data?._id || response.data?.data?.id;
      if (registrationId) {
        if (isTeamRegistration) {
          setPendingTeamRegistrationId(String(registrationId));
        } else {
          setPendingRegistrationId(String(registrationId));
        }
      }
    } catch (err) {
      const payload = {
        type: "error",
        text: err.response?.data?.message || "Unable to register for this event.",
      };
      setMessage(payload);
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-10 text-sm text-gray-600 dark:text-gray-300 inline-flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        Loading event details...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Event not found</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">This event is not available right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f8] py-6 sm:py-8 dark:bg-gray-900">
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-center text-white shadow-2xl">
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-1 ${
                modal.type === "success"
                  ? "bg-emerald-500/15 text-emerald-400 ring-emerald-400/40"
                  : "bg-rose-500/15 text-rose-300 ring-rose-400/40"
              }`}
            >
              {modal.type === "success" ? <CheckCircle2 size={30} /> : <AlertCircle size={30} />}
            </div>
            <h2 className="mt-4 text-xl font-semibold">
              {modal.type === "success" ? "Thank You!" : "Unable to Register"}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{modal.text}</p>
            <button
              type="button"
              onClick={handleModalClose}
              className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition ${
                modal.type === "success"
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-rose-500 hover:bg-rose-600"
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
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
                {message?.type === "success" && (
                  <div className="mb-4 flex flex-wrap gap-3">
                    {pendingTeamRegistrationId && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/student-dashboard/team-registration/${encodeURIComponent(
                              pendingTeamRegistrationId
                            )}`
                          )
                        }
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        View Team Invitations
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate("/student-dashboard/my-events")}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                    >
                      Open My Events
                    </button>
                  </div>
                )}

                {isCoordinatorBlocked ? (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 p-4 text-sm text-amber-700 dark:text-amber-300">
                    {isAssignedCoordinator
                      ? "You are assigned as a coordinator for this event. Coordinators cannot register."
                      : "Coordinator accounts cannot register for team events."}
                  </div>
                ) : isRegistered ? (
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
                      <input type="email" placeholder="Email Address *" value={leaderProfile.email} readOnly className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200" />
                      <input placeholder="Mobile Number *" value={leaderProfile.mobileNumber} onChange={(eventValue) => updateLeaderField("mobileNumber", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
                      <input placeholder="College Name *" value={leaderProfile.collegeName} onChange={(eventValue) => updateLeaderField("collegeName", eventValue.target.value)} className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100" />
                      <input
                        placeholder="Department *"
                        value={leaderProfile.branch}
                        readOnly
                        className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 cursor-not-allowed"
                      />
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
                                <div className="space-y-1">
                                  <input
                                    placeholder="Email Address *"
                                    value={member.email}
                                    onChange={(eventValue) => handleMemberEmailChange(index, eventValue.target.value)}
                                    onBlur={() => lookupMemberProfile(index, member.email)}
                                    className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                                  />
                                  {memberLookupLoading[index] && (
                                    <p className="text-[10px] text-slate-400">
                                      Checking saved profile...
                                    </p>
                                  )}
                                  {!memberLookupLoading[index] && memberLookupErrors[index] && (
                                    <p className="text-[10px] text-rose-600 dark:text-rose-300">
                                      {memberLookupErrors[index]}
                                    </p>
                                  )}
                                </div>
                                <input placeholder="Mobile Number *" value={member.mobileNumber} onChange={(eventValue) => updateMemberField(index, "mobileNumber", eventValue.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100" />
                                <input placeholder="College Name *" value={member.collegeName} onChange={(eventValue) => updateMemberField(index, "collegeName", eventValue.target.value)} className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100" />
                                {isDepartmentEvent ? (
                                  <input
                                    value={eventVisibilityDepartment}
                                    readOnly
                                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 cursor-not-allowed"
                                  />
                                ) : (
                                  <select
                                    value={member.branch}
                                    onChange={(eventValue) => updateMemberField(index, "branch", eventValue.target.value)}
                                    className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                                  >
                                    <option value="">Select department</option>
                                    {departmentOptions.map((department) => (
                                      <option key={department} value={department}>
                                        {department}
                                      </option>
                                    ))}
                                  </select>
                                )}
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

                    {event.registrationOpen && (
                      <button
                        type="button"
                        onClick={handleRegister}
                        disabled={isRegistering || !canRegister}
                        className="mt-5 w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
                      >
                        {isRegistering ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Submitting...</span> : isTeamRegistration ? "Register Team" : "Register"}
                      </button>
                    )}
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
                      <h2 className="text-xl min-[340px]:text-2xl sm:text-3xl font-bold">{event.title}</h2>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-white/10">
                    <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/10">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                        <CalendarDays size={13} />
                        Date & Time
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white break-words">
                        {formatEventDate(event.startDate)} • {event.time}
                      </p>
                    </div>
                    <div className="px-4 py-3 border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/10">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                        <MapPin size={13} />
                        Venue
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white break-words">{event.venue}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                        <Building2 size={13} />
                        Organized By
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white break-words">{organizerLabel}</p>
                    </div>
                  </div>
                </section>

                <div className="border-b border-gray-200 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm">
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

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
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
                            {event.organizerDepartment ? (
                              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{event.organizerDepartment}</p>
                            ) : null}
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
                                    {coordinator.department ? (
                                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                                        {coordinator.department}
                                      </p>
                                    ) : null}
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

                      {showSidebarRegisterButton && (
                        <button
                          type="button"
                          onClick={() => navigate(registerPath)}
                          disabled={isRegistered || isCoordinatorBlocked || !event.registrationOpen}
                          className="mt-4 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
                        >
                          {registerCtaLabel}
                        </button>
                      )}

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
                              {coordinator.department ? (
                                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{coordinator.department}</p>
                              ) : null}
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

                {canViewTeamInvites ? (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/student-dashboard/team-registration/${encodeURIComponent(
                          teamRegistrationInfo.id
                        )}`
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    View Team Invitations
                  </button>
                ) : null}

                {isCoordinatorBlocked ? (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 p-4 text-sm text-amber-700 dark:text-amber-300">
                    {isAssignedCoordinator
                      ? "You are assigned as a coordinator for this event. Registration is disabled."
                      : "Coordinator accounts cannot register for team events."}
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
