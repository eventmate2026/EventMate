import jwt from "jsonwebtoken";

export default (payloadOrUserId, expiresIn = "7d") => {
  const payload =
    payloadOrUserId && typeof payloadOrUserId === "object"
      ? payloadOrUserId
      : { userId: payloadOrUserId };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn });
};
