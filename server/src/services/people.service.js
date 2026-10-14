const prisma = require("../lib/prisma");
const { userInclude } = require("../middleware/auth");
const { hashPassword } = require("../utils/password");
const { serializeUser, sectionLabel } = require("../utils/serialize");
const { notFound, badRequest, conflict, forbidden } = require("../utils/httpError");
const { pageArgs, paged } = require("../utils/pagination");
const { audit } = require("../utils/audit");
const { deliverNotification } = require("./notify.service");

const REP_NAMES = { CR: "Class Representative", LR: "Ladies Representative", NONE: "Student" };

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

async function listStudents(q) {
  const where = {
    ...(q.sectionId && { sectionId: q.sectionId }),
    ...((q.courseId || q.yearOfStudy) && {
      section: { ...(q.courseId && { courseId: q.courseId }), ...(q.yearOfStudy && { yearOfStudy: q.yearOfStudy }) },
    }),
    ...(q.representativeRole && { representativeRole: q.representativeRole }),
    user: {
      ...(q.status && { status: q.status }),
      ...(q.search && {
        OR: [{ fullName: { contains: q.search } }, { email: { contains: q.search } }, { username: { contains: q.search } }],
      }),
    },
  };
  const orderBy =
    q.sort === "name" ? { user: { fullName: q.order } } : q.sort === "createdAt" ? { createdAt: q.order } : { rollNumber: q.order };

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy,
      ...pageArgs(q),
      include: { user: true, section: { include: { course: true } } },
    }),
    prisma.student.count({ where }),
  ]);
  return paged(rows.map((s) => serializeUser({ ...s.user, student: s })), total, q);
}

async function getStudent(studentId) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: { include: userInclude } } });
  if (!student) throw notFound("Student not found");
  return serializeUser(student.user);
}

async function createStudent(data, req) {
  const section = await prisma.section.findUnique({ where: { id: data.sectionId }, include: { course: true } });
  if (!section) throw badRequest("Please correct the highlighted fields.", { sectionId: "Choose a valid section" });
  const user = await prisma.user.create({
    data: {
      username: data.rollNumber,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      fullName: data.fullName,
      mobile: data.mobile,
      role: "STUDENT",
      status: "ACTIVE",
      student: { create: { rollNumber: data.rollNumber, sectionId: section.id, admissionYear: data.admissionYear ?? null } },
    },
    include: userInclude,
  });
  await audit(prisma, { req, action: "student.create", entityType: "student", entityId: user.student.id, summary: `Created student ${user.fullName} (${data.rollNumber}) in ${sectionLabel(section)}` });
  return serializeUser(user);
}

async function updateStudent(studentId, data, req) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true } });
  if (!student) throw notFound("Student not found");
  if (data.sectionId) {
    const exists = await prisma.section.count({ where: { id: data.sectionId } });
    if (!exists) throw badRequest("Please correct the highlighted fields.", { sectionId: "Choose a valid section" });
  }
  const sectionChanged = data.sectionId && data.sectionId !== student.sectionId;

  const user = await prisma.user.update({
    where: { id: student.userId },
    data: {
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.email && { email: data.email }),
      ...(data.mobile !== undefined && { mobile: data.mobile }),
      ...(data.rollNumber && { username: data.rollNumber }),
      student: {
        update: {
          ...(data.rollNumber && { rollNumber: data.rollNumber }),
          ...(data.sectionId && { sectionId: data.sectionId }),
          ...(data.admissionYear !== undefined && { admissionYear: data.admissionYear }),
          // A representative designation belongs to a section; moving sections clears it.
          ...(sectionChanged && { representativeRole: "NONE" }),
        },
      },
    },
    include: userInclude,
  });
  await audit(prisma, { req, action: "student.update", entityType: "student", entityId: studentId, summary: `Updated student ${user.fullName} (${user.student.rollNumber})`, metadata: { fields: Object.keys(data) } });
  return serializeUser(user);
}

/**
 * Assign CR / LR. A section has at most one CR and one LR, so assigning a new representative
 * returns the previous holder to a regular student in the same transaction.
 */
async function setRepresentative(studentId, representativeRole, req) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true, section: { include: { course: true } } } });
  if (!student) throw notFound("Student not found");
  if (representativeRole !== "NONE" && student.user.status !== "ACTIVE") {
    throw conflict("Only active students can be made representatives.");
  }

  const result = await prisma.$transaction(async (tx) => {
    let replaced = null;
    if (representativeRole !== "NONE") {
      const previous = await tx.student.findFirst({
        where: { sectionId: student.sectionId, representativeRole, NOT: { id: studentId } },
        include: { user: true },
      });
      if (previous) {
        await tx.student.update({ where: { id: previous.id }, data: { representativeRole: "NONE" } });
        replaced = { id: previous.id, fullName: previous.user.fullName, rollNumber: previous.rollNumber };
      }
    }
    await tx.student.update({ where: { id: studentId }, data: { representativeRole } });
    if (representativeRole !== "NONE") {
      await deliverNotification(tx, {
        title: `You are now the ${REP_NAMES[representativeRole]}`,
        message: `You have been appointed ${REP_NAMES[representativeRole]} (${representativeRole}) for ${sectionLabel(student.section)}. Representative tools are now available in your Student Portal.`,
        category: "GENERAL",
        targetType: "USER",
        targetLabel: student.user.fullName,
        senderId: req.user.id,
        userIds: [student.userId],
      });
    }
    await audit(tx, {
      req,
      action: "student.representative",
      entityType: "student",
      entityId: studentId,
      summary: `Set ${student.user.fullName} (${student.rollNumber}) as ${REP_NAMES[representativeRole]} for ${sectionLabel(student.section)}`,
      metadata: { from: student.representativeRole, to: representativeRole, replaced },
    });
    return replaced;
  });
  return { student: await getStudent(studentId), replaced: result };
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

async function listStaff(q) {
  const where = {
    ...(q.departmentId && { departmentId: q.departmentId }),
    user: {
      ...(q.status && { status: q.status }),
      ...(q.search && {
        OR: [{ fullName: { contains: q.search } }, { email: { contains: q.search } }, { username: { contains: q.search } }],
      }),
    },
  };
  const orderBy =
    q.sort === "employeeId" ? { employeeId: q.order } : q.sort === "createdAt" ? { createdAt: q.order } : { user: { fullName: q.order } };
  const [rows, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      orderBy,
      ...pageArgs(q),
      include: { user: true, department: true, _count: { select: { assignments: true } } },
    }),
    prisma.staff.count({ where }),
  ]);
  return paged(
    rows.map((s) => ({ ...serializeUser({ ...s.user, staff: s }), assignmentCount: s._count.assignments })),
    total,
    q
  );
}

async function getStaff(staffId) {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: {
      user: { include: userInclude },
      assignments: { include: { subject: true, section: { include: { course: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!staff) throw notFound("Staff member not found");
  return {
    ...serializeUser(staff.user),
    assignments: staff.assignments.map((a) => ({
      id: a.id,
      subject: { id: a.subject.id, code: a.subject.code, name: a.subject.name },
      section: { id: a.section.id, label: sectionLabel(a.section) },
    })),
  };
}

async function createStaff(data, req) {
  const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
  if (!department) throw badRequest("Please correct the highlighted fields.", { departmentId: "Choose a valid department" });
  const user = await prisma.user.create({
    data: {
      username: data.employeeId,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      fullName: data.fullName,
      mobile: data.mobile,
      role: "STAFF",
      status: "ACTIVE",
      staff: { create: { employeeId: data.employeeId, departmentId: department.id, designation: data.designation ?? null } },
    },
    include: userInclude,
  });
  await audit(prisma, { req, action: "staff.create", entityType: "staff", entityId: user.staff.id, summary: `Created staff account ${user.fullName} (${data.employeeId})` });
  return serializeUser(user);
}

async function updateStaff(staffId, data, req) {
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff) throw notFound("Staff member not found");
  if (data.departmentId) {
    const exists = await prisma.department.count({ where: { id: data.departmentId } });
    if (!exists) throw badRequest("Please correct the highlighted fields.", { departmentId: "Choose a valid department" });
  }
  const user = await prisma.user.update({
    where: { id: staff.userId },
    data: {
      ...(data.fullName && { fullName: data.fullName }),
      ...(data.email && { email: data.email }),
      ...(data.mobile !== undefined && { mobile: data.mobile }),
      ...(data.employeeId && { username: data.employeeId }),
      staff: {
        update: {
          ...(data.employeeId && { employeeId: data.employeeId }),
          ...(data.departmentId && { departmentId: data.departmentId }),
          ...(data.designation !== undefined && { designation: data.designation }),
        },
      },
    },
    include: userInclude,
  });
  await audit(prisma, { req, action: "staff.update", entityType: "staff", entityId: staffId, summary: `Updated staff ${user.fullName} (${user.staff.employeeId})`, metadata: { fields: Object.keys(data) } });
  return serializeUser(user);
}

// ---------------------------------------------------------------------------
// Administrators and shared account operations
// ---------------------------------------------------------------------------

async function listAdmins() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { fullName: "asc" } });
  return admins.map(serializeUser);
}

async function createAdmin(data, req) {
  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      mobile: data.mobile ?? null,
      fullName: data.fullName,
      passwordHash: await hashPassword(data.password),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  await audit(prisma, { req, action: "admin.create", entityType: "user", entityId: user.id, summary: `Granted administrator access to ${user.fullName} (${user.username})` });
  return serializeUser(user);
}

/** Activate / deactivate / approve any account. Deactivation revokes active sessions. */
async function setStatus(userId, { status, reason }, req) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound("Account not found");
  if (target.id === req.user.id) throw forbidden("You cannot change the status of your own account.");
  if (status === target.status) return serializeUser(target);
  if (target.role === "ADMIN" && status !== "ACTIVE") {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (activeAdmins <= 1) throw conflict("At least one active administrator is required.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { status, ...(status !== "ACTIVE" && { tokenVersion: { increment: 1 } }) },
    });
    if (status !== "ACTIVE" && target.role === "STUDENT") {
      // Representatives must be active students.
      await tx.student.updateMany({ where: { userId }, data: { representativeRole: "NONE" } });
    }
    if (status === "ACTIVE" && target.status === "PENDING") {
      await deliverNotification(tx, {
        title: "Your account has been approved",
        message: "An administrator approved your Student Expressoo account. Welcome aboard!",
        category: "GENERAL",
        targetType: "USER",
        targetLabel: target.fullName,
        senderId: req.user.id,
        userIds: [userId],
      });
    }
    const verb = status === "ACTIVE" ? (target.status === "PENDING" ? "Approved" : "Activated") : "Deactivated";
    await audit(tx, {
      req,
      action: `user.${status.toLowerCase()}`,
      entityType: "user",
      entityId: userId,
      summary: `${verb} ${target.role.toLowerCase()} account ${target.fullName} (${target.username})`,
      metadata: { from: target.status, to: status, reason: reason ?? null },
    });
    return u;
  });
  return serializeUser(updated);
}

async function resetPassword(userId, password, req) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw notFound("Account not found");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } } });
  await audit(prisma, { req, action: "user.password_reset", entityType: "user", entityId: userId, summary: `Reset the password for ${target.fullName} (${target.username})` });
  return { ok: true };
}

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  setRepresentative,
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  listAdmins,
  createAdmin,
  setStatus,
  resetPassword,
};
