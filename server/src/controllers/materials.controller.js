const materials = require("../services/materials.service");

module.exports = {
  list: async (req, res) => res.json(await materials.list(req.user, req.valid.query)),
  get: async (req, res) => res.json(materials.serializeMaterial(await materials.findVisible(req.user, req.valid.params.id), req.user)),
  create: async (req, res) => res.status(201).json(await materials.create(req.user, req.file, req.body, req)),
  update: async (req, res) => res.json(await materials.update(req.user, req.valid.params.id, req.body, req)),
  remove: async (req, res) => res.json(await materials.remove(req.user, req.valid.params.id, req)),
  download: async (req, res) => {
    const { filePath, fileName, mimeType } = await materials.prepareDownload(req.user, req.valid.params.id);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, no-store");
    // The path is built server-side from a random stored name, so dot-directories are safe here.
    res.download(filePath, fileName, { dotfiles: "allow" });
  },
};
