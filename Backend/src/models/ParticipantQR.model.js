import mongoose from "mongoose";

const ParticipantQRSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventRegistration",
      required: true
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },

    // The participant this QR belongs to
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    // "leader" for team leader, "participant" for everyone else
    role: {
      type: String,
      enum: ["leader", "participant"],
      required: true
    },

    // Unique token encoded inside the QR
    // Used for attendance scanning later
    token: {
      type: String,
      required: true,
      unique: true
    },

    // Cloudinary URL of the QR image
    qrImageUrl: {
      type: String,
      required: true
    },

    // Attendance fields — used later
    attendanceMarked: {
      type: Boolean,
      default: false
    },

    attendanceMarkedAt: {
      type: Date,
      default: null
    },

    attendanceMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

// One QR per participant per event — no duplicates
ParticipantQRSchema.index({ eventId: 1, email: 1 }, { unique: true });

export default mongoose.model("ParticipantQR", ParticipantQRSchema);
