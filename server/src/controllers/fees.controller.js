const fees = require("../services/fees.service");

const id = (req) => req.valid.params.id;

module.exports = {
  listStructures: async (req, res) => res.json({ items: await fees.listStructures(req.valid.query) }),
  createStructure: async (req, res) => res.status(201).json(await fees.createStructure(req.body, req)),
  updateStructure: async (req, res) => res.json(await fees.updateStructure(id(req), req.body, req)),
  deleteStructure: async (req, res) => res.json(await fees.deleteStructure(id(req), req)),
  assignStructure: async (req, res) => res.json(await fees.assignStructure(id(req), req)),

  listRecords: async (req, res) => res.json(await fees.listRecords(req.valid.query)),
  getRecord: async (req, res) => res.json(await fees.getRecord(id(req))),
  updateRecord: async (req, res) => res.json(await fees.updateRecord(id(req), req.body, req)),
  myFees: async (req, res) => res.json(await fees.myFees(req.user.student)),

  recordPayment: async (req, res) => res.status(201).json(await fees.recordPayment(req.body, req)),
  voidPayment: async (req, res) => res.json(await fees.voidPayment(id(req), req.body, req)),
  listPayments: async (req, res) => res.json(await fees.listPayments(req.valid.query)),
  myPayments: async (req, res) => res.json(await fees.listPayments(req.valid.query, { studentId: req.user.student.id })),
  getPayment: async (req, res) => res.json(await fees.getPayment(id(req), req.user)),
};
