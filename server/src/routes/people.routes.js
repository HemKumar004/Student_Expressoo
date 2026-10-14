const { Router } = require("express");
const ctrl = require("../controllers/people.controller");
const v = require("../validators/people");
const { idParams } = require("../validators/common");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");

/** Account management — administrators only. */
const students = Router();
students.use(authenticate, authorize("ADMIN"));
students.get("/", validate({ query: v.listStudents }), ctrl.listStudents);
students.post("/", validate({ body: v.createStudent }), ctrl.createStudent);
students.get("/:id", validate({ params: idParams }), ctrl.getStudent);
students.patch("/:id", validate({ params: idParams, body: v.updateStudent }), ctrl.updateStudent);
students.patch("/:id/representative", validate({ params: idParams, body: v.setRepresentative }), ctrl.setRepresentative);

const staff = Router();
staff.use(authenticate, authorize("ADMIN"));
staff.get("/", validate({ query: v.listStaff }), ctrl.listStaff);
staff.post("/", validate({ body: v.createStaff }), ctrl.createStaff);
staff.get("/:id", validate({ params: idParams }), ctrl.getStaff);
staff.patch("/:id", validate({ params: idParams, body: v.updateStaff }), ctrl.updateStaff);

const users = Router();
users.use(authenticate, authorize("ADMIN"));
users.get("/admins", ctrl.listAdmins);
users.post("/admins", validate({ body: v.createAdmin }), ctrl.createAdmin);
users.patch("/:id/status", validate({ params: idParams, body: v.setStatus }), ctrl.setStatus);
users.post("/:id/reset-password", validate({ params: idParams, body: v.resetPassword }), ctrl.resetPassword);

module.exports = { students, staff, users };
