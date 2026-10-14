const c = require("./common");
const { paginationSchema } = require("../utils/pagination");
const { z } = c;

const status = z.enum(["PENDING", "ACTIVE", "INACTIVE"]);
const representativeRole = z.enum(["NONE", "CR", "LR"]);

const listStudents = paginationSchema.extend({
  search: c.search,
  courseId: c.optionalId,
  sectionId: c.optionalId,
  yearOfStudy: z.coerce.number().int().min(1).max(6).optional(),
  status: status.optional(),
  representativeRole: representativeRole.optional(),
  sort: z.enum(["rollNumber", "name", "createdAt"]).default("rollNumber"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

const createStudent = z.object({
  fullName: c.fullName,
  email: c.email,
  mobile: c.mobile,
  rollNumber: c.rollNumber,
  sectionId: c.id,
  admissionYear: z.coerce.number().int().min(1990).max(2100).optional().nullable(),
  password: c.password,
});

const updateStudent = z.object({
  fullName: c.fullName.optional(),
  email: c.email.optional(),
  mobile: c.optionalMobile,
  rollNumber: c.rollNumber.optional(),
  sectionId: c.id.optional(),
  admissionYear: z.coerce.number().int().min(1990).max(2100).optional().nullable(),
});

const listStaff = paginationSchema.extend({
  search: c.search,
  departmentId: c.optionalId,
  status: status.optional(),
  sort: z.enum(["name", "employeeId", "createdAt"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

const createStaff = z.object({
  fullName: c.fullName,
  email: c.email,
  mobile: c.mobile,
  employeeId: c.employeeId,
  departmentId: c.id,
  designation: c.optionalTrimmed(80),
  password: c.password,
});

const updateStaff = z.object({
  fullName: c.fullName.optional(),
  email: c.email.optional(),
  mobile: c.optionalMobile,
  employeeId: c.employeeId.optional(),
  departmentId: c.id.optional(),
  designation: c.optionalTrimmed(80),
});

const createAdmin = z.object({
  fullName: c.fullName,
  username: z
    .string({ error: "Username is required" })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{4,50}$/, { error: "Username must be 4–50 characters: letters, digits, dot, dash or underscore" }),
  email: c.email,
  mobile: c.optionalMobile,
  password: c.password,
});

const setStatus = z.object({ status, reason: c.optionalTrimmed(200) });
const setRepresentative = z.object({ representativeRole });
const resetPassword = z.object({ password: c.password });

module.exports = {
  listStudents,
  createStudent,
  updateStudent,
  listStaff,
  createStaff,
  updateStaff,
  createAdmin,
  setStatus,
  setRepresentative,
  resetPassword,
};
