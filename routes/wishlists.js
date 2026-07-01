const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/auth");

function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseStatus(rawStatus) {
  const status = Number.parseInt(rawStatus, 10);
  return [0, 1].includes(status) ? status : null;
}

function normalizeJson(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  return value;
}

const COMMENT_STATS_SQL = `
  (
    SELECT COUNT(*)::int
    FROM comment cm
    JOIN order_items oi ON cm.order_item_id = oi.order_item_id
    JOIN variant_product vp_cm ON oi.variant_id = vp_cm.variant_id
    WHERE vp_cm.product_id = p.product_id AND cm.deleted_at IS NULL
  ) AS comment_count,
  (
    SELECT ROUND(AVG(cm.comment_rating)::numeric, 1)
    FROM comment cm
    JOIN order_items oi ON cm.order_item_id = oi.order_item_id
    JOIN variant_product vp_cm ON oi.variant_id = vp_cm.variant_id
    WHERE vp_cm.product_id = p.product_id AND cm.deleted_at IS NULL
  ) AS average_rating
`;

/**
 * @route   GET /api/wishlists
 * @desc    Lay danh sach wishlist cua nguoi dung hien tai
 * @access  Private
 */
router.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const status = parseStatus(req.query.status);

  if (status === null) {
    return res.status(400).json({ error: "Trang thai khong hop le (phai la 0 hoac 1)" });
  }

  try {
    const { rows: items } = await db.query(
      `
      SELECT
        w.wishlist_id,
        w.quantity,
        w.status,
        w.created_at,

        v.variant_id,
        v.variant_product_price AS price,
        v.variant_product_price_sale AS price_sale,
        v.variant_product_list_image AS image,
        v.variant_product_quantity,

        c.color_id,
        c.color_name,
        c.color_code AS color_hex,

        p.product_id,
        p.product_name,
        p.product_slug AS slug,
        p.product_image AS product_image,
        p.category_id,

        cat.category_name AS category_name,

        (
          SELECT json_agg(
            json_build_object(
              'color_id', col.color_id,
              'color_name', col.color_name,
              'color_hex', col.color_code
            )
          )
          FROM variant_product vp2
          LEFT JOIN color col ON vp2.color_id = col.color_id
          WHERE vp2.product_id = p.product_id
        ) AS colors,

        ${COMMENT_STATS_SQL}
      FROM wishlist w
      JOIN variant_product v ON w.variant_id = v.variant_id
      JOIN product p ON v.product_id = p.product_id
      LEFT JOIN color c ON v.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      WHERE w.user_id = $1 AND w.status = $2
      ORDER BY w.created_at DESC
      `,
      [userId, status]
    );

    const result = items.map((item) => ({
      ...item,
      colors: normalizeJson(item.colors, []),
      isWishlist: true,
      average_rating: item.average_rating !== null ? Number(item.average_rating) : null,
    }));

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: "Loi khi lay du lieu gio hang/wishlist" });
  }
});

router.get("/wwww", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const status = parseStatus(req.query.status);

  if (status === null) {
    return res.status(400).json({ error: "Trang thai khong hop le (phai la 0 hoac 1)" });
  }

  try {
    const { rows: items } = await db.query(
      `
      SELECT
        w.wishlist_id,
        w.quantity,
        w.status,
        w.created_at,

        v.variant_id,
        v.variant_product_price AS price,
        v.variant_product_price_sale AS price_sale,
        v.variant_product_price_sale AS "priceSale",
        v.variant_product_list_image AS image,

        c.color_id,
        c.color_name,
        c.color_code AS color_hex,

        p.product_id,
        p.product_name AS name,
        p.product_slug AS slug,
        p.product_image AS product_image,
        p.category_id,

        (
          SELECT json_build_object(
            'id', cat.category_id,
            'name', cat.category_name
          )
          FROM category cat
          WHERE cat.category_id = p.category_id
        ) AS category,

        (
          SELECT json_agg(col.color_code)
          FROM variant_product vp2
          LEFT JOIN color col ON vp2.color_id = col.color_id
          WHERE vp2.product_id = p.product_id
        ) AS colors,

        ${COMMENT_STATS_SQL}
      FROM wishlist w
      JOIN variant_product v ON w.variant_id = v.variant_id
      JOIN product p ON v.product_id = p.product_id
      LEFT JOIN color c ON v.color_id = c.color_id
      WHERE w.user_id = $1 AND w.status = $2
      ORDER BY w.created_at DESC
      `,
      [userId, status]
    );

    const result = items.map((item) => ({
      ...item,
      colors: normalizeJson(item.colors, []),
      category: normalizeJson(item.category, {}),
      isWishlist: true,
      average_rating: item.average_rating !== null ? Number(item.average_rating) : null,
    }));

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: "Loi khi lay du lieu gio hang/wishlist" });
  }
});

router.get("/variant/:variantId", verifyToken, async (req, res) => {
  try {
    const variantId = parseId(req.params.variantId);
    const userId = req.user.id;

    if (!variantId) {
      return res.status(400).json({ error: "Invalid variant ID" });
    }

    const { rows: wishlistRows } = await db.query(
      `
      SELECT wishlist_id
      FROM wishlist
      WHERE variant_id = $1 AND user_id = $2 AND status = 1
      `,
      [variantId, userId]
    );

    return res.status(200).json({
      exists: wishlistRows.length > 0,
      wishlist_id: wishlistRows.length > 0 ? wishlistRows[0].wishlist_id : null,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to check variant in wishlist" });
  }
});

/**
 * @route   POST /api/wishlists
 * @desc    Them san pham vao wishlist
 * @access  Private
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { variant_id, status, quantity = 1 } = req.body;
    const userId = req.user.id;

    const parsedVariantId = parseId(variant_id);
    const parsedStatus = parseStatus(String(status));
    const parsedQuantity = Number(quantity);

    if (!parsedVariantId || (parsedStatus === 0 && parsedQuantity < 1)) {
      return res.status(400).json({ error: "Variant ID and valid quantity are required" });
    }

    if (parsedStatus === null) {
      return res.status(400).json({ error: "Invalid status: must be 0 (cart) or 1 (wishlist)" });
    }

    const { rows: variantRows } = await db.query(
      "SELECT variant_id FROM variant_product WHERE variant_id = $1",
      [parsedVariantId]
    );
    if (!variantRows.length) {
      return res.status(404).json({ error: "Variant not found" });
    }

    const { rows: existingRows } = await db.query(
      `
      SELECT wishlist_id, quantity
      FROM wishlist
      WHERE user_id = $1 AND variant_id = $2 AND status = $3
      `,
      [userId, parsedVariantId, parsedStatus]
    );

    if (parsedStatus === 1) {
      if (existingRows.length > 0) {
        return res.status(400).json({ error: "Variant already in wishlist" });
      }

      const { rows: insertedRows } = await db.query(
        `
        INSERT INTO wishlist (user_id, variant_id, status, created_at)
        VALUES ($1, $2, 1, NOW())
        RETURNING wishlist_id
        `,
        [userId, parsedVariantId]
      );

      const wishlistId = insertedRows[0].wishlist_id;

      const { rows: itemRows } = await db.query(
        `
        SELECT
          w.wishlist_id,
          w.quantity,
          w.created_at,
          v.*,
          ${COMMENT_STATS_SQL}
        FROM wishlist w
        JOIN variant_product v ON w.variant_id = v.variant_id
        JOIN product p ON v.product_id = p.product_id
        WHERE w.wishlist_id = $1
        `,
        [wishlistId]
      );

      return res.status(201).json({
        message: "Variant added to wishlist successfully",
        wishlistItem: itemRows[0],
      });
    }

    if (existingRows.length > 0) {
      const newQuantity = Number(existingRows[0].quantity) + parsedQuantity;

      await db.query(
        "UPDATE wishlist SET quantity = $1, updated_at = NOW() WHERE wishlist_id = $2",
        [newQuantity, existingRows[0].wishlist_id]
      );

      return res.status(200).json({ message: "Cart item updated successfully" });
    }

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO wishlist (user_id, variant_id, quantity, status, created_at)
      VALUES ($1, $2, $3, 0, NOW())
      RETURNING wishlist_id
      `,
      [userId, parsedVariantId, parsedQuantity]
    );

    const wishlistId = insertedRows[0].wishlist_id;

    const { rows: itemRows } = await db.query(
      `
      SELECT
        w.wishlist_id,
        w.quantity,
        w.created_at,
        v.*,
        ${COMMENT_STATS_SQL}
      FROM wishlist w
      JOIN variant_product v ON w.variant_id = v.variant_id
      JOIN product p ON v.product_id = p.product_id
      WHERE w.wishlist_id = $1
      `,
      [wishlistId]
    );

    return res.status(201).json({
      message: "Variant added to cart successfully",
      cartItem: itemRows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to process request" });
  }
});

/**
 * @route   PUT /api/wishlists/:id
 * @desc    Cap nhat so luong san pham trong gio hang
 * @access  Private
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const wishlistId = parseId(req.params.id);
    const { quantity } = req.body;
    const userId = req.user.id;

    if (!wishlistId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: "Du lieu khong hop le" });
    }

    const { rows: existingRows } = await db.query(
      `
      SELECT *
      FROM wishlist
      WHERE wishlist_id = $1 AND user_id = $2 AND status = 0
      `,
      [wishlistId, userId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "Khong tim thay san pham trong gio hang" });
    }

    await db.query(
      "UPDATE wishlist SET quantity = $1, updated_at = NOW() WHERE wishlist_id = $2",
      [quantity, wishlistId]
    );

    return res.status(200).json({ message: "Cap nhat so luong thanh cong" });
  } catch (error) {
    return res.status(500).json({ error: "Cap nhat so luong that bai" });
  }
});

/**
 * @route   DELETE /api/wishlists/clear
 * @desc    Xoa toan bo cart item (status = 0)
 * @access  Private
 */
router.delete("/clear", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query("DELETE FROM wishlist WHERE user_id = $1 AND status = 0", [userId]);

    return res.status(200).json({ message: "Da xoa cac san pham chua thanh toan khoi gio hang" });
  } catch (error) {
    return res.status(500).json({ error: "Da xay ra loi khi xoa gio hang" });
  }
});

router.delete("/clearid", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { selectedItemIds = [] } = req.body;

    if (!Array.isArray(selectedItemIds) || selectedItemIds.length === 0) {
      return res.status(400).json({ error: "Danh sach san pham can xoa khong hop le." });
    }

    const parsedIds = selectedItemIds
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isInteger(id));

    if (parsedIds.length === 0) {
      return res.status(400).json({ error: "Danh sach san pham can xoa khong hop le." });
    }

    await db.query(
      "DELETE FROM wishlist WHERE user_id = $1 AND status = 0 AND wishlist_id = ANY($2::int[])",
      [userId, parsedIds]
    );

    return res.status(200).json({ message: "Da xoa cac san pham da chon khoi gio hang" });
  } catch (error) {
    return res.status(500).json({ error: "Da xay ra loi khi xoa gio hang" });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const wishlistId = parseId(req.params.id);
    const userId = req.user.id;

    if (!wishlistId) {
      return res.status(400).json({ error: "Invalid wishlist ID" });
    }

    const { rows: existingRows } = await db.query(
      "SELECT wishlist_id FROM wishlist WHERE wishlist_id = $1 AND user_id = $2",
      [wishlistId, userId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "Wishlist item not found or not owned by user" });
    }

    await db.query("DELETE FROM wishlist WHERE wishlist_id = $1", [wishlistId]);

    return res.status(200).json({ message: "Xoa san pham thanh cong" });
  } catch (error) {
    return res.status(500).json({ error: "Da xay ra loi khi xoa san pham" });
  }
});

/**
 * @route   DELETE /api/wishlists/variant/:variantId
 * @desc    Xoa khoi wishlist theo variant_id
 * @access  Private
 */
router.delete("/variant/:variantId", verifyToken, async (req, res) => {
  try {
    const variantId = parseId(req.params.variantId);
    const userId = req.user.id;

    if (!variantId) {
      return res.status(400).json({ error: "Invalid variant ID" });
    }

    await db.query(
      "DELETE FROM wishlist WHERE variant_id = $1 AND user_id = $2 AND status = 1",
      [variantId, userId]
    );

    return res.status(200).json({ success: true, message: "Xoa wishlist thanh cong" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Loi server khi xoa" });
  }
});

router.delete("/product/:productId", verifyToken, async (req, res) => {
  try {
    const productId = parseId(req.params.productId);
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const { rows: wishlistRows } = await db.query(
      `
      SELECT w.wishlist_id
      FROM wishlist w
      JOIN variant_product vp ON w.variant_id = vp.variant_id
      WHERE vp.product_id = $1 AND w.user_id = $2
      LIMIT 1
      `,
      [productId, userId]
    );

    if (!wishlistRows.length) {
      return res.status(404).json({ error: "Product not found in wishlist" });
    }

    await db.query(
      `
      DELETE FROM wishlist w
      USING variant_product vp
      WHERE w.variant_id = vp.variant_id
        AND vp.product_id = $1
        AND w.user_id = $2
      `,
      [productId, userId]
    );

    return res.json({ message: "Product removed from wishlist successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to remove product from wishlist" });
  }
});

/**
 * @route   GET /api/wishlists/check/:productId
 * @desc    Kiem tra san pham co trong wishlist khong
 * @access  Private
 */
router.get("/check/:productId", verifyToken, async (req, res) => {
  try {
    const productId = parseId(req.params.productId);
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const { rows: wishlistRows } = await db.query(
      `
      SELECT w.wishlist_id
      FROM wishlist w
      JOIN variant_product vp ON w.variant_id = vp.variant_id
      WHERE vp.product_id = $1 AND w.user_id = $2
      LIMIT 1
      `,
      [productId, userId]
    );

    return res.json({
      in_wishlist: wishlistRows.length > 0,
      wishlist_id: wishlistRows.length > 0 ? wishlistRows[0].wishlist_id : null,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to check wishlist status" });
  }
});

module.exports = router;
