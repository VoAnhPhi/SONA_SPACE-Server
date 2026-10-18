"use strict";

// SQL fragments and small parsers shared by the product services.

// The price a shopper pays: the cheapest sale price when one exists, else the cheapest list price.
const ACTUAL_PRICE_SQL = `
  (SELECT
    CASE
      WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
      ELSE MIN(vp2.variant_product_price)
    END
  FROM variant_product vp2
  WHERE vp2.product_id = p.product_id)`;

// Keys are the labels the storefront sends in the `price` query parameter.
const PRICE_FILTERS = {
  "Dưới 10 triệu": `${ACTUAL_PRICE_SQL} < 10000000`,
  "10 - 30 triệu": `${ACTUAL_PRICE_SQL} BETWEEN 10000000 AND 30000000`,
  "Trên 30 triệu": `${ACTUAL_PRICE_SQL} > 30000000`,
};

// Keys are the labels the storefront sends in the `sort` query parameter.
const SORTS = {
  "Giá tăng dần": `${ACTUAL_PRICE_SQL} ASC`,
  "Giá giảm dần": `${ACTUAL_PRICE_SQL} DESC`,
  "Mới nhất": "p.created_at DESC",
  "Giảm giá": `
    (SELECT
      MAX(
        CASE
          WHEN vp2.variant_product_price_sale > 0
          THEN ((vp2.variant_product_price - vp2.variant_product_price_sale) / vp2.variant_product_price * 100)
          ELSE 0
        END
      )
    FROM variant_product vp2
    WHERE vp2.product_id = p.product_id) DESC`,
};

const DEFAULT_SORT = "p.created_at DESC";

const priceFilterSql = (price) => (Object.hasOwn(PRICE_FILTERS, price) ? PRICE_FILTERS[price] : null);
const orderBySql = (sort) => (sort && Object.hasOwn(SORTS, sort) ? SORTS[sort] : DEFAULT_SORT);

// Attribute values of a product with their display text (a material name stands in for a free value).
const ATTRIBUTE_DISPLAY_SQL = `
        COALESCE(
          a.value_type,
          CASE
            WHEN pav.material_id IS NOT NULL THEN 'material_id'
            ELSE NULL::text
          END
        ) AS value_type,
        CASE
          WHEN pav.value IS NOT NULL AND pav.value <> '' THEN pav.value
          WHEN m.material_name IS NOT NULL THEN m.material_name
          ELSE NULL
        END AS value_display`;

// Cheapest-first variants of every product, default colour (color_id = 1) first.
const VARIANTS_FOR_PRODUCTS_SQL = `
      SELECT
        vp.product_id,
        vp.variant_id,
        vp.color_id,
        vp.variant_product_price        AS price,
        vp.variant_product_price_sale   AS price_sale,
        vp.variant_product_quantity     AS quantity,
        vp.variant_product_slug         AS variant_slug,
        vp.variant_product_list_image   AS list_image,
        col.color_name,
        col.color_code AS color_hex,
        col.color_id AS color_priority
      FROM variant_product vp
      JOIN color col ON vp.color_id = col.color_id
      WHERE vp.product_id = ANY($1::int[])
      ORDER BY col.color_id = 1 DESC, col.color_id ASC, vp.variant_id ASC
      `;

const ROOMS_FOR_PRODUCTS_SQL = `
      SELECT rp.product_id, r.room_id, r.room_name, r.slug
      FROM room_product rp
      JOIN room r ON rp.room_id = r.room_id
      WHERE rp.product_id = ANY($1::int[])
      `;

const ATTRIBUTES_FOR_PRODUCTS_SQL = `
      SELECT
        pav.product_id,
        a.attribute_id,
        a.attribute_name,
        a.unit,
        COALESCE(a.is_required, FALSE) AS is_required,${ATTRIBUTE_DISPLAY_SQL},
        pav.value AS raw_value,
        pav.material_id
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      LEFT JOIN materials m ON pav.material_id = m.material_id
      WHERE pav.product_id = ANY($1::int[])
      ORDER BY a.attribute_name ASC
      `;

const COMMENT_COUNTS_FOR_PRODUCTS_SQL = `
      SELECT vp.product_id, COUNT(*) AS comment_count
      FROM comment cm
      JOIN order_items oi ON oi.order_item_id = cm.order_item_id
      JOIN variant_product vp ON vp.variant_id = oi.variant_id
      WHERE vp.product_id = ANY($1::int[]) AND cm.deleted_at IS NULL
      GROUP BY vp.product_id
      `;

const STOCK_FOR_PRODUCTS_SQL = `
      SELECT product_id, COALESCE(SUM(variant_product_quantity),0) AS total_stock
      FROM variant_product
      WHERE product_id = ANY($1::int[])
      GROUP BY product_id
      `;

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const stripQuotes = (value) => (value || "").trim().replace(/^['"]+|['"]+$/g, "");

// "a.jpg, 'b.jpg'" -> ["a.jpg", "b.jpg"]
const splitImages = (list) =>
  (list || "")
    .split(",")
    .map((s) => stripQuotes(s))
    .filter(Boolean);

/** First image of a comma separated list, or null. */
const firstImage = (list) => (list ? list.split(",")[0].trim().replace(/^['"]+|['"]+$/g, "") : null);

module.exports = {
  ACTUAL_PRICE_SQL,
  priceFilterSql,
  orderBySql,
  ATTRIBUTE_DISPLAY_SQL,
  VARIANTS_FOR_PRODUCTS_SQL,
  ROOMS_FOR_PRODUCTS_SQL,
  ATTRIBUTES_FOR_PRODUCTS_SQL,
  COMMENT_COUNTS_FOR_PRODUCTS_SQL,
  STOCK_FOR_PRODUCTS_SQL,
  parseJsonArray,
  stripQuotes,
  splitImages,
  firstImage,
};
