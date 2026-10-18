const express = require("express");
const router = express.Router();
const { sendEmailFromCustomer } = require("../src/shared/mail/contact.mail");

router.post("/", async (req, res) => {
  const { name, email, phone, message } = req.body;

  // Kiểm tra thủ công
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Vui lòng nhập họ tên." });
  }

  if (!email || email.trim() === "") {
    return res.status(400).json({ error: "Vui lòng nhập email." });
  }

  // Kiểm tra định dạng email đơn giản
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email không hợp lệ." });
  }

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Vui lòng nhập nội dung." });
  }
  const now = new Date();
  const supportTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const formatDateTime = (date) => {
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };
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

    if (emailSent) {
      return res.status(200).json({ message: "Gửi liên hệ thành công." });
    } else {
      return res
        .status(500)
        .json({ error: "Không gửi được email. Vui lòng thử lại." });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Đã xảy ra lỗi. Vui lòng thử lại sau." });
  }
});

module.exports = router;
