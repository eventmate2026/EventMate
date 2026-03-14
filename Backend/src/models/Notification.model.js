import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    // Who receives this notification
    recipient: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
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
