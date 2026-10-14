const { Router } = require("express");
const ctrl = require("../controllers/academics.controller");
const v = require("../validators/academics");
const { idParams } = require("../validators/common");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

const admin = authorize("ADMIN");

// Reference data is readable by any signed-in user (used for filters and pickers).
router.get("/departments", ctrl.listDepartments);
router.post("/departments", admin, validate({ body: v.department }), ctrl.createDepartment);
router.patch("/departments/:id", admin, validate({ params: idParams, body: v.department.partial() }), ctrl.updateDepartment);
router.delete("/departments/:id", admin, validate({ params: idParams }), ctrl.deleteDepartment);

router.get("/courses", validate({ query: v.listFilter }), ctrl.listCourses);
router.post("/courses", admin, validate({ body: v.course }), ctrl.createCourse);
router.patch("/courses/:id", admin, validate({ params: idParams, body: v.courseUpdate }), ctrl.updateCourse);
router.delete("/courses/:id", admin, validate({ params: idParams }), ctrl.deleteCourse);

router.get("/sections", validate({ query: v.listFilter }), ctrl.listSections);
router.post("/sections", admin, validate({ body: v.section }), ctrl.createSection);
router.patch("/sections/:id", admin, validate({ params: idParams, body: v.section.partial() }), ctrl.updateSection);
router.delete("/sections/:id", admin, validate({ params: idParams }), ctrl.deleteSection);

router.get("/subjects", validate({ query: v.listFilter }), ctrl.listSubjects);
router.post("/subjects", admin, validate({ body: v.subject }), ctrl.createSubject);
router.patch("/subjects/:id", admin, validate({ params: idParams, body: v.subject.partial() }), ctrl.updateSubject);
router.delete("/subjects/:id", admin, validate({ params: idParams }), ctrl.deleteSubject);

router.get("/assignments/mine", authorize("STAFF"), ctrl.myAssignments);
router.get("/assignments", admin, validate({ query: v.listFilter }), ctrl.listAssignments);
router.post("/assignments", admin, validate({ body: v.assignment }), ctrl.createAssignment);
router.delete("/assignments/:id", admin, validate({ params: idParams }), ctrl.deleteAssignment);

module.exports = router;
