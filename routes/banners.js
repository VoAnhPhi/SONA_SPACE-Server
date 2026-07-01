const express = require("express");
const router = express.Router();
const db = require("../config/database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verifyToken, isAdmin } = require("../middleware/auth");

const BANNER_UPLOAD_DIR = path.join(__dirname, "../public/uploads/banners");
const PAGE_TYPES = [
  "home",
  "danh-muc",
  "san-pham",
  "gio-hang",
  "thanh-toan",
  "dat-hang-thanh-cong",
  "khong-gian",
  "dich-vu-thiet-ke",
  "ho-so-kien-truc",
  "lien-he",
  "dang-ky",
  "dang-nhap",
  "quen-mat-khau",
  "tai-khoan",
  "chi-tiet-don-hang",
  "dieu-khoan-su-dung",
  "chinh-sach-bao-mat",
  "tin-tuc",
];

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

function normalizeStatus(status) {
  if (status === "active" || status === 1 || status === "1" || status === true) {
    return 1;
  }
  return 0;
}

function normalizePageType(pageType) {
  const normalized = String(pageType || "home").trim().toLowerCase();
  return PAGE_TYPES.includes(normalized) ? normalized : "home";
}

function normalizeOptionalDate(dateValue) {
  if (dateValue === undefined || dateValue === null || dateValue === "") {
    return null;
  }
  return dateValue;
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
    page_type: row.page_type || "home",
    start_date: row.start_date,
    end_date: row.end_date,
  };
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
    const pageType = normalizePageType(req.params.pageType);
    const { rows } = await db.query(
      `
      SELECT *
      FROM banners
      WHERE deleted_at IS NULL
        AND status = 1
        AND LOWER(page_type) = $1
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY banner_priority ASC, created_at DESC
      `,
      [pageType]
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

    const normalizedPageTypes = pageTypes.map(normalizePageType);
    const { rows } = await db.query(
      `
      SELECT *
      FROM banners
      WHERE deleted_at IS NULL
        AND status = 1
        AND page_type = ANY($1::text[])
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY banner_priority ASC, created_at DESC
      `,
      [normalizedPageTypes]
    );

    const grouped = normalizedPageTypes.reduce((acc, pageType) => {
      acc[pageType] = [];
      return acc;
    }, {});

    rows.map(mapBannerRow).forEach((banner) => {
      if (!grouped[banner.page_type]) {
        grouped[banner.page_type] = [];
      }
      grouped[banner.page_type].push(banner);
    });

    return res.json(grouped);
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
    const normalizedPageTypes = pageTypes.map(normalizePageType);
    const { rows } = await db.query(
      `
      SELECT *
      FROM banners
      WHERE deleted_at IS NULL
        AND status = 1
        AND page_type = ANY($1::text[])
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY banner_priority ASC, created_at DESC
      `,
      [normalizedPageTypes]
    );

    const grouped = normalizedPageTypes.reduce((acc, pageType) => {
      acc[pageType] = [];
      return acc;
    }, {});

    rows.map(mapBannerRow).forEach((banner) => {
      if (!grouped[banner.page_type]) {
        grouped[banner.page_type] = [];
      }
      grouped[banner.page_type].push(banner);
    });

    return res.json(grouped);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/page-types", async (req, res) => {
  return res.json(PAGE_TYPES);
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
    const { title, subtitle, link_url, position, category_id, page_type, start_date, end_date } =
      req.body;

    if (!title || !req.file) {
      return res.status(400).json({ error: "Title and image are required" });
    }

    const status = normalizeStatus(req.body.status);
    const { rows } = await db.query(
      `
      INSERT INTO banners (
        banner_title,
        banner_description,
        banner_image,
        banner_link,
        banner_priority,
        page_type,
        status,
        category_id,
        start_date,
        end_date,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NULL)
      RETURNING *
      `,
      [
        title,
        subtitle || null,
        path.basename(req.file.path),
        link_url || null,
        Number(position) || 0,
        normalizePageType(page_type),
        status,
        category_id ? Number(category_id) : null,
        normalizeOptionalDate(start_date),
        normalizeOptionalDate(end_date),
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

    const nextStatus =
      req.body.status === undefined ? Number(existing.status) : normalizeStatus(req.body.status);

    await db.query(
      `
      UPDATE banners
      SET
        banner_title = $1,
        banner_description = $2,
        banner_image = $3,
        banner_link = $4,
        banner_priority = $5,
        page_type = $6,
        status = $7,
        category_id = $8,
        start_date = $9,
        end_date = $10,
        updated_at = NOW()
      WHERE banner_id = $11
      `,
      [
        req.body.title || existing.banner_title,
        req.body.subtitle !== undefined ? req.body.subtitle : existing.banner_description,
        nextImage,
        req.body.link_url !== undefined ? req.body.link_url : existing.banner_link,
        req.body.position !== undefined ? Number(req.body.position) : existing.banner_priority,
        req.body.page_type !== undefined
          ? normalizePageType(req.body.page_type)
          : existing.page_type,
        nextStatus,
        req.body.category_id !== undefined && req.body.category_id !== ""
          ? Number(req.body.category_id)
          : existing.category_id,
        req.body.start_date !== undefined
          ? normalizeOptionalDate(req.body.start_date)
          : existing.start_date,
        req.body.end_date !== undefined
          ? normalizeOptionalDate(req.body.end_date)
          : existing.end_date,
        bannerId,
      ]
    );

    const { rows: updatedRows } = await db.query("SELECT * FROM banners WHERE banner_id = $1", [
      bannerId,
    ]);

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

    await db.query("UPDATE banners SET status = $1, updated_at = NOW() WHERE banner_id = $2", [
      newStatus,
      bannerId,
    ]);

    const { rows: updatedRows } = await db.query("SELECT * FROM banners WHERE banner_id = $1", [
      bannerId,
    ]);

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
