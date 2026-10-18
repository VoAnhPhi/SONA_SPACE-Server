"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

// Positive or negative integers pass; the callers reject 0 through `!id`.
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

function requireId(rawId) {
  const id = parseId(rawId);
  if (!id) throw new HttpError(400, { error: "ID khong hop le" });
  return id;
}

function list() {
  return guard({ error: "Loi khi lay danh sach loai thong bao" }, async () => {
    const { rows } = await db.query("SELECT * FROM notification_types ORDER BY id DESC");
    return rows.map(mapTypeRow);
  });
}

function getById(rawId) {
  return guard({ error: "Loi khi lay du lieu loai thong bao" }, async () => {
    const id = requireId(rawId);

    const { rows } = await db.query("SELECT * FROM notification_types WHERE id = $1", [id]);

    if (!rows.length) {
      throw new HttpError(404, { error: "Khong tim thay loai thong bao" });
    }

    return mapTypeRow(rows[0]);
  });
}

function create(body) {
  const failure = (error) =>
    error.code === "23505"
      ? new HttpError(409, { error: "type_code da ton tai" })
      : { error: "Loi khi them loai thong bao" };

  return guard(failure, async () => {
    const { type_code, type_name, description, is_active, icon } = body;
    if (!type_code) {
      throw new HttpError(400, { error: "type_code la bat buoc" });
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

    return {
      id: rows[0].id,
      is_active: is_active ?? 1,
      message: "Them loai thong bao thanh cong",
    };
  });
}

/** Kept for API compatibility: the schema has no is_active column, so nothing is stored. */
function updateStatus(rawId, body) {
  return guard({ error: "Loi khi cap nhat trang thai" }, async () => {
    const id = requireId(rawId);

    const { is_active } = body;
    if (typeof is_active !== "number" || ![0, 1].includes(is_active)) {
      throw new HttpError(400, { error: "Trang thai khong hop le" });
    }

    const { rows } = await db.query("SELECT id FROM notification_types WHERE id = $1", [id]);

    if (!rows.length) {
      throw new HttpError(404, { error: "Khong tim thay loai thong bao" });
    }

    return { message: "Cap nhat trang thai thanh cong", is_active };
  });
}

function update(rawId, body) {
  return guard({ error: "Loi khi cap nhat loai thong bao" }, async () => {
    const id = requireId(rawId);

    const { type_code, type_name, description, icon } = body;

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
      throw new HttpError(404, { error: "Khong tim thay loai thong bao" });
    }

    return { message: "Cap nhat thanh cong" };
  });
}

/** A type that still has notifications cannot be deleted. */
function remove(rawId) {
  return guard({ error: "Loi khi xoa loai thong bao" }, async () => {
    const id = requireId(rawId);

    const { rows: countRows } = await db.query(
      "SELECT COUNT(*)::int AS count FROM notifications WHERE type_id = $1",
      [id]
    );

    if (Number(countRows[0]?.count || 0) > 0) {
      throw new HttpError(400, {
        error: "Khong the xoa vi van con thong bao thuoc loai nay",
      });
    }

    const { rowCount } = await db.query("DELETE FROM notification_types WHERE id = $1", [id]);

    if (rowCount === 0) {
      throw new HttpError(404, { error: "Khong tim thay loai thong bao" });
    }

    return { message: "Xoa thanh cong" };
  });
}

module.exports = { list, getById, create, updateStatus, update, remove };
