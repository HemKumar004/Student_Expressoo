const attendance = require("../services/attendance.service");

module.exports = {
  roster: async (req, res) => res.json(await attendance.getRoster(req.user, req.valid.query)),
  save: async (req, res) => {
    const result = await attendance.saveSession(req.user, req.body, req);
    res.status(result.created ? 201 : 200).json(result);
  },
  remove: async (req, res) => res.json(await attendance.deleteSession(req.user, req.valid.params.id, req)),
  sessions: async (req, res) => res.json(await attendance.listSessions(req.user, req.valid.query)),
  mySummary: async (req, res) => res.json(await attendance.studentSummary(req.user.student)),
  myHistory: async (req, res) => res.json(await attendance.studentHistory(req.user.student, req.valid.query)),
  classStats: async (req, res) => res.json(await attendance.classStats(req.user, req.valid.query)),
  overview: async (req, res) => res.json(await attendance.overview(req.user, req.valid.query)),
};
