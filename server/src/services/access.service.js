const prisma = require("../lib/prisma");
const { forbidden } = require("../utils/httpError");

/** All (subject, section) pairs a staff member is assigned to. */
async function staffAssignments(staffId) {
  return prisma.staffAssignment.findMany({
    where: { staffId },
    select: { id: true, subjectId: true, sectionId: true },
  });
}

/**
 * Staff may only act on subjects/sections they are assigned to. Administrators may act on all.
 * Throws 403 otherwise. Returns the assignment (or null for admins).
 */
async function assertCanTeach(user, { sectionId, subjectId }) {
  if (user.role === "ADMIN") return null;
  if (user.role !== "STAFF" || !user.staff) throw forbidden();
  const assignment = await prisma.staffAssignment.findFirst({
    where: { staffId: user.staff.id, sectionId, ...(subjectId ? { subjectId } : {}) },
  });
  if (!assignment) {
    throw forbidden(subjectId ? "You are not assigned to teach this subject for this section." : "You are not assigned to this section.");
  }
  return assignment;
}

/** Sections a staff member teaches (ids). */
async function staffSectionIds(staffId) {
  const rows = await prisma.staffAssignment.findMany({ where: { staffId }, select: { sectionId: true }, distinct: ["sectionId"] });
  return rows.map((r) => r.sectionId);
}

/** Active student user ids for a set of sections. */
async function studentUserIdsForSections(db, sectionIds) {
  if (!sectionIds.length) return [];
  const rows = await db.student.findMany({
    where: { sectionId: { in: sectionIds }, user: { status: "ACTIVE" } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

module.exports = { staffAssignments, assertCanTeach, staffSectionIds, studentUserIdsForSections };
