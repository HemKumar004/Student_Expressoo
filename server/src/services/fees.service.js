const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { parseDateOnly, toDateOnly, today } = require("../utils/dates");
const { dec, money, netAmount, balanceOf, feeStatusFor, ZERO } = require("../utils/money");
const { serializeSection, sectionLabel, personRef } = require("../utils/serialize");
const { notFound, badRequest, conflict, unprocessable } = require("../utils/httpError");
const { pageArgs, paged } = require("../utils/pagination");
const { audit } = require("../utils/audit");
const { deliverNotification } = require("./notify.service");

const METHOD_LABELS = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank transfer", CHEQUE: "Cheque", DEMAND_DRAFT: "Demand draft" };
const inr = (v) => `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------------------
// Serialisers
// ---------------------------------------------------------------------------

function serializeStructure(s) {
  return {
    id: s.id,
    name: s.name,
    academicYear: s.academicYear,
    courseId: s.courseId,
    course: s.course ? { id: s.course.id, code: s.course.code, name: s.course.name } : null,
    yearOfStudy: s.yearOfStudy,
    amount: money(s.amount),
    dueDate: toDateOnly(s.dueDate),
    description: s.description,
    isActive: s.isActive,
    createdAt: s.createdAt,
    stats: s._stats,
  };
}

function serializeRecord(r) {
  const net = netAmount(r);
  const balance = balanceOf(r);
  return {
    id: r.id,
    amount: money(r.amount),
    discount: money(r.discount),
    netAmount: money(net),
    amountPaid: money(r.amountPaid),
    balance: money(balance),
    status: r.status,
    dueDate: toDateOnly(r.dueDate),
    overdue: balance.gt(0) && r.dueDate < today(),
    remarks: r.remarks,
    feeStructure: r.feeStructure ? { id: r.feeStructure.id, name: r.feeStructure.name, academicYear: r.feeStructure.academicYear } : undefined,
    student: r.student
      ? {
          id: r.student.id,
          rollNumber: r.student.rollNumber,
          fullName: r.student.user?.fullName,
          section: r.student.section ? serializeSection(r.student.section) : undefined,
        }
      : undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function serializePayment(p) {
  return {
    id: p.id,
    receiptNo: p.receiptNo,
    amount: money(p.amount),
    method: p.method,
    methodLabel: METHOD_LABELS[p.method],
    referenceNo: p.referenceNo,
    paidOn: toDateOnly(p.paidOn),
    status: p.status,
    notes: p.notes,
    recordedBy: personRef(p.recordedBy),
    voidedBy: personRef(p.voidedBy),
    voidedAt: p.voidedAt,
    voidReason: p.voidReason,
    createdAt: p.createdAt,
    feeRecord: p.feeRecord
      ? {
          id: p.feeRecord.id,
          feeStructure: p.feeRecord.feeStructure ? { id: p.feeRecord.feeStructure.id, name: p.feeRecord.feeStructure.name, academicYear: p.feeRecord.feeStructure.academicYear } : undefined,
          student: p.feeRecord.student
            ? {
                id: p.feeRecord.student.id,
                rollNumber: p.feeRecord.student.rollNumber,
                fullName: p.feeRecord.student.user?.fullName,
                section: p.feeRecord.student.section ? serializeSection(p.feeRecord.student.section) : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

const recordInclude = {
  feeStructure: true,
  student: { include: { user: true, section: { include: { course: true } } } },
};

const paymentInclude = {
  recordedBy: true,
  voidedBy: true,
  feeRecord: { include: recordInclude },
};

// ---------------------------------------------------------------------------
// Fee structures
// ---------------------------------------------------------------------------

async function structureStats(ids) {
  if (!ids.length) return new Map();
  const rows = await prisma.studentFeeRecord.groupBy({
    by: ["feeStructureId"],
    where: { feeStructureId: { in: ids } },
    _count: { _all: true },
    _sum: { amount: true, discount: true, amountPaid: true },
  });
  return new Map(
    rows.map((r) => {
      const net = dec(r._sum.amount).minus(dec(r._sum.discount));
      return [
        r.feeStructureId,
        { assigned: r._count._all, billed: money(net), collected: money(r._sum.amountPaid), outstanding: money(net.minus(dec(r._sum.amountPaid))) },
      ];
    })
  );
}

async function listStructures(q) {
  const rows = await prisma.feeStructure.findMany({
    where: {
      ...(q.courseId && { courseId: q.courseId }),
      ...(q.academicYear && { academicYear: q.academicYear }),
      ...(q.active !== undefined && { isActive: q.active }),
    },
    include: { course: true },
    orderBy: [{ academicYear: "desc" }, { dueDate: "asc" }],
  });
  const stats = await structureStats(rows.map((r) => r.id));
  return rows.map((r) => serializeStructure({ ...r, _stats: stats.get(r.id) || { assigned: 0, billed: "0.00", collected: "0.00", outstanding: "0.00" } }));
}

async function ensureCourse(courseId) {
  if (courseId && !(await prisma.course.count({ where: { id: courseId } }))) {
    throw badRequest("Please correct the highlighted fields.", { courseId: "Choose a valid course" });
  }
}

async function createStructure(data, req) {
  await ensureCourse(data.courseId);
  const s = await prisma.feeStructure.create({
    data: { ...data, amount: dec(data.amount), dueDate: parseDateOnly(data.dueDate), createdById: req.user.id },
    include: { course: true },
  });
  await audit(prisma, { req, action: "fee_structure.create", entityType: "fee_structure", entityId: s.id, summary: `Created fee structure "${s.name}" (${s.academicYear}) for ${inr(s.amount)}` });
  return serializeStructure(s);
}

async function updateStructure(id, data, req) {
  const existing = await prisma.feeStructure.findUnique({ where: { id }, include: { _count: { select: { records: true } } } });
  if (!existing) throw notFound("Fee structure not found");
  if (data.courseId !== undefined) await ensureCourse(data.courseId);
  const changesScope = data.amount !== undefined || data.courseId !== undefined || data.yearOfStudy !== undefined;
  if (existing._count.records && changesScope) {
    const sameAmount = data.amount === undefined || dec(data.amount).eq(existing.amount);
    const sameCourse = data.courseId === undefined || data.courseId === existing.courseId;
    const sameYear = data.yearOfStudy === undefined || data.yearOfStudy === existing.yearOfStudy;
    if (!(sameAmount && sameCourse && sameYear)) {
      throw conflict("The amount and audience cannot change after the fee has been assigned to students. Create a new fee structure instead, or adjust individual records with a discount.");
    }
  }
  const s = await prisma.feeStructure.update({
    where: { id },
    data: {
      ...data,
      ...(data.amount !== undefined && { amount: dec(data.amount) }),
      ...(data.dueDate !== undefined && { dueDate: parseDateOnly(data.dueDate) }),
    },
    include: { course: true },
  });
  await audit(prisma, { req, action: "fee_structure.update", entityType: "fee_structure", entityId: id, summary: `Updated fee structure "${s.name}"`, metadata: { fields: Object.keys(data) } });
  return serializeStructure(s);
}

async function deleteStructure(id, req) {
  const s = await prisma.feeStructure.findUnique({ where: { id }, include: { _count: { select: { records: true } } } });
  if (!s) throw notFound("Fee structure not found");
  if (s._count.records) throw conflict("This fee has been assigned to students and cannot be deleted. Mark it inactive instead.");
  await prisma.feeStructure.delete({ where: { id } });
  await audit(prisma, { req, action: "fee_structure.delete", entityType: "fee_structure", entityId: id, summary: `Deleted fee structure "${s.name}"` });
  return { ok: true };
}

/** Bill every active student matching the structure's course/year. Existing bills are skipped. */
async function assignStructure(id, req) {
  const s = await prisma.feeStructure.findUnique({ where: { id }, include: { course: true } });
  if (!s) throw notFound("Fee structure not found");
  if (!s.isActive) throw conflict("Activate this fee structure before assigning it.");

  const students = await prisma.student.findMany({
    where: {
      user: { status: "ACTIVE" },
      section: { ...(s.courseId && { courseId: s.courseId }), ...(s.yearOfStudy && { yearOfStudy: s.yearOfStudy }) },
    },
    select: { id: true, userId: true },
  });
  if (!students.length) return { created: 0, skipped: 0, matched: 0 };

  const result = await prisma.$transaction(async (tx) => {
    const already = await tx.studentFeeRecord.findMany({ where: { feeStructureId: id }, select: { studentId: true } });
    const billed = new Set(already.map((r) => r.studentId));
    const fresh = students.filter((st) => !billed.has(st.id));
    if (fresh.length) {
      await tx.studentFeeRecord.createMany({
        data: fresh.map((st) => ({ studentId: st.id, feeStructureId: id, amount: s.amount, dueDate: s.dueDate, status: "UNPAID" })),
        skipDuplicates: true,
      });
      await deliverNotification(tx, {
        title: `New fee: ${s.name}`,
        message: `${s.name} (${s.academicYear}) of ${inr(s.amount)} has been added to your account. Due date: ${toDateOnly(s.dueDate)}. Pay at the accounts office and keep your receipt.`,
        category: "FEE",
        targetType: "STUDENTS",
        targetLabel: s.course ? `${s.course.code}${s.yearOfStudy ? ` · Year ${s.yearOfStudy}` : ""}` : "All students",
        senderId: req.user.id,
        userIds: fresh.map((st) => st.userId),
      });
    }
    await audit(tx, {
      req,
      action: "fee_structure.assign",
      entityType: "fee_structure",
      entityId: id,
      summary: `Assigned "${s.name}" to ${fresh.length} student(s) (${students.length - fresh.length} already billed)`,
    });
    return { created: fresh.length, skipped: students.length - fresh.length, matched: students.length };
  });
  return result;
}

// ---------------------------------------------------------------------------
// Student fee records
// ---------------------------------------------------------------------------

async function listRecords(q) {
  const where = {
    ...(q.status && { status: q.status }),
    ...(q.feeStructureId && { feeStructureId: q.feeStructureId }),
    ...(q.overdue && { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today() } }),
    student: {
      ...(q.sectionId && { sectionId: q.sectionId }),
      ...(q.courseId && { section: { courseId: q.courseId } }),
      ...(q.search && { OR: [{ rollNumber: { contains: q.search } }, { user: { fullName: { contains: q.search } } }] }),
    },
  };
  const [rows, total, sums] = await Promise.all([
    prisma.studentFeeRecord.findMany({
      where,
      include: recordInclude,
      orderBy: [{ dueDate: "asc" }, { student: { rollNumber: "asc" } }],
      ...pageArgs(q),
    }),
    prisma.studentFeeRecord.count({ where }),
    prisma.studentFeeRecord.aggregate({ where, _sum: { amount: true, discount: true, amountPaid: true } }),
  ]);
  const billed = dec(sums._sum.amount).minus(dec(sums._sum.discount));
  return {
    ...paged(rows.map(serializeRecord), total, q),
    totals: { billed: money(billed), collected: money(sums._sum.amountPaid), outstanding: money(billed.minus(dec(sums._sum.amountPaid))) },
  };
}

async function getRecord(id) {
  const r = await prisma.studentFeeRecord.findUnique({
    where: { id },
    include: { ...recordInclude, payments: { include: { recordedBy: true, voidedBy: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!r) throw notFound("Fee record not found");
  return { ...serializeRecord(r), payments: r.payments.map(serializePayment) };
}

/** Apply a discount/concession. The status is always recomputed from the amounts. */
async function updateRecord(id, data, req) {
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.studentFeeRecord.findUnique({ where: { id }, include: { student: { include: { user: true } }, feeStructure: true } });
    if (!r) throw notFound("Fee record not found");
    const discount = data.discount !== undefined ? dec(data.discount) : r.discount;
    if (discount.gt(r.amount)) throw unprocessable("Discount cannot exceed the fee amount.", { discount: "Discount cannot exceed the fee amount" });
    if (dec(r.amountPaid).gt(dec(r.amount).minus(discount))) {
      throw unprocessable("Discount would make the amount already paid exceed the net fee.", { discount: "Too large for the amount already paid" });
    }
    const status = feeStatusFor({ amount: r.amount, discount, amountPaid: r.amountPaid });
    const u = await tx.studentFeeRecord.update({
      where: { id },
      data: { discount, status, ...(data.remarks !== undefined && { remarks: data.remarks }) },
      include: recordInclude,
    });
    await audit(tx, {
      req,
      action: "fee_record.update",
      entityType: "student_fee_record",
      entityId: id,
      summary: `Adjusted "${r.feeStructure.name}" for ${r.student.user.fullName} (${r.student.rollNumber}): discount ${inr(discount)}`,
      metadata: { previousDiscount: money(r.discount), discount: money(discount), status },
    });
    return u;
  });
  return serializeRecord(updated);
}

/** Everything a student needs: bills, balances, and payment history. */
async function myFees(student) {
  const records = await prisma.studentFeeRecord.findMany({
    where: { studentId: student.id },
    include: { feeStructure: true, payments: { include: { recordedBy: true, voidedBy: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { dueDate: "asc" },
  });
  let billed = ZERO;
  let paid = ZERO;
  let overdue = ZERO;
  let nextDue = null;
  const todayObj = today();
  for (const r of records) {
    billed = billed.plus(netAmount(r));
    paid = paid.plus(dec(r.amountPaid));
    const bal = balanceOf(r);
    if (bal.gt(0)) {
      if (r.dueDate < todayObj) overdue = overdue.plus(bal);
      else if (!nextDue || r.dueDate < nextDue.dueDate) nextDue = r;
    }
  }
  const payments = records
    .flatMap((r) => r.payments.map((p) => ({ ...serializePayment(p), feeName: r.feeStructure.name, academicYear: r.feeStructure.academicYear })))
    .sort((a, b) => (a.paidOn < b.paidOn ? 1 : a.paidOn > b.paidOn ? -1 : b.id - a.id));
  return {
    summary: {
      billed: money(billed),
      paid: money(paid),
      balance: money(billed.minus(paid)),
      overdue: money(overdue),
      nextDue: nextDue ? { feeName: nextDue.feeStructure.name, dueDate: toDateOnly(nextDue.dueDate), amount: money(balanceOf(nextDue)) } : null,
    },
    records: records.map((r) => serializeRecord(r)),
    payments,
    onlinePaymentsEnabled: false,
  };
}

// ---------------------------------------------------------------------------
// Payments (recorded by the accounts office)
// ---------------------------------------------------------------------------

function receiptNumber(payment, paidOn) {
  return `RCPT-${paidOn.slice(0, 4)}-${String(payment.id).padStart(6, "0")}`;
}

async function recordPayment(data, req) {
  const amount = dec(data.amount);
  const paidOn = parseDateOnly(data.paidOn);
  if (paidOn > today()) throw badRequest("Please correct the highlighted fields.", { paidOn: "Payment date cannot be in the future" });

  const payment = await prisma.$transaction(async (tx) => {
    const r = await tx.studentFeeRecord.findUnique({ where: { id: data.feeRecordId }, include: { feeStructure: true, student: { include: { user: true } } } });
    if (!r) throw notFound("Fee record not found");
    const balance = balanceOf(r);
    if (balance.lte(0)) throw unprocessable("This fee has already been settled.");
    if (amount.gt(balance)) {
      throw unprocessable(`Amount exceeds the outstanding balance of ${inr(balance)}.`, { amount: `Maximum allowed is ${inr(balance)}` });
    }

    const newPaid = dec(r.amountPaid).plus(amount);
    const status = feeStatusFor({ amount: r.amount, discount: r.discount, amountPaid: newPaid });
    // Optimistic concurrency: only apply if nobody changed amountPaid since we read it.
    const { count } = await tx.studentFeeRecord.updateMany({
      where: { id: r.id, amountPaid: r.amountPaid },
      data: { amountPaid: newPaid, status },
    });
    if (count !== 1) throw conflict("This fee record was updated by someone else. Refresh and try again.");

    const created = await tx.payment.create({
      data: {
        feeRecordId: r.id,
        receiptNo: `TMP-${crypto.randomUUID()}`,
        amount,
        method: data.method,
        referenceNo: data.referenceNo ?? null,
        paidOn,
        notes: data.notes ?? null,
        recordedById: req.user.id,
      },
    });
    const p = await tx.payment.update({ where: { id: created.id }, data: { receiptNo: receiptNumber(created, data.paidOn) }, include: paymentInclude });

    await deliverNotification(tx, {
      title: "Payment received",
      message: `We received ${inr(amount)} towards ${r.feeStructure.name} (${METHOD_LABELS[data.method]}). Receipt ${p.receiptNo}. Remaining balance: ${inr(balance.minus(amount))}.`,
      category: "FEE",
      targetType: "USER",
      targetLabel: r.student.user.fullName,
      senderId: req.user.id,
      userIds: [r.student.userId],
    });
    await audit(tx, {
      req,
      action: "payment.record",
      entityType: "payment",
      entityId: p.id,
      summary: `Recorded ${inr(amount)} (${METHOD_LABELS[data.method]}) from ${r.student.user.fullName} (${r.student.rollNumber}) for "${r.feeStructure.name}" — ${p.receiptNo}`,
      metadata: { feeRecordId: r.id, amount: money(amount), status },
    });
    return p;
  });
  return serializePayment(payment);
}

async function voidPayment(id, { reason }, req) {
  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id }, include: { feeRecord: { include: { feeStructure: true, student: { include: { user: true } } } } } });
    if (!p) throw notFound("Payment not found");
    if (p.status === "VOIDED") throw conflict("This payment has already been voided.");
    const r = p.feeRecord;
    const newPaid = dec(r.amountPaid).minus(dec(p.amount));
    if (newPaid.isNegative()) throw conflict("Fee record is inconsistent with this payment; contact support.");
    const status = feeStatusFor({ amount: r.amount, discount: r.discount, amountPaid: newPaid });
    const { count } = await tx.studentFeeRecord.updateMany({ where: { id: r.id, amountPaid: r.amountPaid }, data: { amountPaid: newPaid, status } });
    if (count !== 1) throw conflict("This fee record was updated by someone else. Refresh and try again.");
    const voided = await tx.payment.update({
      where: { id },
      data: { status: "VOIDED", voidedById: req.user.id, voidedAt: new Date(), voidReason: reason },
      include: paymentInclude,
    });
    await audit(tx, {
      req,
      action: "payment.void",
      entityType: "payment",
      entityId: id,
      summary: `Voided ${p.receiptNo} (${inr(p.amount)}) for ${r.student.user.fullName} (${r.student.rollNumber}): ${reason}`,
      metadata: { feeRecordId: r.id, amount: money(p.amount) },
    });
    return voided;
  });
  return serializePayment(payment);
}

async function listPayments(q, { studentId } = {}) {
  const where = {
    ...(q.method && { method: q.method }),
    ...(q.status && { status: q.status }),
    ...((q.from || q.to) && { paidOn: { ...(q.from && { gte: parseDateOnly(q.from) }), ...(q.to && { lte: parseDateOnly(q.to) }) } }),
    ...((studentId || q.studentId || q.search) && {
      feeRecord: {
        student: {
          ...((studentId || q.studentId) && { id: studentId || q.studentId }),
          ...(q.search && { OR: [{ rollNumber: { contains: q.search } }, { user: { fullName: { contains: q.search } } }] }),
        },
      },
    }),
  };
  if (q.search && /^RCPT-/i.test(q.search)) {
    delete where.feeRecord;
    where.receiptNo = { contains: q.search };
  }
  const [rows, total, sum] = await Promise.all([
    prisma.payment.findMany({ where, include: paymentInclude, orderBy: [{ paidOn: "desc" }, { id: "desc" }], ...pageArgs(q) }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { ...where, status: "RECORDED" }, _sum: { amount: true } }),
  ]);
  return { ...paged(rows.map(serializePayment), total, q), totals: { collected: money(sum._sum.amount) } };
}

async function getPayment(id, user) {
  const p = await prisma.payment.findUnique({ where: { id }, include: paymentInclude });
  if (!p) throw notFound("Payment not found");
  // Students may only open their own receipts.
  if (user.role === "STUDENT" && p.feeRecord.student.id !== user.student?.id) throw notFound("Payment not found");
  return serializePayment(p);
}

module.exports = {
  listStructures,
  createStructure,
  updateStructure,
  deleteStructure,
  assignStructure,
  listRecords,
  getRecord,
  updateRecord,
  myFees,
  recordPayment,
  voidPayment,
  listPayments,
  getPayment,
  serializeRecord,
  METHOD_LABELS,
  sectionLabel,
};
