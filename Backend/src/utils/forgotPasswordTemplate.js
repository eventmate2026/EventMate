import buildOtpEmailTemplate from "./buildOtpEmailTemplate.js";

export default ({ name, otp }) =>
  buildOtpEmailTemplate({
    name,
    otp,
    title: "Reset your EventMate password",
    intro:
      "We received a request to reset your password. Use the one-time password below to continue securely.",
    otpLabel: "Password Reset Code",
    validityText: "This password reset code is valid for 5 minutes.",
    preheader: "Use this secure code to reset your EventMate password.",
    accent: "#0f766e",
    accentSoft: "#ecfeff",
  });
