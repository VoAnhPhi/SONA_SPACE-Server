const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

/**
 * @route   GET /filter/categories
 * @desc    Lấy danh sách danh mục
 * @access  Public
 */
router.get("/filter/", async (req, res) => {
  const { rows } = await db.query(`
    SELECT category_id, category_name, slug, category_icon
    FROM category
    WHERE category_status = 1
    ORDER BY category_priority ASC
  `);
  res.json(rows);
});

/**
 * @route   GET /api/categories
 * @desc    Lấy tất cả danh mục sản phẩm
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
      FROM category c WHERE category_status = 1
      ORDER BY c.category_priority ASC
    `;
    try {
      const { rows: categories } = await db.query(sql);
      return res.json(categories);
    } catch (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch categories", details: error.message });
  }
});

/**
 * @route   GET /api/categories/:slug
 * @desc    Lấy thông tin một danh mục theo slug
 * @access  Public
 */
router.get("/:slug", async (req, res) => {
  let slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });
  try {
    const sql = `
      SELECT
        c.*,
        c.slug,
        (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
      FROM category c
      WHERE c.slug = $1
    `;
    const { rows: category } = await db.query(sql, [slug]);

    if (!category || category.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(category[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

/**
 * @route   GET /api/categories/atts/:categoryId
 * @desc    Lấy thuộc tính danh mục theo ID danh mục
 * @access  Public
 */
router.get("/:categoryId", async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    if (!categoryId || isNaN(categoryId)) {
      return res
        .status(400)
        .json({ success: false, message: "ID danh mục không hợp lệ." });
    }

    const sql = `
      SELECT
        attribute_id,
        attribute_name,
        unit,
        is_required
      FROM attributes
      WHERE category_id = $1
      ORDER BY attribute_name ASC
    `;
    const { rows: attributes } = await db.query(sql, [categoryId]);

    res.status(200).json(attributes);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi lấy danh sách thuộc tính danh mục.",
    });
  }
});

/**
 * @route   GET /api/categories/admin/all
 * @desc    Lấy tất cả danh mục sản phẩm
 * @access  Private (Admin only)
 */
router.get("/admin/all", verifyToken, isAdmin, async (req, res) => {
  try {
    const sql = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM product WHERE category_id = c.category_id) as product_count
      FROM category c
      ORDER BY c.category_priority ASC
    `;
    try {
      const { rows: categories } = await db.query(sql);
      return res.json(categories);
    } catch (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch categories", details: error.message });
  }
});
/**
 * @route   GET /api/categories/:categoryId/attributes
 * @desc    Lấy thuộc tính danh mục theo ID danh mục (alternative path)
 * @access  Public
 */

/**
 * @route   POST /api/categories
 * @desc    Tạo danh mục mới
 * @access  Private (Admin only)
 */

router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { name, image, banner, slug, status, priority } = req.body;

    if (!name || !slug) {
      return res
        .status(400)
        .json({ error: "Category name and slug are required" });
    }

    // Kiểm tra tên danh mục đã tồn tại chưa
    const { rows: existingCategories } = await db.query(
      "SELECT category_id FROM category WHERE slug = $1",
      [slug]
    );

    if (existingCategories.length > 0) {
      return res.status(400).json({ error: "Category slug already exists" });
    }

    // Tạo danh mục mới
    await db.query(
      "INSERT INTO category (category_name, category_image, category_banner, category_status, category_priority, created_at, slug) VALUES ($1, $2, $3, $4, $5, NOW(), $6)",
      [
        name,
        image || null,
        banner || null,
        typeof status === "number" ? status : 1,
        typeof priority === "number" ? priority : 0,
        slug,
      ]
    );

    // Lấy thông tin danh mục vừa tạo
    const { rows: newCategory } = await db.query(
      "SELECT * FROM category WHERE slug = $1",
      [slug]
    );

    res.status(201).json({
      message: "Category created successfully",
      category: newCategory[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create category" });
  }
});

/**
 * @route   PUT /api/categories/:id
 * @desc    Cập nhật thông tin danh mục
 * @access  Private (Admin only)
 */

router.put("/:slug", verifyToken, isAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    const { name, image, banner, priority, status } = req.body;

    // 1. Kiểm tra danh mục tồn tại
    const { rows: oldData } = await db.query(
      "SELECT category_id, category_image, category_banner FROM category WHERE slug = $1",
      [slug]
    );
    if (!oldData.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    const categoryId = oldData[0].category_id;
    const oldImage = oldData[0].category_image;
    const oldBanner = oldData[0].category_banner;

    // 2. Kiểm tra tên mới có trùng không
    if (name) {
      const { rows: duplicateName } = await db.query(
        "SELECT category_id FROM category WHERE category_name = $1 AND slug != $2",
        [name, slug]
      );
      if (duplicateName.length > 0) {
        return res.status(400).json({ error: "Category name already exists" });
      }
    }

    // 3. Hàm xóa ảnh cũ nếu có
    const deleteFromCloudinary = async (url) => {
      if (!url) return;
      const publicId = url
        .split("/")
        .slice(7)
        .join("/")
        .replace(/\.(jpg|jpeg|png|webp)$/i, "");
      await cloudinary.uploader.destroy(publicId);
    };

    if (image && image !== oldImage) {
      await deleteFromCloudinary(oldImage);
    }

    if (banner && banner !== oldBanner) {
      await deleteFromCloudinary(oldBanner);
    }

    // 4. Cập nhật
    await db.query(
      `
      UPDATE category
      SET
        category_name = COALESCE($1, category_name),
        category_image = COALESCE($2, category_image),
        category_banner = COALESCE($3, category_banner),
        category_priority = COALESCE($4, category_priority),
        category_status = COALESCE($5, category_status),
        updated_at = NOW()
      WHERE slug = $6
      `,
      [
        name || null,
        image || null,
        banner || null,
        priority || 0,
        status ?? 1,
        slug,
      ]
    );

    const { rows: updatedCategory } = await db.query(
      "SELECT * FROM category WHERE slug = $1",
      [slug]
    );

    res.json({
      message: "Category updated successfully",
      category: updatedCategory[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update category" });
  }
});

/**
 * @route   DELETE /api/categories/:id
 * @desc    Xóa danh mục
 * @access  Private (Admin only)
 */

router.delete("/:slug", verifyToken, isAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    // Kiểm tra danh mục tồn tại
    const { rows: categoryData } = await db.query(
      "SELECT category_id, category_image, category_banner FROM category WHERE slug = $1",
      [slug]
    );

    if (!categoryData.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    const categoryId = categoryData[0].category_id;
    const { category_image, category_banner } = categoryData[0];

    // Kiểm tra xem danh mục có sản phẩm nào không
    const { rows: products } = await db.query(
      "SELECT product_id FROM product WHERE category_id = $1 ",
      [categoryId]
    );

    if (products.length > 0) {
      const productIds = products.map((p) => p.product_id).join(", ");
      return res.status(400).json({
        error:
          "Cannot delete category with products. Remove or reassign products first.",
        totalProducts: products.length,
        productIds: productIds,
      });
    }

    const deleteFromCloudinary = async (url) => {
      if (!url) return;
      const publicId = url
        .split("/")
        .slice(7)
        .join("/")
        .replace(/\.(jpg|jpeg|png|webp)$/i, "");
      await cloudinary.uploader.destroy(publicId);
    };

    deleteFromCloudinary(category_image);
    deleteFromCloudinary(category_banner);

    // Xóa danh mục
    await db.query("DELETE FROM category WHERE slug = $1", [slug]);

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

/**
 * @route   GET /api/categories/:id/products
 * @desc    Lấy tất cả sản phẩm thuộc một danh mục
 * @access  Public
 */
router.get("/:slug/products", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    const allowedSortFields = ["created_at", "updated_at", "product_name"];
    const sort_by = allowedSortFields.includes(req.query.sort_by)
      ? req.query.sort_by
      : "created_at";

    const sort_order =
      req.query.sort_order?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Kiểm tra danh mục
    const { rows: category } = await db.query(
      "SELECT category_id, category_name FROM category WHERE slug = $1",
      [slug]
    );

    if (!category.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    const categoryId = category[0].category_id;

    // Đếm tổng sản phẩm
    const { rows: countResult } = await db.query(
      "SELECT COUNT(*) as total FROM product WHERE category_id = $1",
      [categoryId]
    );

    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    // Query sản phẩm
    const { rows: products } = await db.query(
      `
       SELECT
  p.product_id AS id,
  p.product_name AS name,
  p.product_slug AS slug,
  p.product_image AS image,
  p.category_id,
  c.category_id,
  c.category_name,
  p.created_at,
  p.updated_at,

 (
  SELECT vp2.variant_product_price
  FROM variant_product vp2
  WHERE vp2.product_id = p.product_id
  ORDER BY vp2.variant_id ASC
  LIMIT 1
) AS price,
(
  SELECT vp2.variant_product_price_sale
  FROM variant_product vp2
  WHERE vp2.product_id = p.product_id
  ORDER BY vp2.variant_id ASC
  LIMIT 1
) AS price_sale,

  COALESCE(json_agg(DISTINCT col.color_hex) FILTER (WHERE col.color_hex IS NOT NULL), '[]') AS color_hex

        FROM product p
        LEFT JOIN category c ON p.category_id = c.category_id
        LEFT JOIN variant_product vp ON p.product_id = vp.product_id
        LEFT JOIN color col ON vp.color_id = col.color_id
        WHERE p.category_id = $1
        GROUP BY p.product_id, c.category_id, c.category_name
        ORDER BY p.${sort_by} ${sort_order}
        LIMIT $2 OFFSET $3
    `,
      [categoryId, limit, offset]
    );

    const transformedProducts = products.map((product) => {
      let colorHex = product.color_hex || [];

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        image: product.image,
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        price: product.price ?? "0.00",
        price_sale: product.price_sale ?? "0.00",
        color_hex: colorHex,
      };
    });

    res.json({
      category: category[0],
      products: transformedProducts,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        productsPerPage: limit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products by category" });
  }
});

/**
 * @route   GET /api/categories/by-product/:slug
 * @desc    Lấy danh sách danh mục theo sản phẩm
 * @access  Public
 */
router.get("/by-product/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug is required" });

  try {
    const { rows } = await db.query(
      `
      SELECT c.category_id, c.category_name, c.slug
      FROM category c
      JOIN product p ON c.category_id = p.category_id
      WHERE p.product_slug = $1
    `,
      [slug]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories by product" });
  }
});

module.exports = router;
