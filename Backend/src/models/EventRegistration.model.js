import mongoose from "mongoose";

/* ================= PARTICIPANT ================= */

const participantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    mobileNumber: { type: String, required: true },
    college: { type: String, required: true },
    branch: { type: String, required: true },
    year: { type: String, required: true },
    emailVerified: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

/* ================= MAIN SCHEMA ================= */

const EventRegistrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true
    },

    teamName: {
      type: String,
      trim: true,
      default: null
    },

    teamLeader: {
      type: participantSchema,
      required: true
    },

    // Clean array — emailVerified lives inside participantSchema, not here
    teamMembers: {
      type: [participantSchema],
      default: []
    },

    totalParticipants: {
      type: Number
    },

    /* ===== WORKFLOW STATUS ===== */

    // Full lifecycle:
    // Draft (shouldn't persist long) →
    // PendingMemberVerification (team members need to verify emails) →
    // PendingPayment (paid events: waiting for payment submission) →
    // PendingPaymentVerification (organizer reviewing payment screenshot) →
    // Confirmed (fully registered) →
    // Rejected (payment rejected or manually rejected) →
    // Cancelled (student cancelled)
    status: {
      type: String,
      enum: [
        "PendingMemberVerification",
        "PendingPayment",
        "PendingPaymentVerification",
        "Confirmed",
        "Rejected",
        "Cancelled"
      ],
      default: "PendingMemberVerification"
    },

    allMembersVerified: {
      type: Boolean,
      default: false
    },

    /* ================= PAYMENT ================= */

    payment: {
      method: {
        type: String,
        enum: ["FREE", "PHONEPE_QR"],
        default: "FREE"
      },

      amount: {
        type: Number,
        default: 0
      },

      transactionId: {
        type: String,
        trim: true
      },

      paymentScreenshot: {
        type: String // Cloudinary URL
      },

      paymentStatus: {
        type: String,
        enum: ["NotRequired", "Pending", "UnderReview", "Verified", "Rejected"],
        default: "NotRequired"
      },

      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },

      verifiedAt: Date
    },

    attendanceMarked: {
      type: Boolean,
      default: false
    },
  
  // Winner tagging
winner: {
  isWinner: {
    type: Boolean,
    default: false
  },
  position: {
    type: String,
    enum: ["1st", "2nd", "3rd"],
    default: null
  },
  assignmentCount: {
    type: Number,
    default: 0
  },
  unassignedOnce: {
    type: Boolean,
    default: false
  }
},

    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

/* ================= PRE-SAVE VALIDATION ================= */

EventRegistrationSchema.pre("save", async function () {
  // Only run full validation on initial creation
  if (!this.isNew) return;

  const Event = mongoose.model("Event");
  const event = await Event.findById(this.event);

  if (!event) throw new Error("Event not found");

  this.totalParticipants = 1 + this.teamMembers.length;

  /* ===== INDIVIDUAL EVENT ===== */
  if (!event.isTeamEvent) {
    if (this.teamMembers.length > 0)
      throw new Error("Individual event cannot have team members");

    this.teamName = null;
  }

  /* ===== TEAM EVENT ===== */
  if (event.isTeamEvent) {
    if (!this.teamName)
      throw new Error("Team name required for team event");

    if (
      this.totalParticipants < event.minTeamSize ||
      this.totalParticipants > event.maxTeamSize
    )
      throw new Error(
        `Team size must be between ${event.minTeamSize} and ${event.maxTeamSize}`
      );
  }

  /* ===== PAYMENT METHOD ===== */
  if (event.registration?.fee > 0) {
    this.payment.method = "PHONEPE_QR";
    this.payment.amount = event.registration.fee;
    this.payment.paymentStatus = "Pending";
  } else {
    this.payment.method = "FREE";
    this.payment.paymentStatus = "NotRequired";
  }
});

/* ================= UNIQUE INDEX ================= */

// One registration per user per event
EventRegistrationSchema.index(
  { event: 1, registeredBy: 1 },
  { unique: true }
);

export default mongoose.model("EventRegistration", EventRegistrationSchema);
