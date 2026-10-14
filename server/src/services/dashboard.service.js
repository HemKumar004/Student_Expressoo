const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const config = require("../config/env");
const attendance = require("./attendance.service");
const fees = require("./fees.service");
const materials = require("./materials.service");
const communication = require("./communication.service");
const { serializeUser, serializeSection, serializeSubject } = require("../utils/serialize");
const { addDays, today, toDateOnly } = require("../utils/dates");
const { dec, money } = require("../utils/money");

const ATTENDED = Prisma.sql`ar.status IN ('PRESENT','LATE')`;
const num = (v) => (v == null ? 0 : Number(v));
const pct = (a, t) => (t ? Math.round((a / t) * 1000) / 10 : null);

async function studentDashboard(user) {
  const isRep = user.student.representativeRole !== "NONE";
  const [att, feeData, inbox, announcements, recentMaterials, alerts] = await Promise.all([
    attendance.studentSummary(user.student),
    fees.myFees(user.student),
    communication.inbox(user, { page: 1, pageSize: 5 }),
    communication.listAnnouncements(user, { page: 1, pageSize: 3 }),
    materials.list(user, { page: 1, pageSize: 5 }),
    isRep ? communication.listAlerts(user, { page: 1, pageSize: 4 }) : null,
  ]);
  return {
    profile: serializeUser(user),
    attendance: att,
    fees: { ...feeData.summary, recordCount: feeData.records.length, onlinePaymentsEnabled: feeData.onlinePaymentsEnabled },
    notifications: { unreadCount: inbox.unreadCount, items: inbox.items },
    announcements: announcements.items,
    materials: { total: recentMaterials.pagination.total, items: recentMaterials.items },
    alerts: alerts ? { openCount: alerts.openCount, items: alerts.items } : null,
  };
}

async function staffDashboard(user) {
  const staffId = user.staff.id;
  const todayObj = today();
  const weekAgo = addDays(todayObj, -6);
  const from = addDays(todayObj, -13);

  const assignments = await prisma.staffAssignment.findMany({
    where: { staffId },
    include: { subject: true, section: { include: { course: true, _count: { select: { students: { where: { user: { status: "ACTIVE" } } } } } } } },
    orderBy: [{ section: { yearOfStudy: "asc" } }, { section: { name: "asc" } }, { subject: { code: "asc" } }],
  });
  const pairs = assignments.map((a) => Prisma.sql`(cs.section_id = ${a.sectionId} AND cs.subject_id = ${a.subjectId})`);
  const pairFilter = pairs.length ? Prisma.sql`(${Prisma.join(pairs, " OR ")})` : Prisma.sql`FALSE`;

  const [sessionsThisWeek, sessionsToday, trend, perAssignment, alertList, inbox, announcements, myMaterials, downloads] = await Promise.all([
    prisma.classSession.count({ where: { staffId, date: { gte: weekAgo, lte: todayObj } } }),
    prisma.classSession.findMany({ where: { staffId, date: todayObj }, include: { subject: true, section: { include: { course: true } } }, orderBy: { period: "asc" } }),
    prisma.$queryRaw`
      SELECT cs.date AS day, COUNT(*) AS total, SUM(${ATTENDED}) AS attended
      FROM attendance_records ar JOIN class_sessions cs ON cs.id = ar.session_id
      WHERE ${pairFilter} AND cs.date BETWEEN ${from} AND ${todayObj}
      GROUP BY cs.date ORDER BY cs.date`,
    prisma.$queryRaw`
      SELECT cs.section_id AS sectionId, cs.subject_id AS subjectId, COUNT(DISTINCT cs.id) AS sessions, COUNT(*) AS total, SUM(${ATTENDED}) AS attended, MAX(cs.date) AS lastDate
      FROM attendance_records ar JOIN class_sessions cs ON cs.id = ar.session_id
      WHERE ${pairFilter}
      GROUP BY cs.section_id, cs.subject_id`,
    communication.listAlerts(user, { page: 1, pageSize: 5, status: "OPEN" }),
    communication.inbox(user, { page: 1, pageSize: 5 }),
    communication.listAnnouncements(user, { page: 1, pageSize: 3 }),
    materials.list(user, { page: 1, pageSize: 5, mine: true }),
    prisma.studyMaterial.aggregate({ where: { uploadedById: user.id }, _sum: { downloadCount: true }, _count: { _all: true } }),
  ]);

  const statMap = new Map(perAssignment.map((r) => [`${r.sectionId}:${r.subjectId}`, r]));
  const classes = assignments.map((a) => {
    const s = statMap.get(`${a.sectionId}:${a.subjectId}`);
    return {
      assignmentId: a.id,
      section: serializeSection(a.section),
      subject: serializeSubject(a.subject),
      studentCount: a.section._count.students,
      sessions: num(s?.sessions),
      averagePercentage: pct(num(s?.attended), num(s?.total)),
      lastSessionDate: s?.lastDate ? toDateOnly(s.lastDate) : null,
    };
  });
  const sectionIds = new Set(assignments.map((a) => a.sectionId));
  const studentCount = assignments.filter((a, i, arr) => arr.findIndex((b) => b.sectionId === a.sectionId) === i).reduce((sum, a) => sum + a.section._count.students, 0);

  return {
    profile: serializeUser(user),
    threshold: config.rules.attendanceThreshold,
    stats: {
      classes: assignments.length,
      sections: sectionIds.size,
      students: studentCount,
      sessionsThisWeek,
      openAlerts: alertList.openCount,
      materials: downloads._count._all,
      downloads: num(downloads._sum.downloadCount),
    },
    classes,
    today: sessionsToday.map((s) => ({ id: s.id, period: s.period, subject: serializeSubject(s.subject), section: serializeSection(s.section) })),
    trend: trend.map((d) => ({ date: toDateOnly(d.day), percentage: pct(num(d.attended), num(d.total)), total: num(d.total) })),
    alerts: alertList.items,
    notifications: { unreadCount: inbox.unreadCount, items: inbox.items },
    announcements: announcements.items,
    materials: myMaterials.items,
  };
}

async function adminDashboard() {
  const todayObj = today();
  const from = addDays(todayObj, -29);
  const sixMonthsAgo = new Date(Date.UTC(todayObj.getUTCFullYear(), todayObj.getUTCMonth() - 5, 1));

  const [userCounts, courses, sections, subjects, att, byCourse, feeSums, overdue, monthly, recent, pending, openAlerts, materialAgg] = await Promise.all([
    prisma.user.groupBy({ by: ["role", "status"], _count: { _all: true } }),
    prisma.course.count(),
    prisma.section.count(),
    prisma.subject.count(),
    attendance.overview({ role: "ADMIN" }, { from: toDateOnly(from), to: toDateOnly(todayObj) }),
    prisma.$queryRaw`
      SELECT c.id AS courseId, c.code AS code, c.name AS name, COUNT(*) AS total, SUM(${ATTENDED}) AS attended
      FROM attendance_records ar
      JOIN class_sessions cs ON cs.id = ar.session_id
      JOIN sections sec ON sec.id = cs.section_id
      JOIN courses c ON c.id = sec.course_id
      WHERE cs.date BETWEEN ${from} AND ${todayObj}
      GROUP BY c.id, c.code, c.name
      ORDER BY c.code`,
    prisma.studentFeeRecord.aggregate({ _sum: { amount: true, discount: true, amountPaid: true }, _count: { _all: true } }),
    prisma.studentFeeRecord.count({ where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: todayObj } } }),
    prisma.$queryRaw`
      SELECT DATE_FORMAT(p.paid_on, '%Y-%m') AS month, SUM(p.amount) AS amount, COUNT(*) AS count
      FROM payments p
      WHERE p.status = 'RECORDED' AND p.paid_on >= ${sixMonthsAgo}
      GROUP BY DATE_FORMAT(p.paid_on, '%Y-%m')
      ORDER BY month`,
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: true } }),
    prisma.user.findMany({ where: { status: "PENDING" }, include: { staff: { include: { department: true } } }, orderBy: { createdAt: "asc" }, take: 5 }),
    prisma.teacherAlert.count({ where: { status: "OPEN" } }),
    prisma.studyMaterial.aggregate({ _count: { _all: true }, _sum: { downloadCount: true } }),
  ]);

  const count = (role, status) => userCounts.filter((r) => r.role === role && (!status || r.status === status)).reduce((s, r) => s + r._count._all, 0);
  const billed = dec(feeSums._sum.amount).minus(dec(feeSums._sum.discount));
  const collected = dec(feeSums._sum.amountPaid);

  // Fill the last six months so the chart has no gaps.
  const monthMap = new Map(monthly.map((m) => [m.month, m]));
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(todayObj.getUTCFullYear(), todayObj.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    const m = monthMap.get(key);
    months.push({ month: key, amount: money(m?.amount ?? 0), count: num(m?.count) });
  }

  return {
    counts: {
      students: count("STUDENT", "ACTIVE"),
      staff: count("STAFF", "ACTIVE"),
      admins: count("ADMIN", "ACTIVE"),
      pendingApprovals: userCounts.filter((r) => r.status === "PENDING").reduce((s, r) => s + r._count._all, 0),
      inactiveAccounts: userCounts.filter((r) => r.status === "INACTIVE").reduce((s, r) => s + r._count._all, 0),
      courses,
      sections,
      subjects,
      openAlerts,
      materials: materialAgg._count._all,
      downloads: num(materialAgg._sum.downloadCount),
    },
    attendance: {
      threshold: config.rules.attendanceThreshold,
      range: att.range,
      overall: att.overall,
      daily: att.daily,
      lowAttendanceCount: att.lowAttendance.length,
      byCourse: byCourse.map((c) => ({ courseId: Number(c.courseId), code: c.code, name: c.name, percentage: pct(num(c.attended), num(c.total)), total: num(c.total) })),
    },
    fees: {
      billed: money(billed),
      collected: money(collected),
      outstanding: money(billed.minus(collected)),
      collectionRate: billed.gt(0) ? Math.round(collected.div(billed).toNumber() * 1000) / 10 : null,
      records: feeSums._count._all,
      overdueRecords: overdue,
      monthly: months,
    },
    recentActivity: recent.map((l) => ({ id: l.id, action: l.action, summary: l.summary, actor: l.actor ? { id: l.actor.id, fullName: l.actor.fullName, role: l.actor.role } : null, createdAt: l.createdAt })),
    pendingApprovals: pending.map(serializeUser),
  };
}

module.exports = { studentDashboard, staffDashboard, adminDashboard };
