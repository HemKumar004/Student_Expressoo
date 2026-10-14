const auth = require("../services/auth.service");
const { audit } = require("../utils/audit");
const prisma = require("../lib/prisma");

module.exports = {
  login: async (req, res) => res.json(await auth.login(req.body, req)),
  registerStudent: async (req, res) => res.status(201).json(await auth.registerStudent(req.body, req)),
  registerStaff: async (req, res) => res.status(201).json(await auth.registerStaff(req.body, req)),
  me: async (req, res) => res.json({ user: await auth.me(req.user.id) }),
  updateMe: async (req, res) => res.json({ user: await auth.updateMe(req.user, req.body, req) }),
  changePassword: async (req, res) => res.json(await auth.changePassword(req.user, req.body, req)),
  logout: async (req, res) => {
    await audit(prisma, { req, action: "auth.logout", entityType: "user", entityId: req.user.id, summary: `${req.user.fullName} signed out` });
    res.json({ ok: true });
  },
};
