"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const {
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
} = require("./products.queries");

const LIMIT_PER_PAGE = 8;

// The default variant of a product: color_id = 1 first, then the lowest color id and variant id.
const DEFAULT_VARIANT_ID_SQL = `
      SELECT vp2.variant_id
      FROM variant_product vp2
      JOIN color c2 ON vp2.color_id = c2.color_id
      WHERE vp2.product_id = p.product_id
      ORDER BY c2.color_id = 1 DESC, c2.color_id ASC, vp2.variant_id ASC
      LIMIT 1`;

// ---------------------------------------------------------------------------
// Storefront listing (two variants of the same endpoint: by slug and by name)
// ---------------------------------------------------------------------------

/**
 * Filters of the storefront listing. `bySlug` selects the /all flavour (category and room given
 * as slugs); the plain listing filters by category and room name.
 */
function buildListingFilters(query, bySlug) {
  const whereConditions = ["p.product_status = 1"];
  const params = [];
  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (bySlug) {
    if (query.categorySlug) {
      whereConditions.push(`c.slug = ${addParam(query.categorySlug)}`);
    }

    if (query.roomSlug) {
      whereConditions.push(`
          p.product_id IN (
            SELECT DISTINCT rp.product_id
            FROM room_product rp
            JOIN room r ON rp.room_id = r.room_id
            WHERE r.slug = ${addParam(query.roomSlug)}
          )
        `);
    }
  } else {
    if (query.category) {
      whereConditions.push(`c.category_name = ${addParam(query.category)}`);
    }

    if (query.room) {
      whereConditions.push(
        `EXISTS (SELECT 1 FROM room_product rp JOIN room r ON rp.room_id = r.room_id WHERE rp.product_id = p.product_id AND r.room_name = ${addParam(query.room)})`
      );
    }
  }

  if (query.price) {
    const priceCondition = priceFilterSql(query.price);
    if (priceCondition) whereConditions.push(priceCondition);
  }

  if (query.color) {
    whereConditions.push(`col.color_name = ${addParam(query.color)}`);
  }

  return { whereConditions, params, orderBy: orderBySql(query.sort) };
}

async function countListing(whereConditions, params) {
  const { rows: countRows } = await db.query(
    `
      SELECT COUNT(DISTINCT p.product_id) AS "totalProducts"
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE ${whereConditions.join(" AND ")}
    `,
    params
  );
  return Number(countRows[0]?.totalProducts || 0);
}

function listingPagination({ totalProducts, page, limit }) {
  return {
    totalProducts,
    currentPage: page,
    productsPerPage: limit,
    totalPages: Math.ceil(totalProducts / limit),
  };
}

/** Listing with category/room given as slugs, including the rooms each product belongs to. */
function listBySlugFilters(query, userId) {
  return guard({ error: "Failed to fetch products" }, async () => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 8;
    const offset = (page - 1) * limit;

    const { whereConditions, params, orderBy } = buildListingFilters(query, true);
    const totalProducts = await countListing(whereConditions, params);

    const userIdIndex = `$${params.length + 1}`;
    const limitIndex = `$${params.length + 2}`;
    const offsetIndex = `$${params.length + 3}`;

    const { rows: products } = await db.query(
      `
        SELECT
          p.product_id AS id,
          p.product_name AS name,
          p.product_slug AS slug,
          p.product_image AS image,
          p.category_id,
          c.category_name,
          p.created_at,
          p.updated_at,
          (
            SELECT MIN(vp2.variant_product_price)
            FROM variant_product vp2
            WHERE vp2.product_id = p.product_id
          ) AS price,
          (
            SELECT MIN(vp2.variant_product_price_sale)
            FROM variant_product vp2
            WHERE vp2.product_id = p.product_id AND vp2.variant_product_price_sale > 0
          ) AS price_sale,
          COALESCE(
            json_agg(DISTINCT col.color_code) FILTER (WHERE col.color_code IS NOT NULL),
            '[]'::json
          ) AS color_hex,
          COALESCE(
            json_agg(DISTINCT r3.slug) FILTER (WHERE r3.slug IS NOT NULL),
            '[]'::json
          ) AS rooms,
          (${DEFAULT_VARIANT_ID_SQL}) AS variant_id,
          (
            SELECT EXISTS (
              SELECT 1
              FROM wishlist w
              WHERE w.variant_id = (${DEFAULT_VARIANT_ID_SQL})
              AND w.user_id = ${userIdIndex}
              AND w.status = 1
            )
          ) AS "isWishlist"
        FROM product p
        LEFT JOIN category c ON p.category_id = c.category_id
        LEFT JOIN variant_product vp ON p.product_id = vp.product_id
        LEFT JOIN color col ON vp.color_id = col.color_id
        LEFT JOIN room_product rp3 ON p.product_id = rp3.product_id
        LEFT JOIN room r3 ON r3.room_id = rp3.room_id
        WHERE ${whereConditions.join(" AND ")}
        GROUP BY p.product_id, c.category_name
        ORDER BY ${orderBy}
        LIMIT ${limitIndex} OFFSET ${offsetIndex}
      `,
      [...params, userId, limit, offset]
    );

    return {
      products: products.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        image: item.image,
        category_id: item.category_id,
        category_name: item.category_name,
        created_at: item.created_at,
        updated_at: item.updated_at,
        price: item.price ?? "0.00",
        price_sale: item.price_sale ?? "0.00",
        color_hex: parseJsonArray(item.color_hex),
        rooms: parseJsonArray(item.rooms),
        variant_id: item.variant_id,
        isWishlist: Boolean(item.isWishlist),
      })),
      pagination: listingPagination({ totalProducts, page, limit }),
    };
  });
}

/** Listing with category/room given by name. */
function listByNameFilters(query, userId) {
  return guard({ error: "Failed to fetch products" }, async () => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 8;
    const offset = (page - 1) * limit;

    const { whereConditions, params, orderBy } = buildListingFilters(query, false);
    const totalProducts = await countListing(whereConditions, params);

    const userIdIndex = `$${params.length + 1}`;
    const limitIndex = `$${params.length + 2}`;
    const offsetIndex = `$${params.length + 3}`;

    const { rows: products } = await db.query(
      `
  SELECT
    p.product_id AS id,
    p.product_name AS name,
    p.product_slug AS slug,
    p.product_image AS image,
    p.category_id,
    c.category_name,
    p.created_at,
    p.updated_at,
    (
      SELECT MIN(vp2.variant_product_price)
      FROM variant_product vp2
      WHERE vp2.product_id = p.product_id
    ) AS price,
    (
      SELECT MIN(vp2.variant_product_price_sale)
      FROM variant_product vp2
      WHERE vp2.product_id = p.product_id AND vp2.variant_product_price_sale > 0
    ) AS price_sale,
    COALESCE(
      json_agg(DISTINCT col.color_code) FILTER (WHERE col.color_code IS NOT NULL),
      '[]'::json
    ) AS color_hex,

    (
      SELECT
        CASE
          WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
          ELSE MIN(vp2.variant_product_price)
        END
      FROM variant_product vp2
      WHERE vp2.product_id = p.product_id
    ) AS actual_price,

    (${DEFAULT_VARIANT_ID_SQL}) AS variant_id,

    (
      SELECT EXISTS (
        SELECT 1
        FROM wishlist w
        WHERE w.variant_id = (${DEFAULT_VARIANT_ID_SQL})
        AND w.user_id = ${userIdIndex}
        AND w.status = 1
      )
    ) AS "isWishlist"

  FROM product p
  LEFT JOIN category c ON p.category_id = c.category_id
  LEFT JOIN variant_product vp ON p.product_id = vp.product_id
  LEFT JOIN color col ON vp.color_id = col.color_id
  WHERE ${whereConditions.join(" AND ")}
  GROUP BY p.product_id, c.category_name
  ORDER BY ${orderBy}
  LIMIT ${limitIndex} OFFSET ${offsetIndex}
`,
      [...params, userId, limit, offset]
    );

    return {
      products: products.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        image: item.image,
        category_id: item.category_id,
        category_name: item.category_name,
        created_at: item.created_at,
        updated_at: item.updated_at,
        price: item.price ?? "0.00",
        price_sale: item.price_sale ?? "0.00",
        color_hex: parseJsonArray(item.color_hex),
        variant_id: item.variant_id,
        isWishlist: Boolean(item.isWishlist),
      })),
      pagination: listingPagination({ totalProducts, page, limit }),
    };
  });
}

// ---------------------------------------------------------------------------
// Small lists
// ---------------------------------------------------------------------------

function search(rawKeyword) {
  const keyword = rawKeyword?.trim() || "";
  if (!keyword) return { results: [] };

  return guard({ error: "Search failed" }, async () => {
    const { rows } = await db.query(
      `
      SELECT
        product_id AS id,
        product_name AS name,
        product_slug AS slug,
        product_image AS image
      FROM product
      WHERE product_status = 1
        AND product_name ILIKE $1
      ORDER BY created_at DESC
      LIMIT 10
    `,
      [`%${keyword}%`]
    );

    return {
      results: rows.map((item) => ({
        ...item,
        image: item.image ? String(item.image) : "",
      })),
    };
  });
}

/** Up to four other products that share a room with the given one. */
function relatedByRoom(rawProductId, userId) {
  const failure = (error) => {
    console.error("GET /api/products/related/by-room/:productId error:", error.message);
    return { error: "Lỗi lấy sản phẩm liên quan theo room" };
  };

  const productId = Number(rawProductId);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new HttpError(400, { error: "Invalid productId" });
  }

  return guard(failure, async () => {
    const { rows: relatedProducts } = await db.query(
      `
      SELECT
        p.product_id AS id,
        p.product_name AS name,
        p.product_slug AS slug,
        p.product_image AS image,
        p.category_id,
        cat.category_name,

        (
          SELECT vp.variant_product_price
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price,

        (
          SELECT vp.variant_product_price_sale
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          AND vp.variant_product_price_sale > 0
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price_sale,

        (
          SELECT vp.variant_id
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS variant_id,

        COALESCE(
          json_agg(DISTINCT col.color_code) FILTER (WHERE col.color_code IS NOT NULL),
          '[]'::json
        ) AS color_hex,

        (
          SELECT COUNT(*)
          FROM comment cm
          JOIN order_items oi ON oi.order_item_id = cm.order_item_id
          JOIN variant_product vp2 ON vp2.variant_id = oi.variant_id
          WHERE vp2.product_id = p.product_id
        ) AS comment_count,

        (
          SELECT EXISTS (
            SELECT 1
            FROM wishlist w
            JOIN variant_product vp ON w.variant_id = vp.variant_id
            WHERE vp.product_id = p.product_id
              AND w.user_id = $1
              AND w.status = 1
          )
        ) AS isWishlist

      FROM room_product rp1
      JOIN room_product rp2 ON rp1.room_id = rp2.room_id
      JOIN product p ON p.product_id = rp2.product_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE rp1.product_id = $2 AND rp2.product_id != $3
      GROUP BY p.product_id, cat.category_name
      LIMIT 4
      `,
      [userId, productId, productId]
    );

    return {
      related_products: relatedProducts.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        image: item.image,
        category_id: item.category_id,
        category_name: item.category_name,
        variant_id: item.variant_id,
        price: item.price ?? 0,
        price_sale: item.price_sale ?? 0,
        color_hex: parseJsonArray(item.color_hex),
        comment_count: item.comment_count ?? 0,
        // the SQL alias is unquoted, so PostgreSQL returns it in lower case
        isWishlist: Boolean(item.iswishlist),
      })),
    };
  });
}

function newest(query, userId) {
  return guard({ error: "Failed to fetch newest products" }, async () => {
    const limit = parseInt(query.limit) || 8;

    const { rows: products } = await db.query(
      `
      SELECT
        p.product_id AS id,
        p.product_name AS name,
        p.product_slug AS slug,
        p.product_image AS image,
        p.category_id,
        cat.category_name,
        p.created_at,
        p.updated_at,

        (
          SELECT vp2.variant_product_price
          FROM variant_product vp2
          WHERE vp2.product_id = p.product_id
          ORDER BY vp2.variant_id ASC
          LIMIT 1
        ) AS price,

        (
          SELECT vp2.variant_product_price_sale
          FROM variant_product vp2
          WHERE vp2.product_id = p.product_id
          AND vp2.variant_product_price_sale > 0
          ORDER BY vp2.variant_id ASC
          LIMIT 1
        ) AS price_sale,

        COALESCE(
          json_agg(DISTINCT col.color_code) FILTER (WHERE col.color_code IS NOT NULL),
          '[]'::json
        ) AS color_hex,

        (
          SELECT COUNT(*)
          FROM comment cm
          JOIN order_items oi ON oi.order_item_id = cm.order_item_id
          JOIN variant_product vp4 ON vp4.variant_id = oi.variant_id
          WHERE vp4.product_id = p.product_id
        ) AS comment_count,

        (
          SELECT vp2.variant_id
          FROM variant_product vp2
          WHERE vp2.product_id = p.product_id
          ORDER BY vp2.variant_id ASC
          LIMIT 1
        ) AS variant_id,

        (
          SELECT EXISTS (
            SELECT 1
            FROM wishlist w
            WHERE w.variant_id = (
              SELECT vp3.variant_id
              FROM variant_product vp3
              WHERE vp3.product_id = p.product_id
              ORDER BY vp3.variant_id ASC
              LIMIT 1
            )
            AND w.user_id = $1
            AND w.status = 1
          )
        ) AS isWishlist

      FROM product p
      LEFT JOIN category cat ON p.category_id = cat.category_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      WHERE p.product_status = 1
      GROUP BY p.product_id, cat.category_name
      ORDER BY p.created_at DESC
      LIMIT $2
    `,
      [userId, limit]
    );

    return products.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      image: item.image,
      category_id: item.category_id,
      category_name: item.category_name,
      variant_id: item.variant_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
      price: item.price ?? "0.00",
      price_sale: item.price_sale ?? "0.00",
      color_hex: parseJsonArray(item.color_hex),
      comment_count: item.comment_count ?? 0,
      isWishlist: Boolean(item.iswishlist),
    }));
  });
}

/** One row per variant with its first image. */
function listVariants() {
  return guard({ error: "Failed to fetch variants" }, async () => {
    const { rows: variants } = await db.query(
      `
      SELECT
        vp.variant_id,
        vp.product_id,
        p.product_name,
        vp.color_id,
        vp.variant_product_price AS variant_product_price,
        vp.variant_product_price_sale AS variant_product_price_sale,
        vp.variant_product_quantity AS variant_product_quantity,
        vp.variant_product_slug AS variant_product_slug,
        vp.variant_product_list_image AS list_image
      FROM variant_product vp
      JOIN product p ON vp.product_id = p.product_id
      ORDER BY vp.product_id, vp.variant_id
      `
    );

    return variants.map((v) => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      product_name: v.product_name,
      color_id: v.color_id,
      price: v.variant_product_price,
      price_sale: v.variant_product_price_sale,
      quantity: v.variant_product_quantity,
      slug: v.variant_product_slug,
      first_image: firstImage(v.list_image),
    }));
  });
}

function groupBy(rows, keyOf) {
  const map = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

/**
 * Every active product with variants, rooms, attributes, stock and review count, built from six
 * batched queries. The wishlist flag is always false here (this endpoint is anonymous).
 */
function fullList() {
  return guard({ error: "Failed to fetch full product list" }, async () => {
    const { rows: products } = await db.query(
      `
      SELECT
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_description,
        p.product_image,
        p.product_sold,
        p.product_view,
        p.product_status,
        p.category_id,
        c.category_name,
        p.created_at,
        p.updated_at
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_status = 1
      ORDER BY p.created_at DESC
      `
    );

    if (!products.length) {
      return { products: [] };
    }

    const productIds = products.map((p) => p.product_id);
    const idParams = productIds.length ? productIds : [-1];

    const { rows: variantRows } = await db.query(VARIANTS_FOR_PRODUCTS_SQL, [idParams]);
    const { rows: roomRows } = await db.query(ROOMS_FOR_PRODUCTS_SQL, [idParams]);
    const { rows: attrRows } = await db.query(ATTRIBUTES_FOR_PRODUCTS_SQL, [idParams]);
    const { rows: commentAgg } = await db.query(COMMENT_COUNTS_FOR_PRODUCTS_SQL, [idParams]);
    const { rows: stockAgg } = await db.query(STOCK_FOR_PRODUCTS_SQL, [idParams]);

    const variantsByPid = groupBy(variantRows, (v) => v.product_id);

    const roomsByPid = new Map();
    for (const r of roomRows) {
      if (!roomsByPid.has(r.product_id)) roomsByPid.set(r.product_id, []);
      roomsByPid.get(r.product_id).push({
        room_id: r.room_id,
        room_name: r.room_name,
        slug: r.slug,
      });
    }

    const attrsByPid = new Map();
    for (const a of attrRows) {
      if (!attrsByPid.has(a.product_id)) attrsByPid.set(a.product_id, []);
      attrsByPid.get(a.product_id).push({
        attribute_id: a.attribute_id,
        name: a.attribute_name,
        unit: a.unit,
        is_required: !!a.is_required,
        value_type: a.value_type,
        value_display: a.value_display,
        raw_value: a.raw_value,
        material_id: a.material_id,
      });
    }

    const commentByPid = new Map(commentAgg.map((r) => [r.product_id, r.comment_count]));
    const stockByPid = new Map(stockAgg.map((r) => [r.product_id, r.total_stock]));

    const result = products.map((p) => {
      const vListRaw = variantsByPid.get(p.product_id) || [];
      const vList = vListRaw.map((v) => ({
        variant_id: v.variant_id,
        product_id: v.product_id,
        color_id: v.color_id,
        color_name: v.color_name,
        color_hex: v.color_hex,
        color_priority: v.color_priority,
        price: v.price,
        price_sale: v.price_sale,
        quantity: v.quantity,
        slug: v.variant_slug,
        images: splitImages(v.list_image),
      }));

      // default variant = first element (already ordered by colour priority)
      const dv = vList[0] || null;

      let min_price = null,
        min_price_sale = null,
        min_actual_price = null;
      for (const it of vList) {
        if (min_price === null || (it.price ?? Infinity) < min_price) min_price = it.price ?? null;
        if (it.price_sale > 0) {
          if (min_price_sale === null || it.price_sale < min_price_sale) min_price_sale = it.price_sale;
          if (min_actual_price === null || it.price_sale < min_actual_price) min_actual_price = it.price_sale;
        }
      }
      if (min_actual_price === null) min_actual_price = min_price;

      const colors = vList.map((v) => ({
        colorId: v.color_id,
        colorName: v.color_name,
        colorHex: v.color_hex,
        slug: v.slug,
      }));

      return {
        id: p.product_id,
        name: p.product_name,
        slug: p.product_slug,
        description: p.product_description,
        main_image: stripQuotes(p.product_image),
        sold: p.product_sold,
        view: p.product_view,
        status: p.product_status,
        category_id: p.category_id,
        category_name: p.category_name,
        created_at: p.created_at,
        updated_at: p.updated_at,

        min_price,
        min_price_sale,
        min_actual_price,

        default_variant: dv
          ? {
              variant_id: dv.variant_id,
              color_name: dv.color_name,
              color_hex: dv.color_hex,
              price: dv.price,
              price_sale: dv.price_sale,
              quantity: dv.quantity,
              slug: dv.slug,
              images: dv.images,
            }
          : null,

        variants: vList,
        colors,
        rooms: roomsByPid.get(p.product_id) || [],
        attributes: attrsByPid.get(p.product_id) || [],
        total_stock: stockByPid.get(p.product_id) ?? 0,
        comment_count: commentByPid.get(p.product_id) ?? 0,
        isWishlist: false,
      };
    });

    return { products: result };
  });
}

/** One record per variant, flattened for the chatbot / embedding index. */
function aiCatalog(query) {
  const limit = Math.min(parseInt(query.limit) || 50, 200);

  const failure = (error) => ({
    error: "Failed to build AI catalog with images",
    details: error.message,
  });

  return guard(failure, async () => {
    const normalize = stripQuotes;

    const sanitizePrice = (price) => {
      const n = Number(price);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const computeActualPrice = (price, price_sale) => {
      const p = sanitizePrice(price);
      const ps = sanitizePrice(price_sale);
      if (ps != null && p != null && ps > 0 && ps < p) return ps;
      return p ?? ps ?? null;
    };
    const compactText = (s) => (s || "").replace(/\s+/g, " ").trim();
    const buildAttributesText = (attrs = []) =>
      attrs
        .map((x) => `${x.attribute_name}: ${x.value_display}${x.unit ? ` ${x.unit}` : ""}`)
        .join("; ");

    const { rows: products } = await db.query(
      `
      SELECT
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_description,
        p.product_status,
        p.category_id,
        c.category_name,
        p.product_image,
        p.created_at,
        p.updated_at
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_status = 1
      ORDER BY p.created_at DESC
      LIMIT $1
      `,
      [limit]
    );

    if (!products.length) return { items: [] };

    const productIds = products.map((p) => p.product_id);

    const { rows: variantRows } = await db.query(VARIANTS_FOR_PRODUCTS_SQL, [productIds]);
    const { rows: roomRows } = await db.query(ROOMS_FOR_PRODUCTS_SQL, [productIds]);
    const { rows: attrRows } = await db.query(ATTRIBUTES_FOR_PRODUCTS_SQL, [productIds]);
    const { rows: commentAgg } = await db.query(COMMENT_COUNTS_FOR_PRODUCTS_SQL, [productIds]);
    const { rows: stockAgg } = await db.query(STOCK_FOR_PRODUCTS_SQL, [productIds]);

    const variantsByPid = groupBy(variantRows, (v) => v.product_id);

    const roomsByPid = new Map();
    for (const r of roomRows) {
      if (!roomsByPid.has(r.product_id)) roomsByPid.set(r.product_id, []);
      roomsByPid.get(r.product_id).push({
        room_id: r.room_id,
        room_name: r.room_name,
        slug: r.slug,
      });
    }

    const attrsByPid = new Map();
    for (const a of attrRows) {
      if (!attrsByPid.has(a.product_id)) attrsByPid.set(a.product_id, []);
      if (a.value_display == null || a.value_display === "") continue; // skip empty attributes
      attrsByPid.get(a.product_id).push(a);
    }

    const commentByPid = new Map(commentAgg.map((r) => [r.product_id, Number(r.comment_count || 0)]));
    const stockByPid = new Map(stockAgg.map((r) => [r.product_id, Number(r.total_stock || 0)]));

    const items = [];
    for (const p of products) {
      const pid = p.product_id;
      const vList = variantsByPid.get(pid) || [];
      const rooms = roomsByPid.get(pid) || [];
      const attributes = attrsByPid.get(pid) || [];

      const description_plain = compactText(p.product_description);
      const attributes_text = buildAttributesText(attributes);
      const baseBlob = [
        p.product_name,
        p.category_name,
        description_plain,
        attributes_text,
        rooms.map((r) => r.room_name).join(", "),
      ]
        .filter(Boolean)
        .join(" — ");

      const total_stock = Number(stockByPid.get(pid) ?? 0);
      const comment_count = Number(commentByPid.get(pid) ?? 0);
      const product_main_image = normalize(p.product_image);

      for (const v of vList) {
        const price = sanitizePrice(v.price);
        const price_sale = sanitizePrice(v.price_sale);
        const actual_price = computeActualPrice(price, price_sale);
        const quantity = Number(v.quantity ?? 0);
        const is_in_stock = quantity > 0;

        const images = splitImages(v.list_image);
        const primary_image = images[0] || product_main_image || null;

        items.push({
          doc_id: `product:${pid}:variant:${v.variant_id}`,
          product_id: pid,
          variant_id: v.variant_id,

          name: p.product_name,
          category: p.category_name,
          slug: p.product_slug,
          variant_slug: v.variant_slug,

          color_name: v.color_name,
          color_hex: v.color_hex,

          price,
          price_sale,
          actual_price,
          is_in_stock,
          quantity,
          total_stock,
          comment_count,
          primary_image,
          rooms,
          attributes: attributes.map((x) => ({
            attribute_id: x.attribute_id,
            attribute_name: x.attribute_name,
            unit: x.unit || "",
            value_type: x.value_type,
            value_display: x.value_display,
          })),
          attributes_text,
          description_plain,

          search_blob: compactText(`${baseBlob} — Màu: ${v.color_name} ${v.color_hex || ""}`),

          created_at: p.created_at,
          updated_at: p.updated_at,
        });
      }
    }

    return { items };
  });
}

/** Product page payload: the product, its variants and colours, related products and attributes. */
function getBySlug(slug) {
  if (!slug) throw new HttpError(400, { message: "Slug không hợp lệ" });

  return guard({ error: "Failed to fetch product details" }, async () => {
    const { rows: productRows } = await db.query(
      `
      SELECT
        p.*, c.category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_slug = $1 AND p.product_status = 1
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
        ? v.list_image.split(",").map((img) => img.trim().replace(/^['\"]+|['\"]+$/g, ""))
        : [],
    }));

    // default variant: colour priority 1, else the first one
    let defaultVariant = variants.find((v) => v.color_priority === 1);
    if (!defaultVariant && variants.length > 0) {
      defaultVariant = variants[0];
    }

    const colors = variants.map((v) => ({
      variant_id: v.variant_id,
      colorId: v.color_id,
      colorName: v.color_name,
      colorHex: v.color_hex,
      colorPriority: v.color_priority || 0,
      slug: v.slug,
    }));

    const { rows: relatedProducts } = await db.query(
      `
      SELECT
        p.product_id,
        p.product_name,
        p.product_slug
      FROM product p
      WHERE p.category_id = $1 AND p.product_id != $2 AND p.product_status = 1
      LIMIT 4
      `,
      [product.category_id, product.product_id]
    );

    const { rows: productAttributes } = await db.query(
      `
      SELECT
        pav.attribute_id,
        pav.value,
        pav.material_id,
        a.attribute_name,
        a.unit,
        COALESCE(a.is_required, FALSE) AS is_required,${ATTRIBUTE_DISPLAY_SQL}
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      LEFT JOIN materials m ON pav.material_id = m.material_id
      WHERE pav.product_id = $1
      ORDER BY a.attribute_name ASC
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
        rating: product.product_rating,
        materials: product.variant_materials,
        height: product.variant_height,
        width: product.variant_width,
        depth: product.variant_depth,
        seating_height: product.variant_seating_height,
        max_weight_load: product.variant_maximum_weight_load,
        status: product.product_status,
        category_id: product.category_id,
        category_name: product.category_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
        defaultPrice: defaultVariant?.price ?? null,
        defaultPriceSale: defaultVariant?.price_sale ?? null,
        defaultImages:
          defaultVariant?.list_image
            ?.split(",")
            .map((img) => img.trim().replace(/^['\"]+|['\"]+$/g, "")) ?? [],
        main_image: product.product_image
          ? product.product_image.trim().replace(/^['\"]+|['\"]+$/g, "")
          : "",
        defaultSlug: defaultVariant?.slug ?? null,
        defaultColorName: defaultVariant?.color_name ?? null,
        defaultColorHex: defaultVariant?.color_hex ?? null,
        defaultQuantity: defaultVariant?.quantity ?? null,
        variants: variantsFull,
        attributes: productAttributes,
      },
      colors,
      related_products: relatedProducts.map((rp) => ({
        id: rp.product_id,
        name: rp.product_name,
        slug: rp.product_slug,
      })),
    };
  });
}

function featured(query) {
  return guard({ error: "Failed to fetch featured products" }, async () => {
    const limit = parseInt(query.limit) || 8;

    const { rows: products } = await db.query(
      `
      SELECT
        p.*,
        l.category_name,
        (
          SELECT COUNT(*)
          FROM comment cm
          JOIN order_items oi ON oi.order_item_id = cm.order_item_id
          JOIN variant_product vp ON vp.variant_id = oi.variant_id
          WHERE vp.product_id = p.product_id
        ) as comment_count
      FROM product p
      LEFT JOIN category l ON p.category_id = l.category_id
      WHERE p.product_status = 1 AND p.product_priority = 1
      ORDER BY p.created_at DESC
      LIMIT $1
    `,
      [limit]
    );

    return products;
  });
}

function byCategory(rawCategoryId, query) {
  const categoryId = Number(rawCategoryId);
  if (isNaN(categoryId)) throw new HttpError(400, { message: "Category ID phải là số" });

  return guard({ error: "Failed to fetch products by category" }, async () => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || LIMIT_PER_PAGE;
    const offset = (page - 1) * limit;

    const { rows: countResult } = await db.query(
      'SELECT COUNT(*) AS "total" FROM product WHERE category_id = $1 AND product_status = 1',
      [categoryId]
    );

    const totalProducts = Number(countResult[0]?.total || 0);
    const totalPages = Math.ceil(totalProducts / limit);

    const { rows: products } = await db.query(
      `
      SELECT
        p.*,
        c.category_name as category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.category_id = $1 AND p.product_status = 1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [categoryId, limit, offset]
    );

    return {
      products: products.map((product) => ({
        id: product.product_id,
        name: product.product_name,
        description: product.product_description,
        price: product.product_price,
        price_sale: product.product_price_sale,
        image: product.product_image,
        list_image: product.product_list_image,
        slug: product.product_slug,
        category_id: product.category_id,
        category_name: product.category_name,
        status: product.product_status,
        priority: product.product_priority,
        view: product.product_view,
        rating: product.product_rating,
        created_at: product.created_at,
        updated_at: product.updated_at,
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        productsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  });
}

module.exports = {
  listBySlugFilters,
  listByNameFilters,
  search,
  relatedByRoom,
  newest,
  listVariants,
  fullList,
  aiCatalog,
  getBySlug,
  featured,
  byCategory,
};
