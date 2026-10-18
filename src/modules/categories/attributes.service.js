"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

/** Define an attribute (size, material, ...) for a category. */
function create(rawCategoryId, body) {
  const failure = () => ({
    success: false,
    message: "Server error while creating attribute.",
  });

  return guard(failure, async () => {
    const categoryId = Number(rawCategoryId);
    const { attribute_name, value_type, unit, is_required } = body;

    if (!Number.isInteger(categoryId)) {
      throw new HttpError(400, {
        success: false,
        message: "Category ID is invalid.",
      });
    }

    if (!attribute_name || !value_type) {
      throw new HttpError(400, {
        success: false,
        message: "Attribute name and value type are required.",
      });
    }

    const { rows } = await db.query(
      `
      INSERT INTO attributes (category_id, attribute_name, value_type, unit, is_required, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING attribute_id, value_type, unit, is_required
      `,
      [
        categoryId,
        String(attribute_name).trim(),
        String(value_type).trim(),
        unit || null,
        Boolean(is_required),
      ]
    );

    return {
      success: true,
      message: "Attribute created successfully.",
      attribute_id: rows[0].attribute_id,
      value_type: rows[0].value_type,
      unit: rows[0].unit,
      is_required: rows[0].is_required,
    };
  });
}

/** Attributes of a category that are not deleted. */
function listByCategory(rawCategoryId) {
  const categoryId = Number(rawCategoryId);

  if (!Number.isInteger(categoryId)) {
    throw new HttpError(400, {
      success: false,
      message: "Category ID is required.",
    });
  }

  const failure = () => ({
    success: false,
    message: `Server error while loading attributes for category ID ${categoryId}.`,
  });

  return guard(failure, async () => {
    const { rows } = await db.query(
      `
      SELECT
        attribute_id,
        attribute_name,
        value_type,
        unit,
        COALESCE(is_required, FALSE) AS is_required
      FROM attributes
      WHERE category_id = $1
        AND deleted_at IS NULL
      ORDER BY attribute_name
      `,
      [categoryId]
    );

    return rows;
  });
}

module.exports = { create, listByCategory };
