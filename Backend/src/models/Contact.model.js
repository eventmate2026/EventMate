import mongoose from "mongoose";

const ContactSchema = new mongoose.Schema(
  {
    fullName: {
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

    message: {
      type: String,
      required: true,
      trim: true
    },

    // If logged in — store their info directly (no ID hunting)
    submittedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      role: {
        type: String,
        default: "GUEST"
      }
    },

    // Track status so admin can manage complaints
    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Resolved"],
      default: "Pending"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Contact", ContactSchema);
