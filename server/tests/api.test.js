const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./helpers");

let ctx;
let tokens = {};
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromToday = (n) => {
  const { today, addDays } = require("../src/utils/dates");
  return iso(addDays(today(), n));
};

before(async () => {
  ctx = await startServer();
  tokens = {
    admin: await ctx.login("admin", "admin"),
    staffA: await ctx.login("STFA0001", "staff"),
    staffB: await ctx.login("STFB0001", "staff"),
    studentA1: await ctx.login("23TEST0001", "student"),
    cr: await ctx.login("23TEST0002", "student"),
    studentB1: await ctx.login("23TEST0101", "student"),
  };
});

after(async () => {
  await ctx?.stop();
});

// ---------------------------------------------------------------------------
describe("authentication", () => {
  it("rejects wrong passwords and wrong portals", async () => {
    const bad = await ctx.api("POST", "/auth/login", { body: { username: "admin", password: "wrong-pass1", portal: "admin" } });
    assert.equal(bad.status, 401);
    const wrongPortal = await ctx.api("POST", "/auth/login", { body: { username: "23TEST0001", password: ctx.PASSWORD, portal: "admin" } });
    assert.equal(wrongPortal.status, 403);
    assert.equal(wrongPortal.data.error.code, "WRONG_PORTAL");
  });

  it("never trusts a client-supplied role during registration", async () => {
    const r = await ctx.api("POST", "/auth/register/student", {
      body: {
        fullName: "Mallory Admin",
        email: "mallory@test.dev",
        mobile: "9123456780",
        rollNumber: "23TEST0999",
        sectionId: ctx.fixture.s1.id,
        password: "Password123",
        confirmPassword: "Password123",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.user.role, "STUDENT");
    const adminLogin = await ctx.api("POST", "/auth/login", { body: { username: "23TEST0999", password: "Password123", portal: "admin" } });
    assert.equal(adminLogin.status, 403);
  });

  it("keeps self-registered staff pending until approved", async () => {
    const r = await ctx.api("POST", "/auth/register/staff", {
      body: { fullName: "New Teacher", email: "new@test.dev", mobile: "9123456781", employeeId: "STFN0001", departmentId: ctx.fixture.dept.id, password: "Password123", confirmPassword: "Password123" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.user.status, "PENDING");
    const denied = await ctx.api("POST", "/auth/login", { body: { username: "STFN0001", password: "Password123", portal: "staff" } });
    assert.equal(denied.status, 403);
    assert.equal(denied.data.error.code, "ACCOUNT_PENDING");

    const approve = await ctx.api("PATCH", `/users/${r.data.user.id}/status`, { token: tokens.admin, body: { status: "ACTIVE" } });
    assert.equal(approve.status, 200);
    const ok = await ctx.api("POST", "/auth/login", { body: { username: "STFN0001", password: "Password123", portal: "staff" } });
    assert.equal(ok.status, 200);
  });

  it("stores only bcrypt hashes", async () => {
    const u = await ctx.prisma.user.findUnique({ where: { username: "23TEST0999" } });
    assert.match(u.passwordHash, /^\$2[aby]\$\d{2}\$/);
    assert.notEqual(u.passwordHash, "Password123");
  });

  it("revokes other sessions when the password changes", async () => {
    const old = await ctx.login("23TEST0003", "student");
    const r = await ctx.api("POST", "/auth/change-password", {
      token: old,
      body: { currentPassword: ctx.PASSWORD, newPassword: "BrandNew123", confirmPassword: "BrandNew123" },
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.token);
    assert.equal((await ctx.api("GET", "/auth/me", { token: old })).status, 401);
    assert.equal((await ctx.api("GET", "/auth/me", { token: r.data.token })).status, 200);
  });

  it("rejects tampered tokens", async () => {
    const forged = tokens.studentA1.slice(0, -4) + "AAAA";
    assert.equal((await ctx.api("GET", "/auth/me", { token: forged })).status, 401);
  });
});

// ---------------------------------------------------------------------------
describe("role-based access control", () => {
  it("blocks students and staff from administrative endpoints", async () => {
    for (const path of ["/students", "/staff", "/fees/records", "/payments", "/reports/fees", "/audit-logs", "/dashboard/admin", "/users/admins"]) {
      assert.equal((await ctx.api("GET", path, { token: tokens.studentA1 })).status, 403, `student ${path}`);
      assert.equal((await ctx.api("GET", path, { token: tokens.staffA })).status, 403, `staff ${path}`);
    }
  });

  it("blocks students from staff tools", async () => {
    const q = `/attendance/roster?sectionId=${ctx.fixture.s1.id}&subjectId=${ctx.fixture.dbms.id}&date=${daysFromToday(0)}&period=1`;
    assert.equal((await ctx.api("GET", q, { token: tokens.studentA1 })).status, 403);
  });

  it("only lets representatives use teacher alerts", async () => {
    assert.equal((await ctx.api("GET", "/teacher-alerts/contacts", { token: tokens.studentA1 })).status, 403);
    assert.equal((await ctx.api("GET", "/teacher-alerts/contacts", { token: tokens.cr })).status, 200);
  });

  it("prevents an administrator from deactivating themselves", async () => {
    const r = await ctx.api("PATCH", `/users/${ctx.fixture.admin.id}/status`, { token: tokens.admin, body: { status: "INACTIVE" } });
    assert.equal(r.status, 403);
  });
});

// ---------------------------------------------------------------------------
describe("attendance", () => {
  const roster = (token, sectionId, subjectId, date, period = 1) =>
    ctx.api("GET", `/attendance/roster?sectionId=${sectionId}&subjectId=${subjectId}&date=${date}&period=${period}`, { token });

  it("lets staff open rosters only for assigned classes", async () => {
    const { s1, s2, dbms } = ctx.fixture;
    const ok = await roster(tokens.staffA, s1.id, dbms.id, daysFromToday(0));
    assert.equal(ok.status, 200);
    assert.ok(ok.data.students.length >= 3);
    assert.equal((await roster(tokens.staffA, s2.id, dbms.id, daysFromToday(0))).status, 403);
  });

  it("persists a session and updates it in place on correction", async () => {
    const { s1, dbms, studentA1, studentA2, studentA3 } = ctx.fixture;
    const date = daysFromToday(-1);
    const body = (status) => ({
      sectionId: s1.id,
      subjectId: dbms.id,
      date,
      period: 2,
      topic: "Normalization",
      records: [
        { studentId: studentA1.student.id, status },
        { studentId: studentA2.student.id, status: "PRESENT" },
        { studentId: studentA3.student.id, status: "LATE" },
      ],
    });
    const first = await ctx.api("PUT", "/attendance/sessions", { token: tokens.staffA, body: body("ABSENT") });
    assert.equal(first.status, 201);
    assert.deepEqual(first.data.counts, { present: 1, late: 1, absent: 1, total: 3 });

    const second = await ctx.api("PUT", "/attendance/sessions", { token: tokens.staffA, body: body("PRESENT") });
    assert.equal(second.status, 200);
    assert.equal(second.data.sessionId, first.data.sessionId);
    assert.equal(await ctx.prisma.attendanceRecord.count({ where: { sessionId: first.data.sessionId } }), 3);
    const rec = await ctx.prisma.attendanceRecord.findFirst({ where: { sessionId: first.data.sessionId, studentId: studentA1.student.id } });
    assert.equal(rec.status, "PRESENT");
    assert.ok(await ctx.prisma.auditLog.findFirst({ where: { action: "attendance.update", entityId: String(first.data.sessionId) } }));
  });

  it("rejects another subject in an already-recorded period (staff)", async () => {
    const { s1, java, studentA1 } = ctx.fixture;
    const r = await ctx.api("PUT", "/attendance/sessions", {
      token: tokens.staffB,
      body: { sectionId: s1.id, subjectId: java.id, date: daysFromToday(-1), period: 2, records: [{ studentId: studentA1.student.id, status: "PRESENT" }] },
    });
    assert.equal(r.status, 409);
  });

  it("validates students, dates and the correction window", async () => {
    const { s1, dbms, studentB1, studentA1 } = ctx.fixture;
    const base = { sectionId: s1.id, subjectId: dbms.id, period: 3 };
    const foreign = await ctx.api("PUT", "/attendance/sessions", { token: tokens.staffA, body: { ...base, date: daysFromToday(0), records: [{ studentId: studentB1.student.id, status: "PRESENT" }] } });
    assert.equal(foreign.status, 400);
    const future = await ctx.api("PUT", "/attendance/sessions", { token: tokens.staffA, body: { ...base, date: daysFromToday(2), records: [{ studentId: studentA1.student.id, status: "PRESENT" }] } });
    assert.equal(future.status, 400);
    const old = { ...base, date: daysFromToday(-30), records: [{ studentId: studentA1.student.id, status: "PRESENT" }] };
    assert.equal((await ctx.api("PUT", "/attendance/sessions", { token: tokens.staffA, body: old })).status, 403);
    assert.equal((await ctx.api("PUT", "/attendance/sessions", { token: tokens.admin, body: old })).status, 201);
  });

  it("shows students only their own attendance", async () => {
    const mine = await ctx.api("GET", "/attendance/me/history?pageSize=100", { token: tokens.studentA1 });
    assert.equal(mine.status, 200);
    assert.ok(mine.data.items.length >= 1);
    const ids = new Set((await ctx.prisma.attendanceRecord.findMany({ where: { studentId: ctx.fixture.studentA1.student.id } })).map((r) => r.id));
    for (const item of mine.data.items) assert.ok(ids.has(item.id));
    const other = await ctx.api("GET", "/attendance/me/history", { token: tokens.studentB1 });
    assert.equal(other.data.items.length, 0);
    const summary = await ctx.api("GET", "/attendance/me/summary", { token: tokens.studentA1 });
    assert.equal(summary.data.overall.total, 2);
    assert.equal(summary.data.overall.attended, 2);
  });
});

// ---------------------------------------------------------------------------
describe("fees and payments", () => {
  let structureId;
  let recordId;

  it("assigns a fee structure to matching students", async () => {
    const created = await ctx.api("POST", "/fees/structures", {
      token: tokens.admin,
      body: { name: "Tuition", academicYear: "2026-27", courseId: ctx.fixture.course.id, yearOfStudy: 3, amount: "1000.50", dueDate: daysFromToday(10) },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.amount, "1000.50");
    structureId = created.data.id;
    const assign = await ctx.api("POST", `/fees/structures/${structureId}/assign`, { token: tokens.admin });
    assert.equal(assign.status, 200);
    assert.ok(assign.data.created >= 4);
    const again = await ctx.api("POST", `/fees/structures/${structureId}/assign`, { token: tokens.admin });
    assert.equal(again.data.created, 0);
    const rec = await ctx.prisma.studentFeeRecord.findFirst({ where: { feeStructureId: structureId, studentId: ctx.fixture.studentA1.student.id } });
    recordId = rec.id;
  });

  it("records partial and full payments with exact decimals", async () => {
    const pay = (amount) => ctx.api("POST", "/payments", { token: tokens.admin, body: { feeRecordId: recordId, amount, method: "UPI", paidOn: daysFromToday(0) } });
    const p1 = await pay("400.25");
    assert.equal(p1.status, 201);
    assert.match(p1.data.receiptNo, /^RCPT-\d{4}-\d{6}$/);
    let rec = await ctx.prisma.studentFeeRecord.findUnique({ where: { id: recordId } });
    assert.equal(rec.status, "PARTIAL");
    assert.equal(rec.amountPaid.toFixed(2), "400.25");

    const over = await pay("700.00");
    assert.equal(over.status, 422);

    const p2 = await pay("600.25");
    assert.equal(p2.status, 201);
    rec = await ctx.prisma.studentFeeRecord.findUnique({ where: { id: recordId } });
    assert.equal(rec.status, "PAID");
    assert.equal(rec.amountPaid.toFixed(2), "1000.50");

    const voided = await ctx.api("POST", `/payments/${p2.data.id}/void`, { token: tokens.admin, body: { reason: "Entered twice" } });
    assert.equal(voided.status, 200);
    rec = await ctx.prisma.studentFeeRecord.findUnique({ where: { id: recordId } });
    assert.equal(rec.status, "PARTIAL");
    assert.equal(rec.amountPaid.toFixed(2), "400.25");
  });

  it("never lets concurrent payments exceed the balance", async () => {
    const rec = await ctx.prisma.studentFeeRecord.findFirst({ where: { feeStructureId: structureId, studentId: ctx.fixture.studentA2.student.id } });
    const results = await Promise.all(
      Array.from({ length: 4 }, () => ctx.api("POST", "/payments", { token: tokens.admin, body: { feeRecordId: rec.id, amount: "1000.50", method: "CASH", paidOn: daysFromToday(0) } }))
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    const after = await ctx.prisma.studentFeeRecord.findUnique({ where: { id: rec.id } });
    assert.equal(after.amountPaid.toFixed(2), "1000.50");
    assert.equal(await ctx.prisma.payment.count({ where: { feeRecordId: rec.id, status: "RECORDED" } }), 1);
  });

  it("shows students only their own fees and receipts", async () => {
    const mine = await ctx.api("GET", "/fees/me", { token: tokens.studentA1 });
    assert.equal(mine.status, 200);
    assert.equal(mine.data.summary.paid, "400.25");
    assert.equal(mine.data.summary.balance, "600.25");
    assert.equal(mine.data.onlinePaymentsEnabled, false);
    const foreignPayment = await ctx.prisma.payment.findFirst({ where: { feeRecord: { studentId: ctx.fixture.studentA2.student.id } } });
    assert.equal((await ctx.api("GET", `/payments/${foreignPayment.id}`, { token: tokens.studentA1 })).status, 404);
  });

  it("refuses to change the amount of an assigned structure", async () => {
    const r = await ctx.api("PATCH", `/fees/structures/${structureId}`, { token: tokens.admin, body: { amount: "2000" } });
    assert.equal(r.status, 409);
  });
});

// ---------------------------------------------------------------------------
describe("study materials", () => {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");
  const form = (fields, file, name, type) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
    if (file) f.append("file", new Blob([file], { type }), name);
    return f;
  };
  let materialId;

  it("accepts a genuine PDF for an assigned class", async () => {
    const r = await ctx.api("POST", "/materials", {
      token: tokens.staffA,
      form: form({ title: "Unit 1 notes", unit: "Unit-1", subjectId: ctx.fixture.dbms.id, sectionId: ctx.fixture.s1.id }, pdf, "notes.pdf", "application/pdf"),
    });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    materialId = r.data.id;
    const stored = await ctx.prisma.studyMaterial.findUnique({ where: { id: materialId } });
    assert.notEqual(stored.storedName, "notes.pdf");
  });

  it("rejects disguised and disallowed files", async () => {
    const fake = await ctx.api("POST", "/materials", {
      token: tokens.staffA,
      form: form({ title: "Fake", subjectId: ctx.fixture.dbms.id, sectionId: ctx.fixture.s1.id }, Buffer.from("MZ\x90\x00 not a pdf"), "evil.pdf", "application/pdf"),
    });
    assert.equal(fake.status, 400);
    const exe = await ctx.api("POST", "/materials", {
      token: tokens.staffA,
      form: form({ title: "Exe", subjectId: ctx.fixture.dbms.id, sectionId: ctx.fixture.s1.id }, Buffer.from("MZ"), "run.exe", "application/octet-stream"),
    });
    assert.equal(exe.status, 400);
  });

  it("rejects uploads for classes the staff member does not teach", async () => {
    const r = await ctx.api("POST", "/materials", {
      token: tokens.staffA,
      form: form({ title: "Wrong class", subjectId: ctx.fixture.java.id, sectionId: ctx.fixture.s2.id }, pdf, "x.pdf", "application/pdf"),
    });
    assert.equal(r.status, 403);
  });

  it("serves downloads only to students who can see the material", async () => {
    const ok = await ctx.api("GET", `/materials/${materialId}/download`, { token: tokens.studentA1 });
    assert.equal(ok.status, 200);
    assert.equal(Buffer.compare(ok.data, pdf), 0);
    assert.match(ok.headers.get("content-disposition"), /notes\.pdf/);
    assert.equal((await ctx.api("GET", `/materials/${materialId}/download`, { token: tokens.studentB1 })).status, 404);
    const listB = await ctx.api("GET", "/materials", { token: tokens.studentB1 });
    assert.ok(!listB.data.items.some((m) => m.id === materialId));
  });

  it("lets only the uploader or an admin delete", async () => {
    // Staff B does not teach this class, so the material is invisible to them (404, not 403).
    assert.equal((await ctx.api("DELETE", `/materials/${materialId}`, { token: tokens.staffB })).status, 404);
    assert.ok(await ctx.prisma.studyMaterial.findUnique({ where: { id: materialId } }));
    assert.equal((await ctx.api("DELETE", `/materials/${materialId}`, { token: tokens.staffA })).status, 200);
    assert.equal(await ctx.prisma.studyMaterial.findUnique({ where: { id: materialId } }), null);
  });
});

// ---------------------------------------------------------------------------
describe("notifications, announcements and teacher alerts", () => {
  it("delivers staff notifications to the assigned section only", async () => {
    const ok = await ctx.api("POST", "/notifications", {
      token: tokens.staffA,
      body: { title: "Quiz tomorrow", message: "Unit 1 quiz.", targetType: "SECTION", sectionIds: [ctx.fixture.s1.id] },
    });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.recipientCount, await ctx.prisma.student.count({ where: { sectionId: ctx.fixture.s1.id, user: { status: "ACTIVE" } } }));
    const denied = await ctx.api("POST", "/notifications", {
      token: tokens.staffA,
      body: { title: "Nope", message: "x", targetType: "SECTION", sectionIds: [ctx.fixture.s2.id] },
    });
    assert.equal(denied.status, 403);
    const broadcast = await ctx.api("POST", "/notifications", { token: tokens.staffA, body: { title: "All", message: "x", targetType: "ALL" } });
    assert.equal(broadcast.status, 403);
  });

  it("tracks read state per recipient and protects other inboxes", async () => {
    const inbox = await ctx.api("GET", "/notifications", { token: tokens.studentA1 });
    assert.ok(inbox.data.unreadCount >= 1);
    const item = inbox.data.items[0];
    const otherInbox = await ctx.api("PATCH", `/notifications/${item.id}/read`, { token: tokens.studentB1 });
    assert.equal(otherInbox.status, 404);
    const read = await ctx.api("PATCH", `/notifications/${item.id}/read`, { token: tokens.studentA1 });
    assert.equal(read.status, 200);
    assert.equal(read.data.unreadCount, inbox.data.unreadCount - 1);
  });

  it("filters announcements by audience", async () => {
    await ctx.api("POST", "/announcements", { token: tokens.admin, body: { title: "Staff only", body: "Meeting", audience: "STAFF" } });
    await ctx.api("POST", "/announcements", { token: tokens.admin, body: { title: "Students only", body: "Exam", audience: "STUDENTS" } });
    const forStudent = await ctx.api("GET", "/announcements", { token: tokens.studentA1 });
    assert.ok(forStudent.data.items.some((a) => a.title === "Students only"));
    assert.ok(!forStudent.data.items.some((a) => a.title === "Staff only"));
    assert.equal((await ctx.api("POST", "/announcements", { token: tokens.staffA, body: { title: "x", body: "y" } })).status, 403);
  });

  it("runs the CR teacher-alert workflow end to end", async () => {
    const contacts = await ctx.api("GET", "/teacher-alerts/contacts", { token: tokens.cr });
    const teacher = contacts.data.contacts.find((c) => c.fullName === "Teacher A");
    assert.equal(teacher.mobile, "9000000101");
    const created = await ctx.api("POST", "/teacher-alerts", { token: tokens.cr, body: { staffId: teacher.staffId, subjectId: ctx.fixture.dbms.id, period: 3, message: "Waiting in room 204" } });
    assert.equal(created.status, 201);
    const dup = await ctx.api("POST", "/teacher-alerts", { token: tokens.cr, body: { staffId: teacher.staffId, period: 3 } });
    assert.equal(dup.status, 409);

    const staffInbox = await ctx.api("GET", "/notifications?category=ALERT", { token: tokens.staffA });
    assert.ok(staffInbox.data.items.some((n) => n.title.includes("period 3")));
    assert.equal((await ctx.api("PATCH", `/teacher-alerts/${created.data.id}/acknowledge`, { token: tokens.staffB, body: {} })).status, 404);
    const ack = await ctx.api("PATCH", `/teacher-alerts/${created.data.id}/acknowledge`, { token: tokens.staffA, body: { responseNote: "On my way" } });
    assert.equal(ack.status, 200);
    assert.equal(ack.data.status, "ACKNOWLEDGED");
    const resolved = await ctx.api("PATCH", `/teacher-alerts/${created.data.id}/resolve`, { token: tokens.cr });
    assert.equal(resolved.data.status, "RESOLVED");
  });
});

// ---------------------------------------------------------------------------
describe("administration", () => {
  it("keeps one CR per section", async () => {
    const r = await ctx.api("PATCH", `/students/${ctx.fixture.studentA1.student.id}/representative`, { token: tokens.admin, body: { representativeRole: "CR" } });
    assert.equal(r.status, 200);
    assert.equal(r.data.replaced.rollNumber, "23TEST0002");
    const previous = await ctx.prisma.student.findUnique({ where: { id: ctx.fixture.studentA2.student.id } });
    assert.equal(previous.representativeRole, "NONE");
  });

  it("revokes access immediately when an account is deactivated", async () => {
    const token = await ctx.login("23TEST0101", "student");
    const r = await ctx.api("PATCH", `/users/${ctx.fixture.studentB1.id}/status`, { token: tokens.admin, body: { status: "INACTIVE" } });
    assert.equal(r.status, 200);
    assert.equal((await ctx.api("GET", "/auth/me", { token })).status, 401);
  });

  it("treats search input as data, not SQL", async () => {
    const r = await ctx.api("GET", `/students?search=${encodeURIComponent("' OR 1=1; DROP TABLE users; --")}`, { token: tokens.admin });
    assert.equal(r.status, 200);
    assert.equal(r.data.items.length, 0);
    assert.ok((await ctx.prisma.user.count()) > 0);
  });

  it("writes an audit trail for sensitive actions", async () => {
    const actions = (await ctx.prisma.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
    for (const a of ["auth.login", "attendance.create", "payment.record", "payment.void", "material.upload", "user.inactive", "student.representative"]) {
      assert.ok(actions.includes(a), `missing audit action ${a}`);
    }
  });

  it("reports dashboard numbers that match the database", async () => {
    const d = await ctx.api("GET", "/dashboard/admin", { token: tokens.admin });
    assert.equal(d.status, 200);
    assert.equal(d.data.counts.students, await ctx.prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } }));
    const agg = await ctx.prisma.studentFeeRecord.aggregate({ _sum: { amountPaid: true } });
    assert.equal(d.data.fees.collected, agg._sum.amountPaid.toFixed(2));
  });
});
