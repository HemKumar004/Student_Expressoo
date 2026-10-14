const { Prisma } = require("@prisma/client");
const prisma = require("../lib/prisma");
const config = require("../config/env");
const { assertCanTeach, staffAssignments } = require("./access.service");
const { parseDateOnly, toDateOnly, today, todayString, addDays, daysBetween } = require("../utils/dates");
const { serializeSection, serializeSubject, sectionLabel, personRef } = require("../utils/serialize");
const { notFound, badRequest, conflict, forbidden } = require("../utils/httpError");
const { pageArgs, paged } = require("../utils/pagination");
const { audit } = require("../utils/audit");

const ATTENDED = Prisma.sql`ar.status IN ('PRESENT','LATE')`;
const num = (v) => (v === null || v === undefined ? 0 : Number(v));

/** Percentage plus how many classes are needed (or can be missed) relative to the threshold. */
function attendanceStats(total, attended) {
  const t = config.rules.attendanceThreshold / 100;
  if (!total) return { total: 0, attended: 0, absent: 0, percentage: null, standing: "none", needed: 0, canMiss: 0 };
  const pct = (attended / total) * 100;
  const needed = pct < config.rules.attendanceThreshold ? Math.ceil((t * total - attended) / (1 - t)) : 0;
  const canMiss = pct >= config.rules.attendanceThreshold ? Math.floor(attended / t - total) : 0;
  const standing = pct >= config.rules.attendanceThreshold ? "good" : pct >= config.rules.attendanceThreshold - 10 ? "warning" : "critical";
  return { total, attended, absent: total - attended, percentage: Math.round(pct * 10) / 10, standing, needed: Math.max(0, needed), canMiss: Math.max(0, canMiss) };
}

function editability(user, dateObj) {
  const todayObj = today();
  if (dateObj > todayObj) return { editable: false, reason: "Attendance cannot be recorded for a future date." };
  if (user.role === "ADMIN") return { editable: true, reason: null };
  const age = daysBetween(dateObj, todayObj);
  if (age > config.rules.attendanceEditWindowDays) {
    return { editable: false, reason: `Attendance older than ${config.rules.attendanceEditWindowDays} days can only be corrected by an administrator.` };
  }
  return { editable: true, reason: null };
}

async function loadSectionAndSubject(sectionId, subjectId) {
  const [section, subject] = await Promise.all([
    prisma.section.findUnique({ where: { id: sectionId }, include: { course: true } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
  ]);
  if (!section) throw notFound("Section not found");
  if (!subject) throw notFound("Subject not found");
  if (subject.courseId !== section.courseId || subject.yearOfStudy !== section.yearOfStudy) {
    throw badRequest(`${subject.code} is not taught to ${sectionLabel(section)}.`);
  }
  return { section, subject };
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

async function getRoster(user, { sectionId, subjectId, date, period }) {
  await assertCanTeach(user, { sectionId, subjectId });
  const { section, subject } = await loadSectionAndSubject(sectionId, subjectId);
  const dateObj = parseDateOnly(date);

  const session = await prisma.classSession.findUnique({
    where: { sectionId_date_period: { sectionId, date: dateObj, period } },
    include: { subject: true, staff: { include: { user: true } }, recordedBy: true, records: true },
  });
  const recordMap = new Map((session?.records || []).map((r) => [r.studentId, r]));

  // Active students, plus anyone already marked in this session (so corrections stay complete).
  const students = await prisma.student.findMany({
    where: { sectionId, OR: [{ user: { status: "ACTIVE" } }, { id: { in: [...recordMap.keys()] } }] },
    include: { user: { select: { fullName: true, status: true } } },
    orderBy: { rollNumber: "asc" },
  });

  const { editable, reason } = editability(user, dateObj);
  const conflicting = session && session.subjectId !== subjectId;

  return {
    section: serializeSection(section),
    subject: serializeSubject(subject),
    date,
    period,
    session: session
      ? {
          id: session.id,
          subject: serializeSubject(session.subject),
          topic: session.topic,
          conductedBy: session.staff ? personRef(session.staff.user) : null,
          recordedBy: personRef(session.recordedBy),
          updatedAt: session.updatedAt,
        }
      : null,
    conflict: conflicting
      ? { message: `Period ${period} on ${date} is already recorded for ${session.subject.code} — ${session.subject.name}.`, subject: serializeSubject(session.subject) }
      : null,
    editable: editable && (!conflicting || user.role === "ADMIN"),
    editableReason: conflicting && user.role !== "ADMIN" ? "This period is already recorded for another subject." : reason,
    students: students.map((s) => ({
      studentId: s.id,
      rollNumber: s.rollNumber,
      fullName: s.user.fullName,
      active: s.user.status === "ACTIVE",
      status: conflicting ? null : recordMap.get(s.id)?.status ?? null,
      remarks: conflicting ? null : recordMap.get(s.id)?.remarks ?? null,
    })),
  };
}

async function saveSession(user, { sectionId, subjectId, date, period, topic, records }, req) {
  await assertCanTeach(user, { sectionId, subjectId });
  const { section, subject } = await loadSectionAndSubject(sectionId, subjectId);
  const dateObj = parseDateOnly(date);

  const { editable, reason } = editability(user, dateObj);
  if (!editable) {
    if (dateObj > today()) throw badRequest("Please correct the highlighted fields.", { date: reason });
    throw forbidden(reason);
  }

  const ids = records.map((r) => r.studentId);
  if (new Set(ids).size !== ids.length) throw badRequest("Each student can only be marked once per period.");
  const inSection = await prisma.student.count({ where: { id: { in: ids }, sectionId } });
  if (inSection !== ids.length) throw badRequest("Some students in the list do not belong to this section.");

  const present = records.filter((r) => r.status === "PRESENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.length - present - late;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.classSession.findUnique({
      where: { sectionId_date_period: { sectionId, date: dateObj, period } },
      include: { subject: true },
    });
    if (existing && existing.subjectId !== subjectId && user.role !== "ADMIN") {
      throw conflict(`Period ${period} on ${date} is already recorded for ${existing.subject.code}.`);
    }

    let session;
    if (existing) {
      session = await tx.classSession.update({
        where: { id: existing.id },
        data: { subjectId, topic: topic ?? null, recordedById: user.id },
      });
      await tx.attendanceRecord.deleteMany({ where: { sessionId: existing.id } });
    } else {
      let staffId = user.staff?.id ?? null;
      if (!staffId) {
        const assigned = await tx.staffAssignment.findFirst({ where: { sectionId, subjectId }, select: { staffId: true } });
        staffId = assigned?.staffId ?? null;
      }
      session = await tx.classSession.create({
        data: { sectionId, subjectId, date: dateObj, period, topic: topic ?? null, staffId, recordedById: user.id },
      });
    }

    await tx.attendanceRecord.createMany({
      data: records.map((r) => ({ sessionId: session.id, studentId: r.studentId, status: r.status, remarks: r.remarks ?? null })),
    });

    await audit(tx, {
      req,
      action: existing ? "attendance.update" : "attendance.create",
      entityType: "class_session",
      entityId: session.id,
      summary: `${existing ? "Corrected" : "Recorded"} attendance for ${subject.code} · ${sectionLabel(section)} · ${date} P${period} (${present + late} present, ${absent} absent)`,
      metadata: { present, late, absent, previousSubjectId: existing && existing.subjectId !== subjectId ? existing.subjectId : undefined },
    });
    return { session, created: !existing };
  });

  return {
    sessionId: result.session.id,
    created: result.created,
    counts: { present, late, absent, total: records.length },
    savedAt: result.session.updatedAt,
  };
}

async function deleteSession(user, sessionId, req) {
  const session = await prisma.classSession.findUnique({ where: { id: sessionId }, include: { subject: true, section: { include: { course: true } } } });
  if (!session) throw notFound("Attendance session not found");
  await assertCanTeach(user, { sectionId: session.sectionId, subjectId: session.subjectId });
  const { editable, reason } = editability(user, session.date);
  if (!editable) throw forbidden(reason);
  await prisma.$transaction(async (tx) => {
    await tx.classSession.delete({ where: { id: sessionId } });
    await audit(tx, {
      req,
      action: "attendance.delete",
      entityType: "class_session",
      entityId: sessionId,
      summary: `Deleted attendance for ${session.subject.code} · ${sectionLabel(session.section)} · ${toDateOnly(session.date)} P${session.period}`,
    });
  });
  return { ok: true };
}

async function listSessions(user, q) {
  const where = {
    ...(q.sectionId && { sectionId: q.sectionId }),
    ...(q.subjectId && { subjectId: q.subjectId }),
    ...(q.staffId && user.role === "ADMIN" && { staffId: q.staffId }),
    ...((q.from || q.to) && { date: { ...(q.from && { gte: parseDateOnly(q.from) }), ...(q.to && { lte: parseDateOnly(q.to) }) } }),
  };
  if (user.role === "STAFF") {
    const assignments = await staffAssignments(user.staff.id);
    if (!assignments.length) return paged([], 0, q);
    where.OR = assignments.map((a) => ({ sectionId: a.sectionId, subjectId: a.subjectId }));
  }

  const [rows, total] = await Promise.all([
    prisma.classSession.findMany({
      where,
      orderBy: [{ date: "desc" }, { period: "desc" }],
      ...pageArgs(q),
      include: { section: { include: { course: true } }, subject: true, staff: { include: { user: true } }, recordedBy: true },
    }),
    prisma.classSession.count({ where }),
  ]);

  const counts = rows.length
    ? await prisma.attendanceRecord.groupBy({ by: ["sessionId", "status"], where: { sessionId: { in: rows.map((r) => r.id) } }, _count: { _all: true } })
    : [];
  const bySession = {};
  for (const c of counts) {
    bySession[c.sessionId] = bySession[c.sessionId] || { PRESENT: 0, ABSENT: 0, LATE: 0 };
    bySession[c.sessionId][c.status] = c._count._all;
  }

  return paged(
    rows.map((s) => {
      const c = bySession[s.id] || { PRESENT: 0, ABSENT: 0, LATE: 0 };
      const total = c.PRESENT + c.ABSENT + c.LATE;
      return {
        id: s.id,
        date: toDateOnly(s.date),
        period: s.period,
        topic: s.topic,
        section: serializeSection(s.section),
        subject: serializeSubject(s.subject),
        conductedBy: s.staff ? personRef(s.staff.user) : null,
        recordedBy: personRef(s.recordedBy),
        counts: { present: c.PRESENT, late: c.LATE, absent: c.ABSENT, total },
        percentage: total ? Math.round(((c.PRESENT + c.LATE) / total) * 1000) / 10 : null,
        editable: editability(user, s.date).editable,
        updatedAt: s.updatedAt,
      };
    }),
    total,
    q
  );
}

// ---------------------------------------------------------------------------
// Student views
// ---------------------------------------------------------------------------

async function studentSummary(student) {
  const [rows, sectionSubjects, weekly] = await Promise.all([
    prisma.$queryRaw`
      SELECT cs.subject_id AS subjectId, COUNT(*) AS total, SUM(${ATTENDED}) AS attended, SUM(ar.status = 'LATE') AS late
      FROM attendance_records ar
      JOIN class_sessions cs ON cs.id = ar.session_id
      WHERE ar.student_id = ${student.id}
      GROUP BY cs.subject_id`,
    prisma.staffAssignment.findMany({
      where: { sectionId: student.sectionId },
      include: { subject: true, staff: { include: { user: true } } },
    }),
    prisma.$queryRaw`
      SELECT MIN(cs.date) AS weekStart, COUNT(*) AS total, SUM(${ATTENDED}) AS attended
      FROM attendance_records ar
      JOIN class_sessions cs ON cs.id = ar.session_id
      WHERE ar.student_id = ${student.id} AND cs.date >= ${addDays(today(), -7 * 10)}
      GROUP BY YEARWEEK(cs.date, 3)
      ORDER BY weekStart`,
  ]);

  const subjects = new Map();
  for (const a of sectionSubjects) {
    const entry = subjects.get(a.subjectId) || { subject: serializeSubject(a.subject), staff: [] };
    entry.staff.push(a.staff.user.fullName);
    subjects.set(a.subjectId, entry);
  }
  const statsBySubject = new Map(rows.map((r) => [Number(r.subjectId), r]));
  // Subjects that have attendance but are no longer assigned (e.g. after a section change).
  const missing = [...statsBySubject.keys()].filter((id) => !subjects.has(id));
  if (missing.length) {
    const extra = await prisma.subject.findMany({ where: { id: { in: missing } } });
    for (const s of extra) subjects.set(s.id, { subject: serializeSubject(s), staff: [] });
  }

  let total = 0;
  let attended = 0;
  const bySubject = [...subjects.values()]
    .map(({ subject, staff }) => {
      const r = statsBySubject.get(subject.id);
      const t = num(r?.total);
      const a = num(r?.attended);
      total += t;
      attended += a;
      return { subject, staff, late: num(r?.late), ...attendanceStats(t, a) };
    })
    .sort((x, y) => x.subject.name.localeCompare(y.subject.name));

  return {
    threshold: config.rules.attendanceThreshold,
    overall: attendanceStats(total, attended),
    subjects: bySubject,
    weekly: weekly.map((w) => ({
      weekStart: toDateOnly(w.weekStart),
      total: num(w.total),
      attended: num(w.attended),
      percentage: num(w.total) ? Math.round((num(w.attended) / num(w.total)) * 1000) / 10 : null,
    })),
  };
}

async function studentHistory(student, q) {
  const where = {
    studentId: student.id,
    ...(q.status && { status: q.status }),
    session: {
      ...(q.subjectId && { subjectId: q.subjectId }),
      ...((q.from || q.to) && { date: { ...(q.from && { gte: parseDateOnly(q.from) }), ...(q.to && { lte: parseDateOnly(q.to) }) } }),
    },
  };
  const [rows, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ session: { date: "desc" } }, { session: { period: "desc" } }],
      ...pageArgs(q),
      include: { session: { include: { subject: true, staff: { include: { user: true } } } } },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);
  return paged(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      remarks: r.remarks,
      date: toDateOnly(r.session.date),
      period: r.session.period,
      topic: r.session.topic,
      subject: serializeSubject(r.session.subject),
      conductedBy: r.session.staff ? personRef(r.session.staff.user) : null,
    })),
    total,
    q
  );
}

// ---------------------------------------------------------------------------
// Staff class view & admin oversight
// ---------------------------------------------------------------------------

async function classStats(user, { sectionId, subjectId }) {
  await assertCanTeach(user, { sectionId, subjectId });
  const { section, subject } = await loadSectionAndSubject(sectionId, subjectId);

  const [students, rows, sessionCount, lastSession] = await Promise.all([
    prisma.student.findMany({
      where: { sectionId, user: { status: "ACTIVE" } },
      include: { user: { select: { fullName: true, email: true, mobile: true } } },
      orderBy: { rollNumber: "asc" },
    }),
    prisma.$queryRaw`
      SELECT ar.student_id AS studentId, COUNT(*) AS total, SUM(${ATTENDED}) AS attended
      FROM attendance_records ar
      JOIN class_sessions cs ON cs.id = ar.session_id
      WHERE cs.section_id = ${sectionId} AND cs.subject_id = ${subjectId}
      GROUP BY ar.student_id`,
    prisma.classSession.count({ where: { sectionId, subjectId } }),
    prisma.classSession.findFirst({ where: { sectionId, subjectId }, orderBy: [{ date: "desc" }, { period: "desc" }] }),
  ]);
  const byStudent = new Map(rows.map((r) => [Number(r.studentId), r]));
  const list = students.map((s) => {
    const r = byStudent.get(s.id);
    return {
      studentId: s.id,
      rollNumber: s.rollNumber,
      fullName: s.user.fullName,
      email: s.user.email,
      representativeRole: s.representativeRole,
      ...attendanceStats(num(r?.total), num(r?.attended)),
    };
  });
  const withData = list.filter((s) => s.total > 0);
  const average = withData.length ? Math.round((withData.reduce((sum, s) => sum + s.percentage, 0) / withData.length) * 10) / 10 : null;

  return {
    section: serializeSection(section),
    subject: serializeSubject(subject),
    threshold: config.rules.attendanceThreshold,
    sessionCount,
    lastSessionDate: lastSession ? toDateOnly(lastSession.date) : null,
    averagePercentage: average,
    belowThreshold: withData.filter((s) => s.percentage < config.rules.attendanceThreshold).length,
    students: list,
  };
}

async function overview(user, q) {
  const to = q.to ? parseDateOnly(q.to) : today();
  const from = q.from ? parseDateOnly(q.from) : addDays(to, -29);
  const filters = Prisma.sql`
    ${q.sectionId ? Prisma.sql`AND cs.section_id = ${q.sectionId}` : Prisma.empty}
    ${q.courseId ? Prisma.sql`AND sec.course_id = ${q.courseId}` : Prisma.empty}`;

  const [bySection, daily, low] = await Promise.all([
    prisma.$queryRaw`
      SELECT cs.section_id AS sectionId, COUNT(*) AS total, SUM(${ATTENDED}) AS attended, COUNT(DISTINCT cs.id) AS sessions
      FROM attendance_records ar
      JOIN class_sessions cs ON cs.id = ar.session_id
      JOIN sections sec ON sec.id = cs.section_id
      WHERE cs.date BETWEEN ${from} AND ${to} ${filters}
      GROUP BY cs.section_id`,
    prisma.$queryRaw`
      SELECT cs.date AS day, COUNT(*) AS total, SUM(${ATTENDED}) AS attended
      FROM attendance_records ar
      JOIN class_sessions cs ON cs.id = ar.session_id
      JOIN sections sec ON sec.id = cs.section_id
      WHERE cs.date BETWEEN ${from} AND ${to} ${filters}
      GROUP BY cs.date
      ORDER BY cs.date`,
    prisma.$queryRaw`
      SELECT ar.student_id AS studentId, COUNT(*) AS total, SUM(${ATTENDED}) AS attended
      FROM attendance_records ar
      JOIN class_sessions cs ON cs.id = ar.session_id
      JOIN sections sec ON sec.id = cs.section_id
      WHERE cs.date BETWEEN ${from} AND ${to} ${filters}
      GROUP BY ar.student_id
      HAVING SUM(${ATTENDED}) * 100 < ${config.rules.attendanceThreshold} * COUNT(*)
      ORDER BY SUM(${ATTENDED}) / COUNT(*) ASC
      LIMIT 100`,
  ]);

  const sectionIds = bySection.map((r) => Number(r.sectionId));
  const lowIds = low.map((r) => Number(r.studentId));
  const [sections, lowStudents] = await Promise.all([
    prisma.section.findMany({ where: { id: { in: sectionIds } }, include: { course: true, _count: { select: { students: true } } } }),
    prisma.student.findMany({ where: { id: { in: lowIds } }, include: { user: true, section: { include: { course: true } } } }),
  ]);
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  const studentMap = new Map(lowStudents.map((s) => [s.id, s]));

  let total = 0;
  let attended = 0;
  const sectionRows = bySection
    .map((r) => {
      const s = sectionMap.get(Number(r.sectionId));
      total += num(r.total);
      attended += num(r.attended);
      return { section: serializeSection(s), studentCount: s?._count.students ?? 0, sessions: num(r.sessions), ...attendanceStats(num(r.total), num(r.attended)) };
    })
    .sort((a, b) => (a.section?.label || "").localeCompare(b.section?.label || ""));

  return {
    range: { from: toDateOnly(from), to: toDateOnly(to) },
    threshold: config.rules.attendanceThreshold,
    overall: attendanceStats(total, attended),
    sections: sectionRows,
    daily: daily.map((d) => ({
      date: toDateOnly(d.day),
      total: num(d.total),
      attended: num(d.attended),
      percentage: num(d.total) ? Math.round((num(d.attended) / num(d.total)) * 1000) / 10 : null,
    })),
    lowAttendance: low
      .map((r) => {
        const s = studentMap.get(Number(r.studentId));
        if (!s) return null;
        return {
          studentId: s.id,
          rollNumber: s.rollNumber,
          fullName: s.user.fullName,
          section: serializeSection(s.section),
          ...attendanceStats(num(r.total), num(r.attended)),
        };
      })
      .filter(Boolean),
  };
}

module.exports = {
  attendanceStats,
  getRoster,
  saveSession,
  deleteSession,
  listSessions,
  studentSummary,
  studentHistory,
  classStats,
  overview,
  todayString,
};
