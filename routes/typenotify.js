const express = require("express");
const router = express.Router();
const db = require("../config/database");

function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function mapTypeRow(row) {
  return {
    ...row,
    is_active: 1,
    notification_type_id: row.id,
  };
}

router.get("", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM notification_types ORDER BY id DESC"
    );
    return res.json(rows.map(mapTypeRow));
  } catch (error) {
    return res.status(500).json({ error: "Loi khi lay danh sach loai thong bao" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID khong hop le" });
    }

    const { rows } = await db.query(
      "SELECT * FROM notification_types WHERE id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Khong tim thay loai thong bao" });
    }

    return res.json(mapTypeRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: "Loi khi lay du lieu loai thong bao" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { type_code, type_name, description, is_active, icon } = req.body;
    if (!type_code) {
      return res.status(400).json({ error: "type_code la bat buoc" });
    }

    const resolvedTypeName = type_name || type_code;

    const { rows } = await db.query(
      `
      INSERT INTO notification_types (type_code, type_name, description, icon, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id
      `,
      [type_code, resolvedTypeName, description || null, icon || null]
    );

    return res.json({
      id: rows[0].id,
      is_active: is_active ?? 1,
      message: "Them loai thong bao thanh cong",
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "type_code da ton tai" });
    }

    return res.status(500).json({ error: "Loi khi them loai thong bao" });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID khong hop le" });
    }

    const { is_active } = req.body;
    if (typeof is_active !== "number" || ![0, 1].includes(is_active)) {
      return res.status(400).json({ error: "Trang thai khong hop le" });
    }

    const { rows } = await db.query(
      "SELECT id FROM notification_types WHERE id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Khong tim thay loai thong bao" });
    }

    // Schema hien tai khong co is_active, giu endpoint de tuong thich API.
    return res.json({ message: "Cap nhat trang thai thanh cong", is_active });
  } catch (error) {
    return res.status(500).json({ error: "Loi khi cap nhat trang thai" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID khong hop le" });
    }

    const { type_code, type_name, description, icon } = req.body;

    const { rowCount } = await db.query(
      `
      UPDATE notification_types
      SET
        type_code = COALESCE($1, type_code),
        type_name = COALESCE($2, type_name),
        description = COALESCE($3, description),
        icon = COALESCE($4, icon),
        updated_at = NOW()
      WHERE id = $5
      `,
      [type_code || null, type_name || null, description || null, icon || null, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Khong tim thay loai thong bao" });
    }

    return res.json({ message: "Cap nhat thanh cong" });
  } catch (error) {
    return res.status(500).json({ error: "Loi khi cap nhat loai thong bao" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID khong hop le" });
    }

    const { rows: countRows } = await db.query(
      "SELECT COUNT(*)::int AS count FROM notifications WHERE type_id = $1",
      [id]
    );

    if (Number(countRows[0]?.count || 0) > 0) {
      return res.status(400).json({
        error: "Khong the xoa vi van con thong bao thuoc loai nay",
      });
    }

    const { rowCount } = await db.query(
      "DELETE FROM notification_types WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Khong tim thay loai thong bao" });
    }

    return res.json({ message: "Xoa thanh cong" });
  } catch (error) {
    return res.status(500).json({ error: "Loi khi xoa loai thong bao" });
  }
});

module.exports = router;
