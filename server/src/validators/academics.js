const c = require("./common");
const { z } = c;

const code = (max) =>
  z
    .string({ error: "Code is required" })
    .trim()
    .toUpperCase()
    .regex(new RegExp(`^[A-Z0-9][A-Z0-9-]{0,${max - 1}}$`), { error: `Code must be 1–${max} letters, digits or dashes` });

const year = z.coerce.number({ error: "Year is required" }).int().min(1, { error: "Year must be 1 or more" }).max(6, { error: "Year must be 6 or less" });

const department = z.object({ code: code(16), name: c.trimmed(120, "Name") });

const course = z.object({
  code: code(20),
  name: c.trimmed(150, "Name"),
  departmentId: c.id,
  durationYears: z.coerce.number().int().min(1).max(6).default(4),
});

// Explicit update schema: `.partial()` would re-apply the durationYears default on every update.
const courseUpdate = z.object({
  code: code(20).optional(),
  name: c.trimmed(150, "Name").optional(),
  departmentId: c.id.optional(),
  durationYears: z.coerce.number().int().min(1).max(6).optional(),
});

const section = z.object({
  courseId: c.id,
  yearOfStudy: year,
  name: z
    .string({ error: "Section name is required" })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,10}$/, { error: "Section name must be 1–10 letters or digits" }),
});

const subject = z.object({
  code: code(20),
  name: c.trimmed(150, "Name"),
  courseId: c.id,
  yearOfStudy: year,
  semester: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(1).max(12).nullable().optional()),
  credits: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(0).max(20).nullable().optional()),
});

const assignment = z.object({ staffId: c.id, subjectId: c.id, sectionId: c.id });

const listFilter = z.object({
  departmentId: c.optionalId,
  courseId: c.optionalId,
  sectionId: c.optionalId,
  staffId: c.optionalId,
  subjectId: c.optionalId,
  yearOfStudy: z.coerce.number().int().min(1).max(6).optional(),
});

module.exports = { department, course, courseUpdate, section, subject, assignment, listFilter };
