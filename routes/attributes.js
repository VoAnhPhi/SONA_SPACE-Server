const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

router.post("/:categoryId", async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const { attribute_name, value_type, unit, is_required } = req.body;

    if (!categoryId || isNaN(categoryId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID danh mục không hợp lệ." });
    }

    if (!attribute_name || !value_type) {
      return res.status(400).json({
        success: false,
        message: "Tên và kiểu giá trị thuộc tính là bắt buộc.",
      });
    }

    const sql = `
      INSERT INTO attributes (category_id, attribute_name, value_type, unit, is_required, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING attribute_id
    `;

    const { rows: result } = await db.query(sql, [
      categoryId,
      attribute_name,
      value_type,
      unit || null,
      is_required ? true : false,
    ]);

    res.status(201).json({
      success: true,
      message: "Tạo thuộc tính thành công.",
      attribute_id: result[0].attribute_id,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ khi tạo thuộc tính." });
  }
});

router.get("/:categoryId/attributes", async (req, res) => {
  const { categoryId } = req.params;

  if (!categoryId) {
    return res
      .status(400)
      .json({ success: false, message: "Category ID là bắt buộc." });
  }

  try {
    const sql = `
      SELECT
          attribute_id,
          attribute_name,
          value_type, -- Lấy trực tiếp từ cột value_type
          unit,
          is_required
      FROM
          attributes
      WHERE
          category_id = $1
      ORDER BY attribute_name;
    `;
    const { rows: attributes } = await db.query(sql, [categoryId]);

    if (attributes.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(attributes);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Lỗi máy chủ khi lấy danh sách thuộc tính cho danh mục ID ${categoryId}.`,
    });
  }
});

module.exports = router;
