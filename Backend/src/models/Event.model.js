import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true
    },

    category: {
      type: String,
      enum: ["Technical", "Cultural", "Sports", "Workshop"],
      required: true
    },

    posterUrl: String,
    resource: {
      name: String,
      url: String,
      mimeType: String,
      uploadedAt: Date
    },

    /* ================= ORGANIZER ================= */

    organizer: {
      organizerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      name: { type: String, required: true },
      department: String,
      contactEmail: String,
      contactPhone: String
    },

    studentCoordinators: [
      {
        coordinatorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null
        },
        name: String,
        email: String,
        department: String
      }
    ],

    /* ================= VENUE ================= */

    venue: {
      mode: {
        type: String,
        enum: ["ONLINE", "OFFLINE", "HYBRID"],
        required: true
      },
      location: String,
      googleMapLink: String
    },

    /* ================= SCHEDULE ================= */

    schedule: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true }
    },

    /* ================= REGISTRATION ================= */

    registration: {
      isOpen: {
        type: Boolean,
        default: false
      },
      lastDate: {
        type: Date,
        required: true
      },
      maxParticipants: {
        type: Number,
        required: true
      },
      fee: {
        type: Number,
        default: 0
      }
    },

    /* ================= TEAM CONFIG ================= */

    isTeamEvent: {
      type: Boolean,
      required: true,
      default: false
    },

    minTeamSize: {
      type: Number,
      default: 1
    },

    maxTeamSize: {
      type: Number,
      default: 1
    },

    /* ================= ATTENDANCE ================= */

    attendance: {
      qrCode: String,
      totalPresent: {
        type: Number,
        default: 0
      }
    },

    /* ================= CERTIFICATE ================= */

    certificate: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      templateId: {
        type: mongoose.Schema.Types.ObjectId
      },
      customization: {
        issuerName: {
          type: String,
          trim: true,
          default: "BAJAJ CHANDRAPUR POLYTECHNIC"
        },
        participationTitle: {
          type: String,
          trim: true,
          default: "Certificate"
        },
        winnerTitle: {
          type: String,
          trim: true,
          default: "Certificate of Excellence"
        },
        introText: {
          type: String,
          trim: true,
          default: "This is to certify that Mr./Miss"
        },
        participationActionText: {
          type: String,
          trim: true,
          default: "Participated in the Event"
        },
        winnerActionText: {
          type: String,
          trim: true,
          default: "Secured {position} Position in"
        },
        footerText: {
          type: String,
          trim: true,
          default: "We appreciate his/her enthusiasm and wish him/her all the best for future."
        },
        coordinatorLabel: {
          type: String,
          trim: true,
          default: "Organizer"
        },
        hodLabel: {
          type: String,
          trim: true,
          default: "HOD"
        },
        principalLabel: {
          type: String,
          trim: true,
          default: "Principal"
        },
        organizerName: {
          type: String,
          trim: true,
          default: ""
        },
        organizerDepartment: {
          type: String,
          trim: true,
          default: ""
        },
        hodName: {
          type: String,
          trim: true,
          default: ""
        },
        hodDepartment: {
          type: String,
          trim: true,
          default: ""
        },
        principalName: {
          type: String,
          trim: true,
          default: ""
        },
        principalDepartment: {
          type: String,
          trim: true,
          default: ""
        },
        organizerSignatureUrl: {
          type: String,
          trim: true,
          default: ""
        },
        hodSignatureUrl: {
          type: String,
          trim: true,
          default: ""
        },
        principalSignatureUrl: {
          type: String,
          trim: true,
          default: ""
        },
        accreditationLogoUrl: {
          type: String,
          trim: true,
          default: ""
        },
        logoUrl: {
          type: String,
          trim: true,
          default: ""
        },
        backgroundImageUrl: {
          type: String,
          trim: true,
          default: ""
        },
        styles: {
          type: mongoose.Schema.Types.Mixed,
          default: {}
        },
        layout: {
          logo: {
            x: { type: Number, default: 5.5 },
            y: { type: Number, default: 8.5 },
            width: { type: Number, default: 60 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "left" }
          },
          accreditationLogo: {
            x: { type: Number, default: 94.5 },
            y: { type: Number, default: 6.5 },
            width: { type: Number, default: 70 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "right" }
          },
          estd: {
            x: { type: Number, default: 79.5 },
            y: { type: Number, default: 6 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          trust: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 6 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          campus: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 18 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          approvals: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 21.5 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          issuerName: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 13 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          title: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 30 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          introText: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 42.5 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          participantName: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 50.5 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          actionText: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 58.5 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          eventName: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 64.5 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          dateVenue: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 71 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          organizerSignature: {
            x: { type: Number, default: 12 },
            y: { type: Number, default: 82 },
            width: { type: Number, default: 130 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "left" }
          },
          hodSignature: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 82 },
            width: { type: Number, default: 130 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          principalSignature: {
            x: { type: Number, default: 88 },
            y: { type: Number, default: 82 },
            width: { type: Number, default: 130 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "right" }
          },
          coordinatorLabel: {
            x: { type: Number, default: 12 },
            y: { type: Number, default: 90 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "left" }
          },
          hodLabel: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 90 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          principalLabel: {
            x: { type: Number, default: 88 },
            y: { type: Number, default: 90 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "right" }
          },
          footerText: {
            x: { type: Number, default: 50 },
            y: { type: Number, default: 75 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "center" }
          },
          verificationCode: {
            x: { type: Number, default: 96 },
            y: { type: Number, default: 92 },
            width: { type: Number, default: 260 },
            height: { type: Number, default: 24 },
            anchor: { type: String, enum: ["left", "center", "right"], default: "right" }
          }
        }
      },
      issuedCount: {
        type: Number,
        default: 0
      }
    },

    /* ================= FEEDBACK ================= */

    feedback: {
      enabled: Boolean,
      averageRating: Number
    },

    /* ================= VISIBILITY ================= */

    visibility: {
      scope: {
        type: String,
        enum: ["COLLEGE", "DEPARTMENT"],
        default: "COLLEGE"
      },
      department: {
        type: String,
        trim: true,
        default: ""
      }
    },

    /* ================= EVENT STATUS ================= */

    status: {
      type: String,
      enum: ["Draft", "Published", "Completed", "Cancelled"],
      default: "Draft"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  { timestamps: true }
);

/* ==================================================
   CRITICAL VALIDATION LOGIC (TEAM DISTINCTION FIX)
================================================== */

EventSchema.pre("save", function () {

  // Individual Event
  if (!this.isTeamEvent) {
    this.minTeamSize = 1;
    this.maxTeamSize = 1;
  }

  // Team Event
  if (this.isTeamEvent) {
    if (this.maxTeamSize <= 1) {
      throw new Error("Team event must have maxTeamSize greater than 1");
    }

    if (this.minTeamSize < 1) {
      throw new Error("minTeamSize must be at least 1");
    }

    if (this.maxTeamSize < this.minTeamSize) {
      throw new Error("maxTeamSize must be >= minTeamSize");
    }
  }

  // Registration sanity check
  if (this.registration.lastDate > this.schedule.startDate) {
    throw new Error("Registration lastDate cannot be after event startDate");
  }

  // Visibility sanity check
  if (!this.visibility) {
    this.visibility = { scope: "COLLEGE", department: "" };
  }
  const visibilityScope = String(this.visibility?.scope || "COLLEGE").toUpperCase();
  if (visibilityScope === "COLLEGE") {
    this.visibility.department = "";
  }
  if (visibilityScope === "DEPARTMENT" && !String(this.visibility?.department || "").trim()) {
    throw new Error("Department is required for department-level events");
  }

});

export default mongoose.model("Event", EventSchema);
