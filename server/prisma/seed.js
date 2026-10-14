/**
 * DEVELOPMENT SEED DATA — Student Expressoo
 *
 * Loads a realistic demo college (departments, courses, sections, staff, students, attendance,
 * fees, payments, study materials, notices). This is sample data only — never real records.
 *
 * Safety:
 *  - refuses to run when NODE_ENV=production
 *  - refuses to run when the database already contains user accounts (never overwrites data)
 *    → to start over in development: `npm run db:reset` (drops all data), then `npm run db:seed`
 *
 * Development sign-in (all seeded accounts share one password):
 *   password ............ Expressoo@2026
 *   Admin Console ....... admin
 *   Staff Portal ........ STF10001 (Dr. Ramesh Kumar)   STF10004 (Lakshmi Prasanna)
 *   Student Portal ...... 23A91A0501 (student)  23A91A0502 (Class Representative)  23A91A0503 (Ladies Representative)
 * Change or remove these accounts before any real deployment.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../src/config/env");
const prisma = require("../src/lib/prisma");
const { hashPassword } = require("../src/utils/password");
const { today, addDays, toDateOnly } = require("../src/utils/dates");
const { dec, feeStatusFor } = require("../src/utils/money");
const { MATERIALS_DIR } = require("../src/middleware/upload");

const DEV_PASSWORD = "Expressoo@2026";

// Deterministic pseudo-random generator so every seed produces the same demo data.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261013);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/** Build a small, valid single-page PDF so seeded materials can really be downloaded. */
function makePdf(title, lines) {
  const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = [`BT /F1 20 Tf 72 740 Td (${esc(title)}) Tj ET`]
    .concat(lines.map((l, i) => `BT /F1 12 Tf 72 ${700 - i * 20} Td (${esc(l)}) Tj ET`))
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "binary");
}

const daysAgo = (n) => addDays(today(), -n);
const minutesAgo = (n) => new Date(Date.now() - n * 60000);

async function main() {
  if (config.isProduction) {
    console.error("Refusing to load development seed data in production.");
    process.exit(1);
  }
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.error(`The database already contains ${existing} account(s). The seed never overwrites data.`);
    console.error("To start fresh in development run `npm run db:reset` (drops ALL data), then `npm run db:seed`.");
    process.exit(1);
  }

  console.log("Seeding development data…");
  const passwordHash = await hashPassword(DEV_PASSWORD);

  // ---- Academic structure --------------------------------------------------
  const cseDept = await prisma.department.create({ data: { code: "CSE", name: "Computer Science & Engineering" } });
  const eceDept = await prisma.department.create({ data: { code: "ECE", name: "Electronics & Communication Engineering" } });
  await prisma.department.create({ data: { code: "BSH", name: "Basic Sciences & Humanities" } });

  const cse = await prisma.course.create({ data: { code: "CSE", name: "B.Tech Computer Science & Engineering", departmentId: cseDept.id, durationYears: 4 } });
  const ece = await prisma.course.create({ data: { code: "ECE", name: "B.Tech Electronics & Communication Engineering", departmentId: eceDept.id, durationYears: 4 } });

  const sec = {};
  for (const [key, course, year, name] of [
    ["cse3a", cse, 3, "A"],
    ["cse3b", cse, 3, "B"],
    ["cse2a", cse, 2, "A"],
    ["ece3a", ece, 3, "A"],
  ]) {
    sec[key] = await prisma.section.create({ data: { courseId: course.id, yearOfStudy: year, name } });
  }

  const subj = {};
  for (const [key, code, name, course, year, semester, credits] of [
    ["dbms", "CS301", "Database Management Systems", cse, 3, 5, 4],
    ["java", "CS302", "Object Oriented Programming through Java", cse, 3, 5, 4],
    ["python", "CS303", "Python Programming", cse, 3, 5, 3],
    ["os", "CS304", "Operating Systems", cse, 3, 5, 4],
    ["cn", "CS305", "Computer Networks", cse, 3, 5, 3],
    ["ds", "CS201", "Data Structures", cse, 2, 3, 4],
    ["dm", "CS202", "Discrete Mathematics", cse, 2, 3, 3],
    ["dld", "CS203", "Digital Logic Design", cse, 2, 3, 3],
    ["sig", "EC301", "Signals & Systems", ece, 3, 5, 4],
    ["dig", "EC302", "Digital Electronics", ece, 3, 5, 4],
    ["mpu", "EC303", "Microprocessors & Microcontrollers", ece, 3, 5, 3],
  ]) {
    subj[key] = await prisma.subject.create({ data: { code, name, courseId: course.id, yearOfStudy: year, semester, credits } });
  }

  // ---- Accounts --------------------------------------------------------------
  const admin = await prisma.user.create({
    data: { username: "admin", email: "admin@expressoo.dev", fullName: "Priya Sharma", mobile: "9000000001", role: "ADMIN", status: "ACTIVE", passwordHash },
  });

  const staffSpec = [
    ["ramesh", "STF10001", "Dr. Ramesh Kumar", cseDept, "Professor & Head", "9848011001"],
    ["suresh", "STF10002", "Suresh Reddy", cseDept, "Associate Professor", "9848011002"],
    ["mahesh", "STF10003", "Mahesh Varma", cseDept, "Assistant Professor", "9848011003"],
    ["lakshmi", "STF10004", "Lakshmi Prasanna", cseDept, "Assistant Professor", "9848011004"],
    ["anitha", "STF10005", "Anitha Rao", cseDept, "Assistant Professor", "9848011005"],
    ["venkat", "STF20001", "Venkat Naidu", eceDept, "Associate Professor", "9848011006"],
  ];
  const staff = {};
  for (const [key, employeeId, fullName, dept, designation, mobile] of staffSpec) {
    const u = await prisma.user.create({
      data: {
        username: employeeId,
        email: `${key}@expressoo.dev`,
        fullName,
        mobile,
        role: "STAFF",
        status: "ACTIVE",
        passwordHash,
        staff: { create: { employeeId, departmentId: dept.id, designation } },
      },
      include: { staff: true },
    });
    staff[key] = u;
  }
  // A registration waiting for approval, to demonstrate the approval workflow.
  await prisma.user.create({
    data: {
      username: "STF10006",
      email: "kiran@expressoo.dev",
      fullName: "Kiran Teja",
      mobile: "9848011007",
      role: "STAFF",
      status: "PENDING",
      passwordHash,
      staff: { create: { employeeId: "STF10006", departmentId: cseDept.id, designation: "Assistant Professor" } },
    },
  });

  const assignments = [
    ["ramesh", "dbms", "cse3a"], ["ramesh", "dbms", "cse3b"],
    ["suresh", "java", "cse3a"], ["suresh", "java", "cse3b"],
    ["mahesh", "python", "cse3a"], ["mahesh", "os", "cse3b"],
    ["lakshmi", "os", "cse3a"], ["lakshmi", "cn", "cse3a"], ["lakshmi", "cn", "cse3b"], ["lakshmi", "python", "cse3b"],
    ["anitha", "ds", "cse2a"], ["anitha", "dm", "cse2a"], ["anitha", "dld", "cse2a"],
    ["venkat", "sig", "ece3a"], ["venkat", "dig", "ece3a"], ["venkat", "mpu", "ece3a"],
  ];
  const teacherOf = {};
  for (const [s, sub, section] of assignments) {
    await prisma.staffAssignment.create({ data: { staffId: staff[s].staff.id, subjectId: subj[sub].id, sectionId: sec[section].id } });
    teacherOf[`${section}:${sub}`] = staff[s];
  }

  const studentNames = {
    cse3a: [
      "Aarav Patel", "Harini Reddy", "Sneha Iyer", "Rohit Sharma", "Divya Nair", "Karthik Rao",
      "Meghana Chowdary", "Vikram Singh", "Pooja Gupta", "Arjun Menon", "Keerthi Varma", "Nikhil Joshi",
    ],
    cse3b: ["Ananya Das", "Rahul Verma", "Shruti Kulkarni", "Siddharth Jain", "Bhavana Murthy", "Aditya Kapoor", "Lavanya Krishnan", "Manoj Pillai", "Tejaswini Rao", "Varun Bhat"],
    cse2a: ["Ishita Mehta", "Pranav Reddy", "Sai Charan", "Nandini Shetty", "Yash Agarwal", "Ritika Saxena", "Gautham Raju", "Swathi Naidu"],
    ece3a: ["Akhil Kumar", "Deepika Rani", "Farhan Ali", "Gayathri Devi", "Hemanth Sai", "Jyothi Lakshmi", "Kalyan Ram", "Mounika Reddy"],
  };
  const rollPrefix = { cse3a: ["23A91A05", 1], cse3b: ["23A91A05", 21], cse2a: ["24A91A05", 1], ece3a: ["23A91A04", 1] };
  const students = {};
  for (const [key, names] of Object.entries(studentNames)) {
    students[key] = [];
    const [prefix, start] = rollPrefix[key];
    for (let i = 0; i < names.length; i++) {
      const roll = `${prefix}${String(start + i).padStart(2, "0")}`;
      const rep = key === "cse3a" && i === 1 ? "CR" : key === "cse3a" && i === 2 ? "LR" : key === "cse3b" && i === 1 ? "CR" : "NONE";
      const u = await prisma.user.create({
        data: {
          username: roll,
          email: `${roll.toLowerCase()}@students.expressoo.dev`,
          fullName: names[i],
          mobile: `9${String(700000000 + Number(roll.slice(-4)) * 37).padStart(9, "0")}`,
          role: "STUDENT",
          status: "ACTIVE",
          passwordHash,
          student: { create: { rollNumber: roll, sectionId: sec[key].id, admissionYear: roll.startsWith("24") ? 2024 : 2023, representativeRole: rep } },
        },
        include: { student: true },
      });
      students[key].push(u);
    }
  }

  // ---- Attendance (last 4 weeks, Mon–Sat, up to yesterday) -------------------
  const timetable = {
    cse3a: ["dbms", "java", "python", "os", "cn"],
    cse3b: ["dbms", "java", "os", "cn", "python"],
    cse2a: ["ds", "dm", "dld"],
    ece3a: ["sig", "dig", "mpu"],
  };
  // Per student, per subject likelihood of attending — a few students fall below 75%.
  const rate = {};
  for (const [key, list] of Object.entries(students)) {
    for (const [i, u] of list.entries()) {
      const base = i === 0 && key === "cse3a" ? 0.88 : i % 5 === 3 ? 0.66 : 0.78 + rand() * 0.2;
      for (const sub of timetable[key]) {
        let r = base + (rand() - 0.5) * 0.12;
        if (key === "cse3a" && i === 0 && sub === "os") r = 0.68; // shows the "classes needed" guidance
        rate[`${u.student.id}:${sub}`] = Math.min(0.99, Math.max(0.45, r));
      }
    }
  }
  let sessionCount = 0;
  let recordCount = 0;
  for (let d = 28; d >= 1; d--) {
    const date = daysAgo(d);
    const weekday = date.getUTCDay();
    if (weekday === 0) continue; // Sunday
    for (const [key, subjects] of Object.entries(timetable)) {
      for (let period = 1; period <= 6; period++) {
        const sub = subjects[(period + weekday) % subjects.length];
        const teacher = teacherOf[`${key}:${sub}`];
        const session = await prisma.classSession.create({
          data: { sectionId: sec[key].id, subjectId: subj[sub].id, staffId: teacher.staff.id, date, period, recordedById: teacher.id, topic: null },
        });
        const records = students[key].map((u) => {
          const r = rand();
          const p = rate[`${u.student.id}:${sub}`];
          return { sessionId: session.id, studentId: u.student.id, status: r < p ? (r > p - 0.04 ? "LATE" : "PRESENT") : "ABSENT" };
        });
        await prisma.attendanceRecord.createMany({ data: records });
        sessionCount++;
        recordCount += records.length;
      }
    }
  }

  // ---- Fees & payments -------------------------------------------------------
  const year = today().getUTCFullYear();
  const academicYear = `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  const structures = [
    { name: "Tuition Fee", course: cse, yearOfStudy: null, amount: "85000.00", due: `${year}-08-31` },
    { name: "Tuition Fee", course: ece, yearOfStudy: null, amount: "80000.00", due: `${year}-08-31` },
    { name: "Library & Laboratory Fee", course: null, yearOfStudy: null, amount: "5000.00", due: `${year}-09-30` },
    { name: "Semester 5 Examination Fee", course: cse, yearOfStudy: 3, amount: "2500.00", due: toDateOnly(addDays(today(), 21)) },
  ];
  const allStudents = Object.entries(students).flatMap(([key, list]) => list.map((u) => ({ ...u, sectionKey: key })));
  const methods = ["UPI", "UPI", "BANK_TRANSFER", "CASH", "CARD", "DEMAND_DRAFT"];
  let paymentCount = 0;
  for (const s of structures) {
    const fs_ = await prisma.feeStructure.create({
      data: {
        name: s.name,
        academicYear,
        courseId: s.course?.id ?? null,
        yearOfStudy: s.yearOfStudy,
        amount: dec(s.amount),
        dueDate: new Date(`${s.due}T00:00:00.000Z`),
        description: s.name === "Tuition Fee" ? "Annual tuition for the academic year." : null,
        createdById: admin.id,
      },
    });
    const eligible = allStudents.filter((u) => {
      const section = sec[u.sectionKey];
      return (!s.course || section.courseId === s.course.id) && (!s.yearOfStudy || section.yearOfStudy === s.yearOfStudy);
    });
    for (const [i, u] of eligible.entries()) {
      const amount = dec(s.amount);
      const discount = s.name === "Tuition Fee" && i % 9 === 4 ? dec("10000.00") : dec(0); // merit scholarship
      const net = amount.minus(discount);
      const roll = rand();
      // Exam fee mostly unpaid (not yet due); tuition mostly paid.
      const paidPortion = s.name.startsWith("Semester") ? (roll < 0.25 ? 1 : 0) : roll < 0.6 ? 1 : roll < 0.85 ? 0.5 : 0;
      const record = await prisma.studentFeeRecord.create({
        data: { studentId: u.student.id, feeStructureId: fs_.id, amount, discount, amountPaid: 0, status: feeStatusFor({ amount, discount, amountPaid: 0 }), dueDate: fs_.dueDate },
      });
      if (paidPortion === 0) continue;
      const instalments = paidPortion === 1 && net.gt(20000) && rand() < 0.4 ? [net.div(2).toDecimalPlaces(2), null] : [paidPortion === 1 ? net : net.div(2).toDecimalPlaces(2)];
      let paid = dec(0);
      for (const [k, part] of instalments.entries()) {
        const payAmount = part ?? net.minus(paid);
        const paidOn = addDays(new Date(`${s.due}T00:00:00.000Z`), -Math.floor(rand() * 40) + k * 20);
        const paidOnSafe = paidOn > daysAgo(1) ? daysAgo(1 + Math.floor(rand() * 5)) : paidOn;
        const p = await prisma.payment.create({
          data: {
            feeRecordId: record.id,
            receiptNo: `TMP-${crypto.randomUUID()}`,
            amount: payAmount,
            method: pick(methods),
            referenceNo: rand() < 0.7 ? `TXN${Math.floor(rand() * 1e10)}` : null,
            paidOn: paidOnSafe,
            recordedById: admin.id,
          },
        });
        await prisma.payment.update({ where: { id: p.id }, data: { receiptNo: `RCPT-${toDateOnly(paidOnSafe).slice(0, 4)}-${String(p.id).padStart(6, "0")}` } });
        paid = paid.plus(payAmount);
        paymentCount++;
      }
      await prisma.studentFeeRecord.update({ where: { id: record.id }, data: { amountPaid: paid, status: feeStatusFor({ amount, discount, amountPaid: paid }) } });
    }
  }

  // ---- Study materials (real files) ------------------------------------------
  fs.mkdirSync(MATERIALS_DIR, { recursive: true });
  const materials = [
    ["ramesh", "dbms", null, "ER Modelling & Relational Algebra", "Unit-1", "Entity–relationship diagrams, keys, and relational algebra with solved examples."],
    ["ramesh", "dbms", null, "Normalization — 1NF to BCNF", "Unit-3", "Functional dependencies, closure, and step-by-step normalization."],
    ["suresh", "java", "cse3a", "Inheritance and Interfaces", "Unit-2", "Class hierarchies, abstract classes, interfaces and polymorphism."],
    ["mahesh", "python", "cse3a", "Functions, Modules and File Handling", "Unit-3", "Lecture notes with practice problems."],
    ["lakshmi", "os", "cse3a", "Process Scheduling Algorithms", "Unit-2", "FCFS, SJF, Priority and Round Robin with Gantt charts."],
    ["lakshmi", "cn", null, "Computer Networks Lab Manual", "Lab", "Experiments 1–10 with expected outputs."],
    ["anitha", "ds", "cse2a", "Stacks, Queues and Linked Lists", "Unit-1", "Implementation notes and complexity analysis."],
    ["venkat", "dig", "ece3a", "Combinational Circuit Design", "Unit-2", "Multiplexers, decoders and K-map simplification."],
  ];
  for (const [i, [who, sub, section, title, unit, description]] of materials.entries()) {
    const storedName = `${crypto.randomUUID()}.pdf`;
    const pdf = makePdf(`${subj[sub].code} · ${title}`, [
      `${subj[sub].name} — ${unit}`,
      `Prepared by ${staff[who].fullName}`,
      "",
      "Sample study material generated by the Student Expressoo development seed.",
      description,
    ]);
    fs.writeFileSync(path.join(MATERIALS_DIR, storedName), pdf);
    await prisma.studyMaterial.create({
      data: {
        title,
        description,
        unit,
        subjectId: subj[sub].id,
        sectionId: section ? sec[section].id : null,
        storedName,
        originalName: `${subj[sub].code}_${title.replace(/[^A-Za-z0-9]+/g, "_").replace(/_+$/, "")}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
        downloadCount: Math.floor(rand() * 40),
        uploadedById: staff[who].id,
        createdAt: minutesAgo((materials.length - i) * 60 * 30),
      },
    });
  }

  // ---- Announcements ----------------------------------------------------------
  await prisma.announcement.createMany({
    data: [
      { title: "Semester mid-term examinations", body: "Mid-term examinations for all B.Tech programmes begin on the first Monday of next month. The detailed timetable is available at the examination cell and will be shared by your class teachers.", audience: "ALL", isPinned: true, authorId: admin.id, publishedAt: minutesAgo(60 * 26) },
      { title: "Campus placement drive — registrations open", body: "Final and pre-final year students can register for the upcoming campus placement drive at the Training & Placement office. Carry two copies of your resume.", audience: "STUDENTS", authorId: admin.id, publishedAt: minutesAgo(60 * 50) },
      { title: "Library hours extended", body: "The central library will remain open until 9:00 PM on weekdays during the examination period.", audience: "STUDENTS", authorId: admin.id, publishedAt: minutesAgo(60 * 80) },
      { title: "Faculty meeting on Friday", body: "All faculty members are requested to attend the academic review meeting on Friday at 4:00 PM in the seminar hall.", audience: "STAFF", authorId: admin.id, publishedAt: minutesAgo(60 * 30) },
    ],
  });

  // ---- Notifications ------------------------------------------------------------
  const userIdsOf = (...keys) => keys.flatMap((k) => students[k].map((u) => u.id));
  async function notify({ title, message, category, targetType, targetLabel, sender, userIds, sectionId, eventAt, ago, readShare = 0.5 }) {
    const n = await prisma.notification.create({
      data: { title, message, category, targetType, targetLabel, senderId: sender?.id ?? null, sectionId: sectionId ?? null, eventAt: eventAt ?? null, createdAt: minutesAgo(ago) },
    });
    await prisma.notificationRecipient.createMany({
      data: userIds.filter((id) => id !== sender?.id).map((userId) => ({ notificationId: n.id, userId, createdAt: minutesAgo(ago), readAt: rand() < readShare ? minutesAgo(ago - 30) : null })),
    });
  }
  await notify({ title: "DBMS assignment 2 due Friday", message: "Submit the normalization assignment (Unit-3, questions 1–8) before Friday's class. Late submissions will not be accepted.", category: "ACADEMIC", targetType: "SECTION", targetLabel: "CSE 3-A, CSE 3-B", sender: staff.ramesh, userIds: userIdsOf("cse3a", "cse3b"), eventAt: addDays(today(), 3), ago: 60 * 5 });
  await notify({ title: "Fee payment reminder", message: "Students with pending tuition fees are requested to clear their dues at the accounts office to avoid a late fee.", category: "FEE", targetType: "STUDENTS", targetLabel: "All students", sender: admin, userIds: allStudents.map((u) => u.id), ago: 60 * 28 });
  await notify({ title: "Class photo on Thursday", message: "Our class photo is on Thursday after lunch near the main block. Please wear your ID cards.", category: "EVENT", targetType: "SECTION", targetLabel: "CSE 3-A", sender: students.cse3a[1], userIds: userIdsOf("cse3a"), sectionId: sec.cse3a.id, ago: 60 * 3, readShare: 0.3 });
  await notify({ title: "OS lab rescheduled", message: "Tomorrow's Operating Systems lab is moved to period 5–6 in Lab 2.", category: "ACADEMIC", targetType: "SECTION", targetLabel: "CSE 3-A", sender: staff.lakshmi, userIds: userIdsOf("cse3a"), sectionId: sec.cse3a.id, ago: 60 * 20 });
  await notify({ title: "Attendance records due", message: "Please make sure attendance for all sessions this week is recorded by Saturday.", category: "GENERAL", targetType: "STAFF", targetLabel: "All staff", sender: admin, userIds: Object.values(staff).map((u) => u.id), ago: 60 * 10, readShare: 0.4 });

  // ---- Teacher alerts --------------------------------------------------------------
  await prisma.teacherAlert.create({
    data: { sectionId: sec.cse3a.id, raisedById: students.cse3a[1].id, staffId: staff.lakshmi.staff.id, subjectId: subj.cn.id, period: 4, alertDate: daysAgo(3), message: "Class is waiting in room 204.", status: "RESOLVED", responseNote: "Coming in 5 minutes.", acknowledgedAt: minutesAgo(60 * 72 - 3), resolvedAt: minutesAgo(60 * 72 - 15), createdAt: minutesAgo(60 * 72) },
  });
  await prisma.teacherAlert.create({
    data: { sectionId: sec.cse3a.id, raisedById: students.cse3a[2].id, staffId: staff.suresh.staff.id, subjectId: subj.java.id, period: 2, alertDate: today(), message: "Java class — waiting in room 204.", status: "ACKNOWLEDGED", responseNote: "Stuck in a meeting, starting at 10:15.", acknowledgedAt: minutesAgo(118), createdAt: minutesAgo(121) },
  });

  await prisma.auditLog.create({ data: { actorId: admin.id, action: "system.seed", entityType: "system", summary: "Loaded development seed data" } });

  const counts = {
    users: await prisma.user.count(),
    students: await prisma.student.count(),
    staff: await prisma.staff.count(),
    classSessions: sessionCount,
    attendanceRecords: recordCount,
    feeRecords: await prisma.studentFeeRecord.count(),
    payments: paymentCount,
    materials: await prisma.studyMaterial.count(),
    notifications: await prisma.notification.count(),
  };
  console.log("✓ Development data loaded:", counts);
  console.log("  Sign-in details for the seeded accounts are listed at the top of prisma/seed.js.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
