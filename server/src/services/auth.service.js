const prisma = require("../lib/prisma");
const { signToken, userInclude, PORTAL_ROLE } = require("../middleware/auth");
const { hashPassword, verifyPassword } = require("../utils/password");
const { serializeUser, sectionLabel } = require("../utils/serialize");
const { unauthorized, forbidden, notFound, badRequest } = require("../utils/httpError");
const { audit } = require("../utils/audit");
const { deliverNotification } = require("./notify.service");

const PORTAL_NAMES = { student: "Student Portal", staff: "Staff Portal", admin: "Admin Console" };

async function login({ username, password, portal }, req) {
  const identifier = username.trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] },
    include: userInclude,
  });

  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) throw unauthorized("Incorrect username or password.", "INVALID_CREDENTIALS");

  // The portal decides which role may sign in; the role itself always comes from the database.
  if (user.role !== PORTAL_ROLE[portal]) {
    throw forbidden(`This account cannot sign in to the ${PORTAL_NAMES[portal]}. Please use the correct portal.`, "WRONG_PORTAL");
  }
  if (user.status === "PENDING") {
    throw forbidden("Your account is awaiting administrator approval.", "ACCOUNT_PENDING");
  }
  if (user.status === "INACTIVE") {
    throw forbidden("Your account has been deactivated. Contact the administrator.", "ACCOUNT_INACTIVE");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    include: userInclude,
  });
  await audit(prisma, { req, actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id, summary: `${user.fullName} signed in to the ${PORTAL_NAMES[portal]}` });

  return { token: signToken(updated), user: serializeUser(updated) };
}

async function registerStudent(data, req) {
  const section = await prisma.section.findUnique({ where: { id: data.sectionId }, include: { course: true } });
  if (!section) throw badRequest("Please correct the highlighted fields.", { sectionId: "Choose a valid section" });

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      username: data.rollNumber,
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      mobile: data.mobile,
      role: "STUDENT",
      status: "ACTIVE",
      student: { create: { rollNumber: data.rollNumber, sectionId: section.id, admissionYear: null } },
    },
    include: userInclude,
  });
  await audit(prisma, { req, actorId: user.id, action: "auth.register", entityType: "student", entityId: user.student.id, summary: `${user.fullName} (${data.rollNumber}) registered for ${sectionLabel(section)}` });
  return { user: serializeUser(user) };
}

async function registerStaff(data, req) {
  const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
  if (!department) throw badRequest("Please correct the highlighted fields.", { departmentId: "Choose a valid department" });

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: data.employeeId,
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        mobile: data.mobile,
        role: "STAFF",
        status: "PENDING",
        staff: { create: { employeeId: data.employeeId, departmentId: department.id, designation: data.designation ?? null } },
      },
      include: userInclude,
    });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    await deliverNotification(tx, {
      title: "New staff registration awaiting approval",
      message: `${created.fullName} (${data.employeeId}, ${department.name}) registered for the Staff Portal. Review and activate the account from Staff management.`,
      category: "GENERAL",
      targetType: "USER",
      targetLabel: "Administrators",
      senderId: null,
      userIds: admins.map((a) => a.id),
    });
    return created;
  });
  await audit(prisma, { req, actorId: user.id, action: "auth.register", entityType: "staff", entityId: user.staff.id, summary: `${user.fullName} (${data.employeeId}) requested a staff account` });
  return { user: serializeUser(user) };
}

async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude });
  if (!user) throw notFound("Account not found");
  return serializeUser(user);
}

async function updateMe(user, data, req) {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { ...(data.email !== undefined && { email: data.email }), ...(data.mobile !== undefined && { mobile: data.mobile }) },
    include: userInclude,
  });
  await audit(prisma, { req, action: "account.update", entityType: "user", entityId: user.id, summary: `${user.fullName} updated their contact details` });
  return serializeUser(updated);
}

async function changePassword(user, { currentPassword, newPassword }, req) {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  if (!(await verifyPassword(currentPassword, fresh.passwordHash))) {
    throw badRequest("Please correct the highlighted fields.", { currentPassword: "Current password is incorrect" });
  }
  // Bumping tokenVersion revokes every other session; return a fresh token for this one.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
    include: userInclude,
  });
  await audit(prisma, { req, action: "account.password_change", entityType: "user", entityId: user.id, summary: `${user.fullName} changed their password` });
  return { token: signToken(updated), user: serializeUser(updated) };
}

module.exports = { login, registerStudent, registerStaff, me, updateMe, changePassword };
