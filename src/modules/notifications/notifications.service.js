"use strict";

const db = require("../../config/database");
const { withTransaction } = require("../../shared/db/transaction");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { parsePositiveId } = require("../../shared/utils/parse-id");

/** Picks the notification type for a code, falling back to system, promotion, then order. */
async function resolveNotificationTypeId(client, typeCode) {
  const normalized = String(typeCode || "").trim().toLowerCase();
  const preferredCodes = normalized
    ? [normalized, "system", "promotion", "order"]
    : ["system", "promotion", "order"];

  const seen = new Set();
  const dedupedCodes = preferredCodes.filter((code) => {
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });

  const { rows } = await client.query(
    `
    SELECT id, type_code
    FROM notification_types
    WHERE type_code = ANY($1::text[])
    ORDER BY CASE
      WHEN type_code = $2 THEN 0
      WHEN type_code = 'system' THEN 1
      WHEN type_code = 'promotion' THEN 2
      WHEN type_code = 'order' THEN 3
      ELSE 4
    END
    LIMIT 1
    `,
    [dedupedCodes, normalized || "system"]
  );

  return {
    typeId: rows[0]?.id || null,
    typeCode: rows[0]?.type_code || normalized || "system",
  };
}

/** Delivers a notification to many users in one statement; existing deliveries are kept. */
async function insertUserNotifications(client, notificationId, userIds) {
  if (!userIds.length) return;

  const values = [];
  const placeholders = userIds
    .map((userId) => {
      values.push(userId, notificationId);
      return `($${values.length - 1}, $${values.length}, 0, NULL, 0)`;
    })
    .join(", ");

  await client.query(
    `
    INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted)
    VALUES ${placeholders}
    ON CONFLICT DO NOTHING
    `,
    values
  );
}

function listAll() {
  return guard({ error: "Loi server khi lay danh sach thong bao" }, async () => {
    const { rows } = await db.query(`
      SELECT
        n.id,
        n.title,
        n.message,
        n.sender_id AS created_by,
        n.created_at,
        n.updated_at,
        n.type_id,
        n.link,
        nt.type_code,
        nt.description AS type_description
      FROM notifications n
      LEFT JOIN notification_types nt ON n.type_id = nt.id
      ORDER BY n.created_at DESC
    `);

    return rows;
  });
}

/** The 50 most recent notifications for the admin bell. */
function listRecent() {
  return guard({ error: "Internal Server Error" }, async () => {
    const { rows } = await db.query(`
      SELECT
        n.id,
        n.type_id,
        n.title,
        n.message,
        n.link,
        n.sender_id,
        n.created_at,
        n.updated_at,
        nt.type_code
      FROM notifications n
      LEFT JOIN notification_types nt ON n.type_id = nt.id
      ORDER BY n.created_at DESC
      LIMIT 50
    `);

    return rows;
  });
}

/** Creates a notification; with status 1 it is delivered to every active user. */
function create(body, sender) {
  return guard({ error: "Loi may chu khi tao thong bao" }, async () => {
    const { title, content, type, image, status = 1 } = body;

    if (!title || !content) {
      throw new HttpError(400, { error: "Tieu de va noi dung la bat buoc" });
    }

    const result = await withTransaction(async (client) => {
      const { typeId, typeCode } = await resolveNotificationTypeId(client, type);

      const { rows: createdRows } = await client.query(
        `
        INSERT INTO notifications (type_id, title, message, link, sender_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
        `,
        [typeId, title, content, image || null, sender.id]
      );

      const notificationId = createdRows[0].id;

      if (Number(status) === 1) {
        const { rows: users } = await client.query(`
          SELECT user_id
          FROM "user"
          WHERE deleted_at IS NULL
            AND user_disabled_at IS NULL
        `);

        await insertUserNotifications(
          client,
          notificationId,
          users.map((user) => user.user_id)
        );
      }

      return { notificationId, typeCode };
    });

    return {
      message: "Tao thong bao thanh cong",
      id: result.notificationId,
      type_code: result.typeCode,
      status: Number(status) === 1 ? 1 : 0,
    };
  });
}

function remove(rawId) {
  const id = parsePositiveId(rawId);
  if (!id) {
    throw new HttpError(400, { error: "ID khong hop le" });
  }

  return guard({ error: "Loi server khi xoa thong bao" }, async () => {
    const deleted = await withTransaction(async (client) => {
      await client.query("DELETE FROM user_notifications WHERE notification_id = $1", [id]);
      const { rowCount } = await client.query("DELETE FROM notifications WHERE id = $1", [id]);
      return rowCount;
    });

    if (deleted === 0) {
      throw new HttpError(404, { error: "Khong tim thay thong bao de xoa" });
    }

    return { message: "Xoa thong bao thanh cong" };
  });
}

module.exports = {
  listAll,
  listRecent,
  create,
  remove,
  resolveNotificationTypeId,
  insertUserNotifications,
};
