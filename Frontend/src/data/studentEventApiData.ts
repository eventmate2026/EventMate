import { resolveUserDepartment } from "../lib/userDepartment";

const DEFAULT_EVENT_BANNER =
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80";

const CATEGORY_STYLE = {
  Technical: "Technical",
  Cultural: "Cultural",
  Sports: "Sports",
  Workshop: "Workshop",
};

const participationLabelMap = {
  INDIVIDUAL: "Individual Event",
  TEAM: "Team Event",
};

const resolveEventId = (event) =>
  String(event?._id || event?.id || event?.eventId || "")
    .trim();

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const text = String(value || "").trim();
  if (!text) return null;

  const dateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toLocalDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const formatEventDate = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return "Date TBD";
  return parsed.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export const deriveEventStatus = (event) => {
  const workflowStatus = String(event?.status || "");
  if (workflowStatus === "Completed" || workflowStatus === "Cancelled") return "completed";

  const startDate = toLocalDate(event?.schedule?.startDate || event?.createdAt || 0);
  const endDate = toLocalDate(event?.schedule?.endDate || event?.schedule?.startDate || event?.createdAt || 0);
  const now = toLocalDate(new Date());

  if (endDate && now && now > endDate) return "completed";
  if (startDate && endDate && now && now >= startDate && now <= endDate) return "current";
  return "upcoming";
};

const formatTimeRange = (schedule) => {
  const startTime = String(schedule?.startTime || "").trim();
  const endTime = String(schedule?.endTime || "").trim();
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return startTime;
  if (endTime) return endTime;
  return "Time TBD";
};

const resolveRegistrationDeadline = (value) => {
  if (!value) return null;
  const text = String(value || "").trim();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const hasTime = /\d{2}:\d{2}/.test(text);
  if (!hasTime) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
};

const resolveRegistrationOpen = (event) => {
  const isPublished = String(event?.status || "") === "Published";
  if (!isPublished) return false;
  if (!event?.registration?.isOpen) return false;
  const deadline = resolveRegistrationDeadline(event?.registration?.lastDate);
  if (!deadline) return true;
  return Date.now() <= deadline.getTime();
};

const fallbackRequirements = (event) => {
  const maxParticipants = Number(event?.registration?.maxParticipants || 0);
  const participationMode = event?.isTeamEvent ? "TEAM" : "INDIVIDUAL";
  const minTeamSize = Number(event?.minTeamSize || 1);
  const maxTeamMembers = Number(event?.maxTeamSize || 1);
  const requirements = [];

  requirements.push({
    title: "Participation",
    description: participationLabelMap[participationMode] || participationLabelMap.INDIVIDUAL,
  });

  if (participationMode !== "INDIVIDUAL" && Number.isFinite(maxTeamMembers) && maxTeamMembers > 1) {
    requirements.push({
      title: "Team Limit",
      description: `Team size must be between ${Math.max(minTeamSize, 1)} and ${maxTeamMembers}.`,
    });
  }

  if (maxParticipants > 0) {
    requirements.push({
      title: "Registration Capacity",
      description: `Maximum ${maxParticipants} participants are allowed.`,
    });
  }

  requirements.push({
    title: "Tools & Equipment",
    description: "Participants should bring personal laptops and chargers unless otherwise notified.",
  });

  return requirements;
};

export const mapApiEventToCard = (event, { registeredIds = new Set() } = {}) => {
  const id = resolveEventId(event);
  const fee = Number(event?.registration?.fee || 0);
  const participationMode = event?.isTeamEvent ? "TEAM" : "INDIVIDUAL";

  return {
    id,
    title: event?.title || "Untitled Event",
    description: event?.description || "Event details will be announced soon.",
    date: formatEventDate(event?.schedule?.startDate || event?.createdAt),
    time: formatTimeRange(event?.schedule),
    dept: event?.organizer?.department || "Campus Department",
    type: CATEGORY_STYLE[event?.category] || "Workshop",
    venue: event?.venue?.location || "Venue TBD",
    price: fee,
    isFree: fee <= 0,
    imageUrl: event?.posterUrl || DEFAULT_EVENT_BANNER,
    status: deriveEventStatus(event),
    startDate: event?.schedule?.startDate || event?.createdAt,
    participantCount: Number(event?.participantCount || 0),
    isRegistered: registeredIds.has(id),
    registrationOpen: resolveRegistrationOpen(event),
    participationMode: participationMode,
    participationLabel: participationLabelMap[participationMode] || participationLabelMap.INDIVIDUAL,
    eventStatus: event?.status || "Published",
  };
};

export const mapApiEventToDetails = (event) => {
  if (!event) return null;
  const fee = Number(event?.registration?.fee || 0);
  const participationMode = event?.isTeamEvent ? "TEAM" : "INDIVIDUAL";
  const maxTeamMembers = Number(event?.maxTeamSize || 1);
  const minTeamMembers = Number(event?.minTeamSize || 1);
  const organizerDepartment = resolveUserDepartment(event?.organizer);
  const visibilityScope = String(event?.visibility?.scope || "COLLEGE").toUpperCase();
  const visibilityDepartment = String(event?.visibility?.department || "").trim();

  return {
    id: resolveEventId(event),
    title: event?.title || "Untitled Event",
    type: CATEGORY_STYLE[event?.category] || "Workshop",
    audience: participationLabelMap[participationMode] || participationLabelMap.INDIVIDUAL,
    organizerName: event?.organizer?.name || "Organizer",
    organizerDepartment,
    coordinators: Array.isArray(event?.studentCoordinators)
      ? event.studentCoordinators.map((item) => ({
          id: String(item?.coordinatorId || item?._id || item?.id || "").trim(),
          name: item?.name || "Coordinator",
          email: item?.email || "",
          department: resolveUserDepartment(item),
        }))
      : [],
    contact: {
      email: event?.organizer?.contactEmail || "support@eventmate.com",
      phone: event?.organizer?.contactPhone || "Not available",
    },
    imageUrl: event?.posterUrl || DEFAULT_EVENT_BANNER,
    description: event?.description || "No description available.",
    longDescription: event?.description || "No description available.",
    requirements: fallbackRequirements(event),
    mentors: [],
    judges: [],
    venue: event?.venue?.location || "Venue TBD",
    time: formatTimeRange(event?.schedule),
    startDate: event?.schedule?.startDate || event?.createdAt,
    status: deriveEventStatus(event),
    isFree: fee <= 0,
    price: fee,
    participantCount: Number(event?.participantCount || 0),
    registrationOpen: resolveRegistrationOpen(event),
    participationMode,
    maxTeamMembers: Number.isFinite(maxTeamMembers) && maxTeamMembers >= 2 ? Math.floor(maxTeamMembers) : 1,
    minTeamMembers: Number.isFinite(minTeamMembers) && minTeamMembers >= 1 ? Math.floor(minTeamMembers) : 1,
    visibilityScope,
    visibilityDepartment,
    eventStatus: event?.status || "Published",
    myRegistration: event?.myRegistration || null,
  };
};
