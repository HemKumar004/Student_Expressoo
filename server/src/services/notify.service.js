const prisma = require("../lib/prisma");

/**
 * Create a notification and fan it out to recipients (one row per user, enabling read tracking).
 * Pass a transaction client as `db` to make delivery atomic with the triggering change.
 */
async function deliverNotification(db = prisma, { title, message, category = "GENERAL", targetType, targetLabel, courseId, sectionId, eventAt, senderId, userIds }) {
  const recipients = [...new Set(userIds)].filter((id) => id && id !== senderId);
  const notification = await db.notification.create({
    data: {
      title,
      message,
      category,
      targetType,
      targetLabel: targetLabel.slice(0, 255),
      courseId: courseId ?? null,
      sectionId: sectionId ?? null,
      eventAt: eventAt ?? null,
      senderId: senderId ?? null,
    },
  });
  if (recipients.length) {
    await db.notificationRecipient.createMany({
      data: recipients.map((userId) => ({ notificationId: notification.id, userId })),
      skipDuplicates: true,
    });
  }
  return { notification, recipientCount: recipients.length };
}

module.exports = { deliverNotification };
