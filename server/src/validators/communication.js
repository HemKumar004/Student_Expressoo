const c = require("./common");
const { paginationSchema } = require("../utils/pagination");
const { z } = c;

const category = z.enum(["GENERAL", "ACADEMIC", "EXAM", "FEE", "EVENT", "URGENT", "ALERT"]);

// ---- Study materials -------------------------------------------------------
const createMaterial = z.object({
  title: c.trimmed(200, "Title"),
  description: c.optionalTrimmed(2000),
  unit: c.optionalTrimmed(40),
  subjectId: c.id,
  sectionId: c.nullableId,
});

const updateMaterial = z.object({
  title: c.trimmed(200, "Title").optional(),
  description: c.optionalTrimmed(2000),
  unit: c.optionalTrimmed(40),
});

const listMaterials = paginationSchema.extend({
  search: c.search,
  subjectId: c.optionalId,
  sectionId: c.optionalId,
  courseId: c.optionalId,
  mine: c.queryBool,
});

// ---- Notifications --------------------------------------------------------
const sendNotification = z
  .object({
    title: c.trimmed(150, "Title"),
    message: c.trimmed(5000, "Message"),
    category: category.exclude(["ALERT"]).default("GENERAL"),
    targetType: z.enum(["ALL", "STUDENTS", "STAFF", "COURSE", "SECTION"], { error: "Choose who should receive this" }),
    courseId: c.optionalId,
    sectionIds: z.array(c.id).max(50).optional(),
    eventAt: c.dateTime.optional(),
  })
  .refine((d) => d.targetType !== "COURSE" || d.courseId, { path: ["courseId"], error: "Choose a course" })
  .refine((d) => d.targetType !== "SECTION" || (d.sectionIds && d.sectionIds.length > 0), {
    path: ["sectionIds"],
    error: "Choose at least one section",
  });

const inbox = paginationSchema.extend({
  unread: c.queryBool,
  category: category.optional(),
});

const sentList = paginationSchema.extend({ search: c.search });

// ---- Announcements ---------------------------------------------------------
const announcement = z.object({
  title: c.trimmed(150, "Title"),
  body: c.trimmed(10000, "Announcement text"),
  audience: z.enum(["ALL", "STUDENTS", "STAFF"]).default("ALL"),
  isPinned: z.boolean().default(false),
  expiresAt: c.dateTime.optional(),
});

const listAnnouncements = paginationSchema.extend({
  includeExpired: c.queryBool,
  audience: z.enum(["ALL", "STUDENTS", "STAFF"]).optional(),
});

// ---- Teacher alerts --------------------------------------------------------
const createAlert = z.object({
  staffId: c.id,
  subjectId: c.optionalId,
  period: c.period,
  message: c.optionalTrimmed(500),
});

const acknowledgeAlert = z.object({ responseNote: c.optionalTrimmed(300) });

const listAlerts = paginationSchema.extend({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]).optional(),
  sectionId: c.optionalId,
});

module.exports = {
  createMaterial,
  updateMaterial,
  listMaterials,
  sendNotification,
  inbox,
  sentList,
  announcement,
  listAnnouncements,
  createAlert,
  acknowledgeAlert,
  listAlerts,
};
