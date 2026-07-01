const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { withTransaction } = require("../db/transaction");
const { verifyToken, isAdmin } = require("../middleware/auth");

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
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

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: "Loi server khi lay danh sach thong bao" });
  }
});

router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
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

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, content, type, image, status = 1 } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Tieu de va noi dung la bat buoc" });
    }

    const result = await withTransaction(async (client) => {
      const { typeId, typeCode } = await resolveNotificationTypeId(client, type);

      const { rows: createdRows } = await client.query(
        `
        INSERT INTO notifications (type_id, title, message, link, sender_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id
        `,
        [typeId, title, content, image || null, req.user.id]
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

    res.status(201).json({
      message: "Tao thong bao thanh cong",
      id: result.notificationId,
      type_code: result.typeCode,
      status: Number(status) === 1 ? 1 : 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Loi may chu khi tao thong bao" });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "ID khong hop le" });
  }

  try {
    const deleted = await withTransaction(async (client) => {
      await client.query("DELETE FROM user_notifications WHERE notification_id = $1", [id]);
      const { rowCount } = await client.query("DELETE FROM notifications WHERE id = $1", [id]);
      return rowCount;
    });

    if (deleted === 0) {
      return res.status(404).json({ error: "Khong tim thay thong bao de xoa" });
    }

    res.json({ message: "Xoa thong bao thanh cong" });
  } catch (error) {
    res.status(500).json({ error: "Loi server khi xoa thong bao" });
  }
});

module.exports = router;
