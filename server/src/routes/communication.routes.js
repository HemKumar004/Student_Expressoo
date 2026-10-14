const { Router } = require("express");
const ctrl = require("../controllers/communication.controller");
const v = require("../validators/communication");
const { idParams } = require("../validators/common");
const { validate } = require("../middleware/validate");
const { authenticate, authorize, requireRepresentative } = require("../middleware/auth");

// ---- Notifications --------------------------------------------------------
const notifications = Router();
notifications.use(authenticate);
notifications.get("/", validate({ query: v.inbox }), ctrl.inbox);
notifications.get("/unread-count", ctrl.unreadCount);
notifications.post("/read-all", ctrl.markAllRead);
notifications.patch("/:id/read", validate({ params: idParams }), ctrl.markRead);
// Sending: staff/admin, or CR/LR for their own section (checked in the service).
notifications.post(
  "/",
  (req, res, next) => (req.user.role === "STUDENT" ? requireRepresentative(req, res, next) : next()),
  validate({ body: v.sendNotification }),
  ctrl.send
);
notifications.get(
  "/sent",
  (req, res, next) => (req.user.role === "STUDENT" ? requireRepresentative(req, res, next) : next()),
  validate({ query: v.sentList }),
  ctrl.sent
);
notifications.delete(
  "/:id",
  (req, res, next) => (req.user.role === "STUDENT" ? requireRepresentative(req, res, next) : next()),
  validate({ params: idParams }),
  ctrl.deleteNotification
);

// ---- Announcements ---------------------------------------------------------
const announcements = Router();
announcements.use(authenticate);
announcements.get("/", validate({ query: v.listAnnouncements }), ctrl.listAnnouncements);
announcements.post("/", authorize("ADMIN"), validate({ body: v.announcement }), ctrl.createAnnouncement);
announcements.put("/:id", authorize("ADMIN"), validate({ params: idParams, body: v.announcement }), ctrl.updateAnnouncement);
announcements.delete("/:id", authorize("ADMIN"), validate({ params: idParams }), ctrl.deleteAnnouncement);

// ---- Teacher alerts (Class / Ladies Representatives) ----------------------
const alerts = Router();
alerts.use(authenticate);
alerts.get("/contacts", requireRepresentative, ctrl.alertContacts);
alerts.post("/", requireRepresentative, validate({ body: v.createAlert }), ctrl.createAlert);
alerts.get(
  "/",
  (req, res, next) => (req.user.role === "STUDENT" ? requireRepresentative(req, res, next) : next()),
  validate({ query: v.listAlerts }),
  ctrl.listAlerts
);
alerts.patch("/:id/acknowledge", authorize("STAFF", "ADMIN"), validate({ params: idParams, body: v.acknowledgeAlert }), ctrl.acknowledgeAlert);
alerts.patch("/:id/resolve", validate({ params: idParams }), ctrl.resolveAlert);

module.exports = { notifications, announcements, alerts };
