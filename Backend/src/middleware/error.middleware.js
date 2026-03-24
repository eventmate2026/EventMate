export default (err, req, res, next) => {
  const isJsonSyntaxError = err instanceof SyntaxError && Object.prototype.hasOwnProperty.call(err, "body");
  const statusCode = isJsonSyntaxError
    ? 400
    : Number(err.statusCode || err.status) || 500;

  const message = isJsonSyntaxError
    ? "Invalid request payload. Please send valid JSON."
    : err.message || "Server Error";

  if (statusCode >= 500) {
    console.error(err.stack || err);
  } else {
    console.warn(`[${statusCode}] ${message}`);
  }

  res.status(statusCode).json({ success: false, message });
};
