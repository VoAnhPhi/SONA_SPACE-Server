const express = require("express");
const router = express.Router();
const db = require("../config/database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/auth");

// Cấu hình multer để upload hình ảnh
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../public/uploads/banners");
    
    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "banner-" + uniqueSuffix + ext);
  },
});

// Kiểm tra loại file
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Chỉ chấp nhận file hình ảnh: jpeg, jpg, png, gif, webp!"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
  fileFilter: fileFilter,
});

// Middleware xác thực admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Admin privileges required." });
  }
};

// GET: Lấy tất cả banner
router.get("/", async (req, res) => {
  try {
    const { rows: banners } = await db.query(`
      SELECT 
        b.*,
        b.banner_id as id,
        c.category_name
      FROM banners b
      LEFT JOIN category c ON b.category_id = c.category_id
      ORDER BY b.position ASC, b.created_at DESC
    `);
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ và thêm status
    banners.forEach(banner => {
      if (banner.image_url && !banner.image_url.startsWith('http')) {
        banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
      }
      
      // Thêm trường status theo định dạng frontend mong đợi
      banner.status = banner.is_active === 1 ? 'active' : 'inactive';
    });
    
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Lấy banner theo page_type
router.get("/page/:pageType", async (req, res) => {
  try {
    const pageType = req.params.pageType;
    
    const { rows: banners } = await db.query(`
      SELECT 
        b.*,
        b.banner_id as id,
        c.category_name
      FROM banners b
      LEFT JOIN category c ON b.category_id = c.category_id
      WHERE b.page_type = $1 AND b.is_active = 1 
      ORDER BY b.position ASC, b.created_at DESC
    `, [pageType]);
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ và thêm status
    banners.forEach(banner => {
      if (banner.image_url && !banner.image_url.startsWith('http')) {
        banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
      }
      
      // Thêm trường status theo định dạng frontend mong đợi  
      banner.status = banner.is_active === 1 ? 'active' : 'inactive';
    });
    
    res.json(banners);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST: Lấy banner cho nhiều page_type cùng lúc
router.post("/pages", async (req, res) => {
  try {
    const { pageTypes } = req.body;
    
    if (!pageTypes || !Array.isArray(pageTypes) || pageTypes.length === 0) {
      return res.status(400).json({ error: "pageTypes array is required" });
    }
    
    // Tạo placeholders cho câu query
    const placeholders = pageTypes.map((_, i) => `$${i + 1}`).join(',');
    
    const { rows: banners } = await db.query(
      `SELECT * FROM banners WHERE page_type IN (${placeholders}) AND status = 'active' ORDER BY page_type, position ASC, created_at DESC`,
      pageTypes
    );
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    banners.forEach(banner => {
      if (banner.image_url && !banner.image_url.startsWith('http')) {
        banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
      }
    });
    
    // Nhóm banner theo page_type
    const result = pageTypes.reduce((acc, pageType) => {
      acc[pageType] = banners.filter(banner => banner.page_type === pageType);
      return acc;
    }, {});
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Lấy banner cho nhiều page_type cùng lúc (qua query string)
router.get("/pages", async (req, res) => {
  try {
    let { types } = req.query;
    
    if (!types) {
      return res.status(400).json({ error: "types query parameter is required" });
    }
    
    // Chuyển đổi từ string sang array nếu cần
    const pageTypes = Array.isArray(types) ? types : types.split(',');
    
    if (pageTypes.length === 0) {
      return res.status(400).json({ error: "At least one page type is required" });
    }
    
    // Tạo placeholders cho câu query
    const placeholders = pageTypes.map((_, i) => `$${i + 1}`).join(',');
    
    const { rows: banners } = await db.query(
      `SELECT * FROM banners WHERE page_type IN (${placeholders}) AND status = 'active' ORDER BY page_type, position ASC, created_at DESC`,
      pageTypes
    );
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    banners.forEach(banner => {
      if (banner.image_url && !banner.image_url.startsWith('http')) {
        banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
      }
    });
    
    // Nhóm banner theo page_type
    const result = pageTypes.reduce((acc, pageType) => {
      acc[pageType] = banners.filter(banner => banner.page_type === pageType);
      return acc;
    }, {});
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Lấy danh sách tất cả các page_type có banner
router.get("/page-types", async (req, res) => {
  try {
    const { rows: result } = await db.query(
      "SELECT DISTINCT page_type FROM banners WHERE status = 'active' ORDER BY page_type"
    );
    
    const pageTypes = result.map(item => item.page_type);
    
    res.json(pageTypes);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET: Lấy banner theo ID
router.get("/:id", async (req, res) => {
  try {
    const { rows: banners } = await db.query("SELECT *, banner_id as id FROM banners WHERE banner_id = $1", [
      req.params.id,
    ]);

    if (banners.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }

    const banner = banners[0];
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    if (banner.image_url && !banner.image_url.startsWith('http')) {
      banner.image_url = `/uploads/banners/${path.basename(banner.image_url)}`;
    }
    
    // Thêm trường status theo định dạng frontend mong đợi
    banner.status = banner.is_active === 1 ? 'active' : 'inactive';
    
    res.json(banner);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST: Tạo banner mới (yêu cầu xác thực admin)
router.post("/", authMiddleware.verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, position, page_type, start_date, end_date, category_id } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!title || !req.file) {
      return res.status(400).json({ error: "Title and image are required" });
    }
    
    const image_url = req.file ? path.basename(req.file.path) : null;
    
    // Convert status to is_active boolean
    const is_active = req.body.status === 'active' ? 1 : 0;
    
    const { rows: result } = await db.query(
      "INSERT INTO banners (title, image_url, position, is_active, page_type, category_id, start_date, end_date, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING banner_id",
      [
        title, 
        image_url, 
        position || 0, 
        is_active, 
        page_type || "home",
        category_id || null,
        start_date || null,
        end_date || null
      ]
    );
    
    res.status(201).json({
      id: result[0].banner_id,
      banner_id: result[0].banner_id,
      title,
      image_url: `/uploads/banners/${image_url}`,
      position,
      is_active,
      status: is_active === 1 ? 'active' : 'inactive',
      page_type: page_type || "home",
      category_id: category_id || null,
      start_date: start_date || null,
      end_date: end_date || null
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT: Cập nhật banner (yêu cầu xác thực admin)
router.put("/:id", authMiddleware.verifyToken, isAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, position, page_type, start_date, end_date, category_id } = req.body;
    const bannerId = req.params.id;
    
    // Kiểm tra banner có tồn tại không
    const { rows: existingBanners } = await db.query("SELECT * FROM banners WHERE banner_id = $1", [bannerId]);
    
    if (existingBanners.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }
    
    const existingBanner = existingBanners[0];
    let image_url = existingBanner.image_url;
    
    // Convert status to is_active boolean
    const is_active = req.body.status === 'active' ? 1 : 0;
    
    // Nếu có upload ảnh mới
    if (req.file) {
      // Xóa ảnh cũ nếu tồn tại và không phải URL bên ngoài
      if (existingBanner.image_url && !existingBanner.image_url.startsWith('http')) {
        const oldImagePath = path.join(__dirname, "../public/uploads/banners", existingBanner.image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      
      // Cập nhật đường dẫn ảnh mới
      image_url = path.basename(req.file.path);
    }
    
    // Cập nhật banner trong database
    await db.query(
      "UPDATE banners SET title = $1, image_url = $2, position = $3, is_active = $4, page_type = $5, category_id = $6, start_date = $7, end_date = $8, updated_at = NOW() WHERE banner_id = $9",
      [
        title || existingBanner.title,
        image_url,
        position !== undefined ? position : existingBanner.position,
        is_active !== undefined ? is_active : existingBanner.is_active,
        page_type || existingBanner.page_type || "home",
        category_id !== undefined ? category_id : existingBanner.category_id,
        start_date !== undefined ? start_date : existingBanner.start_date,
        end_date !== undefined ? end_date : existingBanner.end_date,
        bannerId
      ]
    );
    
    // Lấy dữ liệu banner sau khi cập nhật
    const { rows: updatedBanners } = await db.query("SELECT *, banner_id as id FROM banners WHERE banner_id = $1", [bannerId]);
    const updatedBanner = updatedBanners[0];
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    if (updatedBanner.image_url && !updatedBanner.image_url.startsWith('http')) {
      updatedBanner.image_url = `/uploads/banners/${path.basename(updatedBanner.image_url)}`;
    }
    
    // Thêm status field
    updatedBanner.status = updatedBanner.is_active === 1 ? 'active' : 'inactive';
    
    res.json(updatedBanner);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE: Xóa banner (yêu cầu xác thực admin)
router.delete("/:id", authMiddleware.verifyToken, isAdmin, async (req, res) => {
  try {
    const bannerId = req.params.id;
    
    // Kiểm tra banner có tồn tại không
    const { rows: existingBanners } = await db.query("SELECT * FROM banners WHERE banner_id = $1", [bannerId]);
    
    if (existingBanners.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }
    
    const existingBanner = existingBanners[0];
    
    // Xóa file ảnh nếu tồn tại và không phải URL bên ngoài
    if (existingBanner.image_url && !existingBanner.image_url.startsWith('http')) {
      const imagePath = path.join(__dirname, "../public/uploads/banners", existingBanner.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Xóa banner từ database
    await db.query("DELETE FROM banners WHERE banner_id = $1", [bannerId]);
    
    res.json({ message: "Banner deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT: Toggle trạng thái hiển thị banner (is_active)
router.put("/:id/toggle-status", authMiddleware.verifyToken, isAdmin, async (req, res) => {
  try {
    const bannerId = req.params.id;
    
    // Kiểm tra banner có tồn tại không
    const { rows: existingBanners } = await db.query("SELECT * FROM banners WHERE banner_id = $1", [bannerId]);
    
    if (existingBanners.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }
    
    const existingBanner = existingBanners[0];
    
    // Toggle trạng thái is_active (1 -> 0, 0 -> 1)
    const newStatus = existingBanner.is_active === 1 ? 0 : 1;
    
    // Cập nhật trạng thái trong database
    await db.query(
      "UPDATE banners SET is_active = $1, updated_at = NOW() WHERE banner_id = $2",
      [newStatus, bannerId]
    );
    
    // Lấy dữ liệu banner sau khi cập nhật
    const { rows: updatedBanners } = await db.query("SELECT * FROM banners WHERE banner_id = $1", [bannerId]);
    const updatedBanner = updatedBanners[0];
    
    // Chuyển đổi đường dẫn hình ảnh thành URL đầy đủ
    if (updatedBanner.image_url && !updatedBanner.image_url.startsWith('http')) {
      updatedBanner.image_url = `/uploads/banners/${path.basename(updatedBanner.image_url)}`;
    }
    
    // Trả về status theo định dạng frontend mong đợi
    updatedBanner.status = updatedBanner.is_active === 1 ? 'active' : 'inactive';
    
    res.json({
      message: `Banner ${newStatus === 1 ? 'đã được hiển thị' : 'đã được ẩn'}`,
      banner: updatedBanner,
      is_active: newStatus
    });
    
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
