const { Router } = require("express");
const ctrl = require("../controllers/materials.controller");
const v = require("../validators/communication");
const { idParams } = require("../validators/common");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");
const { materialUpload } = require("../middleware/upload");

const router = Router();
router.use(authenticate);

router.get("/", validate({ query: v.listMaterials }), ctrl.list);
router.get("/:id", validate({ params: idParams }), ctrl.get);
router.get("/:id/download", validate({ params: idParams }), ctrl.download);

const uploaders = authorize("STAFF", "ADMIN");
router.post("/", uploaders, materialUpload.single("file"), validate({ body: v.createMaterial }), ctrl.create);
router.patch("/:id", uploaders, validate({ params: idParams, body: v.updateMaterial }), ctrl.update);
router.delete("/:id", uploaders, validate({ params: idParams }), ctrl.remove);

module.exports = router;
