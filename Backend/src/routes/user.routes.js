import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import upload from "../middleware/multer.middleware.js";
import { passwordRecoveryLimiter } from "../middleware/rateLimit.middleware.js";

import { getProfileController, updateProfileController, uploadAvatarController, forgotPasswordController, resetPasswordController,
  revokeProfileSessionController,
  createOrganizer,
  createCoordinator,
  promoteCoordinator
} from "../controllers/user.controller.js";

const router = express.Router();

router.post("/forgot-password", passwordRecoveryLimiter, forgotPasswordController);
router.post("/reset-password", passwordRecoveryLimiter, resetPasswordController);
router.use(authMiddleware);

router.get("/profile", getProfileController);
router.put("/profile", updateProfileController);
router.delete("/profile/sessions/:sessionId", revokeProfileSessionController);
router.post("/avatar", upload.single("avatar"), uploadAvatarController);

router.post(
  "/create-organizer",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN"),
  createOrganizer
);

router.post(
  "/create-coordinator",
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  createCoordinator
);

router.post(
  "/promote-coordinator",
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  promoteCoordinator
);

export default router;
