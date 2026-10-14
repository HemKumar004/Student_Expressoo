const { Router } = require("express");
const ctrl = require("../controllers/attendance.controller");
const v = require("../validators/attendance");
const { idParams } = require("../validators/common");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

// Students: their own records only (identity comes from the session, never from the URL).
router.get("/me/summary", authorize("STUDENT"), ctrl.mySummary);
router.get("/me/history", authorize("STUDENT"), validate({ query: v.history }), ctrl.myHistory);

// Staff (assigned classes) and administrators.
const teaching = authorize("STAFF", "ADMIN");
router.get("/roster", teaching, validate({ query: v.roster }), ctrl.roster);
router.put("/sessions", teaching, validate({ body: v.saveSession }), ctrl.save);
router.get("/sessions", teaching, validate({ query: v.listSessions }), ctrl.sessions);
router.delete("/sessions/:id", teaching, validate({ params: idParams }), ctrl.remove);
router.get("/class-stats", teaching, validate({ query: v.classStats }), ctrl.classStats);

router.get("/overview", authorize("ADMIN"), validate({ query: v.overview }), ctrl.overview);

module.exports = router;
