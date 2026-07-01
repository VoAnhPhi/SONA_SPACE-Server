const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("../config/cloudinary");

function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function formatImageList(list) {
  if (Array.isArray(list)) {
    return list
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(",");
  }

  if (typeof list === "string") {
    return list
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(",");
  }

  return null;
}

function extractPublicIdFromUrl(url) {
  const parts = String(url || "").split("/upload/");
  if (parts.length < 2) {
    return null;
  }

  const pathParts = parts[1].split("/");
  if (pathParts[0]?.startsWith("v") && !Number.isNaN(Number(pathParts[0].slice(1)))) {
    pathParts.shift();
  }

  const fullPath = pathParts.join("/");
  return fullPath.replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");
}

function normalizeVariantPayload(body) {
  const colorId = parseId(body.color_id ?? body.variant_colors);
  const slug = String(body.slug ?? body.variant_product_slug ?? "").trim();

  const quantityRaw = body.quantity ?? body.variant_product_quantity;
  const priceRaw = body.price ?? body.variant_product_price;
  const priceSaleRaw = body.price_sale ?? body.variant_product_price_sale;

  const quantity = quantityRaw !== undefined && quantityRaw !== null && quantityRaw !== "" ? Number(quantityRaw) : null;
  const price = priceRaw !== undefined && priceRaw !== null && priceRaw !== "" ? Number(priceRaw) : null;
  const priceSale = priceSaleRaw !== undefined && priceSaleRaw !== null && priceSaleRaw !== "" ? Number(priceSaleRaw) : null;

  const listImage = formatImageList(
    body.list_image ?? body.list_img ?? body.variant_product_list_image
  );

  return {
    colorId,
    slug,
    quantity,
    price,
    priceSale,
    listImage,
  };
}

/**
 * @route   GET /api/variants
 * @desc    Lay danh sach bien the san pham
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const productId = parseId(req.query.product_id);

    const sqlParts = ["SELECT * FROM variant_product"];
    const params = [];

    if (productId) {
      params.push(productId);
      sqlParts.push(`WHERE product_id = $${params.length}`);
    }

    sqlParts.push("ORDER BY variant_id ASC");

    const { rows } = await db.query(sqlParts.join(" "), params);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch variants" });
  }
});

/**
 * @route   GET /api/variants/by-product/:slug
 * @desc    Lay danh sach bien the theo san pham
 * @access  Public
 */
router.get("/by-product/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) {
    return res.status(400).json({ error: "Missing product slug" });
  }

  try {
    const { rows } = await db.query(
      `
      SELECT vp.*
      FROM variant_product vp
      JOIN product p ON vp.product_id = p.product_id
      WHERE p.product_slug = $1
      `,
      [slug]
    );

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch variants by product" });
  }
});

/**
 * @route   GET /api/variants/:productSlug/:colorId
 * @desc    Lay thong tin chi tiet mot bien the
 * @access  Public
 */
router.get("/:productSlug/:colorId", async (req, res) => {
  try {
    const { productSlug } = req.params;
    const colorId = parseId(req.params.colorId);

    if (!productSlug || !colorId) {
      return res.status(400).json({ error: "Thieu productSlug hoac colorId" });
    }

    const { rows } = await db.query(
      `
      SELECT
        vp.variant_id,
        vp.product_id,
        c.color_id,
        c.color_name,
        c.color_code AS color_hex,
        c.color_priority,
        vp.variant_product_slug,
        vp.variant_product_quantity,
        vp.variant_product_price,
        vp.variant_product_price_sale,
        vp.variant_product_list_image
      FROM variant_product vp
      JOIN color c ON vp.color_id = c.color_id
      JOIN product p ON vp.product_id = p.product_id
      WHERE p.product_slug = $1 AND c.color_id = $2
      LIMIT 1
      `,
      [productSlug, colorId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Khong tim thay bien the phu hop" });
    }

    const data = rows[0];

    return res.json({
      variantId: data.variant_id,
      productId: data.product_id,
      colorId: data.color_id,
      colorName: data.color_name,
      colorHex: data.color_hex,
      colorPriority: data.color_priority,
      quantity: data.variant_product_quantity,
      price: data.variant_product_price,
      priceSale: data.variant_product_price_sale,
      slug: data.variant_product_slug,
      listImage: data.variant_product_list_image,
    });
  } catch (error) {
    return res.status(500).json({ error: "Loi khi lay chi tiet bien the" });
  }
});

/**
 * @route   POST /api/variants
 * @desc    Tao bien the moi
 * @access  Private (Admin only)
 */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const productId = parseId(req.body.product_id);
    if (!productId) {
      return res.status(400).json({ error: "Product ID is required" });
    }

    const payload = normalizeVariantPayload(req.body);

    if (!payload.colorId || !payload.slug) {
      return res.status(400).json({
        error: "color_id (or variant_colors) and slug are required",
      });
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity < 0) {
      return res.status(400).json({ error: "quantity must be a non-negative number" });
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      return res.status(400).json({ error: "price must be a non-negative number" });
    }

    if (payload.priceSale !== null && (!Number.isFinite(payload.priceSale) || payload.priceSale < 0)) {
      return res.status(400).json({ error: "price_sale must be a non-negative number" });
    }

    const { rows: productRows } = await db.query(
      "SELECT product_id FROM product WHERE product_id = $1",
      [productId]
    );
    if (!productRows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    const { rows: colorRows } = await db.query(
      "SELECT color_id FROM color WHERE color_id = $1",
      [payload.colorId]
    );
    if (!colorRows.length) {
      return res.status(404).json({ error: "Color not found" });
    }

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO variant_product (
        product_id,
        color_id,
        variant_product_slug,
        variant_product_quantity,
        variant_product_price,
        variant_product_price_sale,
        variant_product_list_image
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING variant_id
      `,
      [
        productId,
        payload.colorId,
        payload.slug,
        payload.quantity,
        payload.price,
        payload.priceSale,
        payload.listImage,
      ]
    );

    const createdVariantId = insertedRows[0].variant_id;
    const { rows: variantRows } = await db.query(
      "SELECT * FROM variant_product WHERE variant_id = $1",
      [createdVariantId]
    );

    return res.status(201).json({
      message: "Variant created successfully",
      variant: variantRows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create variant" });
  }
});

/**
 * @route   POST /api/variants/:productId
 * @desc    Tao bien the moi cho san pham
 * @access  Private (Admin only)
 */
router.post("/:productId", async (req, res) => {
  const productId = parseId(req.params.productId);
  const payload = normalizeVariantPayload(req.body);

  const errors = [];
  const variantIndex = 0;

  const addError = (field, message) => {
    errors.push({ field: `variants[${variantIndex}].${field}`, message });
  };

  if (!productId) {
    return res.status(400).json({ error: "Thieu hoac sai productId" });
  }

  if (!payload.colorId) {
    addError("color_id", "Mau sac la bat buoc");
  }

  if (!payload.slug) {
    addError("slug", "Slug la bat buoc");
  }

  if (!Number.isFinite(payload.quantity)) {
    addError("quantity", "So luong khong hop le");
  }

  if (!Number.isFinite(payload.price)) {
    addError("price", "Gia khong hop le");
  }

  if (payload.priceSale !== null && !Number.isFinite(payload.priceSale)) {
    addError("price_sale", "Gia khuyen mai khong hop le");
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: "Du lieu khong hop le", errors });
  }

  try {
    const { rows: productRows } = await db.query(
      "SELECT product_id FROM product WHERE product_id = $1",
      [productId]
    );
    if (!productRows.length) {
      return res.status(404).json({ error: "Product khong ton tai" });
    }

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO variant_product (
        product_id,
        color_id,
        variant_product_slug,
        variant_product_quantity,
        variant_product_price,
        variant_product_price_sale,
        variant_product_list_image
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING variant_id
      `,
      [
        productId,
        payload.colorId,
        payload.slug,
        payload.quantity,
        payload.price,
        payload.priceSale,
        payload.listImage,
      ]
    );

    return res.status(201).json({
      message: "Tao bien the thanh cong",
      variant_id: insertedRows[0].variant_id,
      list_image: payload.listImage ? payload.listImage.split(",") : [],
    });
  } catch (error) {
    return res.status(500).json({
      error: "Tao bien the that bai",
      detail: error.message,
    });
  }
});

/**
 * @route   PUT /api/variants/:variantId
 * @desc    Cap nhat thong tin bien the
 * @access  Private (Admin only)
 */
router.put("/:variantId", async (req, res) => {
  const variantId = parseId(req.params.variantId);
  const payload = normalizeVariantPayload(req.body);

  const errors = [];
  const variantIndex = 0;

  const addError = (field, message) => {
    errors.push({ field: `variants[${variantIndex}].${field}`, message });
  };

  if (!variantId) {
    return res.status(400).json([{ field: "variantId", message: "Thieu ID bien the." }]);
  }

  if (!payload.colorId) {
    addError("color_id", "Vui long chon mau cho bien the.");
  }

  if (!payload.slug) {
    addError("slug", "Slug khong duoc de trong.");
  }

  if (!Number.isFinite(payload.quantity) || payload.quantity < 0) {
    addError("quantity", "So luong phai la so khong am.");
  }

  if (!Number.isFinite(payload.price) || payload.price < 0) {
    addError("price", "Gia phai la so khong am.");
  }

  if (payload.priceSale !== null && (!Number.isFinite(payload.priceSale) || payload.priceSale < 0)) {
    addError("price_sale", "Gia khuyen mai phai la so khong am.");
  }

  if (!payload.listImage) {
    addError("list_image", "Vui long chon it nhat 1 anh cho bien the.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const { rows: existingRows } = await db.query(
      "SELECT variant_id FROM variant_product WHERE variant_id = $1",
      [variantId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "Bien the khong ton tai." });
    }

    await db.query(
      `
      UPDATE variant_product SET
        color_id = $1,
        variant_product_slug = $2,
        variant_product_quantity = $3,
        variant_product_price = $4,
        variant_product_price_sale = $5,
        variant_product_list_image = $6
      WHERE variant_id = $7
      `,
      [
        payload.colorId,
        payload.slug,
        payload.quantity,
        payload.price,
        payload.priceSale,
        payload.listImage,
        variantId,
      ]
    );

    const { rows: updatedRows } = await db.query(
      "SELECT * FROM variant_product WHERE variant_id = $1",
      [variantId]
    );

    return res.json({
      message: "Cap nhat bien the thanh cong!",
      variant: updatedRows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: "Cap nhat bien the that bai", detail: error.message });
  }
});

/**
 * @route   DELETE /api/variants/:variantId
 * @desc    Xoa bien the
 * @access  Private (Admin only)
 */
router.delete("/:variantId", async (req, res) => {
  const variantId = parseId(req.params.variantId);

  if (!variantId) {
    return res.status(400).json({ error: "Thieu variantId" });
  }

  try {
    const { rows: existingRows } = await db.query(
      "SELECT * FROM variant_product WHERE variant_id = $1",
      [variantId]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "Bien the khong ton tai" });
    }

    const { rows: orderRows } = await db.query(
      "SELECT order_item_id FROM order_items WHERE variant_id = $1 LIMIT 1",
      [variantId]
    );

    if (orderRows.length > 0) {
      return res.status(400).json({
        error: "Khong the xoa bien the dang duoc su dung trong don hang",
      });
    }

    const listImageStr = existingRows[0].variant_product_list_image || "";
    const imageUrls = listImageStr.split(",").map((url) => url.trim()).filter(Boolean);

    const publicIds = imageUrls
      .map((url) => extractPublicIdFromUrl(url))
      .filter(Boolean);

    await Promise.all(
      publicIds.map(async (publicId) => {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (error) {
          return null;
        }
        return null;
      })
    );

    await db.query("DELETE FROM variant_product WHERE variant_id = $1", [variantId]);

    return res.json({
      message: "Da xoa bien the va anh thanh cong",
      deletedImages: publicIds,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Loi server khi xoa bien the",
      detail: error.message,
    });
  }
});

module.exports = router;
