import jwt from "jsonwebtoken";

const buildPayload = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return { userId: value };
};

export default (payload, expiresIn = "7d") =>
  jwt.sign(buildPayload(payload), process.env.JWT_REFRESH_SECRET, { expiresIn });
