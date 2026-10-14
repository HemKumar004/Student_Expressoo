const comm = require("../services/communication.service");

const id = (req) => req.valid.params.id;

module.exports = {
  send: async (req, res) => res.status(201).json(await comm.sendNotification(req.user, req.body, req)),
  inbox: async (req, res) => res.json(await comm.inbox(req.user, req.valid.query)),
  unreadCount: async (req, res) => res.json(await comm.unreadCount(req.user)),
  markRead: async (req, res) => res.json(await comm.markRead(req.user, id(req))),
  markAllRead: async (req, res) => res.json(await comm.markAllRead(req.user)),
  sent: async (req, res) => res.json(await comm.sent(req.user, req.valid.query)),
  deleteNotification: async (req, res) => res.json(await comm.deleteNotification(req.user, id(req), req)),

  listAnnouncements: async (req, res) => res.json(await comm.listAnnouncements(req.user, req.valid.query)),
  createAnnouncement: async (req, res) => res.status(201).json(await comm.createAnnouncement(req.user, req.body, req)),
  updateAnnouncement: async (req, res) => res.json(await comm.updateAnnouncement(id(req), req.body, req)),
  deleteAnnouncement: async (req, res) => res.json(await comm.deleteAnnouncement(id(req), req)),

  alertContacts: async (req, res) => res.json(await comm.alertContacts(req.user)),
  createAlert: async (req, res) => res.status(201).json(await comm.createAlert(req.user, req.body, req)),
  listAlerts: async (req, res) => res.json(await comm.listAlerts(req.user, req.valid.query)),
  acknowledgeAlert: async (req, res) => res.json(await comm.acknowledgeAlert(req.user, id(req), req.body, req)),
  resolveAlert: async (req, res) => res.json(await comm.resolveAlert(req.user, id(req), req)),
};
