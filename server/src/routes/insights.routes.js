const { Router } = require("express");
const ctrl = require("../controllers/insights.controller");
const { z, id, optionalId, optionalDate, search } = require("../validators/common");
const { paginationSchema } = require("../utils/pagination");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");

// ---- Public metadata ----------------------------------------------------
const meta = Router();
meta.get("/config", ctrl.config);
meta.get("/registration-options", ctrl.registrationOptions);
meta.get("/permissions", authenticate, authorize("ADMIN"), ctrl.permissions);

// ---- Dashboards (one per portal) -----------------------------------------
const dashboard = Router();
dashboard.use(authenticate);
dashboard.get("/student", authorize("STUDENT"), ctrl.studentDashboard);
dashboard.get("/staff", authorize("STAFF"), ctrl.staffDashboard);
dashboard.get("/admin", authorize("ADMIN"), ctrl.adminDashboard);

// ---- Reports & audit ------------------------------------------------------
const reports = Router();
reports.use(authenticate, authorize("ADMIN"));
reports.get(
  "/attendance",
  validate({ query: z.object({ sectionId: id, subjectId: optionalId, from: optionalDate, to: optionalDate }) }),
  ctrl.attendanceReport
);
reports.get("/fees", validate({ query: z.object({ courseId: optionalId, academicYear: z.string().trim().max(9).optional() }) }), ctrl.feeReport);

const auditLogs = Router();
auditLogs.use(authenticate, authorize("ADMIN"));
auditLogs.get(
  "/",
  validate({
    query: paginationSchema.extend({
      actorId: optionalId,
      entityType: z.string().trim().max(64).optional(),
      action: z.string().trim().max(64).optional(),
      search,
      from: optionalDate,
      to: optionalDate,
    }),
  }),
  ctrl.auditLogs
);

module.exports = { meta, dashboard, reports, auditLogs };
