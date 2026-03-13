import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },

    role: {
      type: String,
      enum: ["MAIN_ADMIN", "ORGANIZER", "STUDENT_COORDINATOR", "STUDENT"],
      default: "STUDENT"
    },

    mobileNumber: { type: String, match: /^[6-9]\d{9}$/, sparse: true },
    collegeName: { type: String, trim: true, maxlength: 150 },
    avatar: { type: String, default: null },
    educationLevel: {
      type: String,
      enum: ["10th", "12th", "Diploma", "Engineering", ""],
      default: ""
    },

    academicProfile: { branch: String, year: { type: String, enum: ["1st","2nd","3rd","4th"] } },
    professionalProfile: { department: String, occupation: String },

    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, default: null },
    refreshToken: { type: String, select: false },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastLoginAt: Date,
    passwordChangedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);
