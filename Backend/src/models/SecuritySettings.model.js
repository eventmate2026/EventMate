import mongoose from "mongoose";

const SecuritySettingsSchema = new mongoose.Schema(
  {
    maxFailedLoginAttempts: {
      type: Number,
      default: 5,
      min: 3,
      max: 20,
    },
    lockoutDurationMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 240,
    },
    accessTokenLifetimeMinutes: {
      type: Number,
      default: 15,
      min: 5,
      max: 120,
    },
    refreshTokenLifetimeDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 30,
    },
    notifyOnLockout: {
      type: Boolean,
      default: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    lastRotatedAt: {
      type: Date,
      default: null,
    },
    tokenInvalidBefore: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("SecuritySettings", SecuritySettingsSchema);
