import mongoose from "mongoose";

const UserSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    browser: {
      type: String,
      default: "Browser",
      trim: true,
      maxlength: 120,
    },
    os: {
      type: String,
      default: "Unknown OS",
      trim: true,
      maxlength: 120,
    },
    deviceType: {
      type: String,
      enum: ["Desktop", "Mobile", "Tablet", "Unknown"],
      default: "Unknown",
    },
    deviceLabel: {
      type: String,
      default: "Unknown device",
      trim: true,
      maxlength: 180,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revokedReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
  },
  { timestamps: true }
);

UserSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: -1, lastActiveAt: -1 });

export default mongoose.model("UserSession", UserSessionSchema);
