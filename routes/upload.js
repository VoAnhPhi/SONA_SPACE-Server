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

function sanitizeFolderSegment(value) {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function resolveProductImageFolder(body) {
  const imageType = String(body.imageType || "").trim().toLowerCase();
  const productSlug = sanitizeFolderSegment(body.productSlug);
  const variantSlug = sanitizeFolderSegment(body.variantSlug);

  if (!["main", "variant"].includes(imageType)) {
    return {
      error: {
        status: 400,
        field: "imageType",
        message: "Loai anh san pham khong hop le",
        detail: "imageType phai la main hoac variant",
      },
    };
  }

  if (!productSlug) {
    return {
      error: {
        status: 400,
        field: "productSlug",
        message: "Thieu slug san pham",
        detail: "productSlug la bat buoc de tao thu muc Cloudinary",
      },
    };
  }

  if (imageType === "variant" && !variantSlug) {
    return {
      error: {
        status: 400,
        field: "variantSlug",
        message: "Thieu slug bien the",
        detail: "variantSlug la bat buoc khi imageType la variant",
      },
    };
  }

  return {
    folder:
      imageType === "main"
        ? `SonaSpace/Product/${productSlug}/main`
        : `SonaSpace/Product/${productSlug}/variants/${variantSlug}`,
  };
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

      const folderResult = resolveProductImageFolder(req.body);
      if (folderResult.error) {
        const { status, field, message, detail } = folderResult.error;
        return res.status(status).json({
          error: message,
          field,
          detail,
        });
      }

      const result = await cloudinary.uploader.upload(buildBase64Image(req.file), {
        folder: folderResult.folder,
      });

      return res.status(200).json({
        message: "Upload thanh cong",
        url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (error) {
      return res.status(500).json({
        error: "Loi khong xac dinh khi upload anh",
        detail: "Khong the upload anh san pham",
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
