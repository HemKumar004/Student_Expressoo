const c = require("./common");
const { paginationSchema } = require("../utils/pagination");
const { z } = c;

const academicYear = z
  .string({ error: "Academic year is required" })
  .trim()
  .regex(/^\d{4}-\d{2}$/, { error: "Use the format 2026-27" })
  .refine((v) => (Number(v.slice(0, 4)) + 1) % 100 === Number(v.slice(5)), { error: "The second year must follow the first (e.g. 2026-27)" });

const optionalYear = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().int().min(1).max(6).nullable());

const createStructure = z.object({
  name: c.trimmed(120, "Name"),
  academicYear,
  courseId: c.nullableId,
  yearOfStudy: optionalYear,
  amount: c.positiveMoney,
  dueDate: c.dateOnly,
  description: c.optionalTrimmed(2000),
  isActive: z.boolean().default(true),
});

const updateStructure = z.object({
  name: c.trimmed(120, "Name").optional(),
  academicYear: academicYear.optional(),
  courseId: c.nullableId.optional(),
  yearOfStudy: optionalYear.optional(),
  amount: c.positiveMoney.optional(),
  dueDate: c.dateOnly.optional(),
  description: c.optionalTrimmed(2000),
  isActive: z.boolean().optional(),
});

const listStructures = z.object({
  courseId: c.optionalId,
  academicYear: z.string().trim().max(9).optional(),
  active: c.queryBool,
});

const listRecords = paginationSchema.extend({
  search: c.search,
  courseId: c.optionalId,
  sectionId: c.optionalId,
  feeStructureId: c.optionalId,
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "WAIVED"]).optional(),
  overdue: c.queryBool,
});

const updateRecord = z.object({
  discount: c.money.optional(),
  remarks: c.optionalTrimmed(255),
});

const recordPayment = z.object({
  feeRecordId: c.id,
  amount: c.positiveMoney,
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE", "DEMAND_DRAFT"], { error: "Choose a payment method" }),
  referenceNo: c.optionalTrimmed(100),
  paidOn: c.dateOnly,
  notes: c.optionalTrimmed(255),
});

const voidPayment = z.object({ reason: c.trimmed(255, "Reason") });

const listPayments = paginationSchema.extend({
  search: c.search,
  method: z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE", "DEMAND_DRAFT"]).optional(),
  status: z.enum(["RECORDED", "VOIDED"]).optional(),
  studentId: c.optionalId,
  from: c.optionalDate,
  to: c.optionalDate,
});

module.exports = { createStructure, updateStructure, listStructures, listRecords, updateRecord, recordPayment, voidPayment, listPayments };
