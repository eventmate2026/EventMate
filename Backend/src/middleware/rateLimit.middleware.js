import rateLimit from "express-rate-limit";

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message }
  });

export const authLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many authentication requests. Please try again later."
});

export const otpRequestLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Please try again later."
});

export const otpVerificationLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Too many OTP verification attempts. Please try again later."
});

export const passwordResetLimiter = buildLimiter({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: "Too many password reset attempts. Please try again later."
});

export const refreshTokenLimiter = buildLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: "Too many session refresh attempts. Please try again later."
});
