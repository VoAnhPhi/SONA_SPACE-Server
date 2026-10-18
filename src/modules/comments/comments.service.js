"use strict";

const db = require("../../config/database");
const { withTransaction } = require("../../shared/db/transaction");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

// Comments reach a product through order_item -> variant -> product
const COMMENT_PRODUCT_JOINS = `
  LEFT JOIN order_items oi ON c.order_item_id = oi.order_item_id
  LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
  LEFT JOIN product p ON vp.product_id = p.product_id
`;

function requireInteger(rawValue, message) {
  const value = Number(rawValue);
  if (!Number.isInteger(value)) throw new HttpError(400, { error: message });
  return value;
}

function paginate(query, defaultLimit) {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || defaultLimit;
  return { page, limit, offset: (page - 1) * limit };
}

function list(query) {
  return guard({ error: "Failed to fetch comments" }, async () => {
    const { page, limit, offset } = paginate(query, 10);
    const productId = query.product_id ? Number(query.product_id) : null;

    if (productId !== null && !Number.isInteger(productId)) {
      throw new HttpError(400, { error: "Invalid product ID" });
    }

    const whereClauses = ["c.deleted_at IS NULL"];
    const params = [];
    if (productId !== null) {
      params.push(productId);
      whereClauses.push(`vp.product_id = $${params.length}`);
    }

    const whereSql = whereClauses.join(" AND ");

    const { rows: countRows } = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM comment c
      ${COMMENT_PRODUCT_JOINS}
      WHERE ${whereSql}
      `,
      params
    );
    const totalComments = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalComments / limit);

    const listParams = [...params, limit, offset];
    const limitIndex = `$${params.length + 1}`;
    const offsetIndex = `$${params.length + 2}`;

    const { rows: comments } = await db.query(
      `
      SELECT
        c.comment_id,
        c.user_id,
        c.order_item_id,
        c.comment_content,
        c.comment_rating,
        c.comment_image,
        c.comment_status,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        p.product_id,
        p.product_name,
        p.product_slug
      FROM comment c
      ${COMMENT_PRODUCT_JOINS}
      WHERE ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT ${limitIndex} OFFSET ${offsetIndex}
      `,
      listParams
    );

    return {
      comments: comments.map((c) => ({
        ...c,
        comment_title: null,
        comment_description: c.comment_content,
        comment_reaction: null,
        user_name: `User ${c.user_id}`,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalComments,
        commentsPerPage: limit,
      },
    };
  });
}

/** Every visible comment with author, product and order (admin). */
function listForAdmin() {
  return guard({ error: "Loi may chu khi lay binh luan" }, async () => {
    const { rows } = await db.query(`
      SELECT
        c.comment_id,
        u.user_name,
        p.product_name,
        o.order_hash,
        c.comment_rating,
        NULL::text AS comment_title,
        c.comment_content AS comment_description,
        NULL::int AS comment_reaction,
        c.comment_status,
        c.created_at,
        c.updated_at,
        c.deleted_at,
        c.user_id,
        c.order_item_id,
        p.product_id
      FROM comment c
      LEFT JOIN "user" u ON c.user_id = u.user_id
      LEFT JOIN order_items oi ON c.order_item_id = oi.order_item_id
      LEFT JOIN orders o ON oi.order_id = o.order_id
      LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
      LEFT JOIN product p ON vp.product_id = p.product_id
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `);

    return rows;
  });
}

/** Admin moderation: set the status and/or soft-delete or restore. */
function moderate(rawId, body) {
  return guard({ error: "Failed to update comment status" }, async () => {
    const commentId = requireInteger(rawId, "Invalid comment ID");

    const { status, deleted } = body;
    const { rows: comments } = await db.query(
      "SELECT comment_id FROM comment WHERE comment_id = $1",
      [commentId]
    );
    if (!comments.length) {
      throw new HttpError(404, { error: "Comment not found" });
    }

    const updates = [];
    const values = [];

    if (status !== undefined) {
      values.push(status);
      updates.push(`comment_status = $${values.length}`);
    }

    if (deleted !== undefined) {
      values.push(deleted ? new Date() : null);
      updates.push(`deleted_at = $${values.length}`);
    }

    updates.push("updated_at = NOW()");

    if (updates.length === 1) {
      throw new HttpError(400, { error: "No update data provided" });
    }

    values.push(commentId);
    await db.query(
      `UPDATE comment SET ${updates.join(", ")} WHERE comment_id = $${values.length}`,
      values
    );

    const { rows: updated } = await db.query("SELECT * FROM comment WHERE comment_id = $1", [
      commentId,
    ]);

    return {
      message: "Comment updated successfully",
      comment: updated[0],
    };
  });
}

function getById(rawId) {
  return guard({ error: "Failed to fetch comment" }, async () => {
    const id = requireInteger(rawId, "Invalid comment ID");

    const { rows } = await db.query(
      `
      SELECT
        c.*,
        p.product_id,
        p.product_name,
        p.product_slug
      FROM comment c
      LEFT JOIN order_items oi ON c.order_item_id = oi.order_item_id
      LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
      LEFT JOIN product p ON vp.product_id = p.product_id
      WHERE c.comment_id = $1
      `,
      [id]
    );

    if (!rows.length) {
      throw new HttpError(404, { error: "Comment not found" });
    }

    return {
      ...rows[0],
      comment_title: null,
      comment_description: rows[0].comment_content,
      user_name: `User ${rows[0].user_id}`,
    };
  });
}

/** Reviews of one product with rating statistics. */
function listByProduct(rawProductId, query) {
  return guard({ error: "Failed to fetch product comments" }, async () => {
    const productId = requireInteger(rawProductId, "Invalid product ID");
    const { page, limit, offset } = paginate(query, 5);

    const { rows: products } = await db.query(
      "SELECT product_id FROM product WHERE product_id = $1",
      [productId]
    );
    if (!products.length) {
      throw new HttpError(404, { error: "Product not found" });
    }

    const { rows: countRows } = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM comment c
      JOIN order_items oi ON c.order_item_id = oi.order_item_id
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      WHERE vp.product_id = $1 AND c.deleted_at IS NULL
      `,
      [productId]
    );
    const totalComments = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalComments / limit);

    const { rows: ratingRows } = await db.query(
      `
      SELECT
        ROUND(AVG(c.comment_rating)::numeric, 1) AS average_rating,
        COUNT(*)::int AS total_ratings,
        SUM(CASE WHEN c.comment_rating = 5 THEN 1 ELSE 0 END)::int AS five_star,
        SUM(CASE WHEN c.comment_rating = 4 THEN 1 ELSE 0 END)::int AS four_star,
        SUM(CASE WHEN c.comment_rating = 3 THEN 1 ELSE 0 END)::int AS three_star,
        SUM(CASE WHEN c.comment_rating = 2 THEN 1 ELSE 0 END)::int AS two_star,
        SUM(CASE WHEN c.comment_rating = 1 THEN 1 ELSE 0 END)::int AS one_star
      FROM comment c
      JOIN order_items oi ON c.order_item_id = oi.order_item_id
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      WHERE vp.product_id = $1 AND c.deleted_at IS NULL
      `,
      [productId]
    );
    const ratingStats = ratingRows[0] || {};

    const { rows: comments } = await db.query(
      `
      SELECT
        c.comment_id,
        c.comment_content,
        c.comment_rating,
        c.comment_status,
        c.created_at,
        c.user_id,
        u.user_name,
        u.user_image
      FROM comment c
      JOIN "user" u ON c.user_id = u.user_id
      JOIN order_items oi ON c.order_item_id = oi.order_item_id
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      WHERE vp.product_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [productId, limit, offset]
    );

    return {
      product_id: productId,
      stats: {
        average_rating: Number(ratingStats.average_rating || 0),
        total_ratings: Number(ratingStats.total_ratings || 0),
        rating_breakdown: {
          five_star: Number(ratingStats.five_star || 0),
          four_star: Number(ratingStats.four_star || 0),
          three_star: Number(ratingStats.three_star || 0),
          two_star: Number(ratingStats.two_star || 0),
          one_star: Number(ratingStats.one_star || 0),
        },
      },
      comments: comments.map((c) => ({
        comment_id: c.comment_id,
        user_id: c.user_id,
        user_name: c.user_name,
        user_image: c.user_image,
        comment_title: null,
        comment_description: c.comment_content,
        comment_rating: c.comment_rating,
        comment_reaction: null,
        created_at: c.created_at,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalComments,
        commentsPerPage: limit,
      },
    };
  });
}

/** Comments of one user; `requester` is req.user. */
function listByUser(rawUserId, query, requester) {
  return guard({ error: "Failed to fetch user comments" }, async () => {
    const userId = requireInteger(rawUserId, "Invalid user ID");

    if (!requester.isAdmin && requester.id !== userId) {
      throw new HttpError(403, { error: "Unauthorized access to user comments" });
    }

    const { page, limit, offset } = paginate(query, 10);

    const { rows: countRows } = await db.query(
      "SELECT COUNT(*)::int AS total FROM comment WHERE user_id = $1 AND deleted_at IS NULL",
      [userId]
    );
    const totalComments = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalComments / limit);

    const { rows: comments } = await db.query(
      `
      SELECT
        c.*,
        p.product_name,
        p.product_slug,
        p.product_image AS product_thumbnail
      FROM comment c
      LEFT JOIN order_items oi ON c.order_item_id = oi.order_item_id
      LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
      LEFT JOIN product p ON vp.product_id = p.product_id
      WHERE c.user_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );

    return {
      user_id: userId,
      comments: comments.map((c) => ({
        ...c,
        comment_title: null,
        comment_description: c.comment_content,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalComments,
        commentsPerPage: limit,
      },
    };
  });
}

/** A customer reviews an item of one of their delivered/completed orders, once per product. */
function create(body, requester) {
  const { order_item_id, comment_title, comment_description, comment_rating } = body;
  const userId = requester.id;

  const failure = (error) => ({ error: "Failed to create comment", details: error.message });

  return guard(failure, async () => {
    if (!order_item_id || !comment_description || !comment_rating) {
      throw new HttpError(400, {
        error: "Missing required fields: order_item_id, comment_description, comment_rating",
      });
    }

    const rating = Number(comment_rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new HttpError(400, { error: "Rating must be between 1 and 5" });
    }

    // The checks only read; throwing before the insert rolls back nothing of substance
    const created = await withTransaction(async (client) => {
      const { rows: orderItemRows } = await client.query(
        `
        SELECT
          oi.order_item_id,
          oi.comment_id AS existing_comment_id,
          oi.variant_id,
          o.order_status,
          o.user_id AS order_user_id,
          vp.product_id AS linked_product_id
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.order_id
        JOIN variant_product vp ON oi.variant_id = vp.variant_id
        WHERE oi.order_item_id = $1
        LIMIT 1
        `,
        [order_item_id]
      );

      if (!orderItemRows.length) {
        throw new HttpError(404, { error: "Order item not found" });
      }

      const item = orderItemRows[0];
      if (Number(item.order_user_id) !== Number(userId)) {
        throw new HttpError(403, { error: "You cannot review this order item" });
      }
      if (![3, 4].includes(Number(item.order_status))) {
        throw new HttpError(400, {
          error: "Order item is not in delivered/completed order status",
        });
      }
      if (item.existing_comment_id !== null) {
        throw new HttpError(400, { error: "This order item is already reviewed" });
      }

      const { rows: existingProductComment } = await client.query(
        `
        SELECT c.comment_id
        FROM comment c
        JOIN order_items oi ON c.order_item_id = oi.order_item_id
        JOIN variant_product vp ON oi.variant_id = vp.variant_id
        WHERE c.user_id = $1 AND vp.product_id = $2 AND c.deleted_at IS NULL
        LIMIT 1
        `,
        [userId, item.linked_product_id]
      );
      if (existingProductComment.length > 0) {
        throw new HttpError(400, {
          error: "You already reviewed this product from another order item",
        });
      }

      const { rows: insertRows } = await client.query(
        `
        INSERT INTO comment (
          order_item_id,
          user_id,
          comment_content,
          comment_rating,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING comment_id
        `,
        [order_item_id, userId, comment_description, rating]
      );
      const newCommentId = insertRows[0].comment_id;

      await client.query(
        `
        UPDATE order_items
        SET comment_id = $1, updated_at = NOW()
        WHERE order_item_id = $2
        `,
        [newCommentId, order_item_id]
      );

      const { rows: createdRows } = await client.query(
        `
        SELECT
          c.*,
          u.user_name,
          u.user_image,
          vp.product_id AS reviewed_product_id,
          p.product_name AS reviewed_product_name
        FROM comment c
        JOIN "user" u ON c.user_id = u.user_id
        JOIN order_items oi ON c.order_item_id = oi.order_item_id
        JOIN variant_product vp ON oi.variant_id = vp.variant_id
        JOIN product p ON vp.product_id = p.product_id
        WHERE c.comment_id = $1
        `,
        [newCommentId]
      );

      return createdRows[0];
    });

    return {
      message: "Comment created successfully",
      comment: {
        ...created,
        comment_title: comment_title || null,
        comment_description: created.comment_content,
      },
    };
  });
}

function update(rawId, body, requester) {
  return guard({ error: "Failed to update comment" }, async () => {
    const commentId = requireInteger(rawId, "Invalid comment ID");

    const { content, rating, images } = body;

    const { rows: comments } = await db.query("SELECT * FROM comment WHERE comment_id = $1", [
      commentId,
    ]);
    if (!comments.length) {
      throw new HttpError(404, { error: "Comment not found" });
    }
    const comment = comments[0];

    if (!requester.isAdmin && requester.id !== comment.user_id) {
      throw new HttpError(403, { error: "You can only update your own comments" });
    }

    if (
      rating !== undefined &&
      (!Number.isFinite(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)
    ) {
      throw new HttpError(400, { error: "Rating must be a number between 1 and 5" });
    }

    const updates = [];
    const values = [];

    if (content !== undefined) {
      values.push(content);
      updates.push(`comment_content = $${values.length}`);
    }
    if (rating !== undefined) {
      values.push(Number(rating));
      updates.push(`comment_rating = $${values.length}`);
    }
    if (images !== undefined) {
      values.push(images ? JSON.stringify(images) : null);
      updates.push(`comment_image = $${values.length}`);
    }

    updates.push("updated_at = NOW()");
    if (updates.length === 1) {
      throw new HttpError(400, { error: "No update data provided" });
    }

    values.push(commentId);
    await db.query(
      `UPDATE comment SET ${updates.join(", ")} WHERE comment_id = $${values.length}`,
      values
    );

    const { rows: updatedRows } = await db.query("SELECT * FROM comment WHERE comment_id = $1", [
      commentId,
    ]);
    const updated = updatedRows[0];

    return {
      message: "Comment updated successfully",
      comment: {
        ...updated,
        comment_title: null,
        comment_description: updated.comment_content,
        user_name: `User ${updated.user_id}`,
        user_avatar: null,
      },
    };
  });
}

function remove(rawId, requester) {
  return guard({ error: "Failed to delete comment" }, async () => {
    const commentId = requireInteger(rawId, "Invalid comment ID");

    const { rows: comments } = await db.query("SELECT * FROM comment WHERE comment_id = $1", [
      commentId,
    ]);
    if (!comments.length) {
      throw new HttpError(404, { error: "Comment not found" });
    }

    const comment = comments[0];
    if (!requester.isAdmin && requester.id !== comment.user_id) {
      throw new HttpError(403, { error: "You can only delete your own comments" });
    }

    await db.query(
      "UPDATE comment SET deleted_at = NOW(), updated_at = NOW() WHERE comment_id = $1",
      [commentId]
    );

    return { message: "Comment deleted successfully" };
  });
}

function toggleStatus(rawId) {
  return guard({ error: "Failed to toggle comment status" }, async () => {
    const commentId = requireInteger(rawId, "Invalid comment ID");

    const { rows: comments } = await db.query(
      "SELECT comment_status FROM comment WHERE comment_id = $1",
      [commentId]
    );
    if (!comments.length) {
      throw new HttpError(404, { error: "Comment not found" });
    }

    const currentStatus = Number(comments[0].comment_status || 0);
    const newStatus = currentStatus === 1 ? 0 : 1;

    await db.query(
      "UPDATE comment SET comment_status = $1, updated_at = NOW() WHERE comment_id = $2",
      [newStatus, commentId]
    );

    return {
      message: "Comment status updated",
      comment_id: commentId,
      status: newStatus,
    };
  });
}

module.exports = {
  list,
  listForAdmin,
  moderate,
  getById,
  listByProduct,
  listByUser,
  create,
  update,
  remove,
  toggleStatus,
};
