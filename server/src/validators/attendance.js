const c = require("./common");
const { paginationSchema } = require("../utils/pagination");
const { z } = c;

const attendanceStatus = z.enum(["PRESENT", "ABSENT", "LATE"], { error: "Choose Present, Absent or Late" });

const roster = z.object({
  sectionId: c.id,
  subjectId: c.id,
  date: c.dateOnly,
  period: c.period,
});

const saveSession = z.object({
  sectionId: c.id,
  subjectId: c.id,
  date: c.dateOnly,
  period: c.period,
  topic: c.optionalTrimmed(200),
  records: z
    .array(
      z.object({
        studentId: c.id,
        status: attendanceStatus,
        remarks: c.optionalTrimmed(200),
      })
    )
    .min(1, { error: "Mark attendance for at least one student" })
    .max(500),
});

const listSessions = paginationSchema.extend({
  sectionId: c.optionalId,
  subjectId: c.optionalId,
  staffId: c.optionalId,
  from: c.optionalDate,
  to: c.optionalDate,
});

const history = paginationSchema.extend({
  subjectId: c.optionalId,
  status: attendanceStatus.optional(),
  from: c.optionalDate,
  to: c.optionalDate,
});

const classStats = z.object({ sectionId: c.id, subjectId: c.id });

const overview = z.object({
  courseId: c.optionalId,
  sectionId: c.optionalId,
  from: c.optionalDate,
  to: c.optionalDate,
});

module.exports = { roster, saveSession, listSessions, history, classStats, overview };
