const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const { verifyToken, isAdmin } = require("../middleware/auth");

function buildBase64Image(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

function resolveFolder(folder, subfolder) {
  return subfolder ? `${folder}/${subfolder}` : folder;
}

async function uploadImage(req, res, defaultFolder, defaultSubfolder) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Thieu file anh" });
    }

    const folder = req.body.folder || defaultFolder;
    const subfolder = req.body.subfolder || defaultSubfolder;
    const result = await cloudinary.uploader.upload(buildBase64Image(req.file), {
      folder: resolveFolder(folder, subfolder),
    });

    return res.status(200).json({
      message: "Upload thanh cong",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    return res.status(500).json({ error: "Loi upload anh", detail: error.message });
  }
}

router.post(
  "/category",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req, res) => uploadImage(req, res, req.body.folder, req.body.subfolder)
);

router.post(
  "/room",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req, res) => uploadImage(req, res, req.body.folder, req.body.subfolder)
);

router.post(
  "/product",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Thieu file anh",
          field: "image",
          detail: "Vui long chon mot file anh de upload",
        });
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          error: "Dinh dang anh khong hop le",
          field: "image",
          detail: "Chi chap nhan file anh JPEG, PNG hoac WEBP",
        });
      }

      const maxSize = 5 * 1024 * 1024;
      if (req.file.size > maxSize) {
        return res.status(400).json({
          error: "Anh vuot qua dung luong cho phep",
          field: "image",
          detail: "Anh phai nho hon 5MB",
        });
      }

      const folder = req.body.folder || "SonaSpace/Product";
      const subfolder = req.body.subfolder || "";
      const result = await cloudinary.uploader.upload(buildBase64Image(req.file), {
        folder: resolveFolder(folder, subfolder),
      });

      return res.status(200).json({
        message: "Upload thanh cong",
        url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Loi khong xac dinh khi upload anh",
        detail: error.message,
      });
    }
  }
);

router.delete("/:publicId(*)", verifyToken, isAdmin, async (req, res) => {
  try {
    const { publicId } = req.params;
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    if (result.result === "not found") {
      return res.status(404).json({ error: "Khong tim thay anh", detail: result });
    }

    if (result.result !== "ok") {
      return res.status(500).json({ error: "Loi xoa anh", detail: result });
    }

    return res.status(200).json({ message: "Xoa anh thanh cong" });
  } catch (error) {
    return res.status(500).json({ error: "Loi xoa anh", detail: error.message });
  }
});

router.post(
  "/news",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req, res) => uploadImage(req, res, "SonaSpace", "News")
);

router.post(
  "/newscategorynews",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req, res) => uploadImage(req, res, "SonaSpace", "NewsCategories")
);

router.post(
  "/event",
  verifyToken,
  isAdmin,
  upload.single("image"),
  async (req, res) => uploadImage(req, res, "SonaSpace", "PopupAd")
);

module.exports = router;
