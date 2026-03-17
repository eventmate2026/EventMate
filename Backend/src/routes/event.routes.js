import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import optionalAuthMiddleware from "../middleware/optionalAuth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import { eventUpload } from "../middleware/multer.middleware.js";
import {
  createEventController,
  publishEvent,
  getPublishedEvents,
  cancelEvent,
  completeEvent,
  updateEvent,
  getEvent,
  assignCoordinator,
  getMyEvents,
  getMyAssignedEvents
} from "../controllers/event.controller.js";

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  eventUpload.fields([
    { name: "poster", maxCount: 1 },
    { name: "resourceFile", maxCount: 1 }
  ]),
  createEventController
);

router.get(
  "/myEvents",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  getMyEvents
);

router.get(
  "/assigned-to-me",
  authMiddleware,
  roleMiddleware("STUDENT_COORDINATOR", "STUDENT"),
  getMyAssignedEvents
);

router.patch(
  "/:id/publish",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  publishEvent
);

router.get("/", optionalAuthMiddleware, getPublishedEvents);

router.patch(
  "/:id/cancel",
  authMiddleware,
  cancelEvent
);

router.patch(
  "/:eventId/complete",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  completeEvent
);

router.patch(
  "/:id",
  authMiddleware,
  updateEvent
);

router.get(
  "/:id",
  optionalAuthMiddleware,
  getEvent
);


router.patch(
  "/:eventId/coordinators/assign",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  assignCoordinator
);

export default router;
