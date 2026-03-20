import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    // Who receives this notification
    recipient: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
      },
      name: {
        type: String,
        required: true
      },
      role: {
        type: String,
        required: true
      },
      email: {
        type: String,
        default: ""
      }
    },

    // Notification content
    title: {
      type: String,
      required: true
    },

    message: {
      type: String,
      required: true
    },

    // Type helps frontend show different icons
    type: {
      type: String,
      enum: [
        "REGISTRATION",
        "ASSIGNMENT",
        "ATTENDANCE",
        "CERTIFICATE",
        "FEEDBACK",
        "CONTACT",
        "WINNER",
        "NOTICE",
        "MESSAGE"
      ],
      required: true
    },

    // Reference to related document
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },

    sender: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      name: {
        type: String
      },
      role: {
        type: String
      }
    },

    groupId: {
      type: String,
      default: null
    },

    emailDelivery: {
      requested: {
        type: Boolean,
        default: false
      },
      trackingMode: {
        type: String,
        enum: ["PROVIDER_ACCEPTANCE", "WEBHOOK_DELIVERY"],
        default: "PROVIDER_ACCEPTANCE"
      },
      status: {
        type: String,
        enum: [
          "NOT_REQUESTED",
          "PENDING",
          "PROCESSING",
          "SENT",
          "FAILED",
          "SKIPPED"
        ],
        default: "NOT_REQUESTED"
      },
      attempts: {
        type: Number,
        default: 0
      },
      queuedAt: {
        type: Date,
        default: null
      },
      lastAttemptAt: {
        type: Date,
        default: null
      },
      nextAttemptAt: {
        type: Date,
        default: null
      },
      acceptedAt: {
        type: Date,
        default: null
      },
      deliveredAt: {
        type: Date,
        default: null
      },
      openedAt: {
        type: Date,
        default: null
      },
      openCount: {
        type: Number,
        default: 0
      },
      providerMessageId: {
        type: String,
        default: ""
      },
      lastError: {
        type: String,
        default: ""
      }
    },

    emailPayload: {
      subject: {
        type: String,
        default: ""
      },
      html: {
        type: String,
        default: ""
      },
      text: {
        type: String,
        default: ""
      },
      attachments: [
        {
          filename: {
            type: String,
            default: ""
          },
          content: {
            type: String,
            default: ""
          },
          type: {
            type: String,
            default: ""
          },
          disposition: {
            type: String,
            default: ""
          },
          contentId: {
            type: String,
            default: ""
          }
        }
      ]
    },

    isRead: {
      type: Boolean,
      default: false
    },

    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

export default mongoose.model("Notification", NotificationSchema);
