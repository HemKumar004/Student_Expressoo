const people = require("../services/people.service");

module.exports = {
  listStudents: async (req, res) => res.json(await people.listStudents(req.valid.query)),
  getStudent: async (req, res) => res.json(await people.getStudent(req.valid.params.id)),
  createStudent: async (req, res) => res.status(201).json(await people.createStudent(req.body, req)),
  updateStudent: async (req, res) => res.json(await people.updateStudent(req.valid.params.id, req.body, req)),
  setRepresentative: async (req, res) => res.json(await people.setRepresentative(req.valid.params.id, req.body.representativeRole, req)),

  listStaff: async (req, res) => res.json(await people.listStaff(req.valid.query)),
  getStaff: async (req, res) => res.json(await people.getStaff(req.valid.params.id)),
  createStaff: async (req, res) => res.status(201).json(await people.createStaff(req.body, req)),
  updateStaff: async (req, res) => res.json(await people.updateStaff(req.valid.params.id, req.body, req)),

  listAdmins: async (_req, res) => res.json({ items: await people.listAdmins() }),
  createAdmin: async (req, res) => res.status(201).json(await people.createAdmin(req.body, req)),
  setStatus: async (req, res) => res.json(await people.setStatus(req.valid.params.id, req.body, req)),
  resetPassword: async (req, res) => res.json(await people.resetPassword(req.valid.params.id, req.body.password, req)),
};
