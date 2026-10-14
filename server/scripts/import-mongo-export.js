/**
 * One-time import of data from the original MongoDB version of Student Expressoo.
 *
 * The original app persisted only three collections (students, teachers, materials);
 * attendance, fees, notifications and teacher alerts lived in in-memory arrays and were
 * lost on every restart, so there is nothing to import for them.
 *
 * 1) Export from MongoDB (on the machine that has the data):
 *      mongoexport --db studentexpressoo --collection students  --jsonArray --out students.json
 *      mongoexport --db studentexpressoo --collection teachers  --jsonArray --out teachers.json
 *      mongoexport --db studentexpressoo --collection materials --jsonArray --out materials.json
 * 2) Preview:   npm run import-mongo -- --dir ./mongo-export --dry-run
 * 3) Import:    npm run import-mongo -- --dir ./mongo-export
 *
 * Mapping and safety rules
 *  - Plaintext passwords from the old system are bcrypt-hashed (users keep their password).
 *  - Old free-text course/section values become Course/Section rows (year of study defaults to
 *    1 — review these in the Admin Console). Departments are created per course code.
 *  - "CR"/"LR" roles become representative designations. "Teacher"/"Admin" roles chosen at
 *    public sign-up are NOT trusted: such users are imported as PENDING staff or skipped.
 *  - Teachers are imported as PENDING staff awaiting administrator approval.
 *  - Materials cannot be imported: the old app stored only a file name string, never the file.
 *  - Existing usernames / emails / roll numbers are skipped, never overwritten.
 *  - A JSON report (import-report.json) is written next to the export files.
 */
const fs = require("fs");
const path = require("path");
const prisma = require("../src/lib/prisma");
const { hashPassword } = require("../src/utils/password");

const args = process.argv.slice(2);
const dirArg = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : null;
const dryRun = args.includes("--dry-run");

const oid = (doc) => (doc?._id?.$oid ? doc._id.$oid : String(doc?._id ?? ""));
const clean = (v) => (typeof v === "string" ? v.trim() : v);
const code = (v, fallback) => (clean(v) || fallback).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16) || fallback;

function readCollection(dir, name) {
  const file = path.join(dir, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8").trim();
  // Accept --jsonArray output or newline-delimited JSON.
  return raw.startsWith("[") ? JSON.parse(raw) : raw.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
}

async function main() {
  if (!dirArg) {
    console.error("Usage: npm run import-mongo -- --dir <folder with students.json/teachers.json/materials.json> [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const dir = path.resolve(dirArg);
  const students = readCollection(dir, "students") || [];
  const teachers = readCollection(dir, "teachers") || [];
  const materials = readCollection(dir, "materials") || [];
  const report = {
    startedAt: new Date().toISOString(),
    dryRun,
    source: dir,
    counts: { studentsRead: students.length, teachersRead: teachers.length, materialsRead: materials.length, studentsImported: 0, staffImported: 0, skipped: 0 },
    created: { departments: [], courses: [], sections: [] },
    idMap: {},
    skipped: [],
    needsReview: [],
    notMigrated: [
      ...materials.map((m) => ({ mongoId: oid(m), collection: "materials", title: `${m.subject} ${m.unit}`, reason: "The original app stored only a file name, not the file itself. Ask the teacher to re-upload it from the Staff Portal." })),
      { collection: "attendance / fees / notifications / teacher alerts", reason: "Kept only in server memory by the original app — no persistent data exists." },
    ],
  };

  const cache = { departments: new Map(), courses: new Map(), sections: new Map() };
  async function ensureCourse(courseText) {
    const c = code(courseText, "GEN");
    if (cache.courses.has(c)) return cache.courses.get(c);
    let course = await prisma.course.findUnique({ where: { code: c } });
    if (!course) {
      let dept = await prisma.department.findUnique({ where: { code: c } });
      if (!dept && !dryRun) dept = await prisma.department.create({ data: { code: c, name: `${c} (imported)` } });
      if (!dept) dept = { id: -1 };
      if (!report.created.departments.includes(c)) report.created.departments.push(c);
      course = dryRun ? { id: -1, code: c } : await prisma.course.create({ data: { code: c, name: `${c} (imported — rename me)`, departmentId: dept.id } });
      report.created.courses.push(c);
    }
    cache.courses.set(c, course);
    return course;
  }
  async function ensureSection(courseText, sectionText) {
    const course = await ensureCourse(courseText);
    const name = code(sectionText, "A").slice(0, 10);
    const key = `${course.code}:${name}`;
    if (cache.sections.has(key)) return cache.sections.get(key);
    let section = course.id > 0 ? await prisma.section.findFirst({ where: { courseId: course.id, name } }) : null;
    if (!section) {
      section = dryRun ? { id: -1 } : await prisma.section.create({ data: { courseId: course.id, yearOfStudy: 1, name } });
      report.created.sections.push(`${course.code} 1-${name}`);
      report.needsReview.push({ section: `${course.code} 1-${name}`, reason: "Year of study unknown in the old data; defaulted to 1. Edit it in Academic structure." });
    }
    cache.sections.set(key, section);
    return section;
  }
  async function exists({ username, email, rollNumber, employeeId }) {
    const [u, s, st] = await Promise.all([
      prisma.user.findFirst({ where: { OR: [{ username }, ...(email ? [{ email: email.toLowerCase() }] : [])] } }),
      rollNumber ? prisma.student.findUnique({ where: { rollNumber } }) : null,
      employeeId ? prisma.staff.findUnique({ where: { employeeId } }) : null,
    ]);
    return u || s || st;
  }
  const skip = (doc, collection, reason) => {
    report.counts.skipped++;
    report.skipped.push({ mongoId: oid(doc), collection, username: doc.username, reason });
  };

  for (const doc of students) {
    const username = clean(doc.username)?.toUpperCase();
    const rollNumber = (clean(doc.rollNumber) || username || "").toUpperCase();
    const role = clean(doc.role) || "Student";
    if (!username || !doc.password || !doc.email || !doc.fullName) {
      skip(doc, "students", "Missing username, password, email or name");
      continue;
    }
    if (role === "Admin") {
      skip(doc, "students", "Self-registered as Admin in the old app — administrator access is never imported. Create admins with `npm run create-admin`.");
      continue;
    }
    if (await exists({ username, email: doc.email, rollNumber })) {
      skip(doc, "students", "Username, email or roll number already exists in MySQL");
      continue;
    }
    const passwordHash = await hashPassword(String(doc.password));
    if (role === "Teacher") {
      const dept = await ensureCourse(doc.course);
      if (!dryRun) {
        const deptRow = await prisma.department.findUnique({ where: { code: dept.code } });
        const u = await prisma.user.create({
          data: { username, email: doc.email.toLowerCase(), fullName: doc.fullName, mobile: clean(doc.mobile) || null, passwordHash, role: "STAFF", status: "PENDING", staff: { create: { employeeId: username, departmentId: deptRow.id } } },
        });
        report.idMap[oid(doc)] = { userId: u.id, type: "staff" };
      }
      report.counts.staffImported++;
      report.needsReview.push({ username, reason: "Signed up as Teacher in the old student form — imported as PENDING staff for approval." });
      continue;
    }
    const section = await ensureSection(doc.course, doc.section);
    const representativeRole = role === "CR" || role === "LR" ? role : "NONE";
    if (!dryRun) {
      const u = await prisma.user.create({
        data: {
          username,
          email: doc.email.toLowerCase(),
          fullName: doc.fullName,
          mobile: clean(doc.mobile) || null,
          passwordHash,
          role: "STUDENT",
          status: "ACTIVE",
          student: { create: { rollNumber, sectionId: section.id, representativeRole } },
        },
        include: { student: true },
      });
      report.idMap[oid(doc)] = { userId: u.id, studentId: u.student.id, type: "student" };
    }
    report.counts.studentsImported++;
  }

  for (const doc of teachers) {
    const username = clean(doc.username)?.toUpperCase();
    const employeeId = (clean(doc.teacherId) || username || "").toUpperCase();
    if (!username || !doc.password || !doc.email || !doc.teacherName) {
      skip(doc, "teachers", "Missing username, password, email or name");
      continue;
    }
    if (await exists({ username, email: doc.email, employeeId })) {
      skip(doc, "teachers", "Username, email or employee ID already exists in MySQL");
      continue;
    }
    const deptCode = code(doc.department, "GEN");
    let dept = await prisma.department.findUnique({ where: { code: deptCode } });
    if (!dept && !dryRun) {
      dept = await prisma.department.create({ data: { code: deptCode, name: `${deptCode} (imported)` } });
      report.created.departments.push(deptCode);
    }
    if (!dryRun) {
      const u = await prisma.user.create({
        data: {
          username,
          email: doc.email.toLowerCase(),
          fullName: doc.teacherName,
          mobile: clean(doc.mobile) || null,
          passwordHash: await hashPassword(String(doc.password)),
          role: "STAFF",
          status: "PENDING",
          staff: { create: { employeeId, departmentId: dept.id } },
        },
      });
      report.idMap[oid(doc)] = { userId: u.id, type: "staff" };
    }
    report.counts.staffImported++;
  }

  if (!dryRun && (report.counts.studentsImported || report.counts.staffImported)) {
    await prisma.auditLog.create({
      data: { action: "system.import", entityType: "system", summary: `Imported ${report.counts.studentsImported} students and ${report.counts.staffImported} staff from the MongoDB export`, metadata: { skipped: report.counts.skipped } },
    });
  }

  report.finishedAt = new Date().toISOString();
  const out = path.join(dir, dryRun ? "import-report.dry-run.json" : "import-report.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`${dryRun ? "[dry run] " : ""}Students: ${report.counts.studentsImported}/${students.length} · Staff: ${report.counts.staffImported} · Skipped: ${report.counts.skipped} · Materials not migratable: ${materials.length}`);
  console.log(`Report written to ${out}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
