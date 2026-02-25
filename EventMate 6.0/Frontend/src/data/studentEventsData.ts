const fallbackImages = {
  Technical: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format",
  Cultural: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format",
  Sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format",
  Workshop: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format",
};

export const STUDENT_DASHBOARD_EVENTS = [
  {
    id: "EVT-TECH-101",
    title: "AI Innovation Sprint",
    description: "Build AI-first solutions for real campus problems in a rapid innovation challenge.",
    audience: "Team Event",
    category: "Technical",
    startDate: "2026-03-12",
    endDate: "2026-03-12",
    time: "09:30 AM",
    department: "Computer Science",
    venue: "Innovation Lab",
    registrationFee: 150,
    organizerName: "Computer Science Dept.",
    studentCoordinators: [
      { name: "Anjali Patil", email: "anjali.patil@eventmate.com" },
      { name: "Rohit Kale", email: "rohit.kale@eventmate.com" },
    ],
    contact: {
      email: "ai-sprint@eventmate.com",
      phone: "+91 90000 11001",
    },
    mentors: ["Dr. N. Iyer", "Ms. Pooja Shah"],
    judges: ["Mr. Ravi Nair", "Ms. Sneha Mehta"],
    requirements: [
      { title: "Team Size", description: "Minimum 2 members and maximum 4 members per team." },
      { title: "Tools and Equipment", description: "Bring your own laptop and charger. Wi-Fi is provided." },
    ],
    longDescription:
      "Join us for the biggest inter-college AI build challenge where teams solve practical campus and social problems. You will ideate, prototype, and pitch to a panel of mentors and judges.",
    imageUrl: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&auto=format",
    participants: [
      { userId: "st-001", name: "Student", email: "student@college.com" },
      { userId: "st-102", name: "Rahul Mehta", email: "rahul.mehta@college.com" },
    ],
  },
  {
    id: "EVT-CUL-102",
    title: "Campus Cultural Night",
    description: "Celebrate music, dance, and performances from every department in one evening.",
    audience: "Open Event",
    category: "Cultural",
    startDate: "2026-03-21",
    endDate: "2026-03-21",
    time: "06:00 PM",
    department: "Fine Arts Council",
    venue: "Main Amphitheatre",
    registrationFee: 0,
    organizerName: "Fine Arts Council",
    studentCoordinators: [
      { name: "Neha Jadhav", email: "neha.jadhav@eventmate.com" },
    ],
    contact: {
      email: "culture-night@eventmate.com",
      phone: "+91 90000 11002",
    },
    mentors: ["Prof. A. Kulkarni"],
    judges: ["Ms. Rhea Kapoor", "Mr. Aman Joseph"],
    requirements: [
      { title: "Performance Slot", description: "Each act gets 8 to 10 minutes on stage." },
      { title: "Audio Submission", description: "Submit tracks and cues before 5 PM on event day." },
    ],
    longDescription:
      "Campus Cultural Night brings performances, music, dance, and theatre under one stage. Participate solo or as a group and represent your department with your best act.",
    imageUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&w=1200&q=80",
    participants: [
      { userId: "st-103", name: "Aman Verma", email: "aman.verma@college.com" },
      { userId: "st-104", name: "Nisha Arora", email: "nisha.arora@college.com" },
    ],
  },
  {
    id: "EVT-SPO-103",
    title: "Inter-Department Football Cup",
    description: "Compete with top campus teams in a high-energy football tournament.",
    audience: "Team Event",
    category: "Sports",
    startDate: "2026-02-22",
    endDate: "2026-02-24",
    time: "04:00 PM",
    department: "Sports Committee",
    venue: "Central Ground",
    registrationFee: 50,
    organizerName: "Sports Committee",
    studentCoordinators: [
      { name: "Yash Kothari", email: "yash.kothari@eventmate.com" },
      { name: "Ritika Salunke", email: "ritika.salunke@eventmate.com" },
    ],
    contact: {
      email: "football-cup@eventmate.com",
      phone: "+91 90000 11003",
    },
    mentors: ["Coach P. Thomas"],
    judges: ["Referee Board - Zone A"],
    requirements: [
      { title: "Team Composition", description: "11 players plus up to 5 substitutes per team." },
      { title: "Uniform", description: "Department jersey and student ID card are mandatory." },
    ],
    longDescription:
      "Represent your department in the annual football cup. Group stages and knockouts are held over three days, with live tracking for scores and player stats.",
    imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
    participants: [
      { userId: "st-001", name: "Student", email: "student@college.com" },
      { userId: "st-109", name: "Vikas Jain", email: "vikas.jain@college.com" },
    ],
  },
  {
    id: "EVT-WS-104",
    title: "Startup Pitch Workshop",
    description: "Learn to craft clear startup pitches, business models, and investor-ready decks.",
    audience: "Workshop",
    category: "Workshop",
    startDate: "2026-01-14",
    endDate: "2026-01-14",
    time: "11:00 AM",
    department: "Entrepreneurship Cell",
    venue: "Seminar Hall B",
    registrationFee: 0,
    organizerName: "Entrepreneurship Cell",
    studentCoordinators: [
      { name: "Gaurav Soni", email: "gaurav.soni@eventmate.com" },
    ],
    contact: {
      email: "startup-workshop@eventmate.com",
      phone: "+91 90000 11004",
    },
    mentors: ["Mr. Vivek Sinha"],
    judges: ["Internal Panel"],
    requirements: [
      { title: "Laptop Required", description: "Bring a laptop for business model canvas activity." },
      { title: "Deck Template", description: "Pitch deck format is shared after registration." },
    ],
    longDescription:
      "A hands-on workshop for early-stage founders and aspiring innovators. Learn how to validate ideas, structure your pitch, and present with clarity.",
    imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format",
    participants: [
      { userId: "st-001", name: "Student", email: "student@college.com" },
      { userId: "st-112", name: "Priya Das", email: "priya.das@college.com" },
    ],
  },
  {
    id: "EVT-TECH-105",
    title: "Full Stack Hackweek",
    description: "Ship full stack products in teams with mentorship, code reviews, and live demos.",
    audience: "Team Event",
    category: "Technical",
    startDate: "2025-12-02",
    endDate: "2025-12-06",
    time: "10:00 AM",
    department: "IT Department",
    venue: "Block C Labs",
    registrationFee: 200,
    organizerName: "Information Technology Dept.",
    studentCoordinators: [
      { name: "Aditi More", email: "aditi.more@eventmate.com" },
      { name: "Sanket Tiwari", email: "sanket.tiwari@eventmate.com" },
    ],
    contact: {
      email: "hackweek@eventmate.com",
      phone: "+91 90000 11005",
    },
    mentors: ["Ms. Divya Rao", "Mr. Salim Khan"],
    judges: ["Industry Jury - Tech Partner"],
    requirements: [
      { title: "Repository Setup", description: "Team leader must share repository link on day 1." },
      { title: "Demo Requirement", description: "Each team must submit a working demo by final day." },
    ],
    longDescription:
      "A five-day building sprint where teams create and deploy full stack applications. Mentors run daily review checkpoints and final demos decide top teams.",
    imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format",
    participants: [
      { userId: "st-115", name: "Tanya Roy", email: "tanya.roy@college.com" },
      { userId: "st-116", name: "Kunal Shah", email: "kunal.shah@college.com" },
    ],
  },
  {
    id: "EVT-CUL-106",
    title: "Photography Walkathon",
    description: "Capture themed city shots and learn framing techniques from pro photographers.",
    audience: "Open Event",
    category: "Cultural",
    startDate: "2026-04-05",
    endDate: "2026-04-05",
    time: "07:00 AM",
    department: "Media Club",
    venue: "Campus North Gate",
    registrationFee: 0,
    organizerName: "Media Club",
    studentCoordinators: [
      { name: "Prajwal Deshmukh", email: "prajwal.deshmukh@eventmate.com" },
    ],
    contact: {
      email: "walkathon@eventmate.com",
      phone: "+91 90000 11006",
    },
    mentors: ["Mr. K. Raman"],
    judges: ["Photo Jury Panel"],
    requirements: [
      { title: "Camera Rules", description: "Mobile and DSLR both allowed for participation." },
      { title: "Theme", description: "Submit 5 photos based on the announced visual theme." },
    ],
    longDescription:
      "Explore city and campus routes with guided photography sessions. Learn composition, storytelling, and post-capture critique from experienced creators.",
    imageUrl: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&auto=format",
    participants: [
      { userId: "st-001", name: "Student", email: "student@college.com" },
      { userId: "st-118", name: "Anika Gupta", email: "anika.gupta@college.com" },
    ],
  },
  {
    id: "EVT-TECH-107",
    title: "Cloud Security Masterclass",
    description: "Understand cloud threat models, IAM hardening, and hands-on defense patterns.",
    audience: "Seminar",
    category: "Technical",
    startDate: "2026-02-25",
    endDate: "2026-02-25",
    time: "02:30 PM",
    department: "Cyber Security Club",
    venue: "Auditorium A",
    registrationFee: 100,
    organizerName: "Cyber Security Club",
    studentCoordinators: [
      { name: "Saee Kulkarni", email: "saee.kulkarni@eventmate.com" },
    ],
    contact: {
      email: "cloud-security@eventmate.com",
      phone: "+91 90000 11007",
    },
    mentors: ["Mr. Aditya Kulshreshtha"],
    judges: ["Session Evaluation Team"],
    requirements: [
      { title: "Prior Knowledge", description: "Basic understanding of cloud platforms is recommended." },
      { title: "Participation", description: "Hands-on quiz is conducted at the end of session." },
    ],
    longDescription:
      "Learn practical cloud security controls and incident response approaches from security practitioners. The session covers IAM, logging, and secure deployment design.",
    imageUrl: "https://images.unsplash.com/photo-1510511459019-5dda7724fd87?w=1200&auto=format",
    participants: [
      { userId: "st-124", name: "Riya Anand", email: "riya.anand@college.com" },
      { userId: "st-125", name: "Arjun Singh", email: "arjun.singh@college.com" },
    ],
  },
  {
    id: "EVT-SPO-108",
    title: "Open Chess Championship",
    description: "Play timed rounds against campus players and climb the final leaderboard.",
    audience: "Individual Event",
    category: "Sports",
    startDate: "2026-01-30",
    endDate: "2026-01-30",
    time: "01:00 PM",
    department: "Mind Sports Club",
    venue: "Student Activity Center",
    registrationFee: 0,
    organizerName: "Mind Sports Club",
    studentCoordinators: [
      { name: "Harshad Giri", email: "harshad.giri@eventmate.com" },
    ],
    contact: {
      email: "chess-open@eventmate.com",
      phone: "+91 90000 11008",
    },
    mentors: ["Prof. S. Menon"],
    judges: ["Certified Arbiters Panel"],
    requirements: [
      { title: "Format", description: "Rapid format with Swiss pairings and timed rounds." },
      { title: "Reporting", description: "Participants must report 20 minutes before round 1." },
    ],
    longDescription:
      "An individual rapid chess tournament open to all students. Compete through multiple rounds, track your points, and qualify for the final ranking board.",
    imageUrl: "https://images.unsplash.com/photo-1528819622765-d6bcf132f793?w=1200&auto=format",
    participants: [
      { userId: "st-001", name: "Student", email: "student@college.com" },
      { userId: "st-130", name: "Deepak Nair", email: "deepak.nair@college.com" },
    ],
  },
];

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatEventDate = (value) => {
  const parsed = toDate(value);
  if (!parsed) return "Date TBD";
  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export const getEventTimelineStatus = (event, referenceDate = new Date()) => {
  const startDate = toDate(event?.startDate);
  const endDate = toDate(event?.endDate) || startDate;

  if (!startDate || !endDate) return "upcoming";

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (referenceDate < start) return "upcoming";
  if (referenceDate > end) return "completed";
  return "current";
};

export const mapStudentEventToCard = (event) => {
  const category = event?.category || "Workshop";
  const fee = Number(event?.registrationFee || 0);

  return {
    id: event?.id,
    title: event?.title || "Untitled Event",
    description: event?.description || "Join this campus event and explore new learning opportunities.",
    date: formatEventDate(event?.startDate),
    time: event?.time || "Time TBD",
    dept: event?.department || "Campus Event",
    venue: event?.venue || "Campus",
    type: category,
    price: fee,
    isFree: fee <= 0,
    imageUrl: event?.imageUrl || fallbackImages[category] || fallbackImages.Workshop,
    status: getEventTimelineStatus(event),
    startDate: event?.startDate || null,
    endDate: event?.endDate || null,
    participantCount: Array.isArray(event?.participants) ? event.participants.length : 0,
  };
};

export const getStudentEventById = (eventId) =>
  STUDENT_DASHBOARD_EVENTS.find((event) => event.id === eventId) || null;

export const mapStudentEventToDetails = (event) => {
  if (!event) return null;

  const card = mapStudentEventToCard(event);
  return {
    ...card,
    audience: event?.audience || "Open Event",
    organizerName: event?.organizerName || `${event?.department || "Campus"} Dept.`,
    coordinators: Array.isArray(event?.studentCoordinators)
      ? event.studentCoordinators
          .map((item) => ({
            name: String(item?.name || "").trim(),
            email: String(item?.email || "").trim().toLowerCase(),
          }))
          .filter((item) => item.name)
      : [],
    longDescription:
      event?.longDescription ||
      "Join this event to learn, collaborate, and build practical outcomes with peers.",
    requirements: Array.isArray(event?.requirements) ? event.requirements : [],
    contact: event?.contact || { email: "eventmate@gmail.com", phone: "+91 90000 00000" },
    mentors: Array.isArray(event?.mentors) ? event.mentors : [],
    judges: Array.isArray(event?.judges) ? event.judges : [],
  };
};

const normalizeToken = (value) => String(value || "").trim().toLowerCase();

const getUserTokens = (user) => {
  const tokens = [
    normalizeToken(user?._id),
    normalizeToken(user?.id),
    normalizeToken(user?.email),
  ].filter(Boolean);
  return new Set(tokens);
};

export const hasUserParticipated = (event, user) => {
  const userTokens = getUserTokens(user);
  if (!userTokens.size) return false;

  const participants = Array.isArray(event?.participants) ? event.participants : [];
  return participants.some((participant) => {
    const participantTokens = [
      normalizeToken(participant?.userId),
      normalizeToken(participant?._id),
      normalizeToken(participant?.email),
    ].filter(Boolean);

    return participantTokens.some((token) => userTokens.has(token));
  });
};

export const getParticipatedStudentEvents = (user) =>
  STUDENT_DASHBOARD_EVENTS.filter((event) => hasUserParticipated(event, user));
