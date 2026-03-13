import mongoose from "mongoose";

const teamInvitationSchema = new mongoose.Schema(
  {
    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventRegistration",
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: ["leader", "member"],
      default: "member"
    },
    token: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["AWAITING_SIGNUP", "PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING"
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    inviteSentAt: {
      type: Date
    },
    respondedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

teamInvitationSchema.index({ registration: 1, email: 1 }, { unique: true });

export default mongoose.model("TeamInvitation", teamInvitationSchema);
