import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import { getAllUsersController, updateUserController, deleteUserController,
  getCoordinators,
  getOrganizers,
  getOrganizerEventCounts,
  getCertificatesRegistry,
  getCertificateAuditLogs,
  revokeCertificate } from "../controllers/admin.controller.js";
import {
  forceLogoutAllController,
  getSecuritySettingsController,
  rotateSecuritySecretController,
  updateSecuritySettingsController
} from "../controllers/securitySettings.controller.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/users", roleMiddleware("MAIN_ADMIN"), getAllUsersController);
router.put("/users/:id", roleMiddleware("MAIN_ADMIN"), updateUserController);
router.delete("/users/:id", roleMiddleware("MAIN_ADMIN"), deleteUserController);


router.get(
  "/coordinators",
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  getCoordinators
);

router.get(
  "/organizers",
  roleMiddleware("MAIN_ADMIN"),
  getOrganizers
);

router.get(
  "/organizers/event-counts",
  roleMiddleware("MAIN_ADMIN"),
  getOrganizerEventCounts
);

router.get(
  "/certificates/registry",
  roleMiddleware("MAIN_ADMIN"),
  getCertificatesRegistry
);

router.get(
  "/certificates/audit-logs",
  roleMiddleware("MAIN_ADMIN"),
  getCertificateAuditLogs
);

router.patch(
  "/certificates/:certificateId/revoke",
  roleMiddleware("MAIN_ADMIN"),
  revokeCertificate
);

router.get(
  "/security-settings",
  roleMiddleware("MAIN_ADMIN"),
  getSecuritySettingsController
);

router.patch(
  "/security-settings",
  roleMiddleware("MAIN_ADMIN"),
  updateSecuritySettingsController
);

router.post(
  "/security-settings/rotate-secret",
  roleMiddleware("MAIN_ADMIN"),
  rotateSecuritySecretController
);

router.post(
  "/security-settings/force-logout",
  roleMiddleware("MAIN_ADMIN"),
  forceLogoutAllController
);

export default router;
