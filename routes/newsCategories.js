const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

function generateSlug(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
}

function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * @route   GET /api/news-categories
 * @desc    Lay danh sach danh muc tin tuc
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        c.news_category_id AS id,
        c.news_category_name AS name,
        c.news_category_slug AS slug,
        c.news_category_status AS status,
        NULL::text AS image,
        NULL::int AS priority,
        c.updated_at,
        c.created_at,
        c.deleted_at,
        COUNT(n.news_id)::int AS news_count
      FROM news_category c
      LEFT JOIN news n ON n.news_category_id = c.news_category_id
      GROUP BY c.news_category_id
      ORDER BY c.created_at DESC
    `);

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
});

/**
 * @route   GET /api/news-categories/:slug
 * @desc    Lay thong tin danh muc tin tuc
 * @access  Public
 */
router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    if (!slug || typeof slug !== "string") {
      return res.status(400).json({ error: "Slug khong hop le." });
    }

    const { rows } = await db.query(
      `
      SELECT
        news_category_id,
        news_category_name,
        news_category_slug,
        news_category_status
      FROM news_category
      WHERE news_category_slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Khong tim thay danh muc theo slug." });
    }

    const category = rows[0];

    return res.json({
      id: category.news_category_id,
      name: category.news_category_name,
      slug: category.news_category_slug,
      image: null,
      priority: null,
      status: category.news_category_status,
    });
  } catch (error) {
    return res.status(500).json({ error: "Loi may chu." });
  }
});

/**
 * @route   POST /api/news-categories
 * @desc    Tao danh muc tin tuc moi
 * @access  Private (Admin only)
 */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  const { name, status = 1, image, priority } = req.body;

  if (!name || typeof name !== "string") {
    return res
      .status(400)
      .json({ error: "Ten danh muc la bat buoc va phai la chuoi." });
  }

  const statusNumber = Number(status);
  if (![0, 1].includes(statusNumber)) {
    return res.status(400).json({ error: "Trang thai khong hop le." });
  }

  if (!image) {
    return res.status(400).json({ error: "Khong the upload danh muc tin khong co hinh anh" });
  }

  if (
    priority === undefined ||
    priority === "" ||
    Number.isNaN(Number(priority)) ||
    Number(priority) < 0
  ) {
    return res
      .status(400)
      .json({ error: "Do uu tien la bat buoc va phai la so >= 0." });
  }

  try {
    const slug = req.body.slug || generateSlug(name);

    const { rows: slugRows } = await db.query(
      "SELECT news_category_id FROM news_category WHERE news_category_slug = $1 LIMIT 1",
      [slug]
    );

    if (slugRows.length > 0) {
      return res.status(400).json({
        error: "Slug da ton tai, vui long nhap ten khac hoac chinh lai slug.",
      });
    }

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO news_category (
        news_category_name,
        news_category_slug,
        news_category_status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING news_category_id
      `,
      [name, slug, statusNumber]
    );

    return res.status(201).json({
      message: "Tao danh muc thanh cong",
      category: {
        id: insertedRows[0].news_category_id,
        name,
        slug,
        image,
        status: statusNumber,
        priority: Number(priority),
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Loi may chu khi tao danh muc" });
  }
});

router.put("/:id/status", verifyToken, isAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  const { status } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID danh muc khong hop le." });
  }

  const statusNumber = Number(status);
  if (![0, 1].includes(statusNumber)) {
    return res.status(400).json({ error: "Trang thai khong hop le. Chi chap nhan 0 hoac 1." });
  }

  try {
    const { rowCount } = await db.query(
      `
      UPDATE news_category
      SET news_category_status = $1, updated_at = NOW()
      WHERE news_category_id = $2
      `,
      [statusNumber, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Khong tim thay danh muc theo ID." });
    }

    return res.json({ message: "Cap nhat trang thai danh muc thanh cong." });
  } catch (error) {
    return res.status(500).json({ error: "Khong the cap nhat trang thai. Vui long thu lai." });
  }
});

/**
 * @route   PUT /api/news-categories/:slug
 * @desc    Cap nhat danh muc tin tuc
 * @access  Private (Admin only)
 */
router.put("/:slug", verifyToken, isAdmin, async (req, res) => {
  const { slug: oldSlug } = req.params;
  const { name, slug: newSlug, image = null, priority, status } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res
      .status(400)
      .json({ error: "Ten danh muc tin la bat buoc va phai la chuoi." });
  }

  if (!newSlug || typeof newSlug !== "string" || newSlug.trim() === "") {
    return res
      .status(400)
      .json({ error: "Slug moi la bat buoc va phai la chuoi." });
  }

  const statusNumber = Number(status);
  if (![0, 1].includes(statusNumber)) {
    return res.status(400).json({ error: "Trang thai khong hop le." });
  }

  const priorityNumber = Number(priority);
  if (Number.isNaN(priorityNumber) || priorityNumber < 0) {
    return res.status(400).json({ error: "Do uu tien khong hop le." });
  }

  try {
    const { rowCount } = await db.query(
      `
      UPDATE news_category
      SET
        news_category_name = $1,
        news_category_slug = $2,
        news_category_status = $3,
        updated_at = NOW()
      WHERE news_category_slug = $4
      `,
      [name.trim(), newSlug.trim(), statusNumber, oldSlug]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Khong tim thay danh muc theo slug." });
    }

    return res.json({
      message: "Cap nhat danh muc thanh cong.",
      category: {
        name: name.trim(),
        slug: newSlug.trim(),
        status: statusNumber,
        image,
        priority: priorityNumber,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Khong the cap nhat danh muc. Vui long thu lai." });
  }
});

/**
 * @route   DELETE /api/news-categories/:id
 * @desc    Xoa danh muc tin tuc
 * @access  Private (Admin only)
 */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const categoryId = parseId(req.params.id);
    if (!categoryId || categoryId <= 0) {
      return res.status(400).json({ error: "ID danh muc khong hop le" });
    }

    const { rows: categories } = await db.query(
      "SELECT news_category_id FROM news_category WHERE news_category_id = $1",
      [categoryId]
    );

    if (categories.length === 0) {
      return res.status(404).json({ error: "Khong tim thay danh muc" });
    }

    const { rows: usedRows } = await db.query(
      "SELECT COUNT(*)::int AS count FROM news WHERE news_category_id = $1",
      [categoryId]
    );

    if (usedRows[0].count > 0) {
      return res.status(400).json({
        error: `Khong the xoa danh muc nay vi co ${usedRows[0].count} bai viet dang su dung.`,
      });
    }

    await db.query("DELETE FROM news_category WHERE news_category_id = $1", [categoryId]);

    return res.json({ message: "Xoa danh muc thanh cong" });
  } catch (error) {
    return res.status(500).json({ error: "Khong the xoa danh muc" });
  }
});

// Tin tuc theo category
router.get("/news/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    const { rows: categoryRows } = await db.query(
      `
      SELECT news_category_id, news_category_name, news_category_slug
      FROM news_category
      WHERE news_category_slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (!categoryRows.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    const category = categoryRows[0];

    const { rows: newsRows } = await db.query(
      `
      SELECT
        news_id,
        news_image,
        news_slug,
        news_title,
        created_at
      FROM news
      WHERE news_category_id = $1 AND news_status = 1
      ORDER BY created_at DESC
      `,
      [category.news_category_id]
    );

    return res.json({
      news: newsRows,
      category: {
        id: category.news_category_id,
        name: category.news_category_name,
        slug: category.news_category_slug,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch news" });
  }
});

module.exports = router;
