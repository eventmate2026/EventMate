import mongoose from "mongoose";

const normalizeVerificationCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const CertificateAuditLogSchema = new mongoose.Schema(
  {
    certificateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Certificate",
      default: null,
      index: true
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
      index: true
    },
    action: {
      type: String,
      enum: ["ISSUED", "VERIFIED", "REVOKED", "DOWNLOADED"],
      required: true
    },
    outcome: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      default: "SUCCESS"
    },
    verificationCode: {
      type: String,
      trim: true,
      default: null
    },
    verificationCodeNormalized: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },
    certificateStatus: {
      type: String,
      enum: ["VALID", "REVOKED", "NOT_FOUND"],
      default: "NOT_FOUND"
    },
    participantName: {
      type: String,
      trim: true,
      default: null
    },
    participantEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    eventName: {
      type: String,
      trim: true,
      default: null
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    actorName: {
      type: String,
      trim: true,
      default: "System"
    },
    actorRole: {
      type: String,
      trim: true,
      default: "SYSTEM"
    },
    source: {
      type: String,
      enum: ["SYSTEM", "ADMIN", "ORGANIZER", "PUBLIC"],
      default: "SYSTEM"
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null
    },
    userAgent: {
      type: String,
      trim: true,
      default: null
    },
    message: {
      type: String,
      trim: true,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

CertificateAuditLogSchema.index(
  { verificationCodeNormalized: 1 },
  { sparse: true }
);
CertificateAuditLogSchema.index({ createdAt: -1 });

CertificateAuditLogSchema.pre("validate", function() {
  const normalized = normalizeVerificationCode(this.verificationCode);
  this.verificationCodeNormalized = normalized || null;
  if (this.participantEmail) {
    this.participantEmail = String(this.participantEmail).trim().toLowerCase();
  }
});

export default mongoose.model("CertificateAuditLog", CertificateAuditLogSchema);
