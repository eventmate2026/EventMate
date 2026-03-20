import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import {
  getMyNotifications,
  markAllRead,
  markOneRead,
  adminSendNotification,
  organizerSendNotification,
  getOrganizerSentGroups,
  getOrganizerGroupReceipts,
  getAdminSentGroups,
  getAdminGroupReceipts,
  recordNotificationEmailEvents
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/my", authMiddleware, getMyNotifications);
router.patch("/read-all", authMiddleware, markAllRead);
router.patch("/:notificationId/read", authMiddleware, markOneRead);
router.post("/email-events", recordNotificationEmailEvents);
router.post("/admin-send", authMiddleware, roleMiddleware("MAIN_ADMIN"), adminSendNotification);
router.post("/organizer-send", authMiddleware, roleMiddleware("ORGANIZER"), organizerSendNotification);
router.get("/organizer-sent", authMiddleware, roleMiddleware("ORGANIZER"), getOrganizerSentGroups);
router.get("/organizer-receipts", authMiddleware, roleMiddleware("ORGANIZER"), getOrganizerGroupReceipts);
router.get("/admin-sent", authMiddleware, roleMiddleware("MAIN_ADMIN"), getAdminSentGroups);
router.get("/admin-receipts", authMiddleware, roleMiddleware("MAIN_ADMIN"), getAdminGroupReceipts);

export default router;
