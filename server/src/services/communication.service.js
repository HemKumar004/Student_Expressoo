const prisma = require("../lib/prisma");
const config = require("../config/env");
const { staffSectionIds, studentUserIdsForSections } = require("./access.service");
const { deliverNotification } = require("./notify.service");
const { serializeSection, serializeSubject, sectionLabel, personRef } = require("../utils/serialize");
const { toDateOnly, today, todayString } = require("../utils/dates");
const { notFound, badRequest, forbidden, conflict } = require("../utils/httpError");
const { pageArgs, paged } = require("../utils/pagination");
const { audit } = require("../utils/audit");

// ===========================================================================
// Notifications
// ===========================================================================

/**
 * Who may notify whom:
 *  - ADMIN: everyone, all students, all staff, a course or sections.
 *  - STAFF: students of sections they are assigned to.
 *  - CR / LR: students of their own section.
 */
async function sendNotification(user, data, req) {
  let { targetType } = data;
  let sectionIds = data.sectionIds || [];
  let courseId = data.courseId;

  if (user.role === "STUDENT") {
    const rep = user.student.representativeRole;
    if (rep === "NONE") throw forbidden("Only Class Representatives and Ladies Representatives can send class messages.");
    targetType = "SECTION";
    sectionIds = [user.student.sectionId];
    courseId = undefined;
  } else if (user.role === "STAFF") {
    if (targetType !== "SECTION") throw forbidden("Staff can send notifications to the sections they teach.");
    const allowed = new Set(await staffSectionIds(user.staff.id));
    const denied = sectionIds.filter((id) => !allowed.has(id));
    if (denied.length) throw forbidden("You can only notify sections you are assigned to.");
  }

  let userIds = [];
  let targetLabel = "";
  let singleSectionId = null;
  if (targetType === "ALL") {
    userIds = (await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);
    targetLabel = "Everyone";
  } else if (targetType === "STUDENTS" || targetType === "STAFF") {
    const role = targetType === "STUDENTS" ? "STUDENT" : "STAFF";
    userIds = (await prisma.user.findMany({ where: { status: "ACTIVE", role }, select: { id: true } })).map((u) => u.id);
    targetLabel = targetType === "STUDENTS" ? "All students" : "All staff";
  } else if (targetType === "COURSE") {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw badRequest("Please correct the highlighted fields.", { courseId: "Choose a valid course" });
    const sections = await prisma.section.findMany({ where: { courseId }, select: { id: true } });
    userIds = await studentUserIdsForSections(prisma, sections.map((s) => s.id));
    targetLabel = `${course.code} — all students`;
  } else {
    const sections = await prisma.section.findMany({ where: { id: { in: sectionIds } }, include: { course: true } });
    if (sections.length !== new Set(sectionIds).size) throw badRequest("Please correct the highlighted fields.", { sectionIds: "One or more sections are invalid" });
    userIds = await studentUserIdsForSections(prisma, sectionIds);
    targetLabel = sections.map(sectionLabel).join(", ");
    if (sections.length === 1) singleSectionId = sections[0].id;
  }

  const category = user.role === "STUDENT" && !["GENERAL", "ACADEMIC", "EVENT"].includes(data.category) ? "GENERAL" : data.category;

  const { notification, recipientCount } = await prisma.$transaction(async (tx) => {
    const result = await deliverNotification(tx, {
      title: data.title,
      message: data.message,
      category,
      targetType,
      targetLabel,
      courseId: targetType === "COURSE" ? courseId : null,
      sectionId: singleSectionId,
      eventAt: data.eventAt ?? null,
      senderId: user.id,
      userIds,
    });
    await audit(tx, {
      req,
      action: "notification.send",
      entityType: "notification",
      entityId: result.notification.id,
      summary: `Sent "${data.title}" to ${targetLabel} (${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"})`,
    });
    return result;
  });
  return { id: notification.id, recipientCount, targetLabel };
}

function serializeInboxItem(r) {
  const n = r.notification;
  return {
    id: r.id,
    notificationId: n.id,
    title: n.title,
    message: n.message,
    category: n.category,
    targetLabel: n.targetLabel,
    eventAt: n.eventAt,
    sender: n.sender ? personRef(n.sender) : { id: null, fullName: "Student Expressoo", role: "SYSTEM" },
    readAt: r.readAt,
    createdAt: n.createdAt,
  };
}

async function inbox(user, q) {
  const where = {
    userId: user.id,
    ...(q.unread && { readAt: null }),
    ...(q.category && { notification: { category: q.category } }),
  };
  const [rows, total, unreadCount] = await Promise.all([
    prisma.notificationRecipient.findMany({
      where,
      include: { notification: { include: { sender: true } } },
      orderBy: { createdAt: "desc" },
      ...pageArgs(q),
    }),
    prisma.notificationRecipient.count({ where }),
    prisma.notificationRecipient.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { ...paged(rows.map(serializeInboxItem), total, q), unreadCount };
}

async function unreadCount(user) {
  return { unreadCount: await prisma.notificationRecipient.count({ where: { userId: user.id, readAt: null } }) };
}

async function markRead(user, recipientId) {
  // Ownership is part of the filter, so users can never touch someone else's inbox.
  const { count } = await prisma.notificationRecipient.updateMany({
    where: { id: recipientId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (!count && !(await prisma.notificationRecipient.count({ where: { id: recipientId, userId: user.id } }))) {
    throw notFound("Notification not found");
  }
  return unreadCount(user);
}

async function markAllRead(user) {
  await prisma.notificationRecipient.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return { unreadCount: 0 };
}

async function sent(user, q) {
  const where = {
    ...(user.role !== "ADMIN" && { senderId: user.id }),
    ...(user.role === "ADMIN" && { senderId: { not: null } }),
    ...(q.search && { OR: [{ title: { contains: q.search } }, { message: { contains: q.search } }] }),
  };
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: { sender: true, _count: { select: { recipients: true } } },
      orderBy: { createdAt: "desc" },
      ...pageArgs(q),
    }),
    prisma.notification.count({ where }),
  ]);
  const reads = rows.length
    ? await prisma.notificationRecipient.groupBy({
        by: ["notificationId"],
        where: { notificationId: { in: rows.map((r) => r.id) }, readAt: { not: null } },
        _count: { _all: true },
      })
    : [];
  const readMap = new Map(reads.map((r) => [r.notificationId, r._count._all]));
  return paged(
    rows.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      category: n.category,
      targetType: n.targetType,
      targetLabel: n.targetLabel,
      eventAt: n.eventAt,
      sender: personRef(n.sender),
      recipientCount: n._count.recipients,
      readCount: readMap.get(n.id) || 0,
      createdAt: n.createdAt,
      canDelete: user.role === "ADMIN" || n.senderId === user.id,
    })),
    total,
    q
  );
}

async function deleteNotification(user, id, req) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n) throw notFound("Notification not found");
  if (user.role !== "ADMIN" && n.senderId !== user.id) throw forbidden("You can only delete notifications you sent.");
  await prisma.$transaction(async (tx) => {
    await tx.notification.delete({ where: { id } });
    await audit(tx, { req, action: "notification.delete", entityType: "notification", entityId: id, summary: `Withdrew notification "${n.title}"` });
  });
  return { ok: true };
}

// ===========================================================================
// Announcements
// ===========================================================================

const AUDIENCE_FOR_ROLE = { STUDENT: ["ALL", "STUDENTS"], STAFF: ["ALL", "STAFF"] };

function serializeAnnouncement(a) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    audience: a.audience,
    isPinned: a.isPinned,
    publishedAt: a.publishedAt,
    expiresAt: a.expiresAt,
    expired: Boolean(a.expiresAt && a.expiresAt < new Date()),
    author: personRef(a.author),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function listAnnouncements(user, q) {
  const now = new Date();
  const where = {
    ...(user.role !== "ADMIN" && { audience: { in: AUDIENCE_FOR_ROLE[user.role] } }),
    ...(user.role === "ADMIN" && q.audience && { audience: q.audience }),
    ...((user.role !== "ADMIN" || !q.includeExpired) && { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }),
    publishedAt: { lte: now },
  };
  const [rows, total] = await Promise.all([
    prisma.announcement.findMany({ where, include: { author: true }, orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }], ...pageArgs(q) }),
    prisma.announcement.count({ where }),
  ]);
  return paged(rows.map(serializeAnnouncement), total, q);
}

async function createAnnouncement(user, data, req) {
  const a = await prisma.announcement.create({ data: { ...data, expiresAt: data.expiresAt ?? null, authorId: user.id }, include: { author: true } });
  await audit(prisma, { req, action: "announcement.create", entityType: "announcement", entityId: a.id, summary: `Published announcement "${a.title}" for ${a.audience.toLowerCase()}` });
  return serializeAnnouncement(a);
}

async function updateAnnouncement(id, data, req) {
  const a = await prisma.announcement.update({ where: { id }, data: { ...data, expiresAt: data.expiresAt ?? null }, include: { author: true } });
  await audit(prisma, { req, action: "announcement.update", entityType: "announcement", entityId: id, summary: `Updated announcement "${a.title}"` });
  return serializeAnnouncement(a);
}

async function deleteAnnouncement(id, req) {
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) throw notFound("Announcement not found");
  await prisma.announcement.delete({ where: { id } });
  await audit(prisma, { req, action: "announcement.delete", entityType: "announcement", entityId: id, summary: `Deleted announcement "${a.title}"` });
  return { ok: true };
}

// ===========================================================================
// Teacher alerts (CR / LR)
// ===========================================================================

const alertInclude = {
  section: { include: { course: true } },
  raisedBy: { include: { student: true } },
  staff: { include: { user: true } },
  subject: true,
};

function serializeAlert(a, user) {
  const ageMinutes = (Date.now() - new Date(a.createdAt).getTime()) / 60000;
  const isRep = user.role === "STUDENT" && user.student?.sectionId === a.sectionId;
  return {
    id: a.id,
    section: serializeSection(a.section),
    subject: a.subject ? serializeSubject(a.subject) : null,
    staff: {
      id: a.staff.id,
      fullName: a.staff.user.fullName,
      employeeId: a.staff.employeeId,
      // The teacher's phone is only shared with the class's representatives and administrators.
      mobile: isRep || user.role === "ADMIN" ? a.staff.user.mobile : undefined,
    },
    raisedBy: {
      id: a.raisedBy.id,
      fullName: a.raisedBy.fullName,
      representativeRole: a.raisedBy.student?.representativeRole ?? null,
    },
    period: a.period,
    alertDate: toDateOnly(a.alertDate),
    message: a.message,
    status: a.status,
    responseNote: a.responseNote,
    acknowledgedAt: a.acknowledgedAt,
    resolvedAt: a.resolvedAt,
    createdAt: a.createdAt,
    escalationDue: a.status === "OPEN" && ageMinutes >= config.rules.alertEscalationMinutes,
    canAcknowledge: a.status === "OPEN" && (user.role === "ADMIN" || user.staff?.id === a.staffId),
    canResolve: a.status !== "RESOLVED" && (user.role === "ADMIN" || user.staff?.id === a.staffId || isRep),
  };
}

/** Teachers assigned to the representative's section, with their subjects and phone. */
async function alertContacts(user) {
  const rows = await prisma.staffAssignment.findMany({
    where: { sectionId: user.student.sectionId, staff: { user: { status: "ACTIVE" } } },
    include: { staff: { include: { user: true } }, subject: true },
    orderBy: { subject: { code: "asc" } },
  });
  const byStaff = new Map();
  for (const r of rows) {
    const entry = byStaff.get(r.staffId) || {
      staffId: r.staffId,
      fullName: r.staff.user.fullName,
      employeeId: r.staff.employeeId,
      designation: r.staff.designation,
      mobile: r.staff.user.mobile,
      subjects: [],
    };
    entry.subjects.push(serializeSubject(r.subject));
    byStaff.set(r.staffId, entry);
  }
  return { escalationMinutes: config.rules.alertEscalationMinutes, maxPeriods: config.rules.maxPeriodsPerDay, contacts: [...byStaff.values()] };
}

async function createAlert(user, data, req) {
  const sectionId = user.student.sectionId;
  const assignment = await prisma.staffAssignment.findFirst({
    where: { sectionId, staffId: data.staffId, ...(data.subjectId && { subjectId: data.subjectId }) },
    include: { staff: { include: { user: true } }, subject: true, section: { include: { course: true } } },
  });
  if (!assignment) throw badRequest("Please correct the highlighted fields.", { staffId: "This teacher does not teach the selected subject for your section" });

  const alertDate = today();
  const duplicate = await prisma.teacherAlert.findFirst({
    where: { sectionId, staffId: data.staffId, alertDate, period: data.period, status: { not: "RESOLVED" } },
  });
  if (duplicate) throw conflict(`An alert for period ${data.period} has already been sent to ${assignment.staff.user.fullName} today.`);

  const alert = await prisma.$transaction(async (tx) => {
    const a = await tx.teacherAlert.create({
      data: {
        sectionId,
        raisedById: user.id,
        staffId: data.staffId,
        subjectId: data.subjectId ?? null,
        period: data.period,
        alertDate,
        message: data.message ?? null,
      },
      include: alertInclude,
    });
    const label = sectionLabel(assignment.section);
    await deliverNotification(tx, {
      title: `Class waiting: ${label}, period ${data.period}`,
      message: `${user.fullName} (${user.student.representativeRole}) reports that ${label} is waiting for you in period ${data.period}${a.subject ? ` (${a.subject.code})` : ""}.${data.message ? ` Message: "${data.message}"` : ""} Please acknowledge in the Staff Portal.`,
      category: "ALERT",
      targetType: "USER",
      targetLabel: assignment.staff.user.fullName,
      sectionId,
      senderId: user.id,
      userIds: [assignment.staff.userId],
    });
    await audit(tx, {
      req,
      action: "teacher_alert.create",
      entityType: "teacher_alert",
      entityId: a.id,
      summary: `${user.fullName} alerted ${assignment.staff.user.fullName} — ${label}, period ${data.period}`,
    });
    return a;
  });
  return serializeAlert(alert, user);
}

async function listAlerts(user, q) {
  const where = {
    ...(q.status && { status: q.status }),
    ...(user.role === "STUDENT" && { sectionId: user.student.sectionId }),
    ...(user.role === "STAFF" && { staffId: user.staff.id }),
    ...(user.role === "ADMIN" && q.sectionId && { sectionId: q.sectionId }),
  };
  const [rows, total, open] = await Promise.all([
    prisma.teacherAlert.findMany({ where, include: alertInclude, orderBy: { createdAt: "desc" }, ...pageArgs(q) }),
    prisma.teacherAlert.count({ where }),
    prisma.teacherAlert.count({ where: { ...where, status: "OPEN" } }),
  ]);
  return { ...paged(rows.map((a) => serializeAlert(a, user)), total, q), openCount: open, escalationMinutes: config.rules.alertEscalationMinutes, today: todayString() };
}

async function loadAlert(id) {
  const a = await prisma.teacherAlert.findUnique({ where: { id }, include: alertInclude });
  if (!a) throw notFound("Alert not found");
  return a;
}

async function acknowledgeAlert(user, id, { responseNote }, req) {
  const a = await loadAlert(id);
  if (user.role !== "ADMIN" && user.staff?.id !== a.staffId) throw notFound("Alert not found");
  if (a.status !== "OPEN") throw conflict("This alert has already been acknowledged.");
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.teacherAlert.update({
      where: { id },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), responseNote: responseNote ?? null },
      include: alertInclude,
    });
    await deliverNotification(tx, {
      title: `${a.staff.user.fullName} acknowledged your alert`,
      message: `Period ${a.period} · ${sectionLabel(a.section)}.${responseNote ? ` Response: "${responseNote}"` : ""}`,
      category: "ALERT",
      targetType: "USER",
      targetLabel: a.raisedBy.fullName,
      sectionId: a.sectionId,
      senderId: user.id,
      userIds: [a.raisedById],
    });
    await audit(tx, { req, action: "teacher_alert.acknowledge", entityType: "teacher_alert", entityId: id, summary: `${user.fullName} acknowledged the alert from ${a.raisedBy.fullName} (${sectionLabel(a.section)}, P${a.period})` });
    return u;
  });
  return serializeAlert(updated, user);
}

async function resolveAlert(user, id, req) {
  const a = await loadAlert(id);
  const isRep = user.role === "STUDENT" && user.student?.sectionId === a.sectionId && user.student.representativeRole !== "NONE";
  if (!(user.role === "ADMIN" || user.staff?.id === a.staffId || isRep)) throw notFound("Alert not found");
  if (a.status === "RESOLVED") throw conflict("This alert is already resolved.");
  const updated = await prisma.teacherAlert.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() }, include: alertInclude });
  await audit(prisma, { req, action: "teacher_alert.resolve", entityType: "teacher_alert", entityId: id, summary: `${user.fullName} resolved the alert for ${sectionLabel(a.section)}, P${a.period}` });
  return serializeAlert(updated, user);
}

module.exports = {
  sendNotification,
  inbox,
  unreadCount,
  markRead,
  markAllRead,
  sent,
  deleteNotification,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  alertContacts,
  createAlert,
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
};
