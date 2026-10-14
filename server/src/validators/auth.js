const c = require("./common");
const { z } = c;

const login = z.object({
  username: c.trimmed(191, "Username"),
  password: z.string({ error: "Password is required" }).min(1, { error: "Password is required" }).max(200),
  portal: z.enum(["student", "staff", "admin"], { error: "Unknown portal" }),
});

/** Public student self-registration. The role is never accepted from the client. */
const registerStudent = z
  .object({
    fullName: c.fullName,
    email: c.email,
    mobile: c.mobile,
    rollNumber: c.rollNumber,
    sectionId: c.id,
    password: c.password,
    confirmPassword: z.string({ error: "Please confirm your password" }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], error: "Passwords do not match" });

/** Public staff self-registration — accounts stay PENDING until an administrator approves them. */
const registerStaff = z
  .object({
    fullName: c.fullName,
    email: c.email,
    mobile: c.mobile,
    employeeId: c.employeeId,
    departmentId: c.id,
    designation: c.optionalTrimmed(80),
    password: c.password,
    confirmPassword: z.string({ error: "Please confirm your password" }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], error: "Passwords do not match" });

const updateMe = z
  .object({
    email: c.email.optional(),
    mobile: c.optionalMobile,
  })
  .refine((d) => d.email !== undefined || d.mobile !== undefined, { error: "Nothing to update" });

const changePassword = z
  .object({
    currentPassword: z.string({ error: "Current password is required" }).min(1, { error: "Current password is required" }),
    newPassword: c.password,
    confirmPassword: z.string({ error: "Please confirm your new password" }),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], error: "Passwords do not match" })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ["newPassword"], error: "Choose a password different from the current one" });

module.exports = { login, registerStudent, registerStaff, updateMe, changePassword };
