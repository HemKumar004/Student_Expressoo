const fs = require("fs");
const path = require("path");
const prisma = require("../lib/prisma");
const { assertCanTeach, staffAssignments, studentUserIdsForSections } = require("./access.service");
const { verifyUploadedFile, removeStoredFile, MATERIALS_DIR } = require("../middleware/upload");
const { serializeSection, serializeSubject, sectionLabel, personRef } = require("../utils/serialize");
const { notFound, badRequest, forbidden } = require("../utils/httpError");
const { pageArgs, paged } = require("../utils/pagination");
const { audit } = require("../utils/audit");
const { deliverNotification } = require("./notify.service");

const include = { subject: true, section: { include: { course: true } }, uploadedBy: true };

function serializeMaterial(m, user) {
  const canManage = user && (user.role === "ADMIN" || m.uploadedById === user.id);
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    unit: m.unit,
    subject: serializeSubject(m.subject),
    section: m.section ? serializeSection(m.section) : null,
    audienceLabel: m.section ? sectionLabel(m.section) : "All sections",
    fileName: m.originalName,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    extension: path.extname(m.originalName).slice(1).toLowerCase(),
    downloadCount: m.downloadCount,
    uploadedBy: personRef(m.uploadedBy),
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    canManage,
  };
}

/** Prisma `where` limiting materials to what the user is allowed to see. */
async function visibilityFilter(user) {
  if (user.role === "ADMIN") return {};
  if (user.role === "STUDENT") {
    const sectionId = user.student.sectionId;
    return {
      OR: [{ sectionId }, { sectionId: null, subject: { assignments: { some: { sectionId } } } }],
    };
  }
  // Staff: their own uploads plus anything for the subjects/sections they teach.
  const assignments = await staffAssignments(user.staff.id);
  return {
    OR: [
      { uploadedById: user.id },
      ...assignments.map((a) => ({ subjectId: a.subjectId, OR: [{ sectionId: a.sectionId }, { sectionId: null }] })),
    ],
  };
}

async function list(user, q) {
  const visible = await visibilityFilter(user);
  const where = {
    AND: [
      visible,
      {
        ...(q.subjectId && { subjectId: q.subjectId }),
        ...(q.sectionId && { sectionId: q.sectionId }),
        ...(q.courseId && { subject: { courseId: q.courseId } }),
        ...(q.mine && { uploadedById: user.id }),
        ...(q.search && {
          OR: [
            { title: { contains: q.search } },
            { description: { contains: q.search } },
            { unit: { contains: q.search } },
            { originalName: { contains: q.search } },
            { subject: { name: { contains: q.search } } },
            { subject: { code: { contains: q.search } } },
          ],
        }),
      },
    ],
  };
  const [rows, total] = await Promise.all([
    prisma.studyMaterial.findMany({ where, include, orderBy: { createdAt: "desc" }, ...pageArgs(q) }),
    prisma.studyMaterial.count({ where }),
  ]);
  return paged(rows.map((m) => serializeMaterial(m, user)), total, q);
}

async function findVisible(user, id) {
  const visible = await visibilityFilter(user);
  const m = await prisma.studyMaterial.findFirst({ where: { AND: [{ id }, visible] }, include });
  if (!m) throw notFound("Study material not found");
  return m;
}

async function create(user, file, data, req) {
  if (!file) throw badRequest("Please correct the highlighted fields.", { file: "Choose a file to upload" });
  try {
    const mimeType = await verifyUploadedFile(file);
    const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject) throw badRequest("Please correct the highlighted fields.", { subjectId: "Choose a valid subject" });

    let section = null;
    if (data.sectionId) {
      section = await prisma.section.findUnique({ where: { id: data.sectionId }, include: { course: true } });
      if (!section) throw badRequest("Please correct the highlighted fields.", { sectionId: "Choose a valid section" });
      await assertCanTeach(user, { sectionId: section.id, subjectId: subject.id });
    } else if (user.role === "STAFF") {
      const teaches = await prisma.staffAssignment.count({ where: { staffId: user.staff.id, subjectId: subject.id } });
      if (!teaches) throw forbidden("You are not assigned to teach this subject.");
    }

    const material = await prisma.$transaction(async (tx) => {
      const m = await tx.studyMaterial.create({
        data: {
          title: data.title,
          description: data.description ?? null,
          unit: data.unit ?? null,
          subjectId: subject.id,
          sectionId: section?.id ?? null,
          storedName: file.filename,
          originalName: file.originalname.slice(0, 255),
          mimeType,
          sizeBytes: file.size,
          uploadedById: user.id,
        },
        include,
      });
      // Let the students who can see it know.
      let sectionIds = section ? [section.id] : [];
      if (!section) {
        const rows = await tx.staffAssignment.findMany({ where: { subjectId: subject.id }, select: { sectionId: true }, distinct: ["sectionId"] });
        sectionIds = rows.map((r) => r.sectionId);
      }
      const userIds = await studentUserIdsForSections(tx, sectionIds);
      await deliverNotification(tx, {
        title: `New study material: ${subject.code}`,
        message: `${user.fullName} shared "${m.title}"${m.unit ? ` (${m.unit})` : ""} for ${subject.name}.`,
        category: "ACADEMIC",
        targetType: "SECTION",
        targetLabel: section ? sectionLabel(section) : `${subject.code} sections`,
        sectionId: section?.id,
        senderId: user.id,
        userIds,
      });
      await audit(tx, {
        req,
        action: "material.upload",
        entityType: "study_material",
        entityId: m.id,
        summary: `Uploaded "${m.title}" for ${subject.code}${section ? ` · ${sectionLabel(section)}` : ""}`,
        metadata: { fileName: m.originalName, sizeBytes: m.sizeBytes },
      });
      return m;
    });
    return serializeMaterial(material, user);
  } catch (err) {
    await removeStoredFile(file.filename);
    throw err;
  }
}

async function update(user, id, data, req) {
  const m = await findVisible(user, id);
  if (user.role !== "ADMIN" && m.uploadedById !== user.id) throw forbidden("Only the uploader or an administrator can edit this material.");
  const updated = await prisma.studyMaterial.update({ where: { id }, data, include });
  await audit(prisma, { req, action: "material.update", entityType: "study_material", entityId: id, summary: `Updated study material "${updated.title}"` });
  return serializeMaterial(updated, user);
}

async function remove(user, id, req) {
  const m = await findVisible(user, id);
  if (user.role !== "ADMIN" && m.uploadedById !== user.id) throw forbidden("Only the uploader or an administrator can delete this material.");
  await prisma.$transaction(async (tx) => {
    await tx.studyMaterial.delete({ where: { id } });
    await audit(tx, { req, action: "material.delete", entityType: "study_material", entityId: id, summary: `Deleted study material "${m.title}" (${m.subject.code})` });
  });
  await removeStoredFile(m.storedName);
  return { ok: true };
}

/** Resolve the file for download after the visibility check; counts the download. */
async function prepareDownload(user, id) {
  const m = await findVisible(user, id);
  const filePath = path.join(MATERIALS_DIR, path.basename(m.storedName));
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    throw notFound("The file for this material is missing on the server. Please ask the uploader to re-upload it.");
  }
  await prisma.studyMaterial.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
  return { filePath, fileName: m.originalName, mimeType: m.mimeType };
}

module.exports = { list, create, update, remove, prepareDownload, findVisible, serializeMaterial };
