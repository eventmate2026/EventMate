import buildOtpEmailTemplate from "./buildOtpEmailTemplate.js";

export default ({ name, otp }) =>
  buildOtpEmailTemplate({
    name,
    otp,
    title: "Verify your EventMate email",
    intro:
      "Use the one-time password below to confirm your email address and finish setting up your EventMate account.",
    otpLabel: "Email Verification Code",
    validityText: "This verification code is valid for 10 minutes.",
    preheader: "Confirm your email address to activate your EventMate account.",
    accent: "#4f46e5",
    accentSoft: "#eef2ff",
  });
