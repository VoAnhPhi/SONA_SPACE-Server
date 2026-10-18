"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

// Legacy 500 body of this endpoint family: { success: false, message }
const failWith = (message) => () => ({ success: false, message });
// Same, but a unique-violation becomes a 409 with its own message.
const failWithConflict = (message, conflictMessage) => (error) =>
  error.code === "23505"
    ? new HttpError(409, { success: false, message: conflictMessage })
    : { success: false, message };

function materialStatusFromDeletedAt(deletedAt) {
  return deletedAt ? 0 : 1;
}

function mapMaterialRow(row) {
  return {
    material_id: row.material_id,
    material_name: row.material_name,
    material_description: row.material_description,
    slug: row.slug,
    material_priority: null,
    material_status: materialStatusFromDeletedAt(row.deleted_at),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

async function hasProductAttributeValueTable() {
  const { rows } = await db.query(
    "SELECT to_regclass('public.product_attribute_value') AS table_name"
  );
  return Boolean(rows[0]?.table_name);
}

/** Materials that are not deleted, newest first. */
function list() {
  return guard(failWith("Loi may chu khi lay danh sach vat lieu."), async () => {
    const { rows } = await db.query(
      `
      SELECT material_id, material_name, material_description, slug, created_at, updated_at, deleted_at
      FROM materials
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      `
    );
    return rows.map(mapMaterialRow);
  });
}

function getBySlug(slug) {
  return guard(failWith("Loi may chu khi lay vat lieu."), async () => {
    const { rows } = await db.query(
      `
      SELECT material_id, material_name, material_description, slug, created_at, updated_at, deleted_at
      FROM materials
      WHERE slug = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [slug]
    );

    if (rows.length === 0) {
      throw new HttpError(404, { success: false, message: "Vat lieu khong tim thay." });
    }

    return { success: true, material: mapMaterialRow(rows[0]) };
  });
}

function create(body) {
  const {
    material_name,
    material_description = null,
    slug,
    material_priority = 1,
    material_status = 1,
  } = body;

  if (!material_name || !slug) {
    throw new HttpError(400, {
      success: false,
      message: "Ten vat lieu va slug la bat buoc.",
    });
  }

  return guard(
    failWithConflict("Loi may chu khi them vat lieu moi.", "Loai vat lieu nay da ton tai."),
    async () => {
      const { rows: insertedRows } = await db.query(
        `
      INSERT INTO materials (material_name, material_description, slug, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING material_id, material_name, material_description, slug, created_at, updated_at, deleted_at
      `,
        [material_name, material_description, slug]
      );

      return {
        success: true,
        message: "Vat lieu da duoc them thanh cong.",
        material: {
          ...mapMaterialRow(insertedRows[0]),
          material_priority,
          material_status,
        },
      };
    }
  );
}

function update(oldSlug, body) {
  const {
    material_name,
    material_description = null,
    slug: newSlug,
    material_priority,
    material_status,
  } = body;

  if (!material_name || !newSlug) {
    throw new HttpError(400, {
      success: false,
      message: "Ten vat lieu va slug moi la bat buoc.",
    });
  }

  return guard(
    failWithConflict("Loi may chu khi cap nhat vat lieu.", "Slug moi da ton tai cho mot vat lieu khac."),
    async () => {
      const { rows: targetRows } = await db.query(
        "SELECT material_id FROM materials WHERE slug = $1 AND deleted_at IS NULL LIMIT 1",
        [oldSlug]
      );

      if (!targetRows.length) {
        throw new HttpError(404, {
          success: false,
          message: "Vat lieu khong tim thay de cap nhat.",
        });
      }

      const materialId = targetRows[0].material_id;

      const { rowCount } = await db.query(
        `
      UPDATE materials
      SET material_name = $1,
          material_description = $2,
          slug = $3,
          updated_at = NOW(),
          deleted_at = CASE WHEN $4::int = 0 THEN COALESCE(deleted_at, NOW()) ELSE NULL END
      WHERE material_id = $5
      `,
        [
          material_name,
          material_description,
          newSlug,
          Number(material_status) === 0 ? 0 : 1,
          materialId,
        ]
      );

      if (rowCount === 0) {
        throw new HttpError(404, {
          success: false,
          message: "Khong co thay doi hoac vat lieu khong ton tai.",
        });
      }

      return {
        success: true,
        message: "Vat lieu da duoc cap nhat thanh cong.",
        material_priority,
      };
    }
  );
}

/** Hide or show a material by flipping deleted_at. */
function toggleStatus(slug) {
  if (!slug) {
    throw new HttpError(400, { success: false, message: "Slug la bat buoc." });
  }

  return guard(failWith("Loi may chu khi cap nhat trang thai."), async () => {
    const { rows } = await db.query(
      `
      SELECT material_id, deleted_at
      FROM materials
      WHERE slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (!rows.length) {
      throw new HttpError(404, { success: false, message: "Vat lieu khong tim thay." });
    }

    const material = rows[0];
    const newDeletedAt = material.deleted_at ? null : new Date();
    const newStatus = newDeletedAt ? 0 : 1;

    await db.query(
      "UPDATE materials SET deleted_at = $1, updated_at = NOW() WHERE material_id = $2",
      [newDeletedAt, material.material_id]
    );

    return {
      success: true,
      message: "Cap nhat trang thai thanh cong.",
      status: newStatus,
    };
  });
}

/** A material used by products is hidden instead of deleted. */
function remove(slug) {
  return guard(failWith("Loi may chu khi xoa vat lieu."), async () => {
    const { rows: materialRows } = await db.query(
      "SELECT material_id FROM materials WHERE slug = $1 LIMIT 1",
      [slug]
    );

    if (!materialRows.length) {
      throw new HttpError(404, {
        success: false,
        message: "Vat lieu khong tim thay de xoa.",
      });
    }

    const materialId = materialRows[0].material_id;

    const hasPivotTable = await hasProductAttributeValueTable();
    if (hasPivotTable) {
      const { rows: usedRows } = await db.query(
        "SELECT COUNT(*)::int AS count FROM product_attribute_value WHERE material_id = $1",
        [materialId]
      );

      if (usedRows[0].count > 0) {
        await db.query(
          "UPDATE materials SET deleted_at = NOW(), updated_at = NOW() WHERE material_id = $1",
          [materialId]
        );

        return {
          success: false,
          message:
            "Da co san pham su dung chat lieu nay, trang thai se chuyen sang an.",
          status: "hidden",
        };
      }
    }

    const { rowCount } = await db.query("DELETE FROM materials WHERE material_id = $1", [
      materialId,
    ]);

    if (rowCount === 0) {
      throw new HttpError(404, {
        success: false,
        message: "Vat lieu khong tim thay de xoa.",
      });
    }

    return {
      success: true,
      message: "Vat lieu da duoc xoa thanh cong.",
    };
  });
}

module.exports = { list, getBySlug, create, update, toggleStatus, remove };
