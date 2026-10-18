"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { publicIdFromVariantUrl, destroyQuietly } = require("./product-images");

// Any integer passes; callers reject 0 through `!id`.
function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Image list as a comma separated string, accepted as an array or already as a string. */
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

const asNumberOrNull = (raw) => (raw !== undefined && raw !== null && raw !== "" ? Number(raw) : null);

/** The admin forms send either the API names or the column names; both are understood. */
function normalizeVariantPayload(body) {
  return {
    colorId: parseId(body.color_id ?? body.variant_colors),
    slug: String(body.slug ?? body.variant_product_slug ?? "").trim(),
    quantity: asNumberOrNull(body.quantity ?? body.variant_product_quantity),
    price: asNumberOrNull(body.price ?? body.variant_product_price),
    priceSale: asNumberOrNull(body.price_sale ?? body.variant_product_price_sale),
    listImage: formatImageList(body.list_image ?? body.list_img ?? body.variant_product_list_image),
  };
}

/** A product's stock is the sum of its variants' quantities. */
async function syncProductStock(productId) {
  await db.query(
    `
    UPDATE product
    SET
      product_stock = COALESCE((
        SELECT SUM(COALESCE(variant_product_quantity, 0))::int
        FROM variant_product
        WHERE product_id = $1
      ), 0),
      updated_at = NOW()
    WHERE product_id = $1
    `,
    [productId]
  );
}

const INSERT_VARIANT_SQL = `
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
      `;

const insertValues = (productId, payload) => [
  productId,
  payload.colorId,
  payload.slug,
  payload.quantity,
  payload.price,
  payload.priceSale,
  payload.listImage,
];

function list(query) {
  return guard({ error: "Failed to fetch variants" }, async () => {
    const productId = parseId(query.product_id);

    const sqlParts = ["SELECT * FROM variant_product"];
    const params = [];

    if (productId) {
      params.push(productId);
      sqlParts.push(`WHERE product_id = $${params.length}`);
    }

    sqlParts.push("ORDER BY variant_id ASC");

    const { rows } = await db.query(sqlParts.join(" "), params);
    return rows;
  });
}

function listByProductSlug(slug) {
  if (!slug) {
    throw new HttpError(400, { error: "Missing product slug" });
  }

  return guard({ error: "Failed to fetch variants by product" }, async () => {
    const { rows } = await db.query(
      `
      SELECT vp.*
      FROM variant_product vp
      JOIN product p ON vp.product_id = p.product_id
      WHERE p.product_slug = $1
      `,
      [slug]
    );

    return rows;
  });
}

function getByProductSlugAndColor(productSlug, rawColorId) {
  return guard({ error: "Loi khi lay chi tiet bien the" }, async () => {
    const colorId = parseId(rawColorId);

    if (!productSlug || !colorId) {
      throw new HttpError(400, { error: "Thieu productSlug hoac colorId" });
    }

    const { rows } = await db.query(
      `
      SELECT
        vp.variant_id,
        vp.product_id,
        c.color_id,
        c.color_name,
        c.color_code AS color_hex,
        c.color_id AS color_priority,
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
      throw new HttpError(404, { error: "Khong tim thay bien the phu hop" });
    }

    const data = rows[0];

    return {
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
    };
  });
}

/** Creates a variant (product_id in the body) and refreshes the product's stock. */
function create(body) {
  return guard({ error: "Failed to create variant" }, async () => {
    const productId = parseId(body.product_id);
    if (!productId) {
      throw new HttpError(400, { error: "Product ID is required" });
    }

    const payload = normalizeVariantPayload(body);

    if (!payload.colorId || !payload.slug) {
      throw new HttpError(400, {
        error: "color_id (or variant_colors) and slug are required",
      });
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity < 0) {
      throw new HttpError(400, { error: "quantity must be a non-negative number" });
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      throw new HttpError(400, { error: "price must be a non-negative number" });
    }

    if (payload.priceSale !== null && (!Number.isFinite(payload.priceSale) || payload.priceSale < 0)) {
      throw new HttpError(400, { error: "price_sale must be a non-negative number" });
    }

    const { rows: productRows } = await db.query(
      "SELECT product_id FROM product WHERE product_id = $1",
      [productId]
    );
    if (!productRows.length) {
      throw new HttpError(404, { error: "Product not found" });
    }

    const { rows: colorRows } = await db.query("SELECT color_id FROM color WHERE color_id = $1", [
      payload.colorId,
    ]);
    if (!colorRows.length) {
      throw new HttpError(404, { error: "Color not found" });
    }

    const { rows: insertedRows } = await db.query(INSERT_VARIANT_SQL, insertValues(productId, payload));

    const createdVariantId = insertedRows[0].variant_id;
    await syncProductStock(productId);
    const { rows: variantRows } = await db.query("SELECT * FROM variant_product WHERE variant_id = $1", [
      createdVariantId,
    ]);

    return {
      message: "Variant created successfully",
      variant: variantRows[0],
    };
  });
}

/** Deprecated: create a variant for the product in the URL, with per-field error reporting. */
function createForProduct(rawProductId, body) {
  const productId = parseId(rawProductId);
  const payload = normalizeVariantPayload(body);

  const errors = [];
  const addError = (field, message) => {
    errors.push({ field: `variants[0].${field}`, message });
  };

  if (!productId) {
    throw new HttpError(400, { error: "Thieu hoac sai productId" });
  }

  if (!payload.colorId) addError("color_id", "Mau sac la bat buoc");
  if (!payload.slug) addError("slug", "Slug la bat buoc");
  if (!Number.isFinite(payload.quantity)) addError("quantity", "So luong khong hop le");
  if (!Number.isFinite(payload.price)) addError("price", "Gia khong hop le");
  if (payload.priceSale !== null && !Number.isFinite(payload.priceSale)) {
    addError("price_sale", "Gia khuyen mai khong hop le");
  }

  if (errors.length > 0) {
    throw new HttpError(400, { error: "Du lieu khong hop le", errors });
  }

  const failure = (error) => ({ error: "Tao bien the that bai", detail: error.message });

  return guard(failure, async () => {
    const { rows: productRows } = await db.query(
      "SELECT product_id FROM product WHERE product_id = $1",
      [productId]
    );
    if (!productRows.length) {
      throw new HttpError(404, { error: "Product khong ton tai" });
    }

    const { rows: insertedRows } = await db.query(INSERT_VARIANT_SQL, insertValues(productId, payload));

    await syncProductStock(productId);

    return {
      message: "Tao bien the thanh cong",
      variant_id: insertedRows[0].variant_id,
      list_image: payload.listImage ? payload.listImage.split(",") : [],
    };
  });
}

/** Deprecated: full update of a variant. */
function update(rawVariantId, body) {
  const variantId = parseId(rawVariantId);
  const payload = normalizeVariantPayload(body);

  const errors = [];
  const addError = (field, message) => {
    errors.push({ field: `variants[0].${field}`, message });
  };

  if (!variantId) {
    // this endpoint answers with a bare array here
    throw new HttpError(400, [{ field: "variantId", message: "Thieu ID bien the." }]);
  }

  if (!payload.colorId) addError("color_id", "Vui long chon mau cho bien the.");
  if (!payload.slug) addError("slug", "Slug khong duoc de trong.");
  if (!Number.isFinite(payload.quantity) || payload.quantity < 0) {
    addError("quantity", "So luong phai la so khong am.");
  }
  if (!Number.isFinite(payload.price) || payload.price < 0) {
    addError("price", "Gia phai la so khong am.");
  }
  if (payload.priceSale !== null && (!Number.isFinite(payload.priceSale) || payload.priceSale < 0)) {
    addError("price_sale", "Gia khuyen mai phai la so khong am.");
  }
  if (!payload.listImage) addError("list_image", "Vui long chon it nhat 1 anh cho bien the.");

  if (errors.length > 0) {
    throw new HttpError(400, { errors });
  }

  const failure = (error) => ({ error: "Cap nhat bien the that bai", detail: error.message });

  return guard(failure, async () => {
    const { rows: existingRows } = await db.query(
      "SELECT variant_id, product_id FROM variant_product WHERE variant_id = $1",
      [variantId]
    );

    if (!existingRows.length) {
      throw new HttpError(404, { error: "Bien the khong ton tai." });
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

    await syncProductStock(existingRows[0].product_id);

    const { rows: updatedRows } = await db.query("SELECT * FROM variant_product WHERE variant_id = $1", [
      variantId,
    ]);

    return {
      message: "Cap nhat bien the thanh cong!",
      variant: updatedRows[0],
    };
  });
}

/** Deprecated: deletes a variant and its images unless an order still references it. */
function remove(rawVariantId) {
  const variantId = parseId(rawVariantId);

  if (!variantId) {
    throw new HttpError(400, { error: "Thieu variantId" });
  }

  const failure = (error) => ({ error: "Loi server khi xoa bien the", detail: error.message });

  return guard(failure, async () => {
    const { rows: existingRows } = await db.query(
      "SELECT * FROM variant_product WHERE variant_id = $1",
      [variantId]
    );

    if (!existingRows.length) {
      throw new HttpError(404, { error: "Bien the khong ton tai" });
    }

    const { rows: orderRows } = await db.query(
      "SELECT order_item_id FROM order_items WHERE variant_id = $1 LIMIT 1",
      [variantId]
    );

    if (orderRows.length > 0) {
      throw new HttpError(400, {
        error: "Khong the xoa bien the dang duoc su dung trong don hang",
      });
    }

    const listImageStr = existingRows[0].variant_product_list_image || "";
    const imageUrls = listImageStr
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);

    const publicIds = imageUrls.map((url) => publicIdFromVariantUrl(url)).filter(Boolean);

    await Promise.all(publicIds.map((publicId) => destroyQuietly(publicId)));

    await db.query("DELETE FROM variant_product WHERE variant_id = $1", [variantId]);
    await syncProductStock(existingRows[0].product_id);

    return {
      message: "Da xoa bien the va anh thanh cong",
      deletedImages: publicIds,
    };
  });
}

module.exports = {
  list,
  listByProductSlug,
  getByProductSlugAndColor,
  create,
  createForProduct,
  update,
  remove,
};
