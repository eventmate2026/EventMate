import mongoose from "mongoose";

const FeedbackSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true
    },

    // Readable snapshot — no need to populate later
    eventName: {
      type: String,
      required: true
    },

    registration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventRegistration",
      required: true
    },

    participantName: {
      type: String,
      required: true
    },

    participantEmail: {
      type: String,
      required: true
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },

    comment: {
      type: String,
      trim: true,
      default: null
    }
  },
);
// One feedback per registration per event
FeedbackSchema.index(
  { event: 1, registration: 1 },
  { unique: true }
);
export default mongoose.model("Feedback", FeedbackSchema);
