const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

/**
 * @route   GET /api/color
 * @desc    Lấy tất cả danh mục sản phẩm
 * @access  Public
 */
router.get("/filter", async (req, res) => {
  const { rows } = await db.query(`
      SELECT color_id, color_name, color_hex
      FROM color
      ORDER BY color_priority ASC
    `);
  res.json(rows);
});

/**
 * @route   GET /api/color/by-product/:slug
 * @desc    Lấy danh sách màu sắc theo sản phẩm
 * @access  Public
 */
router.get("/by-product/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    const { rows } = await db.query(
      `
      SELECT DISTINCT c.color_id, c.color_name, c.color_hex, c.color_slug
      FROM color c
      JOIN variant_product vp ON c.color_id = vp.color_id
      WHERE vp.product_id = $1
    `,
      [slug]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch colors by product" });
  }
});

router.get("/admin", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        c.color_id,
        c.color_hex,
        c.color_name,
        c.color_priority,
        c.color_slug,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        c.status,
        COUNT(DISTINCT vp.product_id) AS product_count
      FROM color c
      LEFT JOIN variant_product vp ON c.color_id = vp.color_id
      GROUP BY c.color_id
      ORDER BY c.color_priority ASC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch all colors" });
  }
});
router.get("/admin/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({ message: "Slug is required" });
  }

  try {
    const { rows } = await db.query(
      `
      SELECT 
        color_id, 
        color_name, 
        color_hex, 
        color_slug, 
        color_priority, 
        status,
        created_at,
        updated_at,
        deleted_at
      FROM color
      WHERE color_slug = $1
      LIMIT 1
    `,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch color" });
  }
});
router.post("/admin", async (req, res) => {
  const { color_hex, color_name, color_priority, color_slug } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!color_name || !color_hex) {
    return res
      .status(400)
      .json({ message: "color_name and color_hex are required" });
  }

  try {
    const { rows: result } = await db.query(
      `
      INSERT INTO color (color_hex, color_name, color_priority, color_slug)
      VALUES ($1, $2, $3, $4)
      RETURNING color_id
    `,
      [color_hex, color_name, color_priority || 0, color_slug]
    );
    res.status(201).json({
      message: "Tạo màu thành công",
      color_id: result[0].color_id,
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi tạo màu" });
  }
});
router.put("/admin/:id", async (req, res) => {
  const colorId = req.params.id;
  const { color_hex, color_name, color_priority, color_slug, status } =
    req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!colorId) {
    return res.status(400).json({ message: "Color ID is required" });
  }

  try {
    const result = await db.query(
      `
      UPDATE color
      SET color_hex = $1, color_name = $2, color_priority = $3, color_slug = $4, status = $5
      WHERE color_id = $6
    `,
      [color_hex, color_name, color_priority, color_slug, status, colorId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json({ message: "Xóa màu thành công" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update color" });
  }
});
router.put("/admin/:id/toggle-status", async (req, res) => {
  const colorId = req.params.id;
  if (!colorId) {
    return res.status(400).json({ message: "Color ID is required" });
  }
  try {
    // Lấy trạng thái hiện tại
    const { rows } = await db.query(
      "SELECT status FROM color WHERE color_id = $1",
      [colorId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Color not found" });
    }
    const currentStatus = rows[0].status;
    const newStatus = currentStatus === 1 ? 0 : 1;
    await db.query(
      "UPDATE color SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE color_id = $2",
      [newStatus, colorId]
    );
    res.json({
      message: "Color status updated",
      color_id: colorId,
      status: newStatus,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle color status" });
  }
});
router.delete("/admin/:id", async (req, res) => {
  const colorId = req.params.id;

  if (!colorId) {
    return res.status(400).json({ message: "Color ID is required" });
  }

  try {
    // Kiểm tra xem màu có sản phẩm sử dụng không
    const { rows: products } = await db.query(
      `SELECT COUNT(*) as count FROM variant_product WHERE color_id = $1`,
      [colorId]
    );
    if (products[0].count > 0) {
      // Nếu có sản phẩm, chuyển trạng thái sang ẩn
      await db.query(
        `UPDATE color SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE color_id = $1`,
        [colorId]
      );
      return res.json({
        message: "Đã có sản phẩm sử dụng màu này, trạng thái sẽ chuyển sang ẩn",
        status: "hidden",
      });
    }
    // Hard delete: Xóa khỏi database
    const result = await db.query(`DELETE FROM color WHERE color_id = $1`, [
      colorId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Color not found" });
    }

    res.json({ message: "Xóa màu thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi khi xóa màu" });
  }
});
module.exports = router;
