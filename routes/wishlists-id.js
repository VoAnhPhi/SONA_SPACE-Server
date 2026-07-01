const express = require("express");
const router = express.Router();
const db = require("../config/database");

/**
 * @route   GET /api/wishlists-id/:userId
 * @desc    Lay danh sach wishlist cua user theo user_id (Public API)
 * @access  Public
 */
router.get("/:userId", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const { rows: wishlists } = await db.query(
      `
      SELECT
        wl.wishlist_id,
        wl.status,
        wl.created_at,
        vp.variant_id,
        vp.product_id,
        p.product_name,
        vp.variant_product_price,
        vp.variant_product_price_sale,
        vp.variant_product_list_image,
        u.user_id,
        u.user_name,
        u.user_gmail,
        u.user_address
      FROM wishlist wl
      JOIN "user" u ON wl.user_id = u.user_id
      JOIN variant_product vp ON wl.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      WHERE wl.user_id = $1 AND wl.deleted_at IS NULL
      ORDER BY wl.created_at DESC
      `,
      [userId]
    );

    if (wishlists.length === 0) {
      return res.json({
        message: "No wishlist items found for this user",
        wishlists: [],
      });
    }

    return res.json({
      user_id: userId,
      wishlist_count: wishlists.length,
      wishlists,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch wishlists",
      details: error.message,
    });
  }
});

module.exports = router;
