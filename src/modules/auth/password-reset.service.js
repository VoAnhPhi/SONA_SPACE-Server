"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { sendEmail } = require("../../shared/mail/verification.mail");

const JWT_SECRET = process.env.JWT_SECRET;
const OTP_TYPE_PASSWORD_RESET = "password_reset";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INTERNAL_ERROR = { error: "Lỗi máy chủ nội bộ. Vui lòng thử lại sau." };

/** Step 1: mail a 6 digit code (at most 3 per 30 minutes; a new code voids the previous one). */
function sendOtp(body) {
  return guard(INTERNAL_ERROR, async () => {
    const { email } = body;

    if (!email) {
      throw new HttpError(400, { error: "Vui lòng cung cấp email." });
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new HttpError(400, { error: "Email không hợp lệ." });
    }

    const { rows: users } = await db.query('SELECT user_id FROM "user" WHERE user_gmail = $1', [email]);
    if (users.length === 0) {
      throw new HttpError(404, { error: "Email không tồn tại trong hệ thống." });
    }

    const userId = users[0].user_id;

    const { rows: sentOtps } = await db.query(
      `
  SELECT COUNT(*)::int AS count FROM otps
  WHERE user_id = $1 AND otp_type = $2 AND created_at >= NOW() - INTERVAL '30 minutes'
`,
      [userId, OTP_TYPE_PASSWORD_RESET]
    );

    if (sentOtps[0].count >= 3) {
      throw new HttpError(429, {
        error: "Bạn đã yêu cầu mã OTP quá 3 lần. Vui lòng thử lại sau 30 phút.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const formattedExpiresAt = expiresAt.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    await db.query(
      "UPDATE otps SET is_used = 1 WHERE user_id = $1 AND otp_type = $2 AND is_used = 0 AND expires_at > NOW()",
      [userId, OTP_TYPE_PASSWORD_RESET]
    );

    await db.query(
      `
      INSERT INTO otps (user_id, otp_code, otp_type, created_at, expires_at, is_used)
      VALUES ($1, $2, $3, NOW(), $4, 0)
    `,
      [userId, hashedOtp, OTP_TYPE_PASSWORD_RESET, expiresAt]
    );

    const emailSent = await sendEmail(
      email,
      "Mã OTP đặt lại mật khẩu của bạn - Furnitown",
      { otp, expiresAt: formattedExpiresAt },
      "otpEmail"
    );

    if (!emailSent) {
      throw new HttpError(500, { error: "Lỗi máy chủ khi gửi mã OTP. Vui lòng thử lại sau." });
    }

    return {
      message:
        "Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến và cả thư mục spam.",
    };
  });
}

/** Step 2: check the code (one attempt per code) and hand out a 10 minute reset token. */
function verifyOtp(body) {
  return guard(INTERNAL_ERROR, async () => {
    const { email, otp } = body;

    if (!email || !otp) {
      throw new HttpError(400, { error: "Vui lòng cung cấp email và mã OTP." });
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new HttpError(400, { error: "Email không hợp lệ." });
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      throw new HttpError(400, { error: "Mã OTP không hợp lệ (phải là 6 chữ số)." });
    }

    const { rows: users } = await db.query('SELECT user_id FROM "user" WHERE user_gmail = $1', [email]);
    if (users.length === 0) {
      throw new HttpError(404, { error: "Email không tồn tại trong hệ thống." });
    }
    const userId = users[0].user_id;

    const { rows: otps } = await db.query(
      `SELECT id, otp_code, expires_at, is_used FROM otps
       WHERE user_id = $1 AND otp_type = $2 AND is_used = 0
       ORDER BY created_at DESC LIMIT 1`,
      [userId, OTP_TYPE_PASSWORD_RESET]
    );

    if (otps.length === 0) {
      throw new HttpError(400, {
        error: "Không tìm thấy mã OTP hợp lệ hoặc mã đã hết hạn/đã sử dụng. Vui lòng yêu cầu mã mới.",
      });
    }

    const storedOtp = otps[0];
    const otpId = storedOtp.id;

    if (new Date() > storedOtp.expires_at) {
      await db.query("UPDATE otps SET is_used = 1 WHERE id = $1", [otpId]);
      throw new HttpError(400, { error: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới." });
    }

    // The schema has no attempts column: the code is voided on the first failed verification.
    const isOtpValid = await bcrypt.compare(otp, storedOtp.otp_code);

    if (!isOtpValid) {
      await db.query("UPDATE otps SET is_used = 1 WHERE id = $1", [otpId]);
      throw new HttpError(401, { error: "Invalid OTP. Please request a new code." });
    }

    await db.query("UPDATE otps SET is_used = 1 WHERE id = $1", [otpId]);

    const resetToken = jwt.sign({ id: userId, purpose: "password_reset" }, JWT_SECRET, {
      expiresIn: "10m",
    });

    return {
      message: "Xác thực OTP thành công.",
      resetToken,
    };
  });
}

/** Step 3: set the new password with the reset token. */
function resetPassword(body) {
  return guard({ error: "Lỗi máy chủ nội bộ." }, async () => {
    const { newPassword, token } = body;

    if (!newPassword || !token) {
      throw new HttpError(400, { error: "Thiếu thông tin cần thiết." });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      throw new HttpError(401, { error: "Token không hợp lệ hoặc đã hết hạn." });
    }

    if (payload.purpose !== "password_reset") {
      throw new HttpError(403, { error: "Token không dùng cho việc đặt lại mật khẩu." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query('UPDATE "user" SET user_password = $1 WHERE user_id = $2', [
      hashedPassword,
      payload.id,
    ]);

    return { message: "Mật khẩu đã được cập nhật thành công." };
  });
}

module.exports = { sendOtp, verifyOtp, resetPassword };
