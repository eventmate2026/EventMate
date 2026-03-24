export default (err, req, res, next) => {
  const isJsonSyntaxError = err instanceof SyntaxError && Object.prototype.hasOwnProperty.call(err, "body");
  const isValidationError = err?.name === "ValidationError";
  const isCastError = err?.name === "CastError";
  const statusCode = isJsonSyntaxError
    ? 400
    : Number(err.statusCode || err.status) || 500;

  const message = isJsonSyntaxError
    ? "Invalid request payload. Please send valid JSON."
    : isValidationError
      ? "Some submitted details are invalid. Please review and try again."
      : isCastError
        ? "The requested record could not be found."
        : statusCode >= 500
          ? "We couldn't process your request right now. Please try again later."
          : err.message || "Request failed.";

  if (statusCode >= 500) {
    console.error(err.stack || err);
  } else {
    console.warn(`[${statusCode}] ${message}`);
  }

  res.status(statusCode).json({ success: false, message });
};
