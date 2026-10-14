const { Prisma } = require("@prisma/client");
const multer = require("multer");
const config = require("../config/env");
const { HttpError } = require("../utils/httpError");
const { formatIssues } = require("./validate");

// Friendly names for unique indexes (MySQL reports the index name on P2002).
const UNIQUE_FIELDS = {
  users_username_key: ["username", "This username is already registered."],
  users_email_key: ["email", "This email address is already registered."],
  students_roll_number_key: ["rollNumber", "A student with this roll number already exists."],
  staff_employee_id_key: ["employeeId", "A staff member with this employee ID already exists."],
  departments_code_key: ["code", "A department with this code already exists."],
  courses_code_key: ["code", "A course with this code already exists."],
  subjects_code_key: ["code", "A subject with this code already exists."],
  sections_course_id_year_of_study_name_key: ["name", "This section already exists for the course and year."],
  staff_assignments_staff_id_subject_id_section_id_key: ["subjectId", "This staff member is already assigned to that subject and section."],
  class_sessions_section_id_date_period_key: ["period", "Attendance for this section, date and period has already been recorded."],
  student_fee_records_student_id_fee_structure_id_key: ["feeStructureId", "This fee is already assigned to the student."],
};

function prismaError(err) {
  if (err.code === "P2002") {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join("_") : String(err.meta?.target || "");
    const known = UNIQUE_FIELDS[target];
    if (known) return new HttpError(409, known[1], { details: { [known[0]]: known[1] }, code: "DUPLICATE" });
    return new HttpError(409, "A record with these details already exists.", { code: "DUPLICATE" });
  }
  if (err.code === "P2003" || err.code === "P2014") {
    return new HttpError(409, "This record is linked to other data and cannot be changed or removed.", { code: "IN_USE" });
  }
  if (err.code === "P2025") return new HttpError(404, "Resource not found", { code: "NOT_FOUND" });
  return null;
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}`, code: "ROUTE_NOT_FOUND" } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let httpErr = null;

  if (err instanceof HttpError) httpErr = err;
  else if (err instanceof Prisma.PrismaClientKnownRequestError) httpErr = prismaError(err);
  else if (err?.name === "ZodError") {
    httpErr = new HttpError(400, "Please correct the highlighted fields.", { details: formatIssues(err.issues), code: "BAD_REQUEST" });
  } else if (err instanceof multer.MulterError) {
    httpErr =
      err.code === "LIMIT_FILE_SIZE"
        ? new HttpError(413, `File is too large. Maximum size is ${Math.round(config.maxUploadBytes / 1048576)} MB.`, { code: "FILE_TOO_LARGE" })
        : new HttpError(400, err.message, { code: "UPLOAD_ERROR" });
  } else if (err?.type === "entity.parse.failed") {
    httpErr = new HttpError(400, "Malformed JSON request body.", { code: "BAD_JSON" });
  } else if (err?.type === "entity.too.large") {
    httpErr = new HttpError(413, "Request body is too large.", { code: "BODY_TOO_LARGE" });
  } else if (err?.expose && err.status >= 400 && err.status < 500) {
    // http-errors raised by Express internals (e.g. file streaming) that are safe to show.
    httpErr = new HttpError(err.status, err.status === 404 ? "File not found" : err.message, { code: "REQUEST_ERROR" });
  }

  if (!httpErr) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
    httpErr = new HttpError(500, "Something went wrong on our side. Please try again.", { code: "INTERNAL" });
  }

  const body = { error: { message: httpErr.message, code: httpErr.code } };
  if (httpErr.details) body.error.details = httpErr.details;
  res.status(httpErr.status).json(body);
}

module.exports = { errorHandler, notFoundHandler };
