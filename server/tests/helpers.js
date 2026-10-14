/**
 * Test harness: points the app at TEST_DATABASE_URL, rebuilds that database from the
 * migrations, loads a small fixture and starts the API on a random port.
 */
const path = require("path");
const { execSync } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set in server/.env — tests need their own database.");
const dbName = new URL(testUrl).pathname.replace(/^\//, "");
if (!/test/i.test(dbName) || testUrl === process.env.DATABASE_URL) {
  throw new Error(`Refusing to run tests against "${dbName}": TEST_DATABASE_URL must be a separate database whose name contains "test".`);
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testUrl;
process.env.UPLOAD_DIR = "tests/tmp-uploads";

const PASSWORD = "Testing@123";

function resetDatabase() {
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "pipe",
  });
}

async function loadFixture(prisma) {
  const { hashPassword } = require("../src/utils/password");
  const passwordHash = await hashPassword(PASSWORD);
  const dept = await prisma.department.create({ data: { code: "CSE", name: "Computer Science" } });
  const course = await prisma.course.create({ data: { code: "CSE", name: "B.Tech CSE", departmentId: dept.id } });
  const s1 = await prisma.section.create({ data: { courseId: course.id, yearOfStudy: 3, name: "A" } });
  const s2 = await prisma.section.create({ data: { courseId: course.id, yearOfStudy: 3, name: "B" } });
  const dbms = await prisma.subject.create({ data: { code: "CS301", name: "DBMS", courseId: course.id, yearOfStudy: 3 } });
  const java = await prisma.subject.create({ data: { code: "CS302", name: "Java", courseId: course.id, yearOfStudy: 3 } });

  const mk = (data) => prisma.user.create({ data: { passwordHash, status: "ACTIVE", ...data }, include: { student: true, staff: true } });
  const admin = await mk({ username: "admin", email: "admin@test.dev", fullName: "Admin One", role: "ADMIN" });
  const staffA = await mk({ username: "STFA0001", email: "a@test.dev", fullName: "Teacher A", mobile: "9000000101", role: "STAFF", staff: { create: { employeeId: "STFA0001", departmentId: dept.id } } });
  const staffB = await mk({ username: "STFB0001", email: "b@test.dev", fullName: "Teacher B", role: "STAFF", staff: { create: { employeeId: "STFB0001", departmentId: dept.id } } });
  const stu = (roll, section, rep = "NONE") =>
    mk({ username: roll, email: `${roll.toLowerCase()}@test.dev`, fullName: `Student ${roll}`, role: "STUDENT", student: { create: { rollNumber: roll, sectionId: section.id, representativeRole: rep } } });
  const studentA1 = await stu("23TEST0001", s1);
  const studentA2 = await stu("23TEST0002", s1, "CR");
  const studentA3 = await stu("23TEST0003", s1);
  const studentB1 = await stu("23TEST0101", s2);

  await prisma.staffAssignment.create({ data: { staffId: staffA.staff.id, subjectId: dbms.id, sectionId: s1.id } });
  await prisma.staffAssignment.create({ data: { staffId: staffB.staff.id, subjectId: java.id, sectionId: s2.id } });
  await prisma.staffAssignment.create({ data: { staffId: staffB.staff.id, subjectId: java.id, sectionId: s1.id } });

  return { dept, course, s1, s2, dbms, java, admin, staffA, staffB, studentA1, studentA2, studentA3, studentB1 };
}

async function startServer() {
  resetDatabase();
  const prisma = require("../src/lib/prisma");
  const { createApp } = require("../src/app");
  const fixture = await loadFixture(prisma);
  const server = await new Promise((resolve) => {
    const s = createApp().listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;

  async function api(method, url, { token, body, form } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const payload = form ?? (body !== undefined ? JSON.stringify(body) : undefined);
    const res = await fetch(base + url, { method, headers, ...(payload !== undefined && { body: payload }) });
    const type = res.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }

  async function login(username, portal) {
    const r = await api("POST", "/auth/login", { body: { username, password: PASSWORD, portal } });
    if (r.status !== 200) throw new Error(`login ${username} failed: ${r.status} ${JSON.stringify(r.data)}`);
    return r.data.token;
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  return { api, login, stop, prisma, fixture, PASSWORD };
}

module.exports = { startServer };
