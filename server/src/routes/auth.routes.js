const { Router } = require("express");
const ctrl = require("../controllers/auth.controller");
const v = require("../validators/auth");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimit");

const router = Router();

router.post("/login", loginLimiter, validate({ body: v.login }), ctrl.login);
router.post("/register/student", registerLimiter, validate({ body: v.registerStudent }), ctrl.registerStudent);
router.post("/register/staff", registerLimiter, validate({ body: v.registerStaff }), ctrl.registerStaff);

router.get("/me", authenticate, ctrl.me);
router.patch("/me", authenticate, validate({ body: v.updateMe }), ctrl.updateMe);
router.post("/change-password", authenticate, loginLimiter, validate({ body: v.changePassword }), ctrl.changePassword);
router.post("/logout", authenticate, ctrl.logout);

module.exports = router;
