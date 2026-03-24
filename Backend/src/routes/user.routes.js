import express from "express";
import multer from "multer";
import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";

import { getProfileController, updateProfileController, uploadAvatarController, forgotPasswordController, resetPasswordController,
  createOrganizer,
  createCoordinator,
  promoteCoordinator
} from "../controllers/user.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);
router.use(authMiddleware);

router.get("/profile", getProfileController);
router.put("/profile", updateProfileController);
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
