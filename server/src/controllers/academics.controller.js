const academics = require("../services/academics.service");

const id = (req) => req.valid.params.id;

module.exports = {
  listDepartments: async (_req, res) => res.json({ items: await academics.listDepartments() }),
  createDepartment: async (req, res) => res.status(201).json(await academics.createDepartment(req.body, req)),
  updateDepartment: async (req, res) => res.json(await academics.updateDepartment(id(req), req.body, req)),
  deleteDepartment: async (req, res) => res.json(await academics.deleteDepartment(id(req), req)),

  listCourses: async (req, res) => res.json({ items: await academics.listCourses(req.valid.query) }),
  createCourse: async (req, res) => res.status(201).json(await academics.createCourse(req.body, req)),
  updateCourse: async (req, res) => res.json(await academics.updateCourse(id(req), req.body, req)),
  deleteCourse: async (req, res) => res.json(await academics.deleteCourse(id(req), req)),

  listSections: async (req, res) => res.json({ items: await academics.listSections(req.valid.query) }),
  createSection: async (req, res) => res.status(201).json(await academics.createSection(req.body, req)),
  updateSection: async (req, res) => res.json(await academics.updateSection(id(req), req.body, req)),
  deleteSection: async (req, res) => res.json(await academics.deleteSection(id(req), req)),

  listSubjects: async (req, res) => res.json({ items: await academics.listSubjects(req.valid.query) }),
  createSubject: async (req, res) => res.status(201).json(await academics.createSubject(req.body, req)),
  updateSubject: async (req, res) => res.json(await academics.updateSubject(id(req), req.body, req)),
  deleteSubject: async (req, res) => res.json(await academics.deleteSubject(id(req), req)),

  listAssignments: async (req, res) => res.json({ items: await academics.listAssignments(req.valid.query) }),
  myAssignments: async (req, res) => res.json({ items: await academics.listAssignments({ staffId: req.user.staff.id }) }),
  createAssignment: async (req, res) => res.status(201).json(await academics.createAssignment(req.body, req)),
  deleteAssignment: async (req, res) => res.json(await academics.deleteAssignment(id(req), req)),
};
