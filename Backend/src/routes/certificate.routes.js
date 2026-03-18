import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import roleMiddleware from "../middleware/role.middleware.js";
import upload from "../middleware/multer.middleware.js";
import {
  getMyCertificates,
  getEventCertificates,
  generateEventCertificates,
  generateSelectedCertificates,
  downloadCertificate,
  verifyCertificate,
  updateEventCertificateCustomization,
  uploadEventCertificateBackground,
  uploadEventCertificateLogo,
  uploadEventCertificateAccreditationLogo,
  uploadEventCertificateSignature,
  downloadDemoCertificate
} from "../controllers/certificate.controller.js";

const router = express.Router();

// Student views their own certificates
router.get("/my", authMiddleware, getMyCertificates);

// Public verify by unique certificate code
router.post("/verify", verifyCertificate);

// Organizer/Admin views certificates for a specific event
router.get(
  "/:eventId",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  getEventCertificates
);

// Organizer/Admin updates certificate customization for an event
router.patch(
  "/:eventId/customization",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  updateEventCertificateCustomization
);

// Organizer/Admin updates certificate background image for an event
router.patch(
  "/:eventId/background",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  upload.single("background"),
  uploadEventCertificateBackground
);

// Organizer/Admin updates certificate logo image for an event
router.patch(
  "/:eventId/logo",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  upload.single("logo"),
  uploadEventCertificateLogo
);

router.patch(
  "/:eventId/accreditation-logo",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  upload.single("accreditationLogo"),
  uploadEventCertificateAccreditationLogo
);

// Organizer/Admin updates certificate signature image for an event
router.patch(
  "/:eventId/signature/:role",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  upload.single("signature"),
  uploadEventCertificateSignature
);

// Organizer/Admin downloads a demo certificate
router.get(
  "/:eventId/demo",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  downloadDemoCertificate
);

// Organizer/Admin manually triggers certificate generation
router.post(
  "/:eventId/generate",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  generateEventCertificates
);

// Organizer/Admin issues certificates for selected attendees
router.post(
  "/:eventId/issue",
  authMiddleware,
  roleMiddleware("MAIN_ADMIN", "ORGANIZER"),
  generateSelectedCertificates
);

// Public download
router.get("/download/:eventId/:emailSlug", downloadCertificate);

export default router;
