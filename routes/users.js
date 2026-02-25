const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { verifyToken, isAdmin, isAdminOnly } = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách người dùng (chỉ admin)
 * @access  Private (Admin)
 */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search;

    // Tìm kiếm người dùng nếu có tham số search
    let whereClause = "";
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClause =
        `WHERE user_gmail LIKE $${paramIndex++} OR user_name LIKE $${paramIndex++} OR user_number LIKE $${paramIndex++}`;
      params = [`%${search}%`, `%${search}%`, `%${search}%`];
    }

    // Đếm tổng số người dùng
    const { rows: countResult } = await db.query(
      `SELECT COUNT(*) as total FROM "user" ${whereClause}`,
      params
    );

    const totalUsers = countResult[0].total;
    const totalPages = Math.ceil(totalUsers / limit);

    // Lấy danh sách người dùng với phân trang
    const { rows: users } = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at 
       FROM "user" ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    // Định dạng lại kết quả
    const formattedUsers = users.map((user) => ({
      id: user.user_id,
      email: user.user_gmail,
      full_name: user.user_name,
      phone: user.user_number,
      address: user.user_address,
      role: user.user_role,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        usersPerPage: limit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
router.get("/simple", verifyToken, isAdmin, async (req, res) => {
  try {
    const { rows: users } = await db.query(`
      SELECT user_id AS id, user_name AS name, user_gmail AS email
      FROM "user"
      WHERE user_role = 'user'
    `);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Lỗi máy chủ khi lấy danh sách người dùng" });
  }
});

router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
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
        COUNT(CASE WHEN o.current_status = 'SUCCESS' THEN 1 END) AS total_success_orders,
        COUNT(CASE WHEN o.current_status = 'CANCELLED' THEN 1 END) AS total_cancelled_orders
      FROM "user" u
      LEFT JOIN orders o ON u.user_id = o.user_id
      WHERE u.deleted_at IS NULL
    `;

    let queryParams = [];

    const requestingUserRole = req.user
      ? req.user.role.toLowerCase().trim()
      : "guest";

    if (requestingUserRole === "staff") {
      sqlQuery += ` AND u.user_role = $1`;
      queryParams.push("user");
    } else if (requestingUserRole !== "admin") {
      return res.status(403).json({
        error:
          "Forbidden - Bạn không có quyền truy cập danh sách người dùng này.",
      });
    }

    sqlQuery += `
      GROUP BY u.user_id
      ORDER BY u.created_at DESC
    `;

    const { rows } = await db.query(sqlQuery, queryParams);

    const users = rows.map((user) => {
      const birth = user.user_birth ? new Date(user.user_birth) : null;
      const createdAt = new Date(user.created_at);
      const updatedAt = new Date(user.updated_at);
      const disabledAt = user.user_disabled_at
        ? new Date(user.user_disabled_at)
        : null;
      const verifiedAt = user.user_verified_at
        ? new Date(user.user_verified_at)
        : null;

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
        created_at:
          createdAt instanceof Date && !isNaN(createdAt)
            ? createdAt.toISOString()
            : null,
        updated_at:
          updatedAt instanceof Date && !isNaN(updatedAt)
            ? updatedAt.toISOString()
            : null,
        disabled_at:
          disabledAt instanceof Date && !isNaN(disabledAt)
            ? disabledAt.toISOString()
            : null,
        verified_at:
          verifiedAt instanceof Date && !isNaN(verifiedAt)
            ? verifiedAt.toISOString()
            : null,

        total_success_orders: user.total_success_orders || 0,
        total_cancelled_orders: user.total_cancelled_orders || 0,
      };
    });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi lấy danh sách người dùng" });
  }
});

router.get("/staff", async (req, res) => {
  try {
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
      const updatedAt = new Date(user.updated_at);
      const birth = user.user_birth ? new Date(user.user_birth) : null;
      const diffDays = Math.floor((today - createdAt) / (1000 * 60 * 60 * 24));

      return {
        ...user,
        user_birth: birth ? birth.toLocaleDateString("vi-VN") : "",
        user_category: diffDays <= 30 ? "Khách hàng mới" : "Khách hàng cũ",
      };
    });

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi lấy danh sách người dùng" });
  }
});

router.get("/admin/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "ID không hợp lệ" });
    }

    const { rows: users } = await db.query(
      `
      SELECT
        u.user_id, u.user_name, u.user_gmail, u.user_number, u.user_image, u.user_address,
        u.user_role, u.user_gender, u.user_birth, u.user_email_active, u.user_verified_at, u.user_disabled_at,
        u.created_at, u.updated_at,
        COUNT(CASE WHEN o.current_status = 'SUCCESS' THEN 1 END) AS total_success_orders,
        COUNT(CASE WHEN o.current_status = 'CANCELLED' THEN 1 END) AS total_cancelled_orders
      FROM "user" u
      LEFT JOIN orders o ON u.user_id = o.user_id
      WHERE u.user_id = $1 AND u.deleted_at IS NULL
      GROUP BY u.user_id
    `,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }

    const user = users[0];
    const today = new Date();
    const createdAt = new Date(user.created_at);
    const diffDays = Math.floor((today - createdAt) / (1000 * 60 * 60 * 24));

    // Determine account status based on user_disabled_at
    const accountStatus = user.user_disabled_at ? "Vô hiệu" : "Hoạt động";

    // Determine email status based on user_email_active
    const emailStatus = user.user_email_active ? "Kích hoạt" : "Chưa kích hoạt";

    res.json({
      id: user.user_id,
      full_name: user.user_name,
      email: user.user_gmail,
      phone: user.user_number,
      image: user.user_image,
      address: user.user_address,
      role: user.user_role,
      gender: user.user_gender,
      birth: user.user_birth,
      email_status: emailStatus, // Trạng thái kích hoạt email
      account_status: accountStatus, // Trạng thái tài khoản (hoạt động/vô hiệu)
      verified_at: user.user_verified_at,
      disabled_at: user.user_disabled_at || null, // Thay đổi "-" thành null nếu không có
      created_at: user.created_at,
      updated_at: user.updated_at,
      total_success_orders: user.total_success_orders || 0, // Đơn hàng đã mua
      total_cancelled_orders: user.total_cancelled_orders || 0, // Đơn hàng đã hủy
      category: diffDays <= 30 ? "Khách hàng mới" : "Khách hàng cũ",
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});
// router.put(
//   "/admin/:id",
//   verifyToken,
//   upload.single("image"),
//   async (req, res) => {
//     try {
//       const userId = Number(req.params.id);
//       if (isNaN(userId)) {
//         return res.status(400).json({ error: "ID không hợp lệ" });
//       }

//       const [existingUsers] = await db.query(
//         "SELECT user_role, user_image, user_name, user_number, user_gender, user_birth, user_address, user_email_active, user_verified_at, user_disabled_at FROM user WHERE user_id = ?",
//         [userId]
//       );

//       if (existingUsers.length === 0) {
//         return res.status(404).json({ error: "Không tìm thấy người dùng" });
//       }
//       const existingUser = existingUsers[0];

//       const {
//         user_name,
//         user_number,
//         user_gender,
//         user_birth,
//         user_role,
//         user_address,
//         user_email_active,
//         user_verified_at,
//         user_disabled_at,
//         remove_image,
//       } = req.body;

//       let finalUserRole = existingUser.user_role;

//       if (user_role !== undefined && user_role !== null) {
//         if (
//           req.user &&
//           req.user.role &&
//           req.user.role.toLowerCase().trim() === "admin"
//         ) {
//           finalUserRole = user_role;
//         } else {
//           if (
//             user_role.toLowerCase().trim() ===
//             existingUser.user_role.toLowerCase().trim()
//           ) {
//             finalUserRole = existingUser.user_role;
//           } else {
//             return res.status(403).json({
//               error:
//                 "Chỉ quản trị viên mới được phép thay đổi quyền người dùng.",
//             });
//           }
//         }
//       }

//       let imageUrl;

//       if (req.file) {
//         const base64Image = `data:${
//           req.file.mimetype
//         };base64,${req.file.buffer.toString("base64")}`;
//         const result = await cloudinary.uploader.upload(base64Image, {
//           folder: "SonaSpace/User",
//         });
//         imageUrl = result.secure_url;

//         const oldImage = existingUser.user_image;
//         if (oldImage && oldImage !== imageUrl) {
//           try {
//             const publicId = oldImage.split("/").slice(-1)[0].split(".")[0];
//             await cloudinary.uploader.destroy(`SonaSpace/User/${publicId}`);
//           } catch (destroyError) {}
//         }
//       } else if (remove_image === "1") {
//         if (existingUser.user_image) {
//           try {
//             const publicId = existingUser.user_image
//               .split("/")
//               .slice(-1)[0]
//               .split(".")[0];
//             await cloudinary.uploader.destroy(`SonaSpace/User/${publicId}`);
//           } catch (destroyError) {}
//         }
//         imageUrl = null;
//       } else {
//         imageUrl = existingUser.user_image || null;
//       }

//       const [updateResult] = await db.query(
//         `UPDATE user SET
//          user_name = ?,
//          user_number = ?,
//          user_gender = ?,
//          user_birth = ?,
//          user_role = ?,
//          user_address = ?,
//          user_email_active = ?,
//          user_verified_at = ?,
//          user_disabled_at = ?,
//          user_image = ?,
//          updated_at = NOW()
//        WHERE user_id = ?`,
//         [
//           user_name !== undefined ? user_name : existingUser.user_name,
//           user_number !== undefined ? user_number : existingUser.user_number,
//           user_gender !== undefined ? user_gender : existingUser.user_gender,
//           user_birth !== undefined ? user_birth : existingUser.user_birth,
//           finalUserRole,
//           user_address !== undefined ? user_address : existingUser.user_address,
//           user_email_active !== undefined
//             ? user_email_active
//             : existingUser.user_email_active,
//           user_verified_at !== undefined
//             ? user_verified_at
//             : existingUser.user_verified_at,
//           user_disabled_at !== undefined
//             ? user_disabled_at
//             : existingUser.user_disabled_at,
//           imageUrl,
//           userId,
//         ]
//       );

//       if (updateResult.affectedRows === 0) {
//         return res.status(404).json({
//           error:
//             "Không tìm thấy người dùng hoặc không có thay đổi nào được thực hiện.",
//         });
//       }

//       res.json({ message: "Cập nhật người dùng thành công" });
//     } catch (error) {
//       res.status(500).json({ error: "Lỗi server", detail: error.message });
//     }
//   }
// );
router.put(
  "/admin/:id",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const userId = Number(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "ID không hợp lệ" });
      }

      const { rows: existingUsers } = await db.query(
        "SELECT user_role, user_image, user_name, user_number, user_gender, user_birth, user_address, user_verified_at, user_disabled_at FROM \"user\" WHERE user_id = $1",
        [userId]
      );

      if (existingUsers.length === 0) {
        return res.status(404).json({ error: "Không tìm thấy người dùng" });
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
      } = req.body;

      let finalUserRole = existingUser.user_role;

      if (user_role !== undefined && user_role !== null) {
        if (
          req.user &&
          req.user.role &&
          req.user.role.toLowerCase().trim() === "admin"
        ) {
          finalUserRole = user_role;
        } else {
          if (
            user_role.toLowerCase().trim() ===
            existingUser.user_role.toLowerCase().trim()
          ) {
            finalUserRole = existingUser.user_role;
          } else {
            return res.status(403).json({
              error:
                "Chỉ quản trị viên mới được phép thay đổi quyền người dùng.",
            });
          }
        }
      }

      let imageUrl;

      if (req.file) {
        const base64Image = `data:${
          req.file.mimetype
        };base64,${req.file.buffer.toString("base64")}`;
        const result = await cloudinary.uploader.upload(base64Image, {
          folder: "SonaSpace/User",
        });
        imageUrl = result.secure_url;

        const oldImage = existingUser.user_image;
        if (oldImage && oldImage !== imageUrl) {
          try {
            const publicId = oldImage.split("/").slice(-1)[0].split(".")[0];
            await cloudinary.uploader.destroy(`SonaSpace/User/${publicId}`);
          } catch (destroyError) {}
        }
      } else if (remove_image === "1") {
        if (existingUser.user_image) {
          try {
            const publicId = existingUser.user_image
              .split("/")
              .slice(-1)[0]
              .split(".")[0];
            await cloudinary.uploader.destroy(`SonaSpace/User/${publicId}`);
          } catch (destroyError) {}
        }
        imageUrl = null;
      } else {
        imageUrl = existingUser.user_image || null;
      }

      const { rows: updateResult, rowCount } = await db.query(
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
          user_verified_at !== undefined
            ? user_verified_at
            : existingUser.user_verified_at,
          user_disabled_at !== undefined
            ? user_disabled_at
            : existingUser.user_disabled_at,
          imageUrl,
          userId,
        ]
      );

      if (rowCount === 0) {
        return res.status(404).json({
          error:
            "Không tìm thấy người dùng hoặc không có thay đổi nào được thực hiện.",
        });
      }

      res.json({ message: "Cập nhật người dùng thành công" });
    } catch (error) {
      res.status(500).json({ error: "Lỗi server", detail: error.message });
    }
  }
);
/**
 * @route   GET /api/users/:id
 * @desc    Lấy thông tin người dùng theo ID
 * @access  Private
 */
router.get("/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được xem thông tin
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view this user" });
    }

    const { rows: users } = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at 
       FROM "user" WHERE user_id = $1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Định dạng lại kết quả
    const user = {
      id: users[0].user_id,
      email: users[0].user_gmail,
      full_name: users[0].user_name,
      phone: users[0].user_number,
      address: users[0].user_address,
      role: users[0].user_role,
      created_at: users[0].created_at,
      updated_at: users[0].updated_at,
    };

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Cập nhật thông tin người dùng
 * @access  Private
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được cập nhật thông tin
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have permission to update this user" });
    }

    const { full_name, phone, address, password, role } = req.body;

    // Kiểm tra người dùng tồn tại
    const { rows: existingUser } = await db.query(
      "SELECT * FROM \"user\" WHERE user_id = $1",
      [userId]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Chỉ admin mới được cập nhật quyền
    let updatedRole = existingUser[0].user_role;
    if (role && req.user.role === "admin") {
      updatedRole = role;
    }

    // Tạo đối tượng chứa dữ liệu cập nhật
    const updateData = {
      user_name: full_name || existingUser[0].user_name,
      user_number: phone !== undefined ? phone : existingUser[0].user_number,
      user_address:
        address !== undefined ? address : existingUser[0].user_address,
      user_role: updatedRole,
      updated_at: new Date(),
    };

    // Cập nhật mật khẩu nếu có
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.user_password = await bcrypt.hash(password, salt);
    }

    // Cập nhật thông tin người dùng
    if (password) {
      await db.query(
        `UPDATE "user" SET
          user_name = $1,
          user_number = $2,
          user_address = $3,
          user_password = $4,
          user_role = $5,
          updated_at = NOW()
        WHERE user_id = $6`,
        [
          updateData.user_name,
          updateData.user_number,
          updateData.user_address,
          updateData.user_password,
          updateData.user_role,
          userId,
        ]
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
        [
          updateData.user_name,
          updateData.user_number,
          updateData.user_address,
          updateData.user_role,
          userId,
        ]
      );
    }

    // Lấy thông tin người dùng đã cập nhật
    const { rows: updatedUser } = await db.query(
      `SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at, updated_at 
       FROM "user" WHERE user_id = $1`,
      [userId]
    );

    // Định dạng lại kết quả
    const formattedUser = {
      id: updatedUser[0].user_id,
      email: updatedUser[0].user_gmail,
      full_name: updatedUser[0].user_name,
      phone: updatedUser[0].user_number,
      address: updatedUser[0].user_address,
      role: updatedUser[0].user_role,
      created_at: updatedUser[0].created_at,
      updated_at: updatedUser[0].updated_at,
    };

    res.json({
      message: "User updated successfully",
      user: formattedUser,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Xóa người dùng
 * @access  Private (Admin)
 */
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Kiểm tra người dùng tồn tại
    const { rows: existingUser } = await db.query(
      "SELECT * FROM \"user\" WHERE user_id = $1",
      [userId]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Không thể xóa chính mình
    if (userId === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    // Kiểm tra xem người dùng có đơn hàng không
    const { rows: orders } = await db.query(
      "SELECT order_id FROM orders WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    if (orders.length > 0) {
      // Nếu có đơn hàng, đánh dấu là không hoạt động thay vì xóa
      // Giả sử có cột user_email_active làm dấu hiệu cho hoạt động
      await db.query(
        "UPDATE \"user\" SET user_email_active = false WHERE user_id = $1",
        [userId]
      );
      return res.json({
        message:
          "User has been deactivated instead of deleted due to existing orders",
      });
    }

    // Xóa các bản ghi liên quan
    await db.query("DELETE FROM wishlist WHERE user_id = $1", [userId]);
    await db.query("DELETE FROM comment WHERE user_id = $1", [userId]);

    // Xóa người dùng
    await db.query("DELETE FROM \"user\" WHERE user_id = $1", [userId]);

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/**
 * @route   GET /api/users/:id/orders
 * @desc    Lấy danh sách đơn hàng của người dùng
 * @access  Private
 */
router.get("/:id/orders", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được xem đơn hàng
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view these orders" });
    }

    // Kiểm tra người dùng tồn tại
    const { rows: existingUser } = await db.query(
      "SELECT user_id FROM \"user\" WHERE user_id = $1",
      [userId]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Lấy danh sách đơn hàng
    const { rows: orders } = await db.query(
      `
      SELECT 
        o.*,
        os.order_status_name as status_name
      FROM orders o
      LEFT JOIN order_status os ON o.order_status_id = os.order_status_id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `,
      [userId]
    );

    // Lấy chi tiết cho mỗi đơn hàng
    for (let i = 0; i < orders.length; i++) {
      // Lấy thông tin thanh toán
      const { rows: payments } = await db.query(
        `
        SELECT * FROM payment WHERE order_id = $1
      `,
        [orders[i].order_id]
      );

      if (payments.length > 0) {
        orders[i].payment = payments[0];
      }

      // Lấy thông tin các sản phẩm trong đơn hàng
      const { rows: orderItems } = await db.query(
        `
        SELECT 
          oi.*,
          p.product_name,
          p.product_image
        FROM order_items oi
        LEFT JOIN product p ON oi.product_id = p.product_id
        WHERE oi.order_id = $1
      `,
        [orders[i].order_id]
      );

      orders[i].items = orderItems;
      orders[i].total_items = orderItems.length;
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user orders" });
  }
});

/**
 * @route   GET /api/users/:id/wishlist
 * @desc    Lấy danh sách wishlist của người dùng
 * @access  Private
 */
router.get("/:id/wishlist", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được xem wishlist
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view this wishlist" });
    }

    // Lấy danh sách wishlist với thông tin sản phẩm
    const { rows: wishlist } = await db.query(
      `
      SELECT 
        w.wishlist_id,
        w.created_at,
        w.updated_at,
        p.*,
        (SELECT COUNT(*) FROM comment WHERE product_id = p.product_id) as comment_count,
        (SELECT AVG(comment_rating) FROM comment WHERE product_id = p.product_id) as average_rating
      FROM wishlist w
      JOIN product p ON w.product_id = p.product_id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `,
      [userId]
    );

    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user wishlist" });
  }
});

/**
 * @route   GET /api/users/:id/reviews
 * @desc    Lấy danh sách đánh giá sản phẩm của người dùng
 * @access  Private
 */
router.get("/:id/reviews", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Kiểm tra quyền: chỉ admin hoặc chính người dùng đó mới được xem đánh giá
    if (req.user.role !== "admin" && req.user.id !== userId) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view these reviews" });
    }

    // Lấy danh sách đánh giá với thông tin sản phẩm
    const { rows: reviews } = await db.query(
      `
      SELECT 
        c.*,
        p.product_name,
        p.product_image,
        p.product_price
      FROM comment c
      JOIN product p ON c.product_id = p.product_id
      WHERE c.user_id = $1
      ORDER BY c.created_at DESC
    `,
      [userId]
    );

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user reviews" });
  }
});

module.exports = router;
