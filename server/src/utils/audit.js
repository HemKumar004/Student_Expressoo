const prisma = require("../lib/prisma");

/**
 * Write an audit log entry. Pass a transaction client as `db` to make the entry part of
 * the same unit of work; outside a transaction a logging failure never breaks the request.
 */
async function audit(db, { req, actorId, action, entityType, entityId, summary, metadata }) {
  const data = {
    actorId: actorId ?? req?.user?.id ?? null,
    action,
    entityType,
    entityId: entityId != null ? String(entityId) : null,
    summary: summary.slice(0, 255),
    metadata: metadata ?? undefined,
    ipAddress: req?.ip ? String(req.ip).slice(0, 45) : null,
  };
  if (db && db !== prisma) return db.auditLog.create({ data });
  try {
    return await prisma.auditLog.create({ data });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err.message);
    return null;
  }
}

module.exports = { audit };
