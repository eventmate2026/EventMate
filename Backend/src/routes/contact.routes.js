import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import {
  submitContact,
  getAdminContacts,
  getContacts,
  getMyContacts
} from "../controllers/contact.controller.js";

const router = express.Router();

// Public — anyone can submit (logged in or not)
// optionalAuth means we attach user if token exists, but don't block if not
router.post("/", (req, res, next) => {
  // Try to attach user if token present, but don't fail if not
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authMiddleware(req, res, next);
  }
  next();
}, submitContact);

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
