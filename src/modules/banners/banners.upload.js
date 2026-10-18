"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Banner images are stored on local disk and served from /uploads/banners by express.static
const BANNER_UPLOAD_DIR = path.join(__dirname, "../../../public/uploads/banners");

function ensureUploadDir() {
  if (!fs.existsSync(BANNER_UPLOAD_DIR)) {
    fs.mkdirSync(BANNER_UPLOAD_DIR, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    ensureUploadDir();
    cb(null, BANNER_UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `banner-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }

  return cb(new Error("Chi chap nhan file hinh anh: jpeg, jpg, png, gif, webp"));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

module.exports = { upload, BANNER_UPLOAD_DIR };
