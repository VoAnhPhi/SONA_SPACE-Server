const multer = require("multer");
const path = require("path");

// Lưu file tạm trong RAM (hoặc dùng diskStorage nếu muốn)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ hỗ trợ ảnh jpeg, jpg, png, webp"));
  }
};

module.exports = multer({ storage, fileFilter });
