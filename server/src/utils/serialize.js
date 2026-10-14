const { toDateOnly } = require("./dates");

/** Compact label used across the UI, e.g. "CSE 3-A". */
function sectionLabel(section) {
  if (!section) return null;
  const code = section.course?.code ?? "";
  return `${code} ${section.yearOfStudy}-${section.name}`.trim();
}

function serializeSection(section) {
  if (!section) return null;
  return {
    id: section.id,
    name: section.name,
    yearOfStudy: section.yearOfStudy,
    courseId: section.courseId,
    course: section.course ? { id: section.course.id, code: section.course.code, name: section.course.name } : undefined,
    label: sectionLabel(section),
  };
}

function serializeSubject(subject) {
  if (!subject) return null;
  return {
    id: subject.id,
    code: subject.code,
    name: subject.name,
    courseId: subject.courseId,
    yearOfStudy: subject.yearOfStudy,
    semester: subject.semester,
    credits: subject.credits,
  };
}

/** Public view of a user account — never includes the password hash or token version. */
function serializeUser(user) {
  if (!user) return null;
  const out = {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    mobile: user.mobile,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
  if (user.student) {
    out.student = {
      id: user.student.id,
      rollNumber: user.student.rollNumber,
      admissionYear: user.student.admissionYear,
      representativeRole: user.student.representativeRole,
      sectionId: user.student.sectionId,
      section: user.student.section ? serializeSection(user.student.section) : undefined,
    };
  }
  if (user.staff) {
    out.staff = {
      id: user.staff.id,
      employeeId: user.staff.employeeId,
      designation: user.staff.designation,
      departmentId: user.staff.departmentId,
      department: user.staff.department
        ? { id: user.staff.department.id, code: user.staff.department.code, name: user.staff.department.name }
        : undefined,
    };
  }
  return out;
}

/** Minimal person reference for lists (e.g. "uploaded by"). */
function personRef(user) {
  return user ? { id: user.id, fullName: user.fullName, role: user.role } : null;
}

module.exports = { sectionLabel, serializeSection, serializeSubject, serializeUser, personRef, toDateOnly };
