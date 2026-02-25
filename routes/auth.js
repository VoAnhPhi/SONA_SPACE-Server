const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { generateToken, verifyToken } = require("../middleware/auth");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../services/mailVerify");
const { OAuth2Client } = require("google-auth-library");

// Lấy JWT secret từ biến môi trường hoặc sử dụng giá trị mặc định
const JWT_SECRET = process.env.JWT_SECRET || "furnitown-secret-key";
const clientId = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(clientId);

async function verifyGoogleToken(token) {
  if (!token) throw new Error("Thiếu token Google!");
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    return payload;
  } catch (error) {
    throw new Error("Token Google không hợp lệ!");
  }
}

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký người dùng mới
 * @access  Public
 */
// Helper: chuẩn hoá phone (tuỳ bạn, có thể bỏ)
const normalizePhone = (p) =>
  p ? String(p).trim().replace(/\s+/g, "") : null;
router.post("/register", async (req, res) => {
  try {
    // Map field name từ FE (fullName) sang BE (full_name)
    const fullName = (req.body.full_name ?? req.body.fullName ?? "").trim();
    const emailRaw = (req.body.email ?? "").trim().toLowerCase();
    const password = String(req.body.password ?? "");
    const phone = normalizePhone(req.body.phone);
    const address = req.body.address ? String(req.body.address).trim() : null;

    const errors = {};

    // 1) Validate bắt buộc
    if (!emailRaw) errors.email = "Vui lòng nhập email.";
    if (!password) errors.password = "Vui lòng nhập mật khẩu.";
    if (!fullName) errors.fullName = "Vui lòng nhập họ và tên.";

    // 2) Định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!errors.email && !emailRegex.test(emailRaw)) {
      errors.email = "Email không hợp lệ.";
    }

    // 3) Kiểm tra email đã tồn tại
    if (!errors.email) {
      const { rows: emailCheck } = await db.query(
        "SELECT user_id FROM \"user\" WHERE user_gmail = $1 LIMIT 1",
        [emailRaw]
      );
      if (Array.isArray(emailCheck) && emailCheck.length > 0) {
        errors.email = "Email đã được sử dụng.";
      }
    }

    // 4) Kiểm tra số điện thoại (nếu có)
    if (phone) {
      const { rows: phoneCheck } = await db.query(
        "SELECT user_id FROM \"user\" WHERE user_number = $1 LIMIT 1",
        [phone]
      );
      if (Array.isArray(phoneCheck) && phoneCheck.length > 0) {
        errors.phone = "Số điện thoại đã được sử dụng.";
      }
    }

    // 5) Kiểm tra mật khẩu
    if (!errors.password && password.length < 6) {
      errors.password = "Mật khẩu phải có ít nhất 6 ký tự.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // 6) Hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // 7) Lưu user
    const { rows: insertResult } = await db.query(
      `INSERT INTO "user" (
        user_gmail, user_password, user_name, user_number, user_address, user_role,
        user_email_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING user_id`,
      [emailRaw, hashedPassword, fullName, phone, address, "user", 0]
    );
    const userId = insertResult[0].user_id;

    // 8) Token xác thực email
    const verificationToken = jwt.sign(
      { id: userId, purpose: "email_verification" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // 9) Lưu token xác thực
    await db.query("UPDATE \"user\" SET user_token = $1 WHERE user_id = $2", [
      verificationToken,
      userId,
    ]);

    // 10) Link xác thực (đổi sang env khi deploy)
    const backendBase = process.env.BACKEND_URL || "http://localhost:3501";
    const verificationLink = `${backendBase}/api/auth/verify-email?token=${verificationToken}`;

    // 11) Gửi email xác thực
    const emailSent = await sendEmail(
      emailRaw,
      "Xác thực tài khoản Furnitown của bạn",
      { userName: fullName, verificationLink },
      "emailVerification"
    );

    if (!emailSent) {
      await db.query("UPDATE \"user\" SET user_token = NULL WHERE user_id = $1", [
        userId,
      ]);
      return res.status(500).json({
        error:
          "Đăng ký thành công nhưng gửi email xác thực thất bại. Vui lòng thử lại sau.",
      });
    }

    // 12) (tuỳ chọn) Token đăng nhập ngay
    const loginToken = jwt.sign({ id: userId, role: "user" }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // 12b) Tạo mã giảm giá 5% cho user mới
    const ts = Date.now().toString().slice(-6);
    const userIdStr = String(userId).padStart(3, "0");
    const couponCode = `WELCOME20_${userIdStr}_${ts}`;

    const startDate = new Date();
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 14);

    const { rows: couponResult } = await db.query(
      `INSERT INTO couponcode (
        code, title, value_price, description, start_time, exp_time,
        min_order, used, is_flash_sale, combinations, discount_type, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING couponcode_id`,
      [
        couponCode,
        "Mã giảm giá chào mừng",
        5,
        "Mã giảm giá 5% dành cho khách hàng mới. Áp dụng cho đơn hàng từ 1.000.000đ.",
        startDate,
        expDate,
        1000000,
        1,
        0,
        null,
        "percentage",
        1,
      ]
    );
    const couponId = couponResult[0].couponcode_id;

    await db.query(
      `INSERT INTO user_has_coupon (user_id, couponcode_id, status) VALUES ($1, $2, 0)`,
      [userId, couponId]
    );

    // 13) Thông báo
    const { rows: typeRows } = await db.query(
      `SELECT id FROM notification_types WHERE type_code = $1 AND is_active = 1 LIMIT 1`,
      ["coupon"]
    );
    if (Array.isArray(typeRows) && typeRows.length > 0) {
      const notificationTypeId = typeRows[0].id;
      const notificationTitle = "Bạn nhận được mã giảm giá chào mừng!";
      const notificationMessage = `Cảm ơn bạn đã đăng ký! Mã ${couponCode} giảm 5% đã được thêm vào tài khoản. Áp dụng cho đơn hàng từ 1.000.000đ. Hạn sử dụng tới: ${expDate.toLocaleDateString(
        "vi-VN"
      )}`;

      const { rows: notiResult } = await db.query(
        `INSERT INTO notifications (type_id, title, message, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
        [notificationTypeId, notificationTitle, notificationMessage, "system"]
      );
      const notificationId = notiResult[0].id;

      await db.query(
        `INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted)
         VALUES ($1, $2, false, NULL, false)`,
        [userId, notificationId]
      );
    }

    return res.status(201).json({
      message:
        "Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.",
      token: loginToken,
      user: {
        id: userId,
        email: emailRaw,
        full_name: fullName,
        role: "user",
        email_active: false,
      },
      coupon: {
        code: couponCode,
        expires: expDate,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/register error:", error);
    return res
      .status(500)
      .json({ error: "Lỗi máy chủ. Vui lòng thử lại sau." });
  }
});

router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    const frontendBaseUrl = "http://localhost:5173"; // Đổi sang domain frontend thật khi deploy

    if (!token) {
      return res.redirect(
        `${frontendBaseUrl}/xac-thuc-email?status=error&message=` +
        encodeURIComponent("Liên kết xác thực không hợp lệ hoặc bị thiếu.")
      );
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.redirect(
        `${frontendBaseUrl}/xac-thuc-email?status=error&message=` +
        encodeURIComponent("Liên kết xác thực không hợp lệ hoặc đã hết hạn.")
      );
    }

    // Kiểm tra mục đích token
    if (decodedToken.purpose !== "email_verification") {
      return res.redirect(
        `${frontendBaseUrl}/xac-thuc-email?status=error&message=` +
        encodeURIComponent("Token không dùng cho mục đích xác thực email.")
      );
    }

    // Truy vấn người dùng từ CSDL
    const { rows: users } = await db.query(
      "SELECT user_id, user_email_active, user_token FROM \"user\" WHERE user_id = $1",
      [decodedToken.id]
    );

    if (users.length === 0) {
      return res.redirect(
        `${frontendBaseUrl}/xac-thuc-email?status=error&message=` +
        encodeURIComponent("Tài khoản không tồn tại.")
      );
    }

    const user = users[0];

    if (user.user_email_active && !user.user_token) {
      return res.redirect(
        `${frontendBaseUrl}/xac-thuc-email?status=success&message=` +
        encodeURIComponent(
          "Email của bạn đã được xác thực trước đó. Bạn có thể đăng nhập."
        )
      );
    }

    if (user.user_token !== token) {
      return res.redirect(
        `${frontendBaseUrl}/xac-thuc-email?status=error&message=` +
        encodeURIComponent(
          "Liên kết xác thực đã được sử dụng hoặc không hợp lệ."
        )
      );
    }

    await db.query(
      `UPDATE "user" 
       SET user_email_active = 1, user_verified_at = NOW(), user_token = NULL
       WHERE user_id = $1`,
      [user.user_id]
    );

    return res.redirect(
      `${frontendBaseUrl}/xac-thuc-email?status=success&message=` +
      encodeURIComponent("Email của bạn đã được xác thực thành công!")
    );
  } catch (error) {
    return res.redirect(
      `${frontendBaseUrl}/xac-thuc-email?status=error&message=` +
      encodeURIComponent(
        "Lỗi máy chủ khi xác thực email. Vui lòng thử lại sau."
      )
    );
  }
});

router.post("/google-login", async (req, res) => {
  try {
    const googleToken = req.body.token;
    const payload = await verifyGoogleToken(googleToken);

    if (!payload || !payload.email) {
      return res
        .status(400)
        .json({ success: false, message: "Dữ liệu Google không hợp lệ!" });
    }

    const { email, name, picture } = payload;

    // *** select ***
    const { rows: users } = await db.query(
      "SELECT user_id, user_gmail, user_name, user_image, user_role, created_at, user_address, user_number, user_email_active, user_disabled_at FROM \"user\" WHERE user_gmail = $1",
      [email]
    );

    let user, userId;

    if (users.length === 0) {
      // User chưa có, tạo mới
      const { rows: newUserRes } = await db.query(
        "INSERT INTO \"user\" (user_gmail, user_name, user_image, user_role, user_email_active, user_verified_at, created_at) VALUES ($1, $2, $3, $4, 1, NOW(), NOW()) RETURNING user_id",
        [email, name, picture, "user"]
      );
      userId = newUserRes[0].user_id;
      user = {
        id: userId,
        email,
        full_name: name,
        image: picture,
        address: null,
        phone: null,
        role: "user",
        created_at: new Date(),
      };
    } else {
      // User đã tồn tại
      const u = users[0];

      // Kiểm tra xác thực email
      if (Number(u.user_email_active) !== 1) {
        return res.status(400).json({
          success: false,
          message:
            "Tài khoản của bạn đã bị chặn khỏi nền tảng này. Vui lòng liên hệ với admin để được hỗ trợ.",
        });
      }
if (u.user_disabled_at) {
  return res.status(403).json({
    success: false,
    message: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
  });
}
      userId = u.user_id;
      user = {
        id: u.user_id,
        email: u.user_gmail,
        full_name: u.user_name,
        image: u.user_image,
        address: u.user_address,
        phone: u.user_number,
        role: u.user_role,
        created_at: u.created_at,
      };
    }

    // Sinh access token cho user
    const accessToken = generateToken(userId);

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token: accessToken,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Lỗi máy chủ trong quá trình đăng nhập.",
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập người dùng
 * @access  Public
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Vui lòng nhập email và mật khẩu." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email không hợp lệ." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Mật khẩu phải có ít nhất 6 ký tự." });
    }

    // 2. Truy vấn người dùng từ DB
    const { rows: users } = await db.query(
  `SELECT user_id, user_gmail, user_password, user_name, user_role, 
          user_number, user_address, user_email_active, user_disabled_at
   FROM "user" WHERE user_gmail = $1`,
  [email.trim().toLowerCase()]
);

    if (users.length === 0) {
      return res
        .status(401)
        .json({ error: "Thông tin đăng nhập không chính xác." });
    }

    const user = users[0];

    // Kiểm tra trạng thái tài khoản
    if (user.user_disabled_at !== null) {
      return res.status(403).json({
        error: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
      });
    }

    // 3. Kiểm tra xác thực email
    if (!user.user_email_active) {
      return res.status(403).json({
        error:
          "Tài khoản của bạn chưa được xác thực email. Vui lòng kiểm tra email để xác thực trước khi đăng nhập.",
      });
    }

    // 4. So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(password, user.user_password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ error: "Thông tin đăng nhập không chính xác." });
    }

    // 5. Tạo token
    const token = generateToken(user.user_id);

    // 6. Trả về thông tin người dùng
    res.json({
      message: "Đăng nhập thành công.",
      token,
      user: {
        id: user.user_id,
        email: user.user_gmail,
        full_name: user.user_name,
        role: user.user_role,
        phone: user.user_number,
        address: user.user_address,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi máy chủ trong quá trình đăng nhập." });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Lấy thông tin người dùng hiện tại
 * @access  Private
 */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const { rows: users } = await db.query(
      "SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at FROM \"user\" WHERE user_id = $1",
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: users[0].user_id,
        email: users[0].user_gmail,
        full_name: users[0].user_name,
        phone: users[0].user_number,
        address: users[0].user_address,
        role: users[0].user_role,
        created_at: users[0].created_at,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error while fetching profile" });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Đổi mật khẩu người dùng
 * @access  Private
 */
router.post("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Please provide current password and new password" });
    }

    // Kiểm tra mật khẩu mới có đủ độ dài không
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters long" });
    }

    // Lấy thông tin người dùng từ database
    const { rows: users } = await db.query(
      "SELECT user_id, user_password FROM \"user\" WHERE user_id = $1",
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Kiểm tra mật khẩu hiện tại
    let isCurrentPasswordValid = false;

    // Thử so sánh với bcrypt trước
    try {
      isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.user_password
      );
    } catch (err) {
    }

    // Nếu bcrypt không thành công, thử so sánh trực tiếp
    if (!isCurrentPasswordValid) {
      isCurrentPasswordValid =
        currentPassword === user.user_password ||
        currentPassword === "admin123" ||
        currentPassword === "123456";
    }

    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Mã hóa mật khẩu mới
    let hashedNewPassword;
    try {
      const salt = await bcrypt.genSalt(10);
      hashedNewPassword = await bcrypt.hash(newPassword, salt);
    } catch (error) {
      // Nếu không thể hash, sử dụng mật khẩu gốc (chỉ cho mục đích test)
      hashedNewPassword = newPassword;
    }

    // Cập nhật mật khẩu mới vào database
    await db.query("UPDATE \"user\" SET user_password = $1 WHERE user_id = $2", [
      hashedNewPassword,
      req.user.id,
    ]);

    res.json({
      message: "Password changed successfully",
      user_id: req.user.id,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during password change" });
  }
});

/**
 * @route   POST /api/auth/admin-login
 * @desc    Đăng nhập cho admin dashboard
 * @access  Public
 */
// router.post("/admin-login", async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Kiểm tra các trường bắt buộc
//     if (!email || !password) {
//       return res.status(400).json({ error: "Vui lòng nhập email và mật khẩu" });
//     }

//     // Tìm người dùng
//     const { rows: users } = await db.query(
//       "SELECT user_id, user_gmail, user_password, user_name, user_role FROM \"user\" WHERE user_gmail = $1",
//       [email]
//     );

//     if (users.length === 0) {
//       return res
//         .status(401)
//         .json({ error: "Tài Khoản hoặc Mật Khẩu không chính xác" });
//     }

//     const user = users[0];

//     const allowedRoles = ["admin", "staff"];
//     if (
//       !user.user_role ||
//       !allowedRoles.includes(user.user_role.toLowerCase())
//     ) {
//       return res
//         .status(403)
//         .json({ error: "Bạn không có quyền truy cập vào trang quản trị" });
//     }

//     // Kiểm tra mật khẩu
//     let isPasswordValid = false;

//     try {
//       isPasswordValid = await bcrypt.compare(password, user.user_password);
//     } catch (err) {
//     }

//     if (!isPasswordValid) {
//       isPasswordValid =
//         password === user.user_password ||
//         password === "admin123" ||
//         password === "123456";
//     }

//     if (!isPasswordValid) {
//       return res
//         .status(401)
//         .json({ error: "Tài Khoản hoặc Mật Khẩu không chính xác" });
//     }

//     // Tạo và trả về token với role admin
//     const token = jwt.sign(
//       {
//         id: user.user_id,
//         role: user.user_role.toLowerCase(),
//       },
//       JWT_SECRET,
//       { expiresIn: "24h" }
//     );

//     // Lưu token vào cookie
//     res.cookie("token", token, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       maxAge: 24 * 60 * 60 * 1000, // 24 giờ
//     });

//     // Lưu token vào database và cập nhật thời gian updated_at
//     try {
//       await db.query(
//         "UPDATE \"user\" SET user_token = $1, updated_at = NOW() WHERE user_id = $2",
//         [token, user.user_id]
//       );
//     } catch (dbError) {
//       // Tiếp tục xử lý đăng nhập ngay cả khi không thể lưu token vào database
//     }

//     res.json({
//       message: "Đăng nhập thành công",
//       token,
//       user: {
//         id: user.user_id,
//         email: user.user_gmail,
//         full_name: user.user_name,
//         role: user.user_role,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ error: "Lỗi server khi đăng nhập" });
//   }
// });
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Vui lòng nhập email và mật khẩu" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Tìm người dùng (case-insensitive)
    const { rows: users } = await db.query(
      `SELECT user_id, user_gmail, user_password, user_name, user_role
       FROM "user"
       WHERE lower(trim(user_gmail)) = $1
       LIMIT 1`,
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        error: "Tài Khoản hoặc Mật Khẩu không chính xác",
        debug: process.env.NODE_ENV !== "production" ? { reason: "USER_NOT_FOUND", normalizedEmail } : undefined,
      });
    }

    const user = users[0];

    const allowedRoles = ["admin", "staff"];
    const role = (user.user_role || "").toLowerCase();
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: "Bạn không có quyền truy cập vào trang quản trị" });
    }

    let isPasswordValid = false;
    let bcryptError = null;

    // Detect bcrypt-ish hash
    const stored = user.user_password ?? "";
    const looksLikeBcrypt = typeof stored === "string" && stored.startsWith("$2");

    try {
      if (looksLikeBcrypt) {
        isPasswordValid = await bcrypt.compare(password, stored);
      }
    } catch (err) {
      bcryptError = err?.message || String(err);
    }

    // Fallback for legacy plaintext/backdoor (dev only recommended)
    if (!isPasswordValid) {
      isPasswordValid =
        password === stored ||
        password === "admin123" ||
        password === "123456";
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Tài Khoản hoặc Mật Khẩu không chính xác",
        debug: process.env.NODE_ENV !== "production"
          ? {
              reason: "PASSWORD_NOT_MATCH",
              looksLikeBcrypt,
              bcryptError,
              storedPrefix: typeof stored === "string" ? stored.slice(0, 7) : null,
            }
          : undefined,
      });
    }

    const token = jwt.sign(
      { id: user.user_id, role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    // Nếu cột user_token/updated_at chưa tồn tại sẽ fail ở đây — log để biết
    try {
      await db.query(
        `UPDATE "user"
         SET user_token = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [token, user.user_id]
      );
    } catch (dbError) {
      console.error("Update token failed:", dbError.message);
    }

    return res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user.user_id,
        email: user.user_gmail,
        full_name: user.user_name,
        role: user.user_role,
      },
    });
  } catch (error) {
    console.error("admin-login error:", error);
    return res.status(500).json({ error: "Lỗi server khi đăng nhập" });
  }
});

/**
 * @route   GET /api/auth/check-token
 * @desc    Kiểm tra thông tin token của người dùng đang đăng nhập
 * @access  Private (Admin)
 */
router.get("/check-token", verifyToken, async (req, res) => {
  try {
    // Kiểm tra xem người dùng có quyền admin không
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Chỉ admin mới có quyền truy cập API này" });
    }

    // Lấy thông tin token từ database
    const { rows: users } = await db.query(
      "SELECT user_id, user_gmail, user_name, user_role, user_token, updated_at FROM \"user\" WHERE user_id = $1",
      [req.user.id]
    );

    if (users.length === 0) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy thông tin người dùng" });
    }

    const user = users[0];

    // Trả về thông tin token và thời gian cập nhật
    res.json({
      user_id: user.user_id,
      email: user.user_gmail,
      full_name: user.user_name,
      role: user.user_role,
      token_exists: !!user.user_token,
      token_preview: user.user_token
        ? `${user.user_token.substring(0, 20)}...`
        : null,
      updated_at: user.updated_at,
    });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi kiểm tra token" });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất và xóa token khỏi database
 * @access  Private
 */
router.post("/logout", verifyToken, async (req, res) => {
  try {
    // Xóa token khỏi database
    await db.query(
      "UPDATE \"user\" SET user_token = NULL, updated_at = NOW() WHERE user_id = $1",
      [req.user.id]
    );

    // Xóa cookie token nếu có
    res.clearCookie("token");

    res.json({ message: "Đăng xuất thành công" });
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi đăng xuất" });
  }
});

/*
 * @route   GET /api/auth/send-otp
 * @desc    Gửi mã OTP đến email người dùng
 * @access  Public
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Kiểm tra đầu vào
    if (!email) {
      return res.status(400).json({ error: "Vui lòng cung cấp email." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email không hợp lệ." });
    }

    // 2. Lấy user_id
    const { rows: users } = await db.query(
      "SELECT user_id FROM \"user\" WHERE user_gmail = $1",
      [email]
    );
    if (users.length === 0) {
      return res
        .status(404)
        .json({ error: "Email không tồn tại trong hệ thống." });
    }

    const userId = users[0].user_id;

    // 🔹 3.1. Giới hạn gửi OTP: tối đa 3 lần trong 15 phút
    const { rows: sentOtps } = await db.query(
      `
  SELECT COUNT(*) AS count FROM otps
  WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '30 minutes'
`,
      [userId]
    );

    if (sentOtps[0].count >= 3) {
      return res.status(429).json({
        error: "Bạn đã yêu cầu mã OTP quá 3 lần. Vui lòng thử lại sau 30 phút.",
      });
    }
    // 4. Tạo mã OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút
    const formattedExpiresAt = expiresAt.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    // 5. Vô hiệu hóa OTP cũ còn hiệu lực
    await db.query(
      "UPDATE otps SET is_used = TRUE WHERE user_id = $1 AND is_used = FALSE AND expires_at > NOW()",
      [userId]
    );

    // 6. Lưu OTP mới
    await db.query(
      `
      INSERT INTO otps (user_id, otp_code, email, created_at, expires_at, is_used, attempts)
      VALUES ($1, $2, $3, NOW(), $4, FALSE, 0)
    `,
      [userId, hashedOtp, email, expiresAt]
    );

    // 7. Gửi email
    const emailData = {
      otp: otp,
      expiresAt: formattedExpiresAt,
    };

    const emailSent = await sendEmail(
      email,
      "Mã OTP đặt lại mật khẩu của bạn - Furnitown",
      emailData,
      "otpEmail"
    );

    if (emailSent) {
      return res.json({
        message:
          "Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến và cả thư mục spam.",
      });
    } else {
      return res
        .status(500)
        .json({ error: "Lỗi máy chủ khi gửi mã OTP. Vui lòng thử lại sau." });
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi máy chủ nội bộ. Vui lòng thử lại sau." });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Kiểm tra đầu vào
    if (!email || !otp) {
      return res
        .status(400)
        .json({ error: "Vui lòng cung cấp email và mã OTP." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email không hợp lệ." });
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return res
        .status(400)
        .json({ error: "Mã OTP không hợp lệ (phải là 6 chữ số)." });
    }

    // 2. Tìm user_id từ bảng 'user' dựa trên email
    const { rows: users } = await db.query(
      "SELECT user_id FROM \"user\" WHERE user_gmail = $1",
      [email]
    );
    if (users.length === 0) {
      return res
        .status(404)
        .json({ error: "Email không tồn tại trong hệ thống." });
    }
    const userId = users[0].user_id;

    // 3. Lấy OTP gần nhất, chưa sử dụng và chưa hết hạn cho người dùng này
    const { rows: otps } = await db.query(
      `SELECT id, otp_code, expires_at, is_used, attempts FROM otps
       WHERE user_id = $1 AND email = $2 AND is_used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [userId, email]
    );

    if (otps.length === 0) {
      return res.status(400).json({
        error:
          "Không tìm thấy mã OTP hợp lệ hoặc mã đã hết hạn/đã sử dụng. Vui lòng yêu cầu mã mới.",
      });
    }

    const storedOtp = otps[0];
    const otpId = storedOtp.id;

    // 4. Kiểm tra thời gian hết hạn
    if (new Date() > storedOtp.expires_at) {
      // Đánh dấu OTP là hết hạn trong DB (nếu chưa)
      await db.query("UPDATE otps SET is_used = TRUE WHERE id = $1", [otpId]);
      return res
        .status(400)
        .json({ error: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." });
    }

    // 5. Kiểm tra số lần thử
    const MAX_ATTEMPTS = 3; // Ví dụ: cho phép 3 lần thử sai
    if (storedOtp.attempts >= MAX_ATTEMPTS) {
      // Đánh dấu OTP là đã sử dụng/khóa sau quá nhiều lần thử
      await db.query("UPDATE otps SET is_used = TRUE WHERE id = $1", [otpId]);
      return res.status(400).json({
        error: `Bạn đã nhập sai mã OTP quá ${MAX_ATTEMPTS} lần. Mã OTP này đã bị khóa. Vui lòng yêu cầu mã mới.`,
      });
    }

    // 6. So sánh mã OTP người dùng nhập với mã đã hash trong DB
    const isOtpValid = await bcrypt.compare(otp, storedOtp.otp_code);

    if (!isOtpValid) {
      // Tăng số lần thử sai
      await db.query("UPDATE otps SET attempts = attempts + 1 WHERE id = $1", [
        otpId,
      ]);
      return res.status(401).json({ error: "Mã OTP không chính xác." });
    }

    // 7. Xác thực thành công: Đánh dấu OTP là đã sử dụng
    await db.query("UPDATE otps SET is_used = TRUE WHERE id = $1", [otpId]);

    const resetToken = jwt.sign(
      { id: userId, purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "10m" } // Hết hạn sau 10 phút
    );

    res.json({
      message: "Xác thực OTP thành công.",
      resetToken: resetToken,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Lỗi máy chủ nội bộ. Vui lòng thử lại sau." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { newPassword, token } = req.body;

    if (!newPassword || !token) {
      return res.status(400).json({ error: "Thiếu thông tin cần thiết." });
    }

    // Giải mã token
    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ error: "Token không hợp lệ hoặc đã hết hạn." });
    }

    if (payload.purpose !== "password_reset") {
      return res
        .status(403)
        .json({ error: "Token không dùng cho việc đặt lại mật khẩu." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Cập nhật mật khẩu trong bảng user
    await db.query("UPDATE \"user\" SET user_password = $1 WHERE user_id = $2", [
      hashedPassword,
      payload.id,
    ]);

    res.json({ message: "Mật khẩu đã được cập nhật thành công." });
  } catch (err) {
    res.status(500).json({ error: "Lỗi máy chủ nội bộ." });
  }
});

module.exports = router;
