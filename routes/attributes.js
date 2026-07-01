const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

router.post("/:categoryId", verifyToken, isAdmin, async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const { attribute_name, value_type, unit, is_required } = req.body;

    if (!Number.isInteger(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Category ID is invalid.",
      });
    }

    // The current PostgreSQL schema only persists the base attribute record.
    if (!attribute_name || !value_type) {
      return res.status(400).json({
        success: false,
        message: "Attribute name and value type are required.",
      });
    }

    const { rows } = await db.query(
      `
      INSERT INTO attributes (category_id, attribute_name, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING attribute_id
      `,
      [categoryId, String(attribute_name).trim()]
    );

    return res.status(201).json({
      success: true,
      message: "Attribute created successfully.",
      attribute_id: rows[0].attribute_id,
      value_type,
      unit: unit || null,
      is_required: Boolean(is_required),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Server error while creating attribute.",
    });
  }
});

router.get("/:categoryId/attributes", async (req, res) => {
  const categoryId = Number(req.params.categoryId);

  if (!Number.isInteger(categoryId)) {
    return res.status(400).json({
      success: false,
      message: "Category ID is required.",
    });
  }

  try {
    const { rows } = await db.query(
      `
      SELECT
        attribute_id,
        attribute_name,
        NULL::text AS value_type,
        NULL::text AS unit,
        FALSE AS is_required
      FROM attributes
      WHERE category_id = $1
        AND deleted_at IS NULL
      ORDER BY attribute_name
      `,
      [categoryId]
    );

    return res.status(200).json(rows);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Server error while loading attributes for category ID ${categoryId}.`,
    });
  }
});

module.exports = router;
