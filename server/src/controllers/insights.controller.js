const dashboard = require("../services/dashboard.service");
const reports = require("../services/reports.service");
const prisma = require("../lib/prisma");
const config = require("../config/env");
const { serializeSection } = require("../utils/serialize");
const { PERMISSIONS } = require("../config/permissions");
const { ALLOWED_EXTENSIONS } = require("../middleware/upload");

module.exports = {
  studentDashboard: async (req, res) => res.json(await dashboard.studentDashboard(req.user)),
  staffDashboard: async (req, res) => res.json(await dashboard.staffDashboard(req.user)),
  adminDashboard: async (_req, res) => res.json(await dashboard.adminDashboard()),

  attendanceReport: async (req, res) => res.json(await reports.attendanceReport(req.valid.query)),
  feeReport: async (req, res) => res.json(await reports.feeReport(req.valid.query)),
  auditLogs: async (req, res) => res.json(await reports.auditLogs(req.valid.query)),

  /** Public, non-sensitive settings the frontends use for consistent client-side validation. */
  config: (_req, res) =>
    res.json({
      institution: "Student Expressoo",
      timezone: config.timezone,
      rules: {
        ...config.rules,
        maxUploadMb: Math.round(config.maxUploadBytes / 1048576),
        allowedUploadExtensions: ALLOWED_EXTENSIONS,
      },
    }),

  /** Options for the public registration forms. */
  registrationOptions: async (_req, res) => {
    const [sections, departments] = await Promise.all([
      prisma.section.findMany({ include: { course: true }, orderBy: [{ course: { code: "asc" } }, { yearOfStudy: "asc" }, { name: "asc" }] }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
    ]);
    res.json({
      sections: sections.map((s) => ({ ...serializeSection(s), courseName: s.course.name })),
      departments: departments.map((d) => ({ id: d.id, code: d.code, name: d.name })),
    });
  },

  permissions: (_req, res) => res.json(PERMISSIONS),
};
