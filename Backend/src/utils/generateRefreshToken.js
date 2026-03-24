import jwt from "jsonwebtoken";

export default (id, expiresIn = "7d") =>
  jwt.sign({ userId: id }, process.env.JWT_REFRESH_SECRET, { expiresIn });
