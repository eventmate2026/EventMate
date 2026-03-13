import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import {
  submitFeedback,
  getEventFeedback
} from "../controllers/feedback.controller.js";

const router = express.Router();

// Student/Leader submits feedback
router.post(
  "/:eventId",
  authMiddleware,
  submitFeedback
);

// Organizer views feedback for their event
router.get(
  "/:eventId",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER", "STUDENT_COORDINATOR", "STUDENT"),
  getEventFeedback
);

export default router;
