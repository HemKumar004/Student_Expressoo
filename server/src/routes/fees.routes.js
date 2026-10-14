const { Router } = require("express");
const ctrl = require("../controllers/fees.controller");
const v = require("../validators/fees");
const { idParams } = require("../validators/common");
const { paginationSchema } = require("../utils/pagination");
const { validate } = require("../middleware/validate");
const { authenticate, authorize } = require("../middleware/auth");

const fees = Router();
fees.use(authenticate);
fees.get("/me", authorize("STUDENT"), ctrl.myFees);

const admin = authorize("ADMIN");
fees.get("/structures", admin, validate({ query: v.listStructures }), ctrl.listStructures);
fees.post("/structures", admin, validate({ body: v.createStructure }), ctrl.createStructure);
fees.patch("/structures/:id", admin, validate({ params: idParams, body: v.updateStructure }), ctrl.updateStructure);
fees.delete("/structures/:id", admin, validate({ params: idParams }), ctrl.deleteStructure);
fees.post("/structures/:id/assign", admin, validate({ params: idParams }), ctrl.assignStructure);
fees.get("/records", admin, validate({ query: v.listRecords }), ctrl.listRecords);
fees.get("/records/:id", admin, validate({ params: idParams }), ctrl.getRecord);
fees.patch("/records/:id", admin, validate({ params: idParams, body: v.updateRecord }), ctrl.updateRecord);

const payments = Router();
payments.use(authenticate);
payments.get("/me", authorize("STUDENT"), validate({ query: paginationSchema }), ctrl.myPayments);
payments.get("/:id", authorize("STUDENT", "ADMIN"), validate({ params: idParams }), ctrl.getPayment);
// Payments are only ever recorded by the accounts office — never marked paid from a client action.
payments.get("/", admin, validate({ query: v.listPayments }), ctrl.listPayments);
payments.post("/", admin, validate({ body: v.recordPayment }), ctrl.recordPayment);
payments.post("/:id/void", admin, validate({ params: idParams, body: v.voidPayment }), ctrl.voidPayment);

module.exports = { fees, payments };
