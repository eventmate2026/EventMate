import jwt from "jsonwebtoken";

export default (id, expiresIn = "1h") =>
  jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn });
