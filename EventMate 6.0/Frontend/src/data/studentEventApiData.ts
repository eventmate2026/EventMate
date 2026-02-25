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

export const formatEventDate = (value) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export const deriveEventStatus = (event) => {
  const workflowStatus = String(event?.status || "");
  if (workflowStatus === "Completed" || workflowStatus === "Cancelled") return "completed";

  const startDate = new Date(event?.schedule?.startDate || event?.createdAt || 0);
  const endDate = new Date(event?.schedule?.endDate || event?.schedule?.startDate || event?.createdAt || 0);
  const now = new Date();

  if (!Number.isNaN(endDate.getTime()) && now > endDate) return "completed";
  if (!Number.isNaN(startDate.getTime()) && now >= startDate && now <= endDate) return "current";
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
    registrationOpen: Boolean(event?.registration?.isOpen) && String(event?.status || "") === "Published",
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

  return {
    id: resolveEventId(event),
    title: event?.title || "Untitled Event",
    type: CATEGORY_STYLE[event?.category] || "Workshop",
    audience: participationLabelMap[participationMode] || participationLabelMap.INDIVIDUAL,
    organizerName: event?.organizer?.name || "Organizer",
    coordinators: Array.isArray(event?.studentCoordinators)
      ? event.studentCoordinators.map((item) => ({
          name: item?.name || "Coordinator",
          email: item?.email || "",
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
    registrationOpen: Boolean(event?.registration?.isOpen) && String(event?.status || "") === "Published",
    participationMode,
    maxTeamMembers: Number.isFinite(maxTeamMembers) && maxTeamMembers >= 2 ? Math.floor(maxTeamMembers) : 1,
    minTeamMembers: Number.isFinite(minTeamMembers) && minTeamMembers >= 1 ? Math.floor(minTeamMembers) : 1,
    eventStatus: event?.status || "Published",
    myRegistration: event?.myRegistration || null,
  };
};
