"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../config/database");
const { generateToken } = require("../../shared/middleware/auth");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { sendEmail } = require("../../shared/mail/verification.mail");
const { authenticateGoogleUser, GoogleAuthError } = require("./google-auth.service");

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getFrontendBaseUrl = () =>
  (
    process.env.SITE_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.VITE_APP_URL ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");

const normalizePhone = (p) => (p ? String(p).trim().replace(/\s+/g, "") : null);

/** Creates the account, mails a verification link and gives the new user a welcome coupon. */
function register(body) {
  const failure = (error) => {
    console.error("POST /api/auth/register error:", error);
    return { error: "Server error. Please try again later." };
  };

  return guard(failure, async () => {
    const fullName = (body.full_name ?? body.fullName ?? "").trim();
    const emailRaw = (body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const phone = normalizePhone(body.phone);
    const address = body.address ? String(body.address).trim() : null;
    const errors = {};

    if (!emailRaw) errors.email = "Please enter email.";
    if (!password) errors.password = "Please enter password.";
    if (!fullName) errors.fullName = "Please enter full name.";

    if (!errors.email && !EMAIL_REGEX.test(emailRaw)) {
      errors.email = "Invalid email format.";
    }

    if (!errors.email) {
      const { rows: emailCheck } = await db.query(
        'SELECT user_id FROM "user" WHERE lower(trim(user_gmail)) = $1 LIMIT 1',
        [emailRaw]
      );
      if (Array.isArray(emailCheck) && emailCheck.length > 0) {
        errors.email = "Email is already in use.";
      }
    }

    if (phone) {
      const { rows: phoneCheck } = await db.query(
        'SELECT user_id FROM "user" WHERE user_number = $1 LIMIT 1',
        [phone]
      );
      if (Array.isArray(phoneCheck) && phoneCheck.length > 0) {
        errors.phone = "Phone number is already in use.";
      }
    }

    if (!errors.password && password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(errors).length > 0) {
      throw new HttpError(400, { errors });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows: insertResult } = await db.query(
      `INSERT INTO "user" (
        user_gmail, user_password, user_name, user_number, user_address, user_role,
        user_email_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING user_id`,
      [emailRaw, hashedPassword, fullName, phone, address, "user", 0]
    );
    const userId = insertResult[0].user_id;

    const verificationToken = jwt.sign({ id: userId, purpose: "email_verification" }, JWT_SECRET, {
      expiresIn: "24h",
    });
    await db.query('UPDATE "user" SET user_token = $1 WHERE user_id = $2', [verificationToken, userId]);

    const backendBase = process.env.BACKEND_URL || "http://localhost:3501";
    const verificationLink = `${backendBase}/api/auth/verify-email?token=${verificationToken}`;
    const emailSent = await sendEmail(
      emailRaw,
      "Verify your Furnitown account",
      { userName: fullName, verificationLink },
      "emailVerification"
    );

    if (!emailSent) {
      await db.query('UPDATE "user" SET user_token = NULL WHERE user_id = $1', [userId]);
      throw new HttpError(500, {
        error: "Registration succeeded but verification email failed to send. Please try again later.",
      });
    }

    const loginToken = jwt.sign({ id: userId, role: "user" }, JWT_SECRET, { expiresIn: "7d" });

    const ts = Date.now().toString().slice(-6);
    const userIdStr = String(userId).padStart(3, "0");
    const couponCode = `WELCOME20_${userIdStr}_${ts}`;
    const startDate = new Date();
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 14);

    const { rows: couponResult } = await db.query(
      `INSERT INTO couponcode (
        couponcode_code, couponcode_description, couponcode_startday, couponcode_endday,
        couponcode_percent, couponcode_amount, couponcode_minimum_order, couponcode_maximum_discount,
        couponcode_quantity, couponcode_used, couponcode_status, couponcode_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING couponcode_id`,
      [
        couponCode,
        "Welcome coupon: 5% off for new users. Minimum order: 1,000,000 VND.",
        startDate,
        expDate,
        5,
        null,
        1000000,
        null,
        1,
        0,
        1,
        0,
      ]
    );
    const couponId = couponResult[0].couponcode_id;

    await db.query(
      "INSERT INTO user_has_coupon (user_id, couponcode_id, status) VALUES ($1, $2, 0)",
      [userId, couponId]
    );

    const { rows: typeRows } = await db.query(
      `SELECT id
       FROM notification_types
       WHERE type_code IN ('promotion', 'system')
       ORDER BY CASE WHEN type_code = 'promotion' THEN 0 ELSE 1 END
       LIMIT 1`
    );

    if (Array.isArray(typeRows) && typeRows.length > 0) {
      const notificationTypeId = typeRows[0].id;
      const notificationTitle = "You received a welcome coupon!";
      const notificationMessage = `Thanks for registering! Coupon ${couponCode} gives 5% off for orders from 1,000,000 VND. Expiry: ${expDate.toLocaleDateString("vi-VN")}`;

      const { rows: notiResult } = await db.query(
        "INSERT INTO notifications (type_id, title, message, link, sender_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [notificationTypeId, notificationTitle, notificationMessage, "/profile/vouchers", null]
      );
      const notificationId = notiResult[0].id;

      await db.query(
        "INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted) VALUES ($1, $2, 0, NULL, 0)",
        [userId, notificationId]
      );
    }

    return {
      message: "Registration successful. Please check your email to verify your account.",
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
    };
  });
}

/** Resolves to the frontend URL the visitor is redirected to; every outcome is a redirect. */
async function verifyEmail(token) {
  const frontendBaseUrl = getFrontendBaseUrl();
  const outcome = (status, message) =>
    `${frontendBaseUrl}/xac-thuc-email?status=${status}&message=` + encodeURIComponent(message);

  try {
    if (!token) {
      return outcome("error", "Liên kết xác thực không hợp lệ hoặc bị thiếu.");
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return outcome("error", "Liên kết xác thực không hợp lệ hoặc đã hết hạn.");
    }

    if (decodedToken.purpose !== "email_verification") {
      return outcome("error", "Token không dùng cho mục đích xác thực email.");
    }

    const { rows: users } = await db.query(
      'SELECT user_id, user_email_active, user_token FROM "user" WHERE user_id = $1',
      [decodedToken.id]
    );

    if (users.length === 0) {
      return outcome("error", "Tài khoản không tồn tại.");
    }

    const user = users[0];

    if (user.user_email_active && !user.user_token) {
      return outcome("success", "Email của bạn đã được xác thực trước đó. Bạn có thể đăng nhập.");
    }

    if (user.user_token !== token) {
      return outcome("error", "Liên kết xác thực đã được sử dụng hoặc không hợp lệ.");
    }

    await db.query(
      `UPDATE "user"
       SET user_email_active = 1, user_verified_at = NOW(), user_token = NULL
       WHERE user_id = $1`,
      [user.user_id]
    );

    return outcome("success", "Email của bạn đã được xác thực thành công!");
  } catch (error) {
    return outcome("error", "Lỗi máy chủ khi xác thực email. Vui lòng thử lại sau.");
  }
}

/** Sign in with a Google credential; resolves to the response body. */
async function googleLogin(body) {
  try {
    const googleToken = body?.token || body?.credential;
    const { userId, user } = await authenticateGoogleUser(googleToken);
    const accessToken = generateToken(userId);

    return {
      success: true,
      message: "Đăng nhập thành công",
      token: accessToken,
      user,
    };
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      throw new HttpError(error.status, {
        success: false,
        code: error.code,
        error: error.message,
      });
    }

    console.error("google-login error:", {
      message: error.message,
      name: error.name,
    });

    throw new HttpError(500, {
      success: false,
      code: "GOOGLE_LOGIN_FAILED",
      error: "Lỗi máy chủ trong quá trình đăng nhập.",
    });
  }
}

function login(body) {
  return guard({ error: "Lỗi máy chủ trong quá trình đăng nhập." }, async () => {
    const { email, password } = body;

    if (!email || !password) {
      throw new HttpError(400, { error: "Vui lòng nhập email và mật khẩu." });
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new HttpError(400, { error: "Email không hợp lệ." });
    }

    if (password.length < 6) {
      throw new HttpError(400, { error: "Mật khẩu phải có ít nhất 6 ký tự." });
    }

    const { rows: users } = await db.query(
      `SELECT user_id, user_gmail, user_password, user_name, user_role,
          user_number, user_address, user_email_active, user_disabled_at
   FROM "user" WHERE user_gmail = $1`,
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      throw new HttpError(401, { error: "Thông tin đăng nhập không chính xác." });
    }

    const user = users[0];

    if (user.user_disabled_at !== null) {
      throw new HttpError(403, {
        error: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
      });
    }

    if (!user.user_email_active) {
      throw new HttpError(403, {
        error:
          "Tài khoản của bạn chưa được xác thực email. Vui lòng kiểm tra email để xác thực trước khi đăng nhập.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.user_password);
    if (!isPasswordValid) {
      throw new HttpError(401, { error: "Thông tin đăng nhập không chính xác." });
    }

    const token = generateToken(user.user_id);

    return {
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
    };
  });
}

function getProfile(requester) {
  return guard({ error: "Server error while fetching profile" }, async () => {
    const { rows: users } = await db.query(
      'SELECT user_id, user_gmail, user_name, user_number, user_address, user_role, created_at FROM "user" WHERE user_id = $1',
      [requester.id]
    );

    if (users.length === 0) {
      throw new HttpError(404, { error: "User not found" });
    }

    return {
      user: {
        id: users[0].user_id,
        email: users[0].user_gmail,
        full_name: users[0].user_name,
        phone: users[0].user_number,
        address: users[0].user_address,
        role: users[0].user_role,
        created_at: users[0].created_at,
      },
    };
  });
}

function changePassword(body, requester) {
  return guard({ error: "Server error during password change" }, async () => {
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      throw new HttpError(400, { error: "Please provide current password and new password" });
    }

    if (newPassword.length < 6) {
      throw new HttpError(400, { error: "New password must be at least 6 characters long" });
    }

    const { rows: users } = await db.query(
      'SELECT user_id, user_password FROM "user" WHERE user_id = $1',
      [requester.id]
    );

    if (users.length === 0) {
      throw new HttpError(404, { error: "User not found" });
    }

    const user = users[0];

    let isCurrentPasswordValid = false;
    try {
      isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.user_password);
    } catch (err) {
      // an unreadable stored hash counts as a wrong password
    }

    if (!isCurrentPasswordValid) {
      throw new HttpError(401, { error: "Current password is incorrect" });
    }

    let hashedNewPassword;
    try {
      const salt = await bcrypt.genSalt(10);
      hashedNewPassword = await bcrypt.hash(newPassword, salt);
    } catch (error) {
      // Falls back to the plain value when hashing fails (kept from the original, test purposes only)
      hashedNewPassword = newPassword;
    }

    await db.query('UPDATE "user" SET user_password = $1 WHERE user_id = $2', [
      hashedNewPassword,
      requester.id,
    ]);

    return {
      message: "Password changed successfully",
      user_id: requester.id,
    };
  });
}

/**
 * Admin dashboard sign-in. Resolves to { token, body }: the route stores the token in the
 * `token` cookie that the EJS admin pages authenticate with.
 */
function adminLogin(body) {
  const failure = (error) => {
    console.error("admin-login error:", error);
    return { error: "Lỗi server khi đăng nhập" };
  };

  return guard(failure, async () => {
    const { email, password } = body;

    if (!email || !password) {
      throw new HttpError(400, { error: "Vui lòng nhập email và mật khẩu" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { rows: users } = await db.query(
      `SELECT user_id, user_gmail, user_password, user_name, user_role
       FROM "user"
       WHERE lower(trim(user_gmail)) = $1
       LIMIT 1`,
      [normalizedEmail]
    );

    if (users.length === 0) {
      throw new HttpError(401, {
        error: "Tài Khoản hoặc Mật Khẩu không chính xác",
        debug:
          process.env.NODE_ENV !== "production"
            ? { reason: "USER_NOT_FOUND", normalizedEmail }
            : undefined,
      });
    }

    const user = users[0];

    const allowedRoles = ["admin", "staff"];
    const role = (user.user_role || "").toLowerCase();
    if (!role || !allowedRoles.includes(role)) {
      throw new HttpError(403, { error: "Bạn không có quyền truy cập vào trang quản trị" });
    }

    let isPasswordValid = false;
    let bcryptError = null;

    const stored = user.user_password ?? "";
    const looksLikeBcrypt = typeof stored === "string" && stored.startsWith("$2");

    try {
      if (looksLikeBcrypt) {
        isPasswordValid = await bcrypt.compare(password, stored);
      }
    } catch (err) {
      bcryptError = err?.message || String(err);
    }

    if (!isPasswordValid) {
      throw new HttpError(401, {
        error: "Tài Khoản hoặc Mật Khẩu không chính xác",
        debug:
          process.env.NODE_ENV !== "production"
            ? {
                reason: "PASSWORD_NOT_MATCH",
                looksLikeBcrypt,
                bcryptError,
                storedPrefix: typeof stored === "string" ? stored.slice(0, 7) : null,
              }
            : undefined,
      });
    }

    const token = jwt.sign({ id: user.user_id, role }, JWT_SECRET, { expiresIn: "24h" });

    // If user_token/updated_at columns are missing this fails; log it but keep the login working
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

    return {
      token,
      body: {
        message: "Đăng nhập thành công",
        token,
        user: {
          id: user.user_id,
          email: user.user_gmail,
          full_name: user.user_name,
          role: user.user_role,
        },
      },
    };
  });
}

/** Debug info about the admin's stored token. */
function checkToken(requester) {
  return guard({ error: "Lỗi server khi kiểm tra token" }, async () => {
    if (requester.role !== "admin") {
      throw new HttpError(403, { error: "Chỉ admin mới có quyền truy cập API này" });
    }

    const { rows: users } = await db.query(
      'SELECT user_id, user_gmail, user_name, user_role, user_token, updated_at FROM "user" WHERE user_id = $1',
      [requester.id]
    );

    if (users.length === 0) {
      throw new HttpError(404, { error: "Không tìm thấy thông tin người dùng" });
    }

    const user = users[0];

    return {
      user_id: user.user_id,
      email: user.user_gmail,
      full_name: user.user_name,
      role: user.user_role,
      token_exists: !!user.user_token,
      token_preview: user.user_token ? `${user.user_token.substring(0, 20)}...` : null,
      updated_at: user.updated_at,
    };
  });
}

function logout(requester) {
  return guard({ error: "Lỗi server khi đăng xuất" }, async () => {
    await db.query('UPDATE "user" SET user_token = NULL, updated_at = NOW() WHERE user_id = $1', [
      requester.id,
    ]);

    return { message: "Đăng xuất thành công" };
  });
}

module.exports = {
  register,
  verifyEmail,
  googleLogin,
  login,
  getProfile,
  changePassword,
  adminLogin,
  checkToken,
  logout,
};
