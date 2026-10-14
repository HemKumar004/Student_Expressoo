const { z } = require("zod");
const config = require("../config/env");
const { parseDateOnly } = require("../utils/dates");

const id = z.coerce.number({ error: "Must be a number" }).int().positive({ error: "Invalid identifier" });
const optionalId = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : v), id.optional());
const nullableId = z.preprocess((v) => (v === "" || v === undefined ? null : v), id.nullable());

const idParams = z.object({ id });

const trimmed = (max, label = "This field") =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${max} characters` });

const optionalTrimmed = (max) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max, { error: `Must be at most ${max} characters` }).nullable().optional()
  );

const dateOnly = z
  .string({ error: "Date is required" })
  .refine((v) => parseDateOnly(v) !== null, { error: "Use a valid date (YYYY-MM-DD)" });

const optionalDate = z.preprocess((v) => (v === "" || v === null ? undefined : v), dateOnly.optional());

const dateTime = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.date({ error: "Use a valid date and time" }).nullable()
);

const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(191, { error: "Email is too long" })
  .pipe(z.email({ error: "Enter a valid email address" }));

const mobile = z
  .string({ error: "Mobile number is required" })
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, { error: "Enter a valid mobile number (10–15 digits)" });

const optionalMobile = z.preprocess((v) => (v === "" ? null : v), mobile.nullable().optional());

const password = z
  .string({ error: "Password is required" })
  .min(config.rules.passwordMinLength, { error: `Password must be at least ${config.rules.passwordMinLength} characters` })
  .max(72, { error: "Password must be at most 72 characters" })
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), { error: "Password must contain at least one letter and one number" });

const fullName = trimmed(120, "Full name").refine((v) => v.length >= 2, { error: "Full name is too short" });

const rollNumber = z
  .string({ error: "Roll number is required" })
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[A-Z0-9]{${config.rules.rollNumberLength}}$`), {
    error: `Roll number must be exactly ${config.rules.rollNumberLength} letters or digits`,
  });

const employeeId = z
  .string({ error: "Employee ID is required" })
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[A-Z0-9]{${config.rules.employeeIdLength}}$`), {
    error: `Employee ID must be exactly ${config.rules.employeeIdLength} letters or digits`,
  });

/** Positive money amount with up to 2 decimals, kept as a string for exact DECIMAL handling. */
const money = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v), { error: "Enter a valid amount (up to 2 decimal places)" });

const positiveMoney = money.refine((v) => Number(v) > 0, { error: "Amount must be greater than zero" });

const queryBool = z.preprocess((v) => (v === "true" || v === "1" ? true : v === "false" || v === "0" ? false : v), z.boolean().optional());

const search = z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v), z.string().max(100).optional());

const period = z.coerce
  .number({ error: "Period is required" })
  .int()
  .min(1, { error: "Period must be at least 1" })
  .max(config.rules.maxPeriodsPerDay, { error: `Period must be at most ${config.rules.maxPeriodsPerDay}` });

module.exports = {
  z,
  id,
  optionalId,
  nullableId,
  idParams,
  trimmed,
  optionalTrimmed,
  dateOnly,
  optionalDate,
  dateTime,
  email,
  mobile,
  optionalMobile,
  password,
  fullName,
  rollNumber,
  employeeId,
  money,
  positiveMoney,
  queryBool,
  search,
  period,
};
