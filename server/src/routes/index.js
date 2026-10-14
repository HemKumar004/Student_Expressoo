const { Router } = require("express");
const auth = require("./auth.routes");
const people = require("./people.routes");
const academics = require("./academics.routes");
const attendance = require("./attendance.routes");
const { fees, payments } = require("./fees.routes");
const materials = require("./materials.routes");
const { notifications, announcements, alerts } = require("./communication.routes");
const { meta, dashboard, reports, auditLogs } = require("./insights.routes");

const api = Router();

api.use("/auth", auth);
api.use("/meta", meta);
api.use("/dashboard", dashboard);
api.use("/students", people.students);
api.use("/staff", people.staff);
api.use("/users", people.users);
api.use("/academics", academics);
api.use("/attendance", attendance);
api.use("/fees", fees);
api.use("/payments", payments);
api.use("/materials", materials);
api.use("/notifications", notifications);
api.use("/announcements", announcements);
api.use("/teacher-alerts", alerts);
api.use("/reports", reports);
api.use("/audit-logs", auditLogs);

module.exports = api;
