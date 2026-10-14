const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const config = require("../config/env");
const { attendanceStats } = require("./attendance.service");
const { parseDateOnly, toDateOnly, today, addDays } = require("../utils/dates");
const { serializeSection, serializeSubject } = require("../utils/serialize");
const { dec, money } = require("../utils/money");
const { notFound } = require("../utils/httpError");
const { pageArgs, paged } = require("../utils/pagination");

const ATTENDED = Prisma.sql`ar.status IN ('PRESENT','LATE')`;
const num = (v) => (v == null ? 0 : Number(v));

/** Per-student attendance for a section (optionally one subject) over a date range. */
async function attendanceReport({ sectionId, subjectId, from, to }) {
  const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { course: true } });
  if (!section) throw notFound("Section not found");
  const subject = subjectId ? await prisma.subject.findUnique({ where: { id: subjectId } }) : null;
  if (subjectId && !subject) throw notFound("Subject not found");

  const toDate = to ? parseDateOnly(to) : today();
  const fromDate = from ? parseDateOnly(from) : addDays(toDate, -89);
  const subjectFilter = subjectId ? Prisma.sql`AND cs.subject_id = ${subjectId}` : Prisma.empty;

  const [students, rows, sessions] = await Promise.all([
    prisma.student.findMany({ where: { sectionId }, include: { user: true }, orderBy: { rollNumber: "asc" } }),
    prisma.$queryRaw`
      SELECT ar.student_id AS studentId, COUNT(*) AS total, SUM(${ATTENDED}) AS attended, SUM(ar.status = 'LATE') AS late
      FROM attendance_records ar JOIN class_sessions cs ON cs.id = ar.session_id
      WHERE cs.section_id = ${sectionId} AND cs.date BETWEEN ${fromDate} AND ${toDate} ${subjectFilter}
      GROUP BY ar.student_id`,
    prisma.classSession.count({
      where: { sectionId, date: { gte: fromDate, lte: toDate }, ...(subjectId && { subjectId }) },
    }),
  ]);
  const byStudent = new Map(rows.map((r) => [Number(r.studentId), r]));
  const list = students.map((s) => {
    const r = byStudent.get(s.id);
    return {
      studentId: s.id,
      rollNumber: s.rollNumber,
      fullName: s.user.fullName,
      status: s.user.status,
      late: num(r?.late),
      ...attendanceStats(num(r?.total), num(r?.attended)),
    };
  });
  const measured = list.filter((s) => s.total > 0);
  return {
    section: serializeSection(section),
    subject: subject ? serializeSubject(subject) : null,
    range: { from: toDateOnly(fromDate), to: toDateOnly(toDate) },
    threshold: config.rules.attendanceThreshold,
    sessions,
    summary: {
      students: list.length,
      average: measured.length ? Math.round((measured.reduce((a, s) => a + s.percentage, 0) / measured.length) * 10) / 10 : null,
      belowThreshold: measured.filter((s) => s.percentage < config.rules.attendanceThreshold).length,
    },
    rows: list,
  };
}

/** Billing and collection by section plus the list of overdue accounts. */
async function feeReport({ courseId, academicYear }) {
  const yearFilter = academicYear ? Prisma.sql`AND fs.academic_year = ${academicYear}` : Prisma.empty;
  const courseFilter = courseId ? Prisma.sql`AND sec.course_id = ${courseId}` : Prisma.empty;
  const todayObj = today();

  const [bySection, defaulters] = await Promise.all([
    prisma.$queryRaw`
      SELECT sec.id AS sectionId, COUNT(DISTINCT st.id) AS students,
             SUM(r.amount - r.discount) AS billed, SUM(r.amount_paid) AS collected,
             SUM(CASE WHEN r.status IN ('UNPAID','PARTIAL') AND r.due_date < ${todayObj} THEN 1 ELSE 0 END) AS overdueRecords
      FROM student_fee_records r
      JOIN fee_structures fs ON fs.id = r.fee_structure_id
      JOIN students st ON st.id = r.student_id
      JOIN sections sec ON sec.id = st.section_id
      WHERE 1 = 1 ${yearFilter} ${courseFilter}
      GROUP BY sec.id`,
    prisma.$queryRaw`
      SELECT st.id AS studentId, SUM(r.amount - r.discount - r.amount_paid) AS balance, MIN(r.due_date) AS oldestDue, COUNT(*) AS records
      FROM student_fee_records r
      JOIN fee_structures fs ON fs.id = r.fee_structure_id
      JOIN students st ON st.id = r.student_id
      JOIN sections sec ON sec.id = st.section_id
      WHERE r.status IN ('UNPAID','PARTIAL') AND r.due_date < ${todayObj} ${yearFilter} ${courseFilter}
      GROUP BY st.id
      ORDER BY balance DESC
      LIMIT 200`,
  ]);

  const [sections, students] = await Promise.all([
    prisma.section.findMany({ where: { id: { in: bySection.map((r) => Number(r.sectionId)) } }, include: { course: true } }),
    prisma.student.findMany({ where: { id: { in: defaulters.map((r) => Number(r.studentId)) } }, include: { user: true, section: { include: { course: true } } } }),
  ]);
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const studentMap = new Map(students.map((s) => [s.id, s]));

  let billed = dec(0);
  let collected = dec(0);
  const rows = bySection
    .map((r) => {
      const b = dec(r.billed ?? 0);
      const c = dec(r.collected ?? 0);
      billed = billed.plus(b);
      collected = collected.plus(c);
      return {
        section: serializeSection(sectionMap.get(Number(r.sectionId))),
        students: num(r.students),
        billed: money(b),
        collected: money(c),
        outstanding: money(b.minus(c)),
        collectionRate: b.gt(0) ? Math.round(c.div(b).toNumber() * 1000) / 10 : null,
        overdueRecords: num(r.overdueRecords),
      };
    })
    .sort((a, b) => (a.section?.label || "").localeCompare(b.section?.label || ""));

  return {
    filters: { courseId: courseId ?? null, academicYear: academicYear ?? null },
    summary: {
      billed: money(billed),
      collected: money(collected),
      outstanding: money(billed.minus(collected)),
      collectionRate: billed.gt(0) ? Math.round(collected.div(billed).toNumber() * 1000) / 10 : null,
      defaulters: defaulters.length,
    },
    sections: rows,
    defaulters: defaulters
      .map((r) => {
        const s = studentMap.get(Number(r.studentId));
        if (!s) return null;
        return {
          studentId: s.id,
          rollNumber: s.rollNumber,
          fullName: s.user.fullName,
          mobile: s.user.mobile,
          section: serializeSection(s.section),
          balance: money(r.balance),
          oldestDue: toDateOnly(r.oldestDue),
          records: num(r.records),
        };
      })
      .filter(Boolean),
  };
}

async function auditLogs(q) {
  const where = {
    ...(q.actorId && { actorId: q.actorId }),
    ...(q.entityType && { entityType: q.entityType }),
    ...(q.action && { action: { startsWith: q.action } }),
    ...(q.search && { summary: { contains: q.search } }),
    ...((q.from || q.to) && {
      createdAt: {
        ...(q.from && { gte: parseDateOnly(q.from) }),
        ...(q.to && { lt: addDays(parseDateOnly(q.to), 1) }),
      },
    }),
  };
  const [rows, total, types] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { actor: true }, orderBy: { createdAt: "desc" }, ...pageArgs(q) }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return {
    ...paged(
      rows.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        summary: l.summary,
        metadata: l.metadata,
        ipAddress: l.ipAddress,
        actor: l.actor ? { id: l.actor.id, fullName: l.actor.fullName, username: l.actor.username, role: l.actor.role } : null,
        createdAt: l.createdAt,
      })),
      total,
      q
    ),
    entityTypes: types.map((t) => t.entityType),
  };
}

module.exports = { attendanceReport, feeReport, auditLogs };
