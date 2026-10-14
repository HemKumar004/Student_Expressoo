const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const config = require("../config/env");
const { badRequest } = require("../utils/httpError");

const MATERIALS_DIR = path.join(config.uploadDir, "materials");
fs.mkdirSync(MATERIALS_DIR, { recursive: true });

/**
 * Allowed study-material formats. `sig` is the expected file signature (magic bytes);
 * Office Open XML files are ZIP containers, legacy Office files are OLE2 compound documents.
 */
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ALLOWED = {
  ".pdf": { mimes: ["application/pdf"], sig: [0x25, 0x50, 0x44, 0x46] },
  ".doc": { mimes: ["application/msword"], sig: OLE },
  ".docx": { mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"], sig: ZIP },
  ".ppt": { mimes: ["application/vnd.ms-powerpoint"], sig: OLE },
  ".pptx": { mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"], sig: ZIP },
  ".xls": { mimes: ["application/vnd.ms-excel"], sig: OLE },
  ".xlsx": { mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], sig: ZIP },
  ".png": { mimes: ["image/png"], sig: [0x89, 0x50, 0x4e, 0x47] },
  ".jpg": { mimes: ["image/jpeg"], sig: [0xff, 0xd8, 0xff] },
  ".jpeg": { mimes: ["image/jpeg"], sig: [0xff, 0xd8, 0xff] },
  ".txt": { mimes: ["text/plain"], sig: null },
};
// Browsers sometimes send a generic type for Office files.
const GENERIC_MIMES = ["application/octet-stream", "application/zip", "application/x-zip-compressed"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MATERIALS_DIR),
  // Never trust the client file name for storage — use a random name with the vetted extension.
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const rule = ALLOWED[ext];
  if (!rule) return cb(badRequest(`Unsupported file type "${ext || "unknown"}". Allowed: ${Object.keys(ALLOWED).join(", ")}`));
  if (!rule.mimes.includes(file.mimetype) && !GENERIC_MIMES.includes(file.mimetype)) {
    return cb(badRequest("The file content type does not match its extension."));
  }
  cb(null, true);
}

const materialUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxUploadBytes, files: 1, fields: 20 },
});

/** After multer has written the file, confirm its leading bytes match the declared type. */
async function verifyUploadedFile(file) {
  const ext = path.extname(file.filename).toLowerCase();
  const rule = ALLOWED[ext];
  const fail = async (msg) => {
    await fs.promises.unlink(file.path).catch(() => {});
    throw badRequest(msg);
  };
  if (!rule) return fail("Unsupported file type.");
  if (file.size === 0) return fail("The uploaded file is empty.");
  if (!rule.sig) return rule.mimes[0];

  const handle = await fs.promises.open(file.path, "r");
  try {
    const buf = Buffer.alloc(rule.sig.length);
    await handle.read(buf, 0, rule.sig.length, 0);
    if (!rule.sig.every((byte, i) => buf[i] === byte)) {
      await handle.close();
      return fail("The file appears to be corrupted or is not a genuine " + ext.slice(1).toUpperCase() + " file.");
    }
  } finally {
    await handle.close().catch(() => {});
  }
  return rule.mimes[0];
}

async function removeStoredFile(storedName) {
  const target = path.join(MATERIALS_DIR, path.basename(storedName));
  await fs.promises.unlink(target).catch(() => {});
}

module.exports = { materialUpload, verifyUploadedFile, removeStoredFile, MATERIALS_DIR, ALLOWED_EXTENSIONS: Object.keys(ALLOWED) };
