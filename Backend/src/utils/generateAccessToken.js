import jwt from "jsonwebtoken";

export default (payloadOrUserId, expiresIn = "1h") => {
  const payload =
    payloadOrUserId && typeof payloadOrUserId === "object"
      ? payloadOrUserId
      : { userId: payloadOrUserId };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};
