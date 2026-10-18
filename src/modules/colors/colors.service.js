"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

function getColorCode(body = {}) {
  return body.color_hex ?? body.color_code ?? null;
}

function buildColorSlug(colorName, colorId) {
  const normalized = String(colorName || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || String(colorId);
}

function mapColorRow(row) {
  return {
    color_id: row.color_id,
    color_name: row.color_name,
    color_hex: row.color_code,
    color_slug: buildColorSlug(row.color_name, row.color_id),
    color_priority: row.color_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    status: row.deleted_at ? 0 : 1,
    product_count:
      row.product_count === undefined ? undefined : Number(row.product_count),
  };
}

/** Active colors for public catalog filters. */
function listActive() {
  return guard("Failed to fetch colors", async () => {
    const { rows } = await db.query(
      `
      SELECT color_id, color_name, color_code, created_at, updated_at, deleted_at
      FROM color
      WHERE deleted_at IS NULL
      ORDER BY color_id ASC
    `
    );
    return rows.map(mapColorRow);
  });
}

function listByProductSlug(slug) {
  if (!slug) throw new HttpError(400, { message: "Slug is required" });

  return guard("Failed to fetch colors by product", async () => {
    const { rows } = await db.query(
      `
      SELECT DISTINCT
        c.color_id,
        c.color_name,
        c.color_code,
        c.created_at,
        c.updated_at,
        c.deleted_at
      FROM color c
      JOIN variant_product vp ON c.color_id = vp.color_id
      JOIN product p ON vp.product_id = p.product_id
      WHERE p.product_slug = $1 AND c.deleted_at IS NULL
      ORDER BY c.color_id ASC
    `,
      [slug]
    );
    return rows.map(mapColorRow);
  });
}

/** Every color with the number of products using it (admin). */
function listAll() {
  return guard("Failed to fetch all colors", async () => {
    const { rows } = await db.query(
      `
      SELECT
        c.color_id,
        c.color_name,
        c.color_code,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        COUNT(DISTINCT vp.product_id)::int AS product_count
      FROM color c
      LEFT JOIN variant_product vp ON c.color_id = vp.color_id
      GROUP BY
        c.color_id,
        c.color_name,
        c.color_code,
        c.created_at,
        c.updated_at,
        c.deleted_at
      ORDER BY c.color_id ASC
    `
    );
    return rows.map(mapColorRow);
  });
}

/** One color by slug or numeric id (admin). */
function getBySlug(slug) {
  if (!slug) throw new HttpError(400, { message: "Slug is required" });

  return guard("Failed to fetch color", async () => {
    const { rows } = await db.query(
      `
      SELECT color_id, color_name, color_code, created_at, updated_at, deleted_at
      FROM color
      ORDER BY color_id ASC
    `
    );

    const mappedColors = rows.map(mapColorRow);
    const color =
      mappedColors.find((item) => item.color_slug === slug) ||
      mappedColors.find((item) => String(item.color_id) === slug);

    if (!color) throw new HttpError(404, { message: "Color not found" });
    return color;
  });
}

function create(body) {
  const { color_name } = body;
  const colorCode = getColorCode(body);

  if (!color_name || !colorCode) {
    throw new HttpError(400, { message: "color_name and color_hex are required" });
  }

  return guard("Failed to create color", async () => {
    const { rows } = await db.query(
      `
      INSERT INTO color (color_code, color_name, created_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING color_id, color_name, color_code, created_at, updated_at, deleted_at
    `,
      [colorCode, color_name]
    );

    return {
      message: "Color created successfully",
      color: mapColorRow(rows[0]),
    };
  });
}

function update(colorId, body) {
  const { color_name, status } = body;
  const colorCode = getColorCode(body);
  const normalizedStatus =
    status === undefined || status === null ? null : Number(status);

  if (!colorId) throw new HttpError(400, { message: "Color ID is required" });

  return guard("Failed to update color", async () => {
    const { rowCount } = await db.query(
      `
      UPDATE color
      SET
        color_code = COALESCE($1, color_code),
        color_name = COALESCE($2, color_name),
        updated_at = CURRENT_TIMESTAMP,
        deleted_at = CASE
          WHEN $3::int = 0 THEN COALESCE(deleted_at, CURRENT_TIMESTAMP)
          WHEN $3::int = 1 THEN NULL
          ELSE deleted_at
        END
      WHERE color_id = $4
    `,
      [colorCode, color_name ?? null, normalizedStatus, colorId]
    );

    if (rowCount === 0) throw new HttpError(404, { message: "Color not found" });
    return { message: "Color updated successfully" };
  });
}

function toggleStatus(colorId) {
  if (!colorId) throw new HttpError(400, { message: "Color ID is required" });

  return guard("Failed to toggle color status", async () => {
    const { rows } = await db.query(
      "SELECT deleted_at FROM color WHERE color_id = $1",
      [colorId]
    );

    if (rows.length === 0) throw new HttpError(404, { message: "Color not found" });

    const isActive = !rows[0].deleted_at;
    const nextStatus = isActive ? 0 : 1;

    await db.query(
      `
        UPDATE color
        SET
          deleted_at = CASE WHEN $1 = 1 THEN NULL ELSE CURRENT_TIMESTAMP END,
          updated_at = CURRENT_TIMESTAMP
        WHERE color_id = $2
      `,
      [nextStatus, colorId]
    );

    return {
      message: "Color status updated",
      color_id: colorId,
      status: nextStatus,
    };
  });
}

/** Colors used by variants are hidden instead of deleted. */
function remove(colorId) {
  if (!colorId) throw new HttpError(400, { message: "Color ID is required" });

  return guard("Failed to delete color", async () => {
    const { rows: products } = await db.query(
      "SELECT COUNT(*)::int AS count FROM variant_product WHERE color_id = $1",
      [colorId]
    );

    if (Number(products[0].count) > 0) {
      await db.query(
        `
        UPDATE color
        SET deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
        WHERE color_id = $1
      `,
        [colorId]
      );

      return {
        message: "Color is still used by products and has been hidden instead",
        status: "hidden",
      };
    }

    const { rowCount } = await db.query(
      "DELETE FROM color WHERE color_id = $1",
      [colorId]
    );

    if (rowCount === 0) throw new HttpError(404, { message: "Color not found" });
    return { message: "Color deleted successfully" };
  });
}

module.exports = {
  listActive,
  listByProductSlug,
  listAll,
  getBySlug,
  create,
  update,
  toggleStatus,
  remove,
};
