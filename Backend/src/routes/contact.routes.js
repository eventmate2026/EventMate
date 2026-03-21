import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import optionalAuthMiddleware from "../middleware/optionalAuth.middleware.js";
import { contactLimiter } from "../middleware/rateLimit.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import {
  submitContact,
  getAdminContacts,
  getContacts,
  getMyContacts
} from "../controllers/contact.controller.js";

const router = express.Router();

// Public - anyone can submit (logged in or not)
router.post("/", contactLimiter, optionalAuthMiddleware, submitContact);

router.get("/my", authMiddleware, getMyContacts);
router.get("/admins", authMiddleware, getAdminContacts);

// MAIN_ADMIN only
router.get(
  "/",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN"),
  getContacts
);

export default router;
