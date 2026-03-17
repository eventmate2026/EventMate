import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../src/models/User.model.js";

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const adminExists = await User.findOne({ role: "MAIN_ADMIN" });
    if (adminExists) {
      console.log("⚠️ MAIN_ADMIN already exists");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    const admin = await User.create({
      fullName: "Super Admin",
      email: "eventmate2026@gmail.com",
      password: hashedPassword,
      role: "MAIN_ADMIN",
      emailVerified: true
    });

    console.log("✅ MAIN_ADMIN created successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating MAIN_ADMIN:", err.message);
    process.exit(1);
  }
};

createAdmin();
