const express = require("express");
const router = express.Router();
const db = require("../config/database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verifyToken, isAdmin } = require("../middleware/auth");

const BANNER_UPLOAD_DIR = path.join(__dirname, "../public/uploads/banners");

function ensureUploadDir() {
  if (!fs.existsSync(BANNER_UPLOAD_DIR)) {
    fs.mkdirSync(BANNER_UPLOAD_DIR, { recursive: true });
  }
}

function toImageUrl(fileName) {
  if (!fileName) return null;
  if (String(fileName).startsWith("http")) return fileName;
  return `/uploads/banners/${path.basename(fileName)}`;
}

function mapBannerRow(row) {
  const numericStatus = Number(row.status) === 1 ? 1 : 0;
  return {
    ...row,
    id: row.banner_id,
    title: row.banner_title,
    subtitle: row.banner_description,
    image_url: toImageUrl(row.banner_image),
    link_url: row.banner_link,
    position: row.banner_priority ?? 0,
    is_active: numericStatus,
    status: numericStatus === 1 ? "active" : "inactive",
    page_type: "home",
  };
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    ensureUploadDir();
    cb(null, BANNER_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
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

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT
        b.*,
        c.category_name
      FROM banners b
      LEFT JOIN category c ON b.category_id = c.category_id
      WHERE b.deleted_at IS NULL
      ORDER BY b.banner_priority ASC, b.created_at DESC
      `
    );

    return res.json(rows.map(mapBannerRow));
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/page/:pageType", async (req, res) => {
  try {
    const pageType = String(req.params.pageType || "home").toLowerCase();
    if (pageType !== "home") {
      return res.json([]);
    }

    const { rows } = await db.query(
      `
      SELECT *
      FROM banners
      WHERE deleted_at IS NULL AND status = 1
      ORDER BY banner_priority ASC, created_at DESC
      `
    );

    return res.json(rows.map(mapBannerRow));
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/pages", async (req, res) => {
  try {
    const { pageTypes } = req.body;

    if (!Array.isArray(pageTypes) || pageTypes.length === 0) {
      return res.status(400).json({ error: "pageTypes array is required" });
    }

    const { rows } = await db.query(
      `
      SELECT *
      FROM banners
      WHERE deleted_at IS NULL AND status = 1
      ORDER BY banner_priority ASC, created_at DESC
      `
    );

    const mapped = rows.map(mapBannerRow);
    const result = pageTypes.reduce((acc, pageType) => {
      acc[pageType] = String(pageType).toLowerCase() === "home" ? mapped : [];
      return acc;
    }, {});

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/pages", async (req, res) => {
  try {
    let { types } = req.query;

    if (!types) {
      return res.status(400).json({ error: "types query parameter is required" });
    }

    const pageTypes = Array.isArray(types) ? types : String(types).split(",");
    if (!pageTypes.length) {
      return res.status(400).json({ error: "At least one page type is required" });
    }

    const { rows } = await db.query(
      `
      SELECT *
      FROM banners
      WHERE deleted_at IS NULL AND status = 1
      ORDER BY banner_priority ASC, created_at DESC
      `
    );

    const mapped = rows.map(mapBannerRow);
    const result = pageTypes.reduce((acc, pageType) => {
      acc[pageType] = String(pageType).toLowerCase() === "home" ? mapped : [];
      return acc;
    }, {});

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/page-types", async (req, res) => {
  return res.json(["home"]);
});

router.get("/:id", async (req, res) => {
  try {
    const bannerId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(bannerId) || bannerId <= 0) {
      return res.status(400).json({ error: "Invalid banner ID" });
    }

    const { rows } = await db.query(
      "SELECT *, banner_id AS id FROM banners WHERE banner_id = $1 AND deleted_at IS NULL",
      [bannerId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Banner not found" });
    }

    return res.json(mapBannerRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, subtitle, link_url, position, category_id } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({ error: "Title and image are required" });
    }

    const status = req.body.status === "active" ? 1 : 0;
    const { rows } = await db.query(
      `
      INSERT INTO banners (
        banner_title,
        banner_description,
        banner_image,
        banner_link,
        banner_priority,
        status,
        category_id,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NULL)
      RETURNING *
      `,
      [
        title,
        subtitle || null,
        path.basename(req.file.path),
        link_url || null,
        Number(position) || 0,
        status,
        category_id ? Number(category_id) : null,
      ]
    );

    return res.status(201).json(mapBannerRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const bannerId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(bannerId) || bannerId <= 0) {
      return res.status(400).json({ error: "Invalid banner ID" });
    }

    const { rows: existingRows } = await db.query(
      "SELECT * FROM banners WHERE banner_id = $1 AND deleted_at IS NULL",
      [bannerId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "Banner not found" });
    }

    const existing = existingRows[0];
    let nextImage = existing.banner_image;

    if (req.file) {
      if (existing.banner_image && !String(existing.banner_image).startsWith("http")) {
        const oldImagePath = path.join(BANNER_UPLOAD_DIR, path.basename(existing.banner_image));
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      nextImage = path.basename(req.file.path);
    }

    const nextStatus = req.body.status === "active" ? 1 : 0;

    await db.query(
      `
      UPDATE banners
      SET
        banner_title = $1,
        banner_description = $2,
        banner_image = $3,
        banner_link = $4,
        banner_priority = $5,
        status = $6,
        category_id = $7,
        updated_at = NOW()
      WHERE banner_id = $8
      `,
      [
        req.body.title || existing.banner_title,
        req.body.subtitle !== undefined ? req.body.subtitle : existing.banner_description,
        nextImage,
        req.body.link_url !== undefined ? req.body.link_url : existing.banner_link,
        req.body.position !== undefined ? Number(req.body.position) : existing.banner_priority,
        nextStatus,
        req.body.category_id !== undefined && req.body.category_id !== ""
          ? Number(req.body.category_id)
          : existing.category_id,
        bannerId,
      ]
    );

    const { rows: updatedRows } = await db.query(
      "SELECT * FROM banners WHERE banner_id = $1",
      [bannerId]
    );

    return res.json(mapBannerRow(updatedRows[0]));
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const bannerId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(bannerId) || bannerId <= 0) {
      return res.status(400).json({ error: "Invalid banner ID" });
    }

    const { rows: existingRows } = await db.query(
      "SELECT * FROM banners WHERE banner_id = $1 AND deleted_at IS NULL",
      [bannerId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "Banner not found" });
    }

    const existing = existingRows[0];
    if (existing.banner_image && !String(existing.banner_image).startsWith("http")) {
      const imagePath = path.join(BANNER_UPLOAD_DIR, path.basename(existing.banner_image));
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await db.query("DELETE FROM banners WHERE banner_id = $1", [bannerId]);
    return res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id/toggle-status", verifyToken, isAdmin, async (req, res) => {
  try {
    const bannerId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(bannerId) || bannerId <= 0) {
      return res.status(400).json({ error: "Invalid banner ID" });
    }

    const { rows: existingRows } = await db.query(
      "SELECT * FROM banners WHERE banner_id = $1 AND deleted_at IS NULL",
      [bannerId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "Banner not found" });
    }

    const existing = existingRows[0];
    const newStatus = Number(existing.status) === 1 ? 0 : 1;

    await db.query(
      "UPDATE banners SET status = $1, updated_at = NOW() WHERE banner_id = $2",
      [newStatus, bannerId]
    );

    const { rows: updatedRows } = await db.query(
      "SELECT * FROM banners WHERE banner_id = $1",
      [bannerId]
    );

    return res.json({
      message: `Banner ${newStatus === 1 ? "da duoc hien thi" : "da duoc an"}`,
      banner: mapBannerRow(updatedRows[0]),
      is_active: newStatus,
    });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
