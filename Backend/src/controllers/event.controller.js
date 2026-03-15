import Event from "../models/Event.model.js";
import User from "../models/User.model.js";
import uploadImageCloudinary from "../utils/uploadImageCloudinary.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import { sendNotification } from "../services/notification.service.js";
import { buildEventEndDateTime, COMPLETION_GRACE_MS } from "../utils/eventTime.js";

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeDepartment = (value = "") => String(value || "").trim();
const resolveUserDepartment = (user) =>
  normalizeDepartment(user?.academicProfile?.branch || user?.professionalProfile?.department || user?.department);
const isEventOver = (event) => {
  const status = String(event?.status || "").trim().toLowerCase();
  if (status === "completed" || status === "cancelled" || status === "canceled") return true;
  const endValue = event?.schedule?.endDate || event?.schedule?.startDate;
  if (!endValue) return false;
  const endTime = new Date(endValue).getTime();
  if (Number.isNaN(endTime)) return false;
  return Date.now() > endTime;
};

const parseVisibilityPayload = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
};

export const createEventController = asyncHandler(async (req, res) => {

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Event poster is required"
    });
  }

  const {
    title,
    description,
    category,
    venue,
    schedule,
    registration,
    certificate,
    feedback,
    visibility,
    isTeamEvent,
    minTeamSize,
    maxTeamSize
  } = req.body;

  if (!title || !category) {
    return res.status(400).json({
      success: false,
      message: "Title and category are required"
    });
  }

  // Upload to Cloudinary
  const uploaded = await uploadImageCloudinary(req.file);

  const visibilityPayload = parseVisibilityPayload(visibility);
  const visibilityScope = String(visibilityPayload?.scope || "").toUpperCase() === "DEPARTMENT"
    ? "DEPARTMENT"
    : "COLLEGE";
  let visibilityDepartment = "";
  if (visibilityScope === "DEPARTMENT") {
    const organizerDepartment = resolveUserDepartment(req.user);
    if (req.user.role === "ORGANIZER") {
      visibilityDepartment = organizerDepartment;
    } else {
      visibilityDepartment =
        normalizeDepartment(visibilityPayload?.department) ||
        organizerDepartment;
    }
    if (!visibilityDepartment) {
      return res.status(400).json({
        success: false,
        message: "Department is required for department-level events"
      });
    }
  }

  const event = await Event.create({
    title,
    description,
    category,
    posterUrl: uploaded.url,

    organizer: {
      organizerId: req.user._id,
      name: req.user.fullName,
      department: req.user.professionalProfile?.department || "",
      contactEmail: req.user.email,
      contactPhone: req.user.mobileNumber || ""
    },

    venue: venue ? JSON.parse(venue) : undefined,
    schedule: schedule ? JSON.parse(schedule) : undefined,
    registration: registration ? JSON.parse(registration) : {
      isOpen: false,
      fee: 0
    },
    certificate: certificate ? JSON.parse(certificate) : { isEnabled: false },
    feedback: feedback ? JSON.parse(feedback) : { enabled: false },

    visibility: {
      scope: visibilityScope,
      department: visibilityDepartment
    },

    isTeamEvent: isTeamEvent === "true",
    minTeamSize: minTeamSize ? Number(minTeamSize) : 1,
    maxTeamSize: maxTeamSize ? Number(maxTeamSize) : 1,

    createdBy: req.user._id
  });

  res.status(201).json({
    success: true,
    message: "Event created successfully (Draft)",
    data: event
  });
});

// PUBLISH EVENT
export const publishEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    if (event.status === "Published") {
      return res.status(400).json({
        success: false,
        message: "Event already published"
      });
    }

    event.status = "Published";
    event.updatedBy = req.user._id;

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event published successfully",
      data: event
    });

  } catch (error) {
    next(error);
  }
};

//getPublishedEvents
export const getPublishedEvents = async (req, res, next) => {
  try {
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const baseQuery = { status: { $in: ["Published", "Completed"] } };
    let visibilityFilter = null;

    if (req.user) {
      if (req.user.role === "STUDENT") {
        const department = resolveUserDepartment(req.user);
        const departmentPattern = department ? new RegExp(`^${escapeRegex(department)}$`, "i") : null;
        visibilityFilter = department
          ? {
              $or: [
                { "visibility.scope": { $exists: false } },
                { "visibility.scope": "COLLEGE" },
                { "visibility.scope": "DEPARTMENT", "visibility.department": departmentPattern },
              ],
            }
          : {
              $or: [
                { "visibility.scope": { $exists: false } },
                { "visibility.scope": "COLLEGE" },
              ],
            };
      }
    } else {
      visibilityFilter = {
        $or: [
          { "visibility.scope": { $exists: false } },
          { "visibility.scope": "COLLEGE" },
        ],
      };
    }

    const query = visibilityFilter ? { ...baseQuery, ...visibilityFilter } : baseQuery;
    
    const events = await Event.find(query)
      .select("-__v -createdBy -updatedBy")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments(query);
    
    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: events
    });

  } catch (error) {
    next(error);
  }
};

//cancel event
export const cancelEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    if (event.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Completed event cannot be cancelled"
      });
    }

    if (event.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Event already cancelled"
      });
    }

    if (
      req.user.role !== "MAIN_ADMIN" &&
      event.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this event"
      });
    }

    event.status = "Cancelled";
    event.updatedBy = req.user._id;

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event cancelled successfully",
      data: event
    });

  } catch (error) {
    next(error);
  }
};

//updateEvent
export const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    if (
      req.user.role !== "MAIN_ADMIN" &&
      event.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this event"
      });
    }

    if (event.status !== "Draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft events can be updated"
      });
    }


    delete req.body.organizer;
    delete req.body.createdBy;
    delete req.body.updatedBy;
    delete req.body.status;
    delete req.body._id;
    delete req.body.__v;

    if (req.body.visibility && typeof req.body.visibility === "string") {
      const parsedVisibility = parseVisibilityPayload(req.body.visibility);
      if (parsedVisibility) req.body.visibility = parsedVisibility;
    }
    if (req.body.visibility) {
      const scope =
        String(req.body.visibility?.scope || "").toUpperCase() === "DEPARTMENT"
          ? "DEPARTMENT"
          : "COLLEGE";
      req.body.visibility.scope = scope;
      if (scope === "COLLEGE") {
        req.body.visibility.department = "";
      } else if (req.user.role === "ORGANIZER") {
        const organizerDepartment = resolveUserDepartment(req.user);
        if (!organizerDepartment) {
          return res.status(400).json({
            success: false,
            message: "Department is required for department-level events"
          });
        }
        req.body.visibility.department = organizerDepartment;
      } else if (!String(req.body.visibility?.department || "").trim()) {
        return res.status(400).json({
          success: false,
          message: "Department is required for department-level events"
        });
      }
    }

    Object.assign(event, req.body);

    event.updatedBy = req.user._id;

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: event
    });

  } catch (error) {
    next(error);
  }
};

//get an published event by id
export const getEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    
    if(!event){
     return res.status(404).json({
        success: false,
        message: "Event not found!"
      });
    }
    
    if(req.user.role !== "MAIN_ADMIN" &&
      event.createdBy.toString() !== req.user._id.toString() && event.status !== "Published"){
       return res.status(403).json({
          success: false,
          message: "Not authorized to view this event"
        })
      }

      if (req.user.role === "STUDENT" && String(event?.visibility?.scope || "COLLEGE") === "DEPARTMENT") {
        const studentDepartment = resolveUserDepartment(req.user);
        const eventDepartment = String(event?.visibility?.department || "").trim();
        if (
          !studentDepartment ||
          !eventDepartment ||
          studentDepartment.toLowerCase() !== eventDepartment.toLowerCase()
        ) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to view this event"
          });
        }
      }
      
      return res.status(200).json({
      success: true,
      message: "Access Granted!",
      data: event
    });
    
  } catch (error) {
    next(error);
  }
};


// ASSIGN COORDINATOR TO EVENT
export const assignCoordinator = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { coordinatorId } = req.body;

    // Find event
    const event = await Event.findById(eventId);
    if (!event)
      return res.status(404).json({ success: false, message: "Event not found" });

    // Only event organizer or admin can assign
    if (
      req.user.role !== "MAIN_ADMIN" &&
      event.createdBy.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ success: false, message: "Not authorized" });

    // Find coordinator and verify their role
    const coordinator = await User.findById(coordinatorId);
    if (!coordinator)
      return res.status(404).json({ success: false, message: "Coordinator not found" });

    const allowedCoordinatorRoles = ["STUDENT_COORDINATOR", "STUDENT"];
    if (!allowedCoordinatorRoles.includes(coordinator.role))
      return res.status(400).json({ success: false, message: "User must be a student or student coordinator" });

    const coordinatorDepartment = resolveUserDepartment(coordinator);

    if (req.user.role === "ORGANIZER") {
      const visibilityScope = String(event?.visibility?.scope || "COLLEGE").toUpperCase();
      if (visibilityScope === "DEPARTMENT") {
        const organizerDepartment = resolveUserDepartment(req.user);
        if (!organizerDepartment) {
          return res.status(400).json({ success: false, message: "Organizer department is required" });
        }
        if (!coordinatorDepartment || organizerDepartment.toLowerCase() !== coordinatorDepartment.toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: "Coordinators must belong to your department"
          });
        }
      }
    }

    // Check if already assigned
    const alreadyAssigned = event.studentCoordinators.some(
      (c) => c.coordinatorId.toString() === coordinatorId
    );
    if (alreadyAssigned)
      return res.status(400).json({ success: false, message: "Coordinator already assigned to this event" });

    // Assign
    event.studentCoordinators.push({
      coordinatorId: coordinator._id,
      name: coordinator.fullName,
      email: coordinator.email,
      department: coordinatorDepartment || ""
    });

    await event.save();

    await sendNotification({
      recipientId: coordinator._id,
      recipientName: coordinator.fullName,
      recipientRole: coordinator.role === "STUDENT" ? "STUDENT" : "STUDENT_COORDINATOR",
      title: "New Event Assignment",
      message: `You have been assigned to coordinate ${event.title}`,
      type: "ASSIGNMENT",
      refId: event._id
    });

    return res.status(200).json({
      success: true,
      message: "Coordinator assigned successfully",
      data: event.studentCoordinators
    });

  } catch (error) {
    next(error);
  }
};


// Organizer sees their own events (all statuses)
export const getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    next(error);
  }
};

// complete event (manual)
export const completeEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found"
      });
    }

    if (event.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Event is already completed"
      });
    }

    if (event.status === "Cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled event cannot be completed"
      });
    }

    if (event.status !== "Published") {
      return res.status(400).json({
        success: false,
        message: "Only published events can be completed"
      });
    }

    if (
      req.user.role !== "MAIN_ADMIN" &&
      event.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to complete this event"
      });
    }

    const eventEndDateTime = buildEventEndDateTime(
      event.schedule?.endDate,
      event.schedule?.endTime
    );

    if (!eventEndDateTime) {
      return res.status(400).json({
        success: false,
        message: "Event end time is missing or invalid"
      });
    }

    const now = new Date();
    if (now < eventEndDateTime) {
      return res.status(400).json({
        success: false,
        message: "Event has not ended yet"
      });
    }

    const manualWindowEndsAt = new Date(eventEndDateTime.getTime() + COMPLETION_GRACE_MS);
    if (now > manualWindowEndsAt) {
      return res.status(400).json({
        success: false,
        message: "Manual completion window has passed; event will be auto-completed"
      });
    }

    event.status = "Completed";
    event.updatedBy = req.user._id;

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event marked completed successfully",
      data: event
    });
  } catch (error) {
    next(error);
  }
};

// Coordinator sees events assigned to their account (all statuses)
export const getMyAssignedEvents = async (req, res, next) => {
  try {
    const allowedRoles = ["STUDENT_COORDINATOR", "STUDENT"];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only students or coordinators can access assigned events",
      });
    }

    const coordinatorId = req.user._id;
    const coordinatorEmail = String(req.user.email || "").trim();

    const query = {
      $or: [
        { "studentCoordinators.coordinatorId": coordinatorId },
      ],
    };

    if (coordinatorEmail) {
      query.$or.push({
        "studentCoordinators.email": { $regex: `^${escapeRegex(coordinatorEmail)}$`, $options: "i" },
      });
    }

    let events = await Event.find(query).sort({ updatedAt: -1, createdAt: -1 });
    if (req.user.role === "STUDENT") {
      events = events.filter((event) => !isEventOver(event));
    }

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};
