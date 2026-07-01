const express = require("express");
const router = express.Router();
const db = require("../config/database");

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

// GET tat ca vat lieu (chua bi xoa)
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT material_id, material_name, material_description, slug, created_at, updated_at, deleted_at
      FROM materials
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      `
    );

    return res.status(200).json(rows.map(mapMaterialRow));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Loi may chu khi lay danh sach vat lieu.",
    });
  }
});

// GET chi tiet vat lieu theo slug
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
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
      return res.status(404).json({ success: false, message: "Vat lieu khong tim thay." });
    }

    return res.status(200).json({ success: true, material: mapMaterialRow(rows[0]) });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Loi may chu khi lay vat lieu.",
    });
  }
});

// POST them moi vat lieu
router.post("/", async (req, res) => {
  const {
    material_name,
    material_description = null,
    slug,
    material_priority = 1,
    material_status = 1,
  } = req.body;

  if (!material_name || !slug) {
    return res.status(400).json({
      success: false,
      message: "Ten vat lieu va slug la bat buoc.",
    });
  }

  try {
    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO materials (material_name, material_description, slug, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING material_id, material_name, material_description, slug, created_at, updated_at, deleted_at
      `,
      [material_name, material_description, slug]
    );

    return res.status(201).json({
      success: true,
      message: "Vat lieu da duoc them thanh cong.",
      material: {
        ...mapMaterialRow(insertedRows[0]),
        material_priority,
        material_status,
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Loai vat lieu nay da ton tai.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Loi may chu khi them vat lieu moi.",
    });
  }
});

// PUT cap nhat vat lieu
router.put("/:slug", async (req, res) => {
  const oldSlug = req.params.slug;
  const {
    material_name,
    material_description = null,
    slug: newSlug,
    material_priority,
    material_status,
  } = req.body;

  if (!material_name || !newSlug) {
    return res.status(400).json({
      success: false,
      message: "Ten vat lieu va slug moi la bat buoc.",
    });
  }

  try {
    const { rows: targetRows } = await db.query(
      "SELECT material_id FROM materials WHERE slug = $1 AND deleted_at IS NULL LIMIT 1",
      [oldSlug]
    );

    if (!targetRows.length) {
      return res.status(404).json({
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
      return res.status(404).json({
        success: false,
        message: "Khong co thay doi hoac vat lieu khong ton tai.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vat lieu da duoc cap nhat thanh cong.",
      material_priority,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Slug moi da ton tai cho mot vat lieu khac.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Loi may chu khi cap nhat vat lieu.",
    });
  }
});

// PUT toggle status (an/hien) vat lieu
router.put("/:slug/toggle-status", async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    return res.status(400).json({ success: false, message: "Slug la bat buoc." });
  }

  try {
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
      return res.status(404).json({ success: false, message: "Vat lieu khong tim thay." });
    }

    const material = rows[0];
    const newDeletedAt = material.deleted_at ? null : new Date();
    const newStatus = newDeletedAt ? 0 : 1;

    await db.query(
      "UPDATE materials SET deleted_at = $1, updated_at = NOW() WHERE material_id = $2",
      [newDeletedAt, material.material_id]
    );

    return res.json({
      success: true,
      message: "Cap nhat trang thai thanh cong.",
      status: newStatus,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Loi may chu khi cap nhat trang thai.",
    });
  }
});

// DELETE vat lieu
router.delete("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const { rows: materialRows } = await db.query(
      "SELECT material_id FROM materials WHERE slug = $1 LIMIT 1",
      [slug]
    );

    if (!materialRows.length) {
      return res.status(404).json({
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

        return res.status(200).json({
          success: false,
          message:
            "Da co san pham su dung chat lieu nay, trang thai se chuyen sang an.",
          status: "hidden",
        });
      }
    }

    const { rowCount } = await db.query("DELETE FROM materials WHERE material_id = $1", [
      materialId,
    ]);

    if (rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Vat lieu khong tim thay de xoa.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vat lieu da duoc xoa thanh cong.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Loi may chu khi xoa vat lieu.",
    });
  }
});

module.exports = router;
