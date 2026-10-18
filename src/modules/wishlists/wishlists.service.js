"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

// One table serves both lists: status 0 is the shopping cart, status 1 is the wishlist.

// Positive or negative integers pass; the callers reject 0 through `!id`.
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

const ITEM_WITH_STATS_SQL = `
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
`;

function requireId(rawId, message) {
  const id = parseId(rawId);
  if (!id) throw new HttpError(400, { error: message });
  return id;
}

/** The current user's cart (status 0) or wishlist (status 1). */
function listForUser(userId, rawStatus) {
  const status = parseStatus(rawStatus);

  if (status === null) {
    throw new HttpError(400, { error: "Trang thai khong hop le (phai la 0 hoac 1)" });
  }

  return guard({ error: "Loi khi lay du lieu gio hang/wishlist" }, async () => {
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

    return items.map((item) => ({
      ...item,
      colors: normalizeJson(item.colors, []),
      isWishlist: true,
      average_rating: item.average_rating !== null ? Number(item.average_rating) : null,
    }));
  });
}

function hasVariant(rawVariantId, userId) {
  return guard({ error: "Failed to check variant in wishlist" }, async () => {
    const variantId = requireId(rawVariantId, "Invalid variant ID");

    const { rows: wishlistRows } = await db.query(
      `
      SELECT wishlist_id
      FROM wishlist
      WHERE variant_id = $1 AND user_id = $2 AND status = 1
      `,
      [variantId, userId]
    );

    return {
      exists: wishlistRows.length > 0,
      wishlist_id: wishlistRows.length > 0 ? wishlistRows[0].wishlist_id : null,
    };
  });
}

/**
 * Add a variant to the wishlist (status 1) or the cart (status 0, quantity adds up).
 * Resolves to { status, body } because the success code differs: 201 new row, 200 cart increase.
 */
function add(body, userId) {
  return guard({ error: "Failed to process request" }, async () => {
    const { variant_id, status, quantity = 1 } = body;

    const parsedVariantId = parseId(variant_id);
    const parsedStatus = parseStatus(String(status));
    const parsedQuantity = Number(quantity);

    if (!parsedVariantId || (parsedStatus === 0 && parsedQuantity < 1)) {
      throw new HttpError(400, { error: "Variant ID and valid quantity are required" });
    }

    if (parsedStatus === null) {
      throw new HttpError(400, { error: "Invalid status: must be 0 (cart) or 1 (wishlist)" });
    }

    const { rows: variantRows } = await db.query(
      "SELECT variant_id FROM variant_product WHERE variant_id = $1",
      [parsedVariantId]
    );
    if (!variantRows.length) {
      throw new HttpError(404, { error: "Variant not found" });
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
        throw new HttpError(400, { error: "Variant already in wishlist" });
      }

      const { rows: insertedRows } = await db.query(
        `
        INSERT INTO wishlist (user_id, variant_id, status, created_at)
        VALUES ($1, $2, 1, NOW())
        RETURNING wishlist_id
        `,
        [userId, parsedVariantId]
      );

      const { rows: itemRows } = await db.query(ITEM_WITH_STATS_SQL, [insertedRows[0].wishlist_id]);

      return {
        status: 201,
        body: {
          message: "Variant added to wishlist successfully",
          wishlistItem: itemRows[0],
        },
      };
    }

    if (existingRows.length > 0) {
      const newQuantity = Number(existingRows[0].quantity) + parsedQuantity;

      await db.query(
        "UPDATE wishlist SET quantity = $1, updated_at = NOW() WHERE wishlist_id = $2",
        [newQuantity, existingRows[0].wishlist_id]
      );

      return { status: 200, body: { message: "Cart item updated successfully" } };
    }

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO wishlist (user_id, variant_id, quantity, status, created_at)
      VALUES ($1, $2, $3, 0, NOW())
      RETURNING wishlist_id
      `,
      [userId, parsedVariantId, parsedQuantity]
    );

    const { rows: itemRows } = await db.query(ITEM_WITH_STATS_SQL, [insertedRows[0].wishlist_id]);

    return {
      status: 201,
      body: {
        message: "Variant added to cart successfully",
        cartItem: itemRows[0],
      },
    };
  });
}

function updateCartQuantity(rawId, body, userId) {
  return guard({ error: "Cap nhat so luong that bai" }, async () => {
    const wishlistId = parseId(rawId);
    const { quantity } = body;

    if (!wishlistId || !Number.isInteger(quantity) || quantity < 1) {
      throw new HttpError(400, { error: "Du lieu khong hop le" });
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
      throw new HttpError(404, { error: "Khong tim thay san pham trong gio hang" });
    }

    await db.query(
      "UPDATE wishlist SET quantity = $1, updated_at = NOW() WHERE wishlist_id = $2",
      [quantity, wishlistId]
    );

    return { message: "Cap nhat so luong thanh cong" };
  });
}

function clearCart(userId) {
  return guard({ error: "Da xay ra loi khi xoa gio hang" }, async () => {
    await db.query("DELETE FROM wishlist WHERE user_id = $1 AND status = 0", [userId]);

    return { message: "Da xoa cac san pham chua thanh toan khoi gio hang" };
  });
}

function clearSelectedCartItems(body, userId) {
  return guard({ error: "Da xay ra loi khi xoa gio hang" }, async () => {
    const { selectedItemIds = [] } = body;

    if (!Array.isArray(selectedItemIds) || selectedItemIds.length === 0) {
      throw new HttpError(400, { error: "Danh sach san pham can xoa khong hop le." });
    }

    const parsedIds = selectedItemIds
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isInteger(id));

    if (parsedIds.length === 0) {
      throw new HttpError(400, { error: "Danh sach san pham can xoa khong hop le." });
    }

    await db.query(
      "DELETE FROM wishlist WHERE user_id = $1 AND status = 0 AND wishlist_id = ANY($2::int[])",
      [userId, parsedIds]
    );

    return { message: "Da xoa cac san pham da chon khoi gio hang" };
  });
}

function removeById(rawId, userId) {
  return guard({ error: "Da xay ra loi khi xoa san pham" }, async () => {
    const wishlistId = requireId(rawId, "Invalid wishlist ID");

    const { rows: existingRows } = await db.query(
      "SELECT wishlist_id FROM wishlist WHERE wishlist_id = $1 AND user_id = $2",
      [wishlistId, userId]
    );

    if (!existingRows.length) {
      throw new HttpError(404, { error: "Wishlist item not found or not owned by user" });
    }

    await db.query("DELETE FROM wishlist WHERE wishlist_id = $1", [wishlistId]);

    return { message: "Xoa san pham thanh cong" };
  });
}

function removeByVariant(rawVariantId, userId) {
  return guard({ success: false, message: "Loi server khi xoa" }, async () => {
    const variantId = requireId(rawVariantId, "Invalid variant ID");

    await db.query(
      "DELETE FROM wishlist WHERE variant_id = $1 AND user_id = $2 AND status = 1",
      [variantId, userId]
    );

    return { success: true, message: "Xoa wishlist thanh cong" };
  });
}

function removeByProduct(rawProductId, userId) {
  return guard({ error: "Failed to remove product from wishlist" }, async () => {
    const productId = requireId(rawProductId, "Invalid product ID");

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
      throw new HttpError(404, { error: "Product not found in wishlist" });
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

    return { message: "Product removed from wishlist successfully" };
  });
}

function checkProduct(rawProductId, userId) {
  return guard({ error: "Failed to check wishlist status" }, async () => {
    const productId = requireId(rawProductId, "Invalid product ID");

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

    return {
      in_wishlist: wishlistRows.length > 0,
      wishlist_id: wishlistRows.length > 0 ? wishlistRows[0].wishlist_id : null,
    };
  });
}

function isPrivilegedUser(user) {
  const role = user?.role?.toLowerCase();
  return role === "admin" || role === "staff" || Boolean(user?.isAdmin);
}

/** Wishlist rows of any user with their contact details; owner, admin or staff only. */
function listByUserId(rawUserId, requester) {
  return guard((error) => ({ error: "Failed to fetch wishlists", details: error.message }), async () => {
    const userId = Number.parseInt(rawUserId, 10);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new HttpError(400, { error: "Invalid user ID" });
    }

    if (!isPrivilegedUser(requester) && Number(requester.id) !== userId) {
      throw new HttpError(403, { error: "You do not have permission to view this wishlist" });
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
      return {
        message: "No wishlist items found for this user",
        wishlists: [],
      };
    }

    return {
      user_id: userId,
      wishlist_count: wishlists.length,
      wishlists,
    };
  });
}

module.exports = {
  listForUser,
  hasVariant,
  add,
  updateCartQuantity,
  clearCart,
  clearSelectedCartItems,
  removeById,
  removeByVariant,
  removeByProduct,
  checkProduct,
  listByUserId,
};
