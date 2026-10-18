"use strict";

// Writes one notification and delivers it to one user, inside the caller's transaction.
async function createUserNotification(client, payload) {
  const { userId, title, message, link, senderId, typeCodes } = payload;
  if (!userId) return;

  const codes = typeCodes && typeCodes.length ? typeCodes : ["system"];
  const placeholders = codes.map((_, idx) => `$${idx + 1}`).join(", ");
  const { rows: typeRows } = await client.query(
    `SELECT id, type_code
     FROM notification_types
     WHERE type_code IN (${placeholders})
     ORDER BY CASE ${codes
       .map((code, idx) => `WHEN type_code = $${idx + 1} THEN ${idx}`)
       .join(" ")} ELSE 999 END
     LIMIT 1`,
    codes
  );

  if (!typeRows.length) return;

  const { rows: notificationRows } = await client.query(
    `INSERT INTO notifications (type_id, title, message, link, sender_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [typeRows[0].id, title, message, link || null, senderId || null]
  );

  await client.query(
    `INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted)
     VALUES ($1, $2, 0, NULL, 0)`,
    [userId, notificationRows[0].id]
  );
}

module.exports = { createUserNotification };
