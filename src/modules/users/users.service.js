"use strict";

const bcrypt = require("bcryptjs");
const db = require("../../config/database");
const cloudinary = require("../../config/cloudinary");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

// `requester` is req.user: { id, email, role }.

function requireUserId(rawId, message) {
  const userId = Number(rawId);
  if (isNaN(userId)) throw new HttpError(400, { error: message });
  return userId;
}

/** Only an admin or the user themselves may read or change a user's data. */
function requireSelfOrAdmin(requester, userId, message) {
  if (requester.role !== "admin" && requester.id !== userId) {
    throw new HttpError(403, { error: message });
  }
}

function formatPublicUser(row) {
  return {
    id: row.user_id,
    email: row.user_gmail,
    full_name: row.user_name,
    phone: row.user_number,
    address: row.user_address,
    role: row.user_role,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Paginated user list with optional search over email, name and phone (admin). */
function list(query) {
  return guard({ error: "Failed to fetch users" }, async () => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = query.search;

    let whereClause = "";
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClause = `WHERE user_gmail LIKE $${paramIndex++} OR user_name LIKE $${paramIndex++} OR user_number LIKE $${paramIndex++}`;
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }

    const { rows: countResult } = await db.query(
      `SELECT COUNT(*) as total FROM "user" ${whereClause}`,
      params
    );

    const totalUsers = countResult[0].total;
    const totalPages = Math.ceil(totalUsers / limit);

    const { rows: users } = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at
       FROM "user" ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return {
      users: users.map(formatPublicUser),
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        usersPerPage: limit,
      },
    };
  });
}

function listSimple() {
  return guard({ error: "Lỗi máy chủ khi lấy danh sách người dùng" }, async () => {
    const { rows: users } = await db.query(`
      SELECT user_id AS id, user_name AS name, user_gmail AS email
      FROM "user"
      WHERE user_role = 'user'
    `);
    return users;
  });
}

/** Admin user table with order counters; staff only see customers. */
function listForAdmin(requester) {
  return guard({ error: "Lỗi server khi lấy danh sách người dùng" }, async () => {
    let sqlQuery = `
      SELECT
        u.user_id,
        u.user_name,
        u.user_gmail,
        u.user_number,
        u.user_image,
        u.user_address,
        u.user_role,
        u.user_gender,
        u.user_birth,
        u.user_email_active,
        u.user_verified_at,
        u.user_disabled_at,
        u.created_at,
        u.updated_at,
        COUNT(CASE WHEN o.order_status = 4 THEN 1 END) AS total_success_orders,
        COUNT(CASE WHEN o.order_status = -1 THEN 1 END) AS total_cancelled_orders
      FROM "user" u
      LEFT JOIN orders o ON u.user_id = o.user_id
      WHERE u.deleted_at IS NULL
    `;

    let queryParams = [];

    const requestingUserRole = requester ? requester.role.toLowerCase().trim() : "guest";

    if (requestingUserRole === "staff") {
      sqlQuery += ` AND u.user_role = $1`;
      queryParams.push("user");
    } else if (requestingUserRole !== "admin") {
      throw new HttpError(403, {
        error: "Forbidden - Bạn không có quyền truy cập danh sách người dùng này.",
      });
    }

    sqlQuery += `
      GROUP BY u.user_id
      ORDER BY u.created_at DESC
    `;

    const { rows } = await db.query(sqlQuery, queryParams);

    const isValidDate = (date) => date instanceof Date && !isNaN(date);

    const users = rows.map((user) => {
      const birth = user.user_birth ? new Date(user.user_birth) : null;
      const createdAt = new Date(user.created_at);
      const updatedAt = new Date(user.updated_at);
      const disabledAt = user.user_disabled_at ? new Date(user.user_disabled_at) : null;
      const verifiedAt = user.user_verified_at ? new Date(user.user_verified_at) : null;

      return {
        id: user.user_id,
        name: user.user_name,
        email: user.user_gmail,
        phone: user.user_number,
        image: user.user_image,
        role: user.user_role,
        gender: user.user_gender,
        birth: birth ? birth.toLocaleDateString("vi-VN") : "",
        email_active: user.user_email_active,
        status: disabledAt ? "Vô hiệu" : "Hoạt động",
        created_at: isValidDate(createdAt) ? createdAt.toISOString() : null,
        updated_at: isValidDate(updatedAt) ? updatedAt.toISOString() : null,
        disabled_at: isValidDate(disabledAt) ? disabledAt.toISOString() : null,
        verified_at: isValidDate(verifiedAt) ? verifiedAt.toISOString() : null,

        total_success_orders: user.total_success_orders || 0,
        total_cancelled_orders: user.total_cancelled_orders || 0,
      };
    });

    return { users };
  });
}

function listStaff() {
  return guard({ error: "Lỗi server khi lấy danh sách người dùng" }, async () => {
    const { rows } = await db.query(`
      SELECT
        user_id,
        user_name,
        user_gmail,
        user_number,
        user_image,
        user_address,
        user_role,
        user_gender,
        user_birth,
        user_email_active,
        created_at,
        updated_at
      FROM "user"
      WHERE deleted_at IS NULL AND user_role = 'staff'
      ORDER BY created_at DESC
    `);

    const today = new Date();

    const users = rows.map((user) => {
      const createdAt = new Date(user.created_at);
      const birth = user.user_birth ? new Date(user.user_birth) : null;
      const diffDays = Math.floor((today - createdAt) / (1000 * 60 * 60 * 24));

      return {
        ...user,
        user_birth: birth ? birth.toLocaleDateString("vi-VN") : "",
        user_category: diffDays <= 30 ? "Khách hàng mới" : "Khách hàng cũ",
      };
    });

    return { users };
  });
}

function getForAdmin(rawId) {
  return guard({ error: "Lỗi server" }, async () => {
    const userId = requireUserId(rawId, "ID không hợp lệ");

    const { rows: users } = await db.query(
      `
      SELECT
        u.user_id, u.user_name, u.user_gmail, u.user_number, u.user_image, u.user_address,
        u.user_role, u.user_gender, u.user_birth, u.user_email_active, u.user_verified_at, u.user_disabled_at,
        u.created_at, u.updated_at,
        COUNT(CASE WHEN o.order_status = 4 THEN 1 END) AS total_success_orders,
        COUNT(CASE WHEN o.order_status = -1 THEN 1 END) AS total_cancelled_orders
      FROM "user" u
      LEFT JOIN orders o ON u.user_id = o.user_id
      WHERE u.user_id = $1 AND u.deleted_at IS NULL
      GROUP BY u.user_id
    `,
      [userId]
    );

    if (users.length === 0) {
      throw new HttpError(404, { error: "Không tìm thấy người dùng" });
    }

    const user = users[0];
    const today = new Date();
    const createdAt = new Date(user.created_at);
    const diffDays = Math.floor((today - createdAt) / (1000 * 60 * 60 * 24));

    const accountStatus = user.user_disabled_at ? "Vô hiệu" : "Hoạt động";
    const emailStatus = user.user_email_active ? "Kích hoạt" : "Chưa kích hoạt";

    return {
      id: user.user_id,
      full_name: user.user_name,
      email: user.user_gmail,
      phone: user.user_number,
      image: user.user_image,
      address: user.user_address,
      role: user.user_role,
      gender: user.user_gender,
      birth: user.user_birth,
      email_status: emailStatus,
      account_status: accountStatus,
      verified_at: user.user_verified_at,
      disabled_at: user.user_disabled_at || null,
      created_at: user.created_at,
      updated_at: user.updated_at,
      total_success_orders: user.total_success_orders || 0,
      total_cancelled_orders: user.total_cancelled_orders || 0,
      category: diffDays <= 30 ? "Khách hàng mới" : "Khách hàng cũ",
    };
  });
}

function avatarPublicId(imageUrl) {
  return `SonaSpace/User/${imageUrl.split("/").slice(-1)[0].split(".")[0]}`;
}

/** Admin/staff edit of a profile, with optional avatar upload; only an admin may change the role. */
function updateForAdmin(rawId, body, file, requester) {
  return guard((error) => ({ error: "Lỗi server", detail: error.message }), async () => {
    const userId = requireUserId(rawId, "ID không hợp lệ");

    const { rows: existingUsers } = await db.query(
      'SELECT user_role, user_image, user_name, user_number, user_gender, user_birth, user_address, user_verified_at, user_disabled_at FROM "user" WHERE user_id = $1',
      [userId]
    );

    if (existingUsers.length === 0) {
      throw new HttpError(404, { error: "Không tìm thấy người dùng" });
    }
    const existingUser = existingUsers[0];

    const {
      user_name,
      user_number,
      user_gender,
      user_birth,
      user_role,
      user_address,
      user_verified_at,
      user_disabled_at,
      remove_image,
    } = body;

    let finalUserRole = existingUser.user_role;

    if (user_role !== undefined && user_role !== null) {
      if (requester && requester.role && requester.role.toLowerCase().trim() === "admin") {
        finalUserRole = user_role;
      } else if (
        user_role.toLowerCase().trim() === existingUser.user_role.toLowerCase().trim()
      ) {
        finalUserRole = existingUser.user_role;
      } else {
        throw new HttpError(403, {
          error: "Chỉ quản trị viên mới được phép thay đổi quyền người dùng.",
        });
      }
    }

    let imageUrl;

    if (file) {
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(base64Image, {
        folder: "SonaSpace/User",
      });
      imageUrl = result.secure_url;

      const oldImage = existingUser.user_image;
      if (oldImage && oldImage !== imageUrl) {
        try {
          await cloudinary.uploader.destroy(avatarPublicId(oldImage));
        } catch (destroyError) {
          // An orphaned old avatar is not worth failing the update
        }
      }
    } else if (remove_image === "1") {
      if (existingUser.user_image) {
        try {
          await cloudinary.uploader.destroy(avatarPublicId(existingUser.user_image));
        } catch (destroyError) {
          // An orphaned old avatar is not worth failing the update
        }
      }
      imageUrl = null;
    } else {
      imageUrl = existingUser.user_image || null;
    }

    const { rowCount } = await db.query(
      `UPDATE "user" SET
          user_name = $1,
          user_number = $2,
          user_gender = $3,
          user_birth = $4,
          user_role = $5,
          user_address = $6,
          user_verified_at = $7,
          user_disabled_at = $8,
          user_image = $9,
          updated_at = NOW()
        WHERE user_id = $10`,
      [
        user_name !== undefined ? user_name : existingUser.user_name,
        user_number !== undefined ? user_number : existingUser.user_number,
        user_gender !== undefined ? user_gender : existingUser.user_gender,
        user_birth !== undefined ? user_birth : existingUser.user_birth,
        finalUserRole,
        user_address !== undefined ? user_address : existingUser.user_address,
        user_verified_at !== undefined ? user_verified_at : existingUser.user_verified_at,
        user_disabled_at !== undefined ? user_disabled_at : existingUser.user_disabled_at,
        imageUrl,
        userId,
      ]
    );

    if (rowCount === 0) {
      throw new HttpError(404, {
        error: "Không tìm thấy người dùng hoặc không có thay đổi nào được thực hiện.",
      });
    }

    return { message: "Cập nhật người dùng thành công" };
  });
}

function getById(rawId, requester) {
  return guard({ error: "Failed to fetch user" }, async () => {
    const userId = requireUserId(rawId, "Invalid user ID");
    requireSelfOrAdmin(requester, userId, "You do not have permission to view this user");

    const { rows: users } = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at
       FROM "user" WHERE user_id = $1`,
      [userId]
    );

    if (users.length === 0) {
      throw new HttpError(404, { error: "User not found" });
    }

    return formatPublicUser(users[0]);
  });
}

/** Self-service profile update; password and role are optional, and only an admin can set a role. */
function update(rawId, body, requester) {
  return guard({ error: "Failed to update user" }, async () => {
    const userId = requireUserId(rawId, "Invalid user ID");
    requireSelfOrAdmin(requester, userId, "You do not have permission to update this user");

    const { full_name, phone, address, password, role } = body;

    const { rows: existingUser } = await db.query('SELECT * FROM "user" WHERE user_id = $1', [
      userId,
    ]);

    if (existingUser.length === 0) {
      throw new HttpError(404, { error: "User not found" });
    }

    let updatedRole = existingUser[0].user_role;
    if (role && requester.role === "admin") {
      updatedRole = role;
    }

    const userName = full_name || existingUser[0].user_name;
    const userNumber = phone !== undefined ? phone : existingUser[0].user_number;
    const userAddress = address !== undefined ? address : existingUser[0].user_address;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await db.query(
        `UPDATE "user" SET
          user_name = $1,
          user_number = $2,
          user_address = $3,
          user_password = $4,
          user_role = $5,
          updated_at = NOW()
        WHERE user_id = $6`,
        [userName, userNumber, userAddress, hashedPassword, updatedRole, userId]
      );
    } else {
      await db.query(
        `UPDATE "user" SET
          user_name = $1,
          user_number = $2,
          user_address = $3,
          user_role = $4,
          updated_at = NOW()
        WHERE user_id = $5`,
        [userName, userNumber, userAddress, updatedRole, userId]
      );
    }

    const { rows: updatedUser } = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at
       FROM "user" WHERE user_id = $1`,
      [userId]
    );

    return {
      message: "User updated successfully",
      user: formatPublicUser(updatedUser[0]),
    };
  });
}

/** Users with orders are meant to be deactivated instead of deleted. */
function remove(rawId, requester) {
  return guard({ error: "Failed to delete user" }, async () => {
    const userId = requireUserId(rawId, "Invalid user ID");

    const { rows: existingUser } = await db.query('SELECT * FROM "user" WHERE user_id = $1', [
      userId,
    ]);

    if (existingUser.length === 0) {
      throw new HttpError(404, { error: "User not found" });
    }

    if (userId === requester.id) {
      throw new HttpError(400, { error: "Cannot delete your own account" });
    }

    const { rows: orders } = await db.query(
      "SELECT order_id FROM orders WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    if (orders.length > 0) {
      await db.query('UPDATE "user" SET user_email_active = false WHERE user_id = $1', [userId]);
      return {
        message: "User has been deactivated instead of deleted due to existing orders",
      };
    }

    await db.query("DELETE FROM wishlist WHERE user_id = $1", [userId]);
    await db.query("DELETE FROM comment WHERE user_id = $1", [userId]);
    await db.query('DELETE FROM "user" WHERE user_id = $1', [userId]);

    return { message: "User deleted successfully" };
  });
}

function listOrders(rawId, requester) {
  return guard({ error: "Failed to fetch user orders" }, async () => {
    const userId = requireUserId(rawId, "Invalid user ID");
    requireSelfOrAdmin(requester, userId, "You do not have permission to view these orders");

    const { rows: existingUser } = await db.query('SELECT user_id FROM "user" WHERE user_id = $1', [
      userId,
    ]);

    if (existingUser.length === 0) {
      throw new HttpError(404, { error: "User not found" });
    }

    const { rows: orders } = await db.query(
      `
      SELECT
        o.*,
        CASE o.order_status
          WHEN -1 THEN 'cancelled'
          WHEN 0 THEN 'pending'
          WHEN 1 THEN 'confirmed'
          WHEN 2 THEN 'shipping'
          WHEN 3 THEN 'delivered'
          WHEN 4 THEN 'completed'
          ELSE 'unknown'
        END AS status_name
      FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `,
      [userId]
    );

    for (let i = 0; i < orders.length; i++) {
      const { rows: payments } = await db.query(
        `
        SELECT *
        FROM payments
        WHERE payment_id = $1
      `,
        [orders[i].payment_id]
      );

      if (payments.length > 0) {
        orders[i].payment = payments[0];
      }

      const { rows: orderItems } = await db.query(
        `
        SELECT
          oi.*,
          vp.variant_product_price,
          vp.variant_product_price_sale,
          vp.variant_product_slug,
          vp.variant_product_list_image,
          p.product_id,
          p.product_name,
          p.product_image
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        WHERE oi.order_id = $1
      `,
        [orders[i].order_id]
      );

      orders[i].items = orderItems;
      orders[i].total_items = orderItems.length;
    }

    return orders;
  });
}

function listWishlist(rawId, requester) {
  return guard({ error: "Failed to fetch user wishlist" }, async () => {
    const userId = requireUserId(rawId, "Invalid user ID");
    requireSelfOrAdmin(requester, userId, "You do not have permission to view this wishlist");

    const { rows: wishlist } = await db.query(
      `
      SELECT
        w.wishlist_id,
        w.created_at,
        w.updated_at,
        vp.variant_id,
        vp.variant_product_quantity,
        vp.variant_product_price,
        vp.variant_product_price_sale,
        vp.variant_product_slug,
        vp.variant_product_list_image,
        p.*,
        (
          SELECT COUNT(*)
          FROM comment c
          JOIN order_items oi ON c.order_item_id = oi.order_item_id
          JOIN variant_product cvp ON oi.variant_id = cvp.variant_id
          WHERE cvp.product_id = p.product_id
        ) AS comment_count,
        (
          SELECT AVG(c.comment_rating)
          FROM comment c
          JOIN order_items oi ON c.order_item_id = oi.order_item_id
          JOIN variant_product cvp ON oi.variant_id = cvp.variant_id
          WHERE cvp.product_id = p.product_id
        ) AS average_rating
      FROM wishlist w
      JOIN variant_product vp ON w.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `,
      [userId]
    );

    return wishlist;
  });
}

function listReviews(rawId, requester) {
  return guard({ error: "Failed to fetch user reviews" }, async () => {
    const userId = requireUserId(rawId, "Invalid user ID");
    requireSelfOrAdmin(requester, userId, "You do not have permission to view these reviews");

    const { rows: reviews } = await db.query(
      `
      SELECT
        c.*,
        oi.order_id,
        oi.variant_id,
        p.product_name,
        p.product_image,
        COALESCE(vp.variant_product_price_sale, vp.variant_product_price) AS product_price
      FROM comment c
      JOIN order_items oi ON c.order_item_id = oi.order_item_id
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `,
      [userId]
    );

    return reviews;
  });
}

module.exports = {
  list,
  listSimple,
  listForAdmin,
  listStaff,
  getForAdmin,
  updateForAdmin,
  getById,
  update,
  remove,
  listOrders,
  listWishlist,
  listReviews,
};
