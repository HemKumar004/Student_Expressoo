/**
 * Errors that are safe to show to API clients. Anything else is reported as a generic 500.
 * `code` is a stable machine-readable identifier; `details` carries field-level problems.
 */
class HttpError extends Error {
  constructor(status, message, { details, code } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (details) this.details = details;
    if (code) this.code = code;
  }
}

const badRequest = (message, details) => new HttpError(400, message, { details, code: "BAD_REQUEST" });
const unauthorized = (message = "Authentication required", code = "UNAUTHENTICATED") =>
  new HttpError(401, message, { code });
const forbidden = (message = "You do not have permission to perform this action", code = "FORBIDDEN") =>
  new HttpError(403, message, { code });
const notFound = (message = "Resource not found") => new HttpError(404, message, { code: "NOT_FOUND" });
const conflict = (message, details) => new HttpError(409, message, { details, code: "CONFLICT" });
const unprocessable = (message, details) => new HttpError(422, message, { details, code: "UNPROCESSABLE" });

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict, unprocessable };
