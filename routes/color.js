const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

function getColorCode(body = {}) {
  return body.color_hex ?? body.color_code ?? null;
}

function buildColorSlug(colorName, colorId) {
  const normalized = String(colorName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

/**
 * @route   GET /api/color/filter
 * @desc    Get active colors for public catalog filters
 * @access  Public
 */
router.get("/filter", async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT color_id, color_name, color_code, created_at, updated_at, deleted_at
      FROM color
      WHERE deleted_at IS NULL
      ORDER BY color_id ASC
    `
    );

    res.json(rows.map(mapColorRow));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch colors" });
  }
});

/**
 * @route   GET /api/color/by-product/:slug
 * @desc    Get colors by product slug
 * @access  Public
 */
router.get("/by-product/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) {
    return res.status(400).json({ message: "Slug is required" });
  }

  try {
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

    res.json(rows.map(mapColorRow));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch colors by product" });
  }
});

router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
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

    res.json(rows.map(mapColorRow));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch all colors" });
  }
});

router.get("/admin/:slug", verifyToken, isAdmin, async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({ message: "Slug is required" });
  }

  try {
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

    if (!color) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json(color);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch color" });
  }
});

router.post("/admin", verifyToken, isAdmin, async (req, res) => {
  const { color_name } = req.body;
  const colorCode = getColorCode(req.body);

  if (!color_name || !colorCode) {
    return res
      .status(400)
      .json({ message: "color_name and color_hex are required" });
  }

  try {
    const { rows } = await db.query(
      `
      INSERT INTO color (color_code, color_name, created_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING color_id, color_name, color_code, created_at, updated_at, deleted_at
    `,
      [colorCode, color_name]
    );

    res.status(201).json({
      message: "Color created successfully",
      color: mapColorRow(rows[0]),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create color" });
  }
});

router.put("/admin/:id", verifyToken, isAdmin, async (req, res) => {
  const colorId = req.params.id;
  const { color_name, status } = req.body;
  const colorCode = getColorCode(req.body);
  const normalizedStatus =
    status === undefined || status === null ? null : Number(status);

  if (!colorId) {
    return res.status(400).json({ message: "Color ID is required" });
  }

  try {
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

    if (rowCount === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json({ message: "Color updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update color" });
  }
});

router.put(
  "/admin/:id/toggle-status",
  verifyToken,
  isAdmin,
  async (req, res) => {
    const colorId = req.params.id;

    if (!colorId) {
      return res.status(400).json({ message: "Color ID is required" });
    }

    try {
      const { rows } = await db.query(
        "SELECT deleted_at FROM color WHERE color_id = $1",
        [colorId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Color not found" });
      }

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

      res.json({
        message: "Color status updated",
        color_id: colorId,
        status: nextStatus,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle color status" });
    }
  }
);

router.delete("/admin/:id", verifyToken, isAdmin, async (req, res) => {
  const colorId = req.params.id;

  if (!colorId) {
    return res.status(400).json({ message: "Color ID is required" });
  }

  try {
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

      return res.json({
        message: "Color is still used by products and has been hidden instead",
        status: "hidden",
      });
    }

    const { rowCount } = await db.query(
      "DELETE FROM color WHERE color_id = $1",
      [colorId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json({ message: "Color deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete color" });
  }
});

module.exports = router;
