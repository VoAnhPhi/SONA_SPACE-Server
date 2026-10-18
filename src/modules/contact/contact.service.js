"use strict";

const HttpError = require("../../shared/http/http-error");
const { sendEmailFromCustomer } = require("../../shared/mail/contact.mail");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatDateTime = (date) =>
  date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** The "Lien he" form: forwards the message to the shop mailbox. */
async function sendContactMessage(body) {
  const { name, email, phone, message } = body;

  if (!name || name.trim() === "") {
    throw new HttpError(400, { error: "Vui lòng nhập họ tên." });
  }

  if (!email || email.trim() === "") {
    throw new HttpError(400, { error: "Vui lòng nhập email." });
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new HttpError(400, { error: "Email không hợp lệ." });
  }

  if (!message || message.trim() === "") {
    throw new HttpError(400, { error: "Vui lòng nhập nội dung." });
  }

  const now = new Date();
  const supportTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    const emailSent = await sendEmailFromCustomer(
      email,
      `Yêu cầu liên hệ từ khách hàng: ${name}`,
      {
        name,
        email,
        phone,
        message,
        currentTime: formatDateTime(now),
        supportTime: formatDateTime(supportTime),
      },
      "contactForm"
    );

    if (!emailSent) {
      throw new HttpError(500, { error: "Không gửi được email. Vui lòng thử lại." });
    }

    return { message: "Gửi liên hệ thành công." };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, { error: "Đã xảy ra lỗi. Vui lòng thử lại sau." });
  }
}

module.exports = { sendContactMessage, EMAIL_REGEX };
