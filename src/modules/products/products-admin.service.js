"use strict";

const db = require("../../config/database");
const { withTransaction } = require("../../shared/db/transaction");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const {
  publicIdFromProductUrl,
  publicIdFromRemovedImageUrl,
  destroyQuietly,
} = require("./product-images");

const isEmpty = (val) => val === undefined || val === null || String(val).trim() === "";
const isNumber = (val) => !isEmpty(val) && !isNaN(Number(val));

// Multi-row INSERT helpers: ($1, $2), ($3, $4), ...
function buildPlaceholders(rowCount, columnCount) {
  return Array.from({ length: rowCount }, (_, idx) => {
    const base = idx * columnCount;
    return `(${Array.from({ length: columnCount }, (_, col) => `$${base + col + 1}`).join(", ")})`;
  }).join(", ");
}

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

/** Product table of the admin page with first-variant prices, stock and review counts. */
function list() {
  return guard({ error: "Failed to fetch admin product list" }, async () => {
    const { rows: products } = await db.query(`
      SELECT
        p.product_id,
        p.product_name,
        p.product_image,
        c.category_name,
        p.product_sold,
        p.product_view,
        p.product_status,
        p.product_priority,
        p.created_at,
        p.updated_at,
        p.product_slug,
        -- Lấy giá gốc của variant đầu tiên
        (
          SELECT vp.variant_product_price
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price,

        -- Lấy giá sale của variant đầu tiên nếu có
        (
          SELECT
            CASE
              WHEN vp.variant_product_price_sale > 0 THEN vp.variant_product_price_sale
              ELSE NULL
            END
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price_sale,

        -- Tổng số lượng từ tất cả variants
        (
          SELECT SUM(vp.variant_product_quantity)
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
        ) AS total_quantity,

        -- Số lượng đánh giá
        (
          SELECT COUNT(*)
          FROM comment cm
          JOIN order_items oi ON oi.order_item_id = cm.order_item_id
          JOIN variant_product vp2 ON vp2.variant_id = oi.variant_id
          WHERE vp2.product_id = p.product_id
            AND cm.deleted_at IS NULL
        ) AS comment_count

      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      ORDER BY p.created_at DESC
    `);

    return products.map((product) => ({
      ...product,
      price: product.price || 0,
      price_sale: product.price_sale || null,
      total_quantity: product.total_quantity || 0,
      comment_count: product.comment_count || 0,
    }));
  });
}

/** Full product for the edit form: variants, rooms and attribute values. */
function getBySlug(slug) {
  if (!slug) throw new HttpError(400, { message: "Slug không hợp lệ" });

  return guard({ error: "Failed to fetch product details" }, async () => {
    const { rows: productRows } = await db.query(
      `
      SELECT
        p.product_id,
        p.product_name,
        p.product_description,
        p.product_slug,
        p.product_sold,
        p.product_view,
        p.product_status,
        p.category_id,
        p.product_image,
        p.created_at,
        p.updated_at,
        p.variant_materials,       -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_height,          -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_width,           -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_depth,           -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_seating_height,  -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        p.variant_maximum_weight_load, -- Giữ lại tạm thời theo cấu trúc bạn cung cấp
        c.category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_slug = $1
      `,
      [slug]
    );

    if (!productRows.length) {
      throw new HttpError(404, { error: "Product not found" });
    }

    const product = productRows[0];

    const { rows: variants } = await db.query(
      `
      SELECT
        vp.variant_id,
        vp.product_id,
        c.color_id,
        c.color_name,
        c.color_code AS color_hex,
        c.color_id AS color_priority,
        vp.variant_product_price AS price,
        vp.variant_product_price_sale AS price_sale,
        vp.variant_product_quantity AS quantity,
        vp.variant_product_slug AS slug,
        vp.variant_product_list_image AS list_image
      FROM variant_product vp
      JOIN color c ON vp.color_id = c.color_id
      WHERE vp.product_id = $1
      ORDER BY c.color_id DESC
      `,
      [product.product_id]
    );

    const variantsFull = variants.map((v) => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      color_id: v.color_id,
      color_name: v.color_name,
      color_hex: v.color_hex,
      quantity: v.quantity,
      price: v.price,
      price_sale: v.price_sale,
      slug: v.slug,
      list_image: v.list_image
        ? v.list_image.split(",").map((img) => img.trim().replace(/^['"]+|['"]+$/g, ""))
        : [],
    }));

    const { rows: rooms } = await db.query(
      `
      SELECT rp.room_id, r.room_name
      FROM room_product rp
      JOIN room r ON rp.room_id = r.room_id
      WHERE rp.product_id = $1
      `,
      [product.product_id]
    );

    const { rows: productAttributes } = await db.query(
      `
      SELECT
          pav.attribute_id,
          pav.value,
          pav.material_id,
          a.attribute_name,
          a.unit,
          COALESCE(a.is_required, FALSE) AS is_required,
          COALESCE(
            a.value_type,
            CASE
              WHEN pav.material_id IS NOT NULL THEN 'material_id'
              ELSE NULL::text
            END
          ) AS value_type
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      WHERE pav.product_id = $1
      `,
      [product.product_id]
    );

    return {
      product: {
        id: product.product_id,
        name: product.product_name,
        description: product.product_description,
        slug: product.product_slug,
        sold: product.product_sold,
        view: product.product_view,
        status: product.product_status,
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        main_image: product.product_image
          ? product.product_image.trim().replace(/^['"]+|['"]+$/g, "")
          : "",
        variants: variantsFull,
        attributes: productAttributes,
        materials: product.variant_materials,
        height: product.variant_height,
        width: product.variant_width,
        depth: product.variant_depth,
        seating_height: product.variant_seating_height,
        max_weight_load: product.variant_maximum_weight_load,
      },
      rooms,
    };
  });
}

// ---------------------------------------------------------------------------
// Create / update with full validation (used by the admin editor)
// ---------------------------------------------------------------------------

/** Validation errors of the create form, as { field, message } entries. */
async function validateNewProduct(body) {
  const {
    name,
    description,
    slug,
    category_id,
    status,
    main_image,
    room_ids,
    variants,
    attributes,
  } = body;

  const errors = [];

  if (isEmpty(name)) errors.push({ field: "name", message: "Tên sản phẩm là bắt buộc" });
  if (isEmpty(description)) {
    errors.push({ field: "description", message: "Mô tả sản phẩm là bắt buộc" });
  }
  if (isEmpty(slug)) errors.push({ field: "slug", message: "Slug là bắt buộc" });
  if (isEmpty(category_id)) errors.push({ field: "category_id", message: "Danh mục là bắt buộc" });
  if (isEmpty(status)) {
    errors.push({ field: "status", message: "Vui lòng chọn trạng thái" });
  } else if (![0, 1, "0", "1"].includes(status)) {
    errors.push({ field: "status", message: "Trạng thái không hợp lệ" });
  }
  if (isEmpty(main_image)) {
    errors.push({ field: "main_image", message: "Ảnh chính sản phẩm là bắt buộc" });
  }
  if (!Array.isArray(room_ids) || room_ids.length === 0) {
    errors.push({ field: "room_ids", message: "Vui lòng chọn ít nhất một phòng" });
  }

  let requiredAttributesFromDB = [];
  if (category_id) {
    const { rows: dbAttrs } = await db.query(
      `SELECT attribute_id, COALESCE(is_required, FALSE) AS is_required FROM attributes WHERE category_id = $1`,
      [category_id]
    );
    requiredAttributesFromDB = dbAttrs;
  }

  if (!Array.isArray(attributes)) {
    errors.push({
      field: "attributes",
      message: "Dữ liệu thuộc tính sản phẩm không hợp lệ.",
    });
  } else {
    const submittedAttributesMap = new Map();
    attributes.forEach((attr) => {
      submittedAttributesMap.set(attr.attribute_id, attr);
    });

    requiredAttributesFromDB.forEach((requiredAttr) => {
      const submittedAttr = submittedAttributesMap.get(requiredAttr.attribute_id);
      if (
        requiredAttr.is_required &&
        (!submittedAttr || (isEmpty(submittedAttr.value) && isEmpty(submittedAttr.material_id)))
      ) {
        errors.push({
          field: `attributes`,
          message: `Thuộc tính bắt buộc (ID: ${requiredAttr.attribute_id}) còn thiếu hoặc chưa có giá trị.`,
        });
      }
    });

    attributes.forEach((attr, i) => {
      if (isEmpty(attr.attribute_id)) {
        errors.push({
          field: `attributes[${i}].attribute_id`,
          message: `Thuộc tính ${i + 1}: Thiếu ID thuộc tính.`,
        });
      }

      if (!isEmpty(attr.value) && !isEmpty(attr.material_id)) {
        errors.push({
          field: `attributes[${i}]`,
          message: `Thuộc tính ${i + 1}: Không thể có cả giá trị và ID chất liệu.`,
        });
      }
    });
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    errors.push({ field: "variants", message: "Phải có ít nhất một biến thể sản phẩm" });
  } else {
    variants.forEach((v, i) => {
      const idx = i + 1;
      if (isEmpty(v.color_id)) {
        errors.push({
          field: `variants[${i}].color_id`,
          message: `Biến thể ${idx}: Thiếu màu sắc`,
        });
      }
      if (isEmpty(v.variant_slug)) {
        errors.push({
          field: `variants[${i}].variant_slug`,
          message: `Biến thể ${idx}: Thiếu slug`,
        });
      }
      if (!isNumber(v.price)) {
        errors.push({
          field: `variants[${i}].price`,
          message: `Biến thể ${idx}: Giá không hợp lệ`,
        });
      }
      if (!isNumber(v.quantity)) {
        errors.push({
          field: `variants[${i}].quantity`,
          message: `Biến thể ${idx}: Số lượng không hợp lệ`,
        });
      }
      if (!Array.isArray(v.list_image) || v.list_image.length === 0) {
        errors.push({
          field: `variants[${i}].list_image`,
          message: `Biến thể ${idx}: Cần ít nhất 1 ảnh`,
        });
      } else {
        v.list_image.forEach((img, j) => {
          if (typeof img !== "string" || !img.startsWith("http")) {
            errors.push({
              field: `variants[${i}].list_image[${j}]`,
              message: `Ảnh ${j + 1} của biến thể ${idx} không hợp lệ`,
            });
          }
        });
      }
    });
  }

  return errors;
}

/** Creates a product with its attribute values, variants and room links in one transaction. */
function add(body) {
  const { name, description, slug, category_id, status, main_image, room_ids, variants, attributes } =
    body;

  const outerFailure = (error) => ({ error: "Lỗi server", details: error.message });
  const insertFailure = (error) => ({
    error: "Lỗi server khi tạo sản phẩm",
    details: error.message,
  });

  return guard(outerFailure, async () => {
    const errors = await validateNewProduct(body);
    if (errors.length > 0) {
      throw new HttpError(400, { error: "Dữ liệu không hợp lệ", errors });
    }

    return guard(insertFailure, async () => {
      const totalVariantQuantity = variants.reduce(
        (sum, variant) => sum + Number(variant.quantity || 0),
        0
      );

      const createdProduct = await withTransaction(async (client) => {
        const { rows: productRows } = await client.query(
          `INSERT INTO product (
          product_name,
          product_description,
          product_slug,
          category_id,
          product_stock,
          product_status,
          product_image,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING product_id`,
          [name, description, slug, category_id, totalVariantQuantity, status, main_image]
        );
        const productId = productRows[0]?.product_id;

        if (attributes.length > 0) {
          const attributeValues = [];
          attributes.forEach((attr) => {
            attributeValues.push(
              productId,
              attr.attribute_id,
              attr.value === undefined || attr.value === "" ? null : attr.value,
              attr.material_id === undefined || attr.material_id === "" ? null : attr.material_id
            );
          });
          await client.query(
            `INSERT INTO product_attribute_value (product_id, attribute_id, value, material_id) VALUES ${buildPlaceholders(attributes.length, 4)}`,
            attributeValues
          );
        }

        for (const v of variants) {
          await client.query(
            `INSERT INTO variant_product (
              product_id,
              color_id,
              variant_product_price,
              variant_product_price_sale,
              variant_product_quantity,
              variant_product_list_image,
              variant_product_slug
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              productId,
              v.color_id,
              v.price,
              v.price_sale || null,
              v.quantity,
              v.list_image.join(","),
              v.variant_slug,
            ]
          );
        }

        if (room_ids.length > 0) {
          const roomValues = [];
          room_ids.forEach((rid) => roomValues.push(productId, rid));
          await client.query(
            `INSERT INTO room_product (product_id, room_id) VALUES ${buildPlaceholders(room_ids.length, 2)}`,
            roomValues
          );
        }

        return { productId };
      });

      return {
        message: "Tạo sản phẩm thành công",
        product_id: createdProduct.productId,
      };
    });
  });
}

/** Validation errors of the edit form; also checks the category's attribute rules in the database. */
async function validateProductUpdate(currentSlug, body) {
  const { name, description, category_id, status, main_image, room_ids, slug, attributes } = body;

  const errors = [];

  if (isEmpty(name)) errors.push({ field: "name", message: "Tên sản phẩm là bắt buộc" });
  if (isEmpty(description)) {
    errors.push({ field: "description", message: "Mô tả sản phẩm là bắt buộc" });
  }
  if (isEmpty(slug)) errors.push({ field: "slug", message: "Slug là bắt buộc" });

  if (!isEmpty(slug)) {
    try {
      const { rows: existingSlug } = await db.query(
        `SELECT product_id FROM product WHERE product_slug = $1 AND product_id <> (SELECT product_id FROM product WHERE product_slug = $2)`,
        [slug, currentSlug]
      );
      if (existingSlug.length > 0) {
        errors.push({
          field: "slug",
          message: "Slug đã tồn tại. Vui lòng chọn slug khác.",
        });
      }
    } catch (dbErr) {
      errors.push({ field: "slug", message: "Lỗi kiểm tra slug duy nhất." });
    }
  }

  if (isEmpty(category_id)) errors.push({ field: "category_id", message: "Danh mục là bắt buộc" });
  if (isEmpty(status)) {
    errors.push({ field: "status", message: "Vui lòng chọn trạng thái" });
  } else if (![0, 1, "0", "1"].includes(status)) {
    errors.push({ field: "status", message: "Trạng thái không hợp lệ" });
  }
  if (isEmpty(main_image)) {
    errors.push({ field: "main_image", message: "Ảnh chính sản phẩm là bắt buộc" });
  }

  if (!Array.isArray(attributes)) {
    errors.push({ field: "attributes", message: "Dữ liệu thuộc tính không hợp lệ." });
  } else {
    try {
      const { rows: categoryAttributesMeta } = await db.query(
        `SELECT
             attribute_id,
             attribute_name,
             value_type,
             unit,
             COALESCE(is_required, FALSE) AS is_required
             FROM attributes
             WHERE category_id = $1`,
        [category_id]
      );

      const categoryAttributeMap = new Map(
        categoryAttributesMeta.map((attr) => [attr.attribute_id, attr])
      );

      const payloadAttributeIds = new Set(attributes.map((attr) => attr.attribute_id));

      for (const payloadAttr of attributes) {
        const meta = categoryAttributeMap.get(payloadAttr.attribute_id);

        if (!meta) {
          errors.push({
            field: `attributes[${payloadAttr.attribute_id}]`,
            message: `Thuộc tính ID ${payloadAttr.attribute_id} không hợp lệ cho danh mục này.`,
          });
          continue;
        }

        if (meta.is_required) {
          if (meta.value_type === "material_id") {
            if (isEmpty(payloadAttr.material_id)) {
              errors.push({
                field: `attributes[${payloadAttr.attribute_id}].material_id`,
                message: `Thuộc tính "${meta.attribute_name}" (chất liệu) là bắt buộc.`,
              });
            }
          } else if (isEmpty(payloadAttr.value)) {
            errors.push({
              field: `attributes[${payloadAttr.attribute_id}].value`,
              message: `Thuộc tính "${meta.attribute_name}" là bắt buộc.`,
            });
          }
        }

        if (
          meta.value_type === "number" &&
          !isEmpty(payloadAttr.value) &&
          !isNumber(payloadAttr.value)
        ) {
          errors.push({
            field: `attributes[${payloadAttr.attribute_id}].value`,
            message: `Giá trị cho "${meta.attribute_name}" phải là số hợp lệ.`,
          });
        }

        if (meta.value_type === "material_id" && !isEmpty(payloadAttr.material_id)) {
          const { rows: materialExists } = await db.query(
            `SELECT material_id FROM materials WHERE material_id = $1`,
            [payloadAttr.material_id]
          );
          if (materialExists.length === 0) {
            errors.push({
              field: `attributes[${payloadAttr.attribute_id}].material_id`,
              message: `Chất liệu ID ${payloadAttr.material_id} không tồn tại.`,
            });
          }
        }
      }

      for (const meta of categoryAttributesMeta) {
        if (meta.is_required && !payloadAttributeIds.has(meta.attribute_id)) {
          errors.push({
            field: `attributes[${meta.attribute_id}]`,
            message: `Thuộc tính "${meta.attribute_name}" là bắt buộc nhưng bị thiếu.`,
          });
        }
      }
    } catch (attrErr) {
      errors.push({ field: "attributes", message: "Lỗi server khi xác thực thuộc tính." });
    }
  }

  if (!Array.isArray(room_ids) || room_ids.length === 0) {
    errors.push({ field: "room_ids", message: "Vui lòng chọn ít nhất một phòng" });
  }

  return errors;
}

/** Updates a product found by its current slug: fields, attribute values and room links. */
async function updateBySlug(currentSlug, body) {
  const { name, description, category_id, status, main_image, room_ids, removedImages = [], slug, attributes } =
    body;

  const errors = await validateProductUpdate(currentSlug, body);
  if (errors.length > 0) {
    throw new HttpError(400, { error: "Dữ liệu không hợp lệ", errors });
  }

  // Images the editor removed are deleted from Cloudinary up front; failures do not matter
  if (removedImages.length) {
    for (const imageUrl of removedImages) {
      const publicId = publicIdFromRemovedImageUrl(imageUrl);
      if (publicId) await destroyQuietly(publicId);
    }
  }

  const failure = (error) => ({ error: "Failed to update product", details: error.message });

  return guard(failure, async () => {
    const txResult = await withTransaction(async (client) => {
      const { rows: productRows } = await client.query(
        `SELECT product_id, product_priority FROM product WHERE product_slug = $1`,
        [currentSlug]
      );
      if (!productRows.length) {
        return { notFound: true };
      }

      const productId = productRows[0].product_id;
      const currentPriority = productRows[0].product_priority;

      // A product that was never prioritised goes to the end of the priority order
      let newPriority = currentPriority;
      if (currentPriority === 0) {
        const { rows: maxPriorityResult } = await client.query(
          `SELECT MAX(product_priority) AS max_priority FROM product`
        );
        const maxPriority = maxPriorityResult[0]?.max_priority || 0;
        newPriority = maxPriority + 1;
      }

      await client.query(
        `UPDATE product SET
          product_name = $1,
          product_slug = $2,
          product_description = $3,
          category_id = $4,
          product_status = $5,
          product_image = $6,
          product_priority = $7
        WHERE product_id = $8`,
        [name, slug, description, category_id, status, main_image, newPriority, productId]
      );

      await client.query(`DELETE FROM product_attribute_value WHERE product_id = $1`, [productId]);

      if (attributes && attributes.length > 0) {
        const attributeValues = [];
        attributes.forEach((attr) => {
          attributeValues.push(
            productId,
            attr.attribute_id,
            attr.value ?? null,
            attr.material_id ?? null
          );
        });
        await client.query(
          `INSERT INTO product_attribute_value (product_id, attribute_id, value, material_id) VALUES ${buildPlaceholders(attributes.length, 4)}`,
          attributeValues
        );
      }

      await client.query(`DELETE FROM room_product WHERE product_id = $1`, [productId]);
      if (room_ids.length > 0) {
        const roomValues = [];
        room_ids.forEach((roomId) => roomValues.push(productId, roomId));
        await client.query(
          `INSERT INTO room_product (product_id, room_id) VALUES ${buildPlaceholders(room_ids.length, 2)}`,
          roomValues
        );
      }

      return { productId };
    });

    if (txResult.notFound) {
      throw new HttpError(404, { error: "Product not found" });
    }

    const productId = txResult.productId;
    const { rows: updatedProductRows } = await db.query(
      `SELECT
        p.*,
        c.category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_id = $1`,
      [productId]
    );

    const { rows: productAttributesValues } = await db.query(
      `SELECT pav.attribute_id, pav.value, pav.material_id, a.attribute_name,
              a.unit,
              COALESCE(a.is_required, FALSE) AS is_required,
              COALESCE(
                a.value_type,
                CASE
                  WHEN pav.material_id IS NOT NULL THEN 'material_id'
                  ELSE NULL::text
                END
              ) AS value_type
         FROM product_attribute_value pav
         JOIN attributes a ON pav.attribute_id = a.attribute_id
         WHERE pav.product_id = $1`,
      [productId]
    );

    return {
      message: "Product updated successfully",
      product: {
        ...updatedProductRows[0],
        attributes: productAttributesValues,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Delete and status
// ---------------------------------------------------------------------------

/** Deletes a product; one that was ever ordered is hidden instead so order history stays intact. */
function remove(slug) {
  if (!slug) throw new HttpError(400, { message: "Slug không hợp lệ" });

  return guard({ error: "Failed to delete product" }, async () => {
    const result = await withTransaction(async (client) => {
      const { rows: existingProduct } = await client.query(
        "SELECT product_id, product_image FROM product WHERE product_slug = $1",
        [slug]
      );
      if (!existingProduct.length) {
        return { notFound: true };
      }

      const { product_id, product_image } = existingProduct[0];

      const { rows: variants } = await client.query(
        "SELECT variant_id, variant_product_list_image FROM variant_product WHERE product_id = $1",
        [product_id]
      );
      const variantIds = variants.map((v) => v.variant_id);

      if (variantIds.length > 0) {
        const { rows: orderItems } = await client.query(
          "SELECT order_item_id FROM order_items WHERE variant_id = ANY($1::int[]) LIMIT 1",
          [variantIds]
        );
        if (orderItems.length > 0) {
          await client.query("UPDATE product SET product_status = 0 WHERE product_id = $1", [
            product_id,
          ]);
          return { softHidden: true };
        }
      }

      for (const variant of variants) {
        const imageUrls = variant.variant_product_list_image
          ? variant.variant_product_list_image.split(",")
          : [];
        for (const url of imageUrls) {
          const publicId = publicIdFromProductUrl(url.trim());
          if (publicId) await destroyQuietly(publicId);
        }
      }

      if (product_image) {
        const publicId = publicIdFromProductUrl(product_image.trim());
        if (publicId) await destroyQuietly(publicId);
      }

      await client.query(
        `
        DELETE FROM comment
        WHERE order_item_id IN (
          SELECT oi.order_item_id
          FROM order_items oi
          JOIN variant_product vp ON vp.variant_id = oi.variant_id
          WHERE vp.product_id = $1
        )
        `,
        [product_id]
      );

      await client.query("DELETE FROM product_attribute_value WHERE product_id = $1", [product_id]);

      if (variantIds.length > 0) {
        await client.query("DELETE FROM wishlist WHERE variant_id = ANY($1::int[])", [variantIds]);
      }

      await client.query("DELETE FROM variant_product WHERE product_id = $1", [product_id]);
      await client.query("DELETE FROM room_product WHERE product_id = $1", [product_id]);
      await client.query("DELETE FROM product WHERE product_id = $1", [product_id]);

      return { deleted: true };
    });

    if (result.notFound) {
      throw new HttpError(404, { error: "Product not found" });
    }
    if (result.softHidden) {
      return {
        message:
          "Sản phẩm đang được mua trong đơn hàng, không thể xoá. Trạng thái đã được chuyển sang 'ẩn'.",
      };
    }
    return { message: "Xoá sản phẩm thành công" };
  });
}

function updateStatus(rawId, body) {
  const id = Number(rawId);
  const { product_status } = body;
  if (isNaN(id) || ![0, 1].includes(Number(product_status))) {
    throw new HttpError(400, { error: "Invalid product id or status" });
  }

  return guard({ error: "Failed to update product status" }, async () => {
    const { rowCount } = await db.query(
      "UPDATE product SET product_status = $1 WHERE product_id = $2",
      [product_status, id]
    );
    if (!rowCount) {
      throw new HttpError(404, { error: "Product not found" });
    }
    return { message: "Product status updated successfully" };
  });
}

// ---------------------------------------------------------------------------
// Original create/update API (kept mounted; it targets columns that no longer exist)
// ---------------------------------------------------------------------------

function legacyCreate(body) {
  return guard({ error: "Failed to create product" }, async () => {
    const {
      name,
      description,
      price,
      category_id,
      stock,
      sku,
      image,
      dimensions,
      material,
      variants,
      room_ids,
    } = body;

    if (!name || !price || !category_id) {
      throw new HttpError(400, { error: "Name, price and category_id are required" });
    }

    const { rows: createdRows } = await db.query(
      `
      INSERT INTO product (
        product_name, product_description, product_price, category_id, product_stock, product_sku,
        product_image, product_dimensions, product_material, product_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING product_id
    `,
      [
        name,
        description || null,
        price,
        category_id,
        stock || 0,
        sku || null,
        image || null,
        dimensions || null,
        material || null,
        1,
      ]
    );

    const productId = createdRows[0]?.product_id;

    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantValues = [];
      variants.forEach((v) => {
        variantValues.push(
          productId,
          v.color || null,
          v.size || null,
          v.price || price,
          v.sku || null,
          v.image || null,
          v.stock || 0
        );
      });

      await db.query(
        `
        INSERT INTO variant_product (
          product_id, color, size, price, sku, image, stock
        ) VALUES ${buildPlaceholders(variants.length, 7)}
      `,
        variantValues
      );
    }

    if (room_ids && Array.isArray(room_ids) && room_ids.length > 0) {
      const roomValues = [];
      room_ids.forEach((roomId) => roomValues.push(productId, roomId));

      await db.query(
        `
        INSERT INTO room_product (product_id, room_id)
        VALUES ${buildPlaceholders(room_ids.length, 2)}
      `,
        roomValues
      );
    }

    const { rows: createdProduct } = await db.query(
      `
      SELECT * FROM product WHERE product_id = $1
    `,
      [productId]
    );

    return {
      message: "Product created successfully",
      product: createdProduct[0],
    };
  });
}

function legacyUpdate(rawId, body) {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { message: "ID phải là số" });

  return guard({ error: "Failed to update product" }, async () => {
    const {
      name,
      description,
      price,
      category_id,
      stock,
      sku,
      image,
      dimensions,
      material,
      variants,
      room_ids,
    } = body;

    const { rows: existingProduct } = await db.query(
      "SELECT product_id FROM product WHERE product_id = $1",
      [id]
    );

    if (!existingProduct.length) {
      throw new HttpError(404, { error: "Product not found" });
    }

    await db.query(
      `
      UPDATE product
      SET
        product_name = COALESCE($1, product_name),
        product_description = COALESCE($2, product_description),
        product_price = COALESCE($3, product_price),
        category_id = COALESCE($4, category_id),
        product_stock = COALESCE($5, product_stock),
        product_sku = COALESCE($6, product_sku),
        product_image = COALESCE($7, product_image),
        product_dimensions = COALESCE($8, product_dimensions),
        product_material = COALESCE($9, product_material),
        product_status = COALESCE($10, product_status),
        updated_at = NOW()
      WHERE product_id = $11
    `,
      [
        name || null,
        description || null,
        price || null,
        category_id || null,
        stock || null,
        sku || null,
        image || null,
        dimensions || null,
        material || null,
        1,
        id,
      ]
    );

    if (variants && Array.isArray(variants) && variants.length > 0) {
      await db.query("DELETE FROM variant_product WHERE product_id = $1", [id]);

      const variantValues = [];
      variants.forEach((v) => {
        variantValues.push(
          id,
          v.color || null,
          v.size || null,
          v.price || price,
          v.sku || null,
          v.image || null,
          v.stock || 0
        );
      });

      await db.query(
        `
        INSERT INTO variant_product (
          product_id, color, size, price, sku, image, stock
        ) VALUES ${buildPlaceholders(variants.length, 7)}
      `,
        variantValues
      );
    }

    if (room_ids && Array.isArray(room_ids)) {
      await db.query("DELETE FROM room_product WHERE product_id = $1", [id]);

      if (room_ids.length > 0) {
        const roomValues = [];
        room_ids.forEach((roomId) => roomValues.push(id, roomId));

        await db.query(
          `
          INSERT INTO room_product (product_id, room_id)
          VALUES ${buildPlaceholders(room_ids.length, 2)}
        `,
          roomValues
        );
      }
    }

    const { rows: updatedProduct } = await db.query(
      `
      SELECT * FROM product WHERE product_id = $1
    `,
      [id]
    );

    return {
      message: "Product updated successfully",
      product: updatedProduct[0],
    };
  });
}

module.exports = {
  list,
  getBySlug,
  add,
  updateBySlug,
  remove,
  updateStatus,
  legacyCreate,
  legacyUpdate,
};
