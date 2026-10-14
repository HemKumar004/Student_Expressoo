const prisma = require("../lib/prisma");
const { notFound, badRequest, conflict } = require("../utils/httpError");
const { serializeSection, sectionLabel } = require("../utils/serialize");
const { audit } = require("../utils/audit");

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

async function listDepartments() {
  const rows = await prisma.department.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { courses: true, staff: true } } },
  });
  return rows.map((d) => ({ id: d.id, code: d.code, name: d.name, courseCount: d._count.courses, staffCount: d._count.staff }));
}

async function createDepartment(data, req) {
  const d = await prisma.department.create({ data });
  await audit(prisma, { req, action: "department.create", entityType: "department", entityId: d.id, summary: `Created department ${d.code} — ${d.name}` });
  return d;
}

async function updateDepartment(id, data, req) {
  const d = await prisma.department.update({ where: { id }, data });
  await audit(prisma, { req, action: "department.update", entityType: "department", entityId: id, summary: `Updated department ${d.code}` });
  return d;
}

async function deleteDepartment(id, req) {
  const d = await prisma.department.findUnique({ where: { id }, include: { _count: { select: { courses: true, staff: true } } } });
  if (!d) throw notFound("Department not found");
  if (d._count.courses || d._count.staff) throw conflict("This department still has courses or staff. Move them before deleting it.");
  await prisma.department.delete({ where: { id } });
  await audit(prisma, { req, action: "department.delete", entityType: "department", entityId: id, summary: `Deleted department ${d.code}` });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

async function listCourses({ departmentId } = {}) {
  const rows = await prisma.course.findMany({
    where: { ...(departmentId && { departmentId }) },
    orderBy: { code: "asc" },
    include: { department: true, _count: { select: { sections: true, subjects: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    durationYears: c.durationYears,
    departmentId: c.departmentId,
    department: { id: c.department.id, code: c.department.code, name: c.department.name },
    sectionCount: c._count.sections,
    subjectCount: c._count.subjects,
  }));
}

async function ensureDepartment(departmentId) {
  if (departmentId && !(await prisma.department.count({ where: { id: departmentId } }))) {
    throw badRequest("Please correct the highlighted fields.", { departmentId: "Choose a valid department" });
  }
}

async function createCourse(data, req) {
  await ensureDepartment(data.departmentId);
  const c = await prisma.course.create({ data });
  await audit(prisma, { req, action: "course.create", entityType: "course", entityId: c.id, summary: `Created course ${c.code} — ${c.name}` });
  return c;
}

async function updateCourse(id, data, req) {
  await ensureDepartment(data.departmentId);
  const c = await prisma.course.update({ where: { id }, data });
  await audit(prisma, { req, action: "course.update", entityType: "course", entityId: id, summary: `Updated course ${c.code}` });
  return c;
}

async function deleteCourse(id, req) {
  const c = await prisma.course.findUnique({ where: { id }, include: { _count: { select: { sections: true, subjects: true, feeStructures: true } } } });
  if (!c) throw notFound("Course not found");
  if (c._count.sections || c._count.subjects || c._count.feeStructures) {
    throw conflict("This course still has sections, subjects or fee structures. Remove them before deleting it.");
  }
  await prisma.course.delete({ where: { id } });
  await audit(prisma, { req, action: "course.delete", entityType: "course", entityId: id, summary: `Deleted course ${c.code}` });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

async function listSections({ courseId, yearOfStudy } = {}) {
  const rows = await prisma.section.findMany({
    where: { ...(courseId && { courseId }), ...(yearOfStudy && { yearOfStudy }) },
    orderBy: [{ course: { code: "asc" } }, { yearOfStudy: "asc" }, { name: "asc" }],
    include: { course: true, _count: { select: { students: true, assignments: true } } },
  });
  return rows.map((s) => ({ ...serializeSection(s), studentCount: s._count.students, assignmentCount: s._count.assignments }));
}

async function ensureCourse(courseId) {
  if (courseId && !(await prisma.course.count({ where: { id: courseId } }))) {
    throw badRequest("Please correct the highlighted fields.", { courseId: "Choose a valid course" });
  }
}

async function createSection(data, req) {
  await ensureCourse(data.courseId);
  const s = await prisma.section.create({ data, include: { course: true } });
  await audit(prisma, { req, action: "section.create", entityType: "section", entityId: s.id, summary: `Created section ${sectionLabel(s)}` });
  return serializeSection(s);
}

async function updateSection(id, data, req) {
  await ensureCourse(data.courseId);
  const s = await prisma.section.update({ where: { id }, data, include: { course: true } });
  await audit(prisma, { req, action: "section.update", entityType: "section", entityId: id, summary: `Updated section ${sectionLabel(s)}` });
  return serializeSection(s);
}

async function deleteSection(id, req) {
  const s = await prisma.section.findUnique({
    where: { id },
    include: { course: true, _count: { select: { students: true, assignments: true, classSessions: true, materials: true } } },
  });
  if (!s) throw notFound("Section not found");
  const n = s._count;
  if (n.students || n.assignments || n.classSessions || n.materials) {
    throw conflict("This section has students, staff assignments, attendance or materials and cannot be deleted.");
  }
  await prisma.section.delete({ where: { id } });
  await audit(prisma, { req, action: "section.delete", entityType: "section", entityId: id, summary: `Deleted section ${sectionLabel(s)}` });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

async function listSubjects({ courseId, yearOfStudy, sectionId } = {}) {
  const where = {
    ...(courseId && { courseId }),
    ...(yearOfStudy && { yearOfStudy }),
    ...(sectionId && { assignments: { some: { sectionId } } }),
  };
  const rows = await prisma.subject.findMany({
    where,
    orderBy: [{ course: { code: "asc" } }, { yearOfStudy: "asc" }, { code: "asc" }],
    include: { course: true, _count: { select: { assignments: true, materials: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    courseId: s.courseId,
    course: { id: s.course.id, code: s.course.code, name: s.course.name },
    yearOfStudy: s.yearOfStudy,
    semester: s.semester,
    credits: s.credits,
    assignmentCount: s._count.assignments,
    materialCount: s._count.materials,
  }));
}

async function createSubject(data, req) {
  await ensureCourse(data.courseId);
  const s = await prisma.subject.create({ data });
  await audit(prisma, { req, action: "subject.create", entityType: "subject", entityId: s.id, summary: `Created subject ${s.code} — ${s.name}` });
  return s;
}

async function updateSubject(id, data, req) {
  await ensureCourse(data.courseId);
  const s = await prisma.subject.update({ where: { id }, data });
  await audit(prisma, { req, action: "subject.update", entityType: "subject", entityId: id, summary: `Updated subject ${s.code}` });
  return s;
}

async function deleteSubject(id, req) {
  const s = await prisma.subject.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true, classSessions: true, materials: true } } },
  });
  if (!s) throw notFound("Subject not found");
  if (s._count.assignments || s._count.classSessions || s._count.materials) {
    throw conflict("This subject has staff assignments, attendance or materials and cannot be deleted.");
  }
  await prisma.subject.delete({ where: { id } });
  await audit(prisma, { req, action: "subject.delete", entityType: "subject", entityId: id, summary: `Deleted subject ${s.code}` });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Staff assignments
// ---------------------------------------------------------------------------

function serializeAssignment(a) {
  return {
    id: a.id,
    staff: a.staff ? { id: a.staff.id, employeeId: a.staff.employeeId, fullName: a.staff.user?.fullName, mobile: a.staff.user?.mobile } : undefined,
    subject: { id: a.subject.id, code: a.subject.code, name: a.subject.name },
    section: serializeSection(a.section),
    createdAt: a.createdAt,
  };
}

const assignmentInclude = {
  staff: { include: { user: true } },
  subject: true,
  section: { include: { course: true } },
};

async function listAssignments({ staffId, sectionId, subjectId, courseId } = {}) {
  const rows = await prisma.staffAssignment.findMany({
    where: {
      ...(staffId && { staffId }),
      ...(sectionId && { sectionId }),
      ...(subjectId && { subjectId }),
      ...(courseId && { section: { courseId } }),
    },
    include: assignmentInclude,
    orderBy: [{ section: { course: { code: "asc" } } }, { section: { yearOfStudy: "asc" } }, { section: { name: "asc" } }, { subject: { code: "asc" } }],
  });
  return rows.map(serializeAssignment);
}

async function createAssignment({ staffId, subjectId, sectionId }, req) {
  const [staff, subject, section] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffId }, include: { user: true } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
    prisma.section.findUnique({ where: { id: sectionId }, include: { course: true } }),
  ]);
  const details = {};
  if (!staff) details.staffId = "Choose a valid staff member";
  if (!subject) details.subjectId = "Choose a valid subject";
  if (!section) details.sectionId = "Choose a valid section";
  if (Object.keys(details).length) throw badRequest("Please correct the highlighted fields.", details);
  if (subject.courseId !== section.courseId || subject.yearOfStudy !== section.yearOfStudy) {
    throw badRequest("Please correct the highlighted fields.", { subjectId: `${subject.code} is not taught to ${sectionLabel(section)} (different course or year).` });
  }
  if (staff.user.status === "INACTIVE") throw conflict("Inactive staff members cannot be assigned to classes.");

  const a = await prisma.staffAssignment.create({ data: { staffId, subjectId, sectionId }, include: assignmentInclude });
  await audit(prisma, { req, action: "assignment.create", entityType: "staff_assignment", entityId: a.id, summary: `Assigned ${staff.user.fullName} to ${subject.code} for ${sectionLabel(section)}` });
  return serializeAssignment(a);
}

async function deleteAssignment(id, req) {
  const a = await prisma.staffAssignment.findUnique({ where: { id }, include: assignmentInclude });
  if (!a) throw notFound("Assignment not found");
  await prisma.staffAssignment.delete({ where: { id } });
  await audit(prisma, { req, action: "assignment.delete", entityType: "staff_assignment", entityId: id, summary: `Removed ${a.staff.user.fullName} from ${a.subject.code} for ${sectionLabel(a.section)}` });
  return { ok: true };
}

module.exports = {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  listAssignments,
  createAssignment,
  deleteAssignment,
  serializeAssignment,
  assignmentInclude,
};
