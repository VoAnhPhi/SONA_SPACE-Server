const express = require("express");
const router = express.Router();
const db = require("../config/database");
const cloudinary = require("../config/cloudinary");
const { verifyToken, isAdmin, optionalAuth } = require("../middleware/auth");
const { withTransaction } = require("../db/transaction");
const { markDeprecatedRoute } = require("../middleware/deprecateRoute");
const LIMIT_PER_PAGE = 8;
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

/**
 * @route   GET /api/products
 * @desc    Láº¥y danh sÃ¡ch sáº£n pháº©m vá»›i phÃ¢n trang, lá»c vÃ  sáº¯p xáº¿p
 * @access  Public
 */
router.get("/all", optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    const categorySlug = req.query.categorySlug;
    const roomSlug = req.query.roomSlug;
    const price = req.query.price;
    const color = req.query.color;
    const sort = req.query.sort;

    const whereConditions = ["p.product_status = 1"];
    const params = [];
    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    // Loc theo categorySlug
    if (categorySlug) {
      whereConditions.push(`c.slug = ${addParam(categorySlug)}`);
    }

    // Loc theo roomSlug (bat buoc neu co)
    if (roomSlug) {
      whereConditions.push(`
          p.product_id IN (
            SELECT DISTINCT rp.product_id 
            FROM room_product rp 
            JOIN room r ON rp.room_id = r.room_id 
            WHERE r.slug = ${addParam(roomSlug)}
          )
        `);
    }

    // Loc theo gia
    if (price) {
      switch (price) {
        case "DÆ°á»›i 10 triá»‡u":
          whereConditions.push(`
              (SELECT 
                CASE 
                  WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                  ELSE MIN(vp2.variant_product_price)
                END 
              FROM variant_product vp2 
              WHERE vp2.product_id = p.product_id) < 10000000
            `);
          break;
        case "10 - 30 triá»‡u":
          whereConditions.push(`
              (SELECT 
                CASE 
                  WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                  ELSE MIN(vp2.variant_product_price)
                END 
              FROM variant_product vp2 
              WHERE vp2.product_id = p.product_id) BETWEEN 10000000 AND 30000000
            `);
          break;
        case "TrÃªn 30 triá»‡u":
          whereConditions.push(`
              (SELECT 
                CASE 
                  WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                  ELSE MIN(vp2.variant_product_price)
                END 
              FROM variant_product vp2 
              WHERE vp2.product_id = p.product_id) > 30000000
            `);
          break;
      }
    }

    // Loc theo mau
    if (color) {
      whereConditions.push(`col.color_name = ${addParam(color)}`);
    }

    // Sort
    let orderBy = "p.created_at DESC";
    if (sort) {
      switch (sort) {
        case "GiÃ¡ tÄƒng dáº§n":
          orderBy = `
              (SELECT 
                CASE 
                  WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                  ELSE MIN(vp2.variant_product_price)
                END 
              FROM variant_product vp2 
              WHERE vp2.product_id = p.product_id) ASC
            `;
          break;
        case "GiÃ¡ giáº£m dáº§n":
          orderBy = `
              (SELECT 
                CASE 
                  WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                  ELSE MIN(vp2.variant_product_price)
                END 
              FROM variant_product vp2 
              WHERE vp2.product_id = p.product_id) DESC
            `;
          break;
        case "Má»›i nháº¥t":
          orderBy = "p.created_at DESC";
          break;
        case "Giáº£m giÃ¡":
          orderBy = `
              (SELECT 
                MAX(
                  CASE 
                    WHEN vp2.variant_product_price_sale > 0 
                    THEN ((vp2.variant_product_price - vp2.variant_product_price_sale) / vp2.variant_product_price * 100)
                    ELSE 0 
                  END
                ) 
              FROM variant_product vp2 
              WHERE vp2.product_id = p.product_id) DESC
            `;
          break;
      }
    }

    // Dem tong san pham
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
    const totalProducts = Number(countRows[0]?.totalProducts || 0);

    const userIdIndex = `$${params.length + 1}`;
    const limitIndex = `$${params.length + 2}`;
    const offsetIndex = `$${params.length + 3}`;

    // Lay danh sach san pham
    const query = `
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
          (
            SELECT vp2.variant_id
            FROM variant_product vp2
            JOIN color c2 ON vp2.color_id = c2.color_id
            WHERE vp2.product_id = p.product_id
            ORDER BY c2.color_id = 1 DESC, c2.color_id ASC, vp2.variant_id ASC
            LIMIT 1
          ) AS variant_id,
          (
            SELECT EXISTS (
              SELECT 1
              FROM wishlist w
              WHERE w.variant_id = (
                SELECT vp2.variant_id
                FROM variant_product vp2
                JOIN color c2 ON vp2.color_id = c2.color_id
                WHERE vp2.product_id = p.product_id
                ORDER BY c2.color_id = 1 DESC, c2.color_id ASC, vp2.variant_id ASC
                LIMIT 1
              )
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
      `;

    const finalParams = [...params, userId, limit, offset];
    const { rows: products } = await db.query(query, finalParams);

    res.json({
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
      pagination: {
        totalProducts,
        currentPage: page,
        productsPerPage: limit,
        totalPages: Math.ceil(totalProducts / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});
router.get("/", optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;
  try {
    // 1. Lay tham so page va limit tu query, mac dinh la 1 va 8
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const offset = (page - 1) * limit;

    // 2. Lay cac tham so loc tu query
    const category = req.query.category;
    const room = req.query.room;
    const price = req.query.price;
    const color = req.query.color;
    const sort = req.query.sort;

    // 3. Xay dung cau query WHERE dua tren cac dieu kien loc
    const whereConditions = ["p.product_status = 1"];
    const params = [];
    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (category) {
      whereConditions.push(`c.category_name = ${addParam(category)}`);
    }

    if (room) {
      whereConditions.push(
        `EXISTS (SELECT 1 FROM room_product rp JOIN room r ON rp.room_id = r.room_id WHERE rp.product_id = p.product_id AND r.room_name = ${addParam(room)})`
      );
    }

    if (price) {
      switch (price) {
        case "DÆ°á»›i 10 triá»‡u":
          whereConditions.push(`
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) < 10000000
          `);
          break;
        case "10 - 30 triá»‡u":
          whereConditions.push(`
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) BETWEEN 10000000 AND 30000000
          `);
          break;
        case "TrÃªn 30 triá»‡u":
          whereConditions.push(`
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) > 30000000
          `);
          break;
      }
    }

    if (color) {
      whereConditions.push(`col.color_name = ${addParam(color)}`);
    }

    // 4. Xay dung cau ORDER BY dua tren tham so sort
    let orderBy = "p.created_at DESC";
    if (sort) {
      switch (sort) {
        case "GiÃ¡ tÄƒng dáº§n":
          orderBy = `
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) ASC
          `;
          break;
        case "GiÃ¡ giáº£m dáº§n":
          orderBy = `
            (SELECT 
              CASE 
                WHEN MIN(vp2.variant_product_price_sale) > 0 THEN MIN(vp2.variant_product_price_sale)
                ELSE MIN(vp2.variant_product_price)
              END 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) DESC
          `;
          break;
        case "Má»›i nháº¥t":
          orderBy = "p.created_at DESC";
          break;
        case "Giáº£m giÃ¡":
          orderBy = `
            (SELECT 
              MAX(
                CASE 
                  WHEN vp2.variant_product_price_sale > 0 
                  THEN ((vp2.variant_product_price - vp2.variant_product_price_sale) / vp2.variant_product_price * 100)
                  ELSE 0 
                END
              ) 
            FROM variant_product vp2 
            WHERE vp2.product_id = p.product_id) DESC
          `;
          break;
      }
    }

    // 5. Truy van tong so san pham voi dieu kien loc
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
    const totalProducts = Number(countRows[0]?.totalProducts || 0);

    const userIdIndex = `$${params.length + 1}`;
    const limitIndex = `$${params.length + 2}`;
    const offsetIndex = `$${params.length + 3}`;

    // 6. Truy van san pham co phan trang va loc
    const query = `
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

    (
      SELECT vp2.variant_id
      FROM variant_product vp2
      JOIN color c2 ON vp2.color_id = c2.color_id
      WHERE vp2.product_id = p.product_id
      ORDER BY c2.color_id = 1 DESC, c2.color_id ASC, vp2.variant_id ASC
      LIMIT 1
    ) AS variant_id,

    (
      SELECT EXISTS (
        SELECT 1
        FROM wishlist w
        WHERE w.variant_id = (
          SELECT vp2.variant_id
          FROM variant_product vp2
          JOIN color c2 ON vp2.color_id = c2.color_id
          WHERE vp2.product_id = p.product_id
          ORDER BY c2.color_id = 1 DESC, c2.color_id ASC, vp2.variant_id ASC
          LIMIT 1
        )
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
`;

    const finalParams = [...params, userId, limit, offset];

    const { rows: products } = await db.query(query, finalParams);

    // 7. Chuan hoa du lieu dau ra
    const result = products.map((item) => ({
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
    }));

    // 8. Phan hoi phan trang chuan REST
    res.json({
      products: result,
      pagination: {
        totalProducts,
        currentPage: page,
        productsPerPage: limit,
        totalPages: Math.ceil(totalProducts / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});
router.get("/search", async (req, res) => {
  const keyword = req.query.q?.trim() || "";
  if (!keyword) return res.json({ results: [] });

  try {
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

    res.json({
      results: rows.map((item) => ({
        ...item,
        image: item.image ? String(item.image) : "",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * @route   GET /api/products/admin
 * @desc    Láº¥y danh sÃ¡ch sáº£n pháº©m cho quáº£n trá»‹ viÃªn
 * @access  Private (Admin only)
 **/
router.get("/admin", markDeprecatedRoute("/api/products/admin"), verifyToken, isAdmin, async (req, res) => {
  try {
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
        -- Láº¥y giÃ¡ gá»‘c cá»§a variant Ä‘áº§u tiÃªn
        (
          SELECT vp.variant_product_price
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
          ORDER BY vp.variant_id ASC
          LIMIT 1
        ) AS price,

        -- Láº¥y giÃ¡ sale cá»§a variant Ä‘áº§u tiÃªn náº¿u cÃ³
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

        -- Tá»•ng sá»‘ lÆ°á»£ng tá»« táº¥t cáº£ variants
        (
          SELECT SUM(vp.variant_product_quantity)
          FROM variant_product vp
          WHERE vp.product_id = p.product_id
        ) AS total_quantity,

        -- Sá»‘ lÆ°á»£ng Ä‘Ã¡nh giÃ¡
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

    // Xá»­ lÃ½ vÃ  format dá»¯ liá»‡u trÆ°á»›c khi tráº£ vá»
    const formattedProducts = products.map((product) => ({
      ...product,
      price: product.price || 0,
      price_sale: product.price_sale || null, // Giá»¯ null náº¿u khÃ´ng cÃ³ giÃ¡ sale
      total_quantity: product.total_quantity || 0,
      comment_count: product.comment_count || 0,
    }));

    res.json(formattedProducts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin product list" });
  }
});

/**
 * @route   GET /api/products/related/by-room/:productId
 * @desc    Láº¥y sáº£n pháº©m liÃªn quan theo room
 * @access  Public
 */
router.get("/related/by-room/:productId", optionalAuth, async (req, res) => {
  const productId = Number(req.params.productId);
  const userId = req.user?.id || 0;
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: "Invalid productId" });
  }

  try {
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

    const result = relatedProducts.map((item) => ({
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
      isWishlist: Boolean(item.iswishlist),
    }));

    res.json({ related_products: result });
  } catch (err) {
    console.error("GET /api/products/related/by-room/:productId error:", err.message);
    res.status(500).json({ error: "Lá»—i láº¥y sáº£n pháº©m liÃªn quan theo room" });
  }
});

/**
 * @route   GET /api/products/newest
 * @desc    Láº¥y danh sÃ¡ch sáº£n pháº©m má»›i nháº¥t
 * @access  Public
 */
router.get("/newest", optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;

  try {
    const limit = parseInt(req.query.limit) || 8;

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

    const result = products.map((item) => ({
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

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch newest products" });
  }
});

/**
 * @route   GET /api/products/variants
 * @desc    Láº¥y danh sÃ¡ch táº¥t cáº£ variants vá»›i thÃ´ng tin sáº£n pháº©m
 * @access  Public
 */
router.get("/variants", async (req, res) => {
  try {
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

    // Chuáº©n hÃ³a: láº¥y áº£nh Ä‘áº§u tiÃªn cho má»—i variant
    const result = variants.map((v) => ({
      variant_id: v.variant_id,
      product_id: v.product_id,
      product_name: v.product_name,
      color_id: v.color_id,
      price: v.variant_product_price,
      price_sale: v.variant_product_price_sale,
      quantity: v.variant_product_quantity,
      slug: v.variant_product_slug,
      first_image: v.list_image
        ? v.list_image
            .split(",")[0]
            .trim()
            .replace(/^['"]+|['"]+$/g, "")
        : null,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch variants" });
  }
});

const splitImages = (list) =>
  (list || "")
    .split(",")
    .map((s) => s.trim().replace(/^['"]+|['"]+$/g, ""))
    .filter(Boolean);

router.get("/full-list-all", async (req, res) => {
  const userId = 0;
  try {
    // 1) Láº¥y toÃ n bá»™ product Ä‘ang active
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
      return res.json({ products: [] });
    }

    const productIds = products.map((p) => p.product_id);
    const idParams = productIds.length ? productIds : [-1];

    // 2) Batch: variants + color (Ä‘Ã£ sáº¯p theo priority máº·c Ä‘á»‹nh)
    const { rows: variantRows } = await db.query(
      `
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
      `,
      [idParams]
    );

    // 3) Batch: rooms
    const { rows: roomRows } = await db.query(
      `
      SELECT rp.product_id, r.room_id, r.room_name, r.slug
      FROM room_product rp
      JOIN room r ON rp.room_id = r.room_id
      WHERE rp.product_id = ANY($1::int[])
      `,
      [idParams]
    );

    // 4) Batch: attributes (chá»‰ cÃ¡c attr cÃ³ value cho sáº£n pháº©m)
    const { rows: attrRows } = await db.query(
      `
      SELECT
        pav.product_id,
        a.attribute_id,
        a.attribute_name,
        a.unit,
        COALESCE(a.is_required, FALSE) AS is_required,
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
        END AS value_display,
        pav.value AS raw_value,
        pav.material_id
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      LEFT JOIN materials m ON pav.material_id = m.material_id
      WHERE pav.product_id = ANY($1::int[])
      ORDER BY a.attribute_name ASC
      `,
      [idParams]
    );

    // 5) Batch: comment_count
    const { rows: commentAgg } = await db.query(
      `
      SELECT vp.product_id, COUNT(*) AS comment_count
      FROM comment cm
      JOIN order_items oi ON oi.order_item_id = cm.order_item_id
      JOIN variant_product vp ON vp.variant_id = oi.variant_id
      WHERE vp.product_id = ANY($1::int[]) AND cm.deleted_at IS NULL
      GROUP BY vp.product_id
      `,
      [idParams]
    );

    // 6) Batch: total_stock
    const { rows: stockAgg } = await db.query(
      `
      SELECT product_id, COALESCE(SUM(variant_product_quantity),0) AS total_stock
      FROM variant_product
      WHERE product_id = ANY($1::int[])
      GROUP BY product_id
      `,
      [idParams]
    );

    // 7) Gom variants theo product vÃ  xÃ¡c Ä‘á»‹nh default_variant_id
    const variantsByPid = new Map();
    for (const v of variantRows) {
      if (!variantsByPid.has(v.product_id)) variantsByPid.set(v.product_id, []);
      variantsByPid.get(v.product_id).push(v);
    }

    const defaultVariantByPid = new Map();
    for (const pid of productIds) {
      const list = variantsByPid.get(pid) || [];
      defaultVariantByPid.set(pid, list[0]?.variant_id || null);
    }

    // 8) Batch wishlist theo default_variant_id (náº¿u cÃ³ user)
    let wishlistSet = new Set();
    if (userId) {
      const defaultVariantIds = Array.from(defaultVariantByPid.values()).filter(
        Boolean
      );
      if (defaultVariantIds.length) {
        const { rows: wlRows } = await db.query(
          `
          SELECT variant_id
          FROM wishlist
          WHERE user_id = $1 AND status = 1
            AND variant_id = ANY($2::int[])
          `,
          [userId, defaultVariantIds]
        );
        wishlistSet = new Set(wlRows.map((r) => r.variant_id));
      }
    }

    // 9) Build cÃ¡c map phá»¥
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

    const commentByPid = new Map(
      commentAgg.map((r) => [r.product_id, r.comment_count])
    );
    const stockByPid = new Map(
      stockAgg.map((r) => [r.product_id, r.total_stock])
    );

    // 10) Káº¿t xuáº¥t toÃ n bá»™ list
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

      // default variant = pháº§n tá»­ Ä‘áº§u tiÃªn (Ä‘Ã£ sáº¯p theo priority)
      const dv = vList[0] || null;

      // TÃ­nh min_price / min_price_sale / min_actual_price tá»« vList
      let min_price = null,
        min_price_sale = null,
        min_actual_price = null;
      for (const it of vList) {
        if (min_price === null || (it.price ?? Infinity) < min_price)
          min_price = it.price ?? null;
        if (it.price_sale > 0) {
          if (min_price_sale === null || it.price_sale < min_price_sale)
            min_price_sale = it.price_sale;
          if (min_actual_price === null || it.price_sale < min_actual_price)
            min_actual_price = it.price_sale;
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
        main_image: (p.product_image || "")
          .trim()
          .replace(/^['"]+|['"]+$/g, ""),
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
        isWishlist: dv ? wishlistSet.has(dv.variant_id) : false,
      };
    });

    return res.json({ products: result });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch full product list" });
  }
});

// Gá»¢I Ã: táº¡o endpoint má»›i Ä‘á»ƒ phá»¥c vá»¥ AI/FE, tráº£ vá» Ä‘á»§ áº£nh cho tá»«ng variant
router.get("/ai-catalog", async (req, res) => {
  // Cho phÃ©p truyá»n ?limit=; máº·c Ä‘á»‹nh 50, tá»‘i Ä‘a 200 (trÃ¡nh quÃ¡ táº£i)
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  try {
    // --- Helpers ---
    const normalize = (s) => (s || "").trim().replace(/^['"]+|['"]+$/g, "");
    const splitImages = (list) =>
      (list || "")
        .split(",")
        .map((x) => normalize(x))
        .filter(Boolean);

    // ThÃªm transform Cloudinary náº¿u URL lÃ  Cloudinary (táº¡o thumbnail nhanh)
    const addCldTransform = (
      url,
      trans = "c_fill,w_480,h_360,q_auto,f_auto"
    ) => {
      if (!url) return url;
      return url.includes("/upload/")
        ? url.replace("/upload/", `/upload/${trans}/`)
        : url;
    };

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
        .map(
          (x) =>
            `${x.attribute_name}: ${x.value_display}${
              x.unit ? ` ${x.unit}` : ""
            }`
        )
        .join("; ");

    // 1) Láº¥y danh sÃ¡ch sáº£n pháº©m Ä‘ang active (chá»‰ field cáº§n thiáº¿t)
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
      `
      ,
      [limit]
    );

    if (!products.length) return res.json({ items: [] });

    const productIds = products.map((p) => p.product_id);

    // 2) Variants + mÃ u + LIST IMAGE (Ä‘Ã£ sáº¯p theo color priority & variant_id)
    const { rows: variantRows } = await db.query(
      `
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
      `,
      [productIds]
    );

    // 3) Rooms theo sáº£n pháº©m
    const { rows: roomRows } = await db.query(
      `
      SELECT rp.product_id, r.room_id, r.room_name, r.slug
      FROM room_product rp
      JOIN room r ON rp.room_id = r.room_id
      WHERE rp.product_id = ANY($1::int[])
      `,
      [productIds]
    );

    // 4) Attributes cÃ³ giÃ¡ trá»‹ (gá»™p text)
    const { rows: attrRows } = await db.query(
      `
      SELECT
        pav.product_id,
        a.attribute_id,
        a.attribute_name,
        a.unit,
        COALESCE(a.is_required, FALSE) AS is_required,
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
        END AS value_display,
        pav.value AS raw_value,
        pav.material_id
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      LEFT JOIN materials m ON pav.material_id = m.material_id
      WHERE pav.product_id = ANY($1::int[])
      ORDER BY a.attribute_name ASC
      `,
      [productIds]
    );

    // 5) comment_count theo sáº£n pháº©m
    const { rows: commentAgg } = await db.query(
      `
      SELECT vp.product_id, COUNT(*) AS comment_count
      FROM comment cm
      JOIN order_items oi ON oi.order_item_id = cm.order_item_id
      JOIN variant_product vp ON vp.variant_id = oi.variant_id
      WHERE vp.product_id = ANY($1::int[]) AND cm.deleted_at IS NULL
      GROUP BY vp.product_id
      `,
      [productIds]
    );

    // 6) total_stock theo sáº£n pháº©m
    const { rows: stockAgg } = await db.query(
      `
      SELECT product_id, COALESCE(SUM(variant_product_quantity),0) AS total_stock
      FROM variant_product
      WHERE product_id = ANY($1::int[])
      GROUP BY product_id
      `,
      [productIds]
    );

    // --- Build maps ---
    const variantsByPid = new Map();
    for (const v of variantRows) {
      if (!variantsByPid.has(v.product_id)) variantsByPid.set(v.product_id, []);
      variantsByPid.get(v.product_id).push(v);
    }

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
      if (a.value_display == null || a.value_display === "") continue; // bá» thuá»™c tÃ­nh rá»—ng
      attrsByPid.get(a.product_id).push(a);
    }

    const commentByPid = new Map(
      commentAgg.map((r) => [r.product_id, Number(r.comment_count || 0)])
    );
    const stockByPid = new Map(
      stockAgg.map((r) => [r.product_id, Number(r.total_stock || 0)])
    );

    // --- Xuáº¥t items: Má»–I VARIANT = 1 record, kÃ¨m áº£nh ---
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
        .join(" â€” ");

      const total_stock = Number(stockByPid.get(pid) ?? 0);
      const comment_count = Number(commentByPid.get(pid) ?? 0);
      const product_main_image = normalize(p.product_image);

      for (const v of vList) {
        const price = sanitizePrice(v.price);
        const price_sale = sanitizePrice(v.price_sale);
        const actual_price = computeActualPrice(price, price_sale);
        const quantity = Number(v.quantity ?? 0);
        const is_in_stock = quantity > 0;

        // áº¢nh variant (Ä‘áº§y Ä‘á»§) + primary + thumbnail
        const images = splitImages(v.list_image);
        const primary_image = images[0] || product_main_image || null;

        items.push({
          // KhÃ³a Ä‘á»‹nh danh
          doc_id: `product:${pid}:variant:${v.variant_id}`,
          product_id: pid,
          variant_id: v.variant_id,

          // Hiá»ƒn thá»‹ tÃªn & phÃ¢n loáº¡i
          name: p.product_name,
          category: p.category_name,
          slug: p.product_slug,
          variant_slug: v.variant_slug,

          // MÃ u sáº¯c
          color_name: v.color_name,
          color_hex: v.color_hex,

          // GiÃ¡ & tá»“n
          price,
          price_sale,
          actual_price,
          is_in_stock,
          quantity,
          total_stock,
          comment_count,
          primary_image, // áº£nh Ä‘áº¡i diá»‡n (láº¥y táº¥m Ä‘áº§u tiÃªn cá»§a variant, fallback sang áº£nh chÃ­nh sp)
          // Bá»‘i cáº£nh
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

          // Search blob cho embedding / filter
          search_blob: compactText(
            `${baseBlob} â€” MÃ u: ${v.color_name} ${v.color_hex || ""}`
          ),

          // Timestamps
          created_at: p.created_at,
          updated_at: p.updated_at,
        });
      }
    }

    return res.json({ items });
  } catch (err) {
    return res
      .status(500)
      .json({
        error: "Failed to build AI catalog with images",
        details: err.message,
      });
  }
});

router.get("/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug khÃ´ng há»£p lá»‡" });

  try {
    // 1. Láº¥y thÃ´ng tin sáº£n pháº©m chÃ­nh
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
      return res.status(404).json({ error: "Product not found" });
    }
    const product = productRows[0];

    // 2. Láº¥y danh sÃ¡ch táº¥t cáº£ biáº¿n thá»ƒ + mÃ u sáº¯c (Ä‘á»ƒ tÃ¬m biáº¿n thá»ƒ máº·c Ä‘á»‹nh vÃ  danh sÃ¡ch mÃ u)
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
        ? v.list_image
            .split(",")
            .map((img) => img.trim().replace(/^['\"]+|['\"]+$/g, ""))
        : [],
    }));

    // 3. TÃ¬m biáº¿n thá»ƒ máº·c Ä‘á»‹nh (Æ°u tiÃªn color_priority = 1)
    let defaultVariant = variants.find((v) => v.color_priority === 1);
    if (!defaultVariant && variants.length > 0) {
      defaultVariant = variants[0];
    }

    // 4. Danh sÃ¡ch cÃ¡c mÃ u sáº¯c (nháº¹, khÃ´ng cáº§n áº£nh/giÃ¡)
    const colors = variants.map((v) => ({
      variant_id: v.variant_id,
      colorId: v.color_id,
      colorName: v.color_name,
      colorHex: v.color_hex,
      colorPriority: v.color_priority || 0,
      slug: v.slug,
    }));

    // 5. Láº¥y sáº£n pháº©m liÃªn quan
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
        COALESCE(a.is_required, FALSE) AS is_required,
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
        END AS value_display
      FROM product_attribute_value pav
      JOIN attributes a ON pav.attribute_id = a.attribute_id
      LEFT JOIN materials m ON pav.material_id = m.material_id
      WHERE pav.product_id = $1
      ORDER BY a.attribute_name ASC
      `,
      [product.product_id]
    );

    return res.json({
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
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

/**
 * @route   POST /api/products
 * @desc    Táº¡o sáº£n pháº©m má»›i
 * @access  Private (Admin only)
 */
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
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
    } = req.body;

    // Kiá»ƒm tra dá»¯ liá»‡u Ä‘áº§u vÃ o
    if (!name || !price || !category_id) {
      return res
        .status(400)
        .json({ error: "Name, price and category_id are required" });
    }

    // Táº¡o sáº£n pháº©m má»›i
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

    // ThÃªm cÃ¡c biáº¿n thá»ƒ náº¿u cÃ³
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const variantValues = [];
      const variantPlaceholders = variants
        .map((v, idx) => {
          const base = idx * 7;
          variantValues.push(
            productId,
            v.color || null,
            v.size || null,
            v.price || price,
            v.sku || null,
            v.image || null,
            v.stock || 0
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
            base + 5
          }, $${base + 6}, $${base + 7})`;
        })
        .join(", ");

      await db.query(
        `
        INSERT INTO variant_product (
          product_id, color, size, price, sku, image, stock
        ) VALUES ${variantPlaceholders}
      `,
        variantValues
      );
    }

    // ThÃªm liÃªn káº¿t vá»›i cÃ¡c phÃ²ng náº¿u cÃ³
    if (room_ids && Array.isArray(room_ids) && room_ids.length > 0) {
      const roomValues = [];
      const roomPlaceholders = room_ids
        .map((roomId, idx) => {
          const base = idx * 2;
          roomValues.push(productId, roomId);
          return `($${base + 1}, $${base + 2})`;
        })
        .join(", ");

      await db.query(
        `
        INSERT INTO room_product (product_id, room_id) 
        VALUES ${roomPlaceholders}
      `,
        roomValues
      );
    }

    // Láº¥y thÃ´ng tin sáº£n pháº©m vá»«a táº¡o
    const { rows: createdProduct } = await db.query(
      `
      SELECT * FROM product WHERE product_id = $1
    `,
      [productId]
    );

    res.status(201).json({
      message: "Product created successfully",
      product: createdProduct[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Cáº­p nháº­t thÃ´ng tin sáº£n pháº©m
 * @access  Private (Admin only)
 */
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: "ID pháº£i lÃ  sá»‘" });

  try {
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
    } = req.body;

    // Kiá»ƒm tra sáº£n pháº©m tá»“n táº¡i
    const { rows: existingProduct } = await db.query(
      "SELECT product_id FROM product WHERE product_id = $1",
      [id]
    );

    if (!existingProduct.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Cáº­p nháº­t thÃ´ng tin sáº£n pháº©m
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

    // Cáº­p nháº­t biáº¿n thá»ƒ náº¿u cÃ³
    if (variants && Array.isArray(variants) && variants.length > 0) {
      // XÃ³a biáº¿n thá»ƒ cÅ©
      await db.query("DELETE FROM variant_product WHERE product_id = $1", [id]);

      // ThÃªm biáº¿n thá»ƒ má»›i
      const variantValues = [];
      const variantPlaceholders = variants
        .map((v, idx) => {
          const base = idx * 7;
          variantValues.push(
            id,
            v.color || null,
            v.size || null,
            v.price || price,
            v.sku || null,
            v.image || null,
            v.stock || 0
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
            base + 5
          }, $${base + 6}, $${base + 7})`;
        })
        .join(", ");

      await db.query(
        `
        INSERT INTO variant_product (
          product_id, color, size, price, sku, image, stock
        ) VALUES ${variantPlaceholders}
      `,
        variantValues
      );
    }

    // Cáº­p nháº­t liÃªn káº¿t phÃ²ng náº¿u cÃ³
    if (room_ids && Array.isArray(room_ids)) {
      // XÃ³a liÃªn káº¿t cÅ©
      await db.query("DELETE FROM room_product WHERE product_id = $1", [id]);

      // ThÃªm liÃªn káº¿t má»›i náº¿u cÃ³
      if (room_ids.length > 0) {
        const roomValues = [];
        const roomPlaceholders = room_ids
          .map((roomId, idx) => {
            const base = idx * 2;
            roomValues.push(id, roomId);
            return `($${base + 1}, $${base + 2})`;
          })
          .join(", ");

        await db.query(
          `
          INSERT INTO room_product (product_id, room_id) 
          VALUES ${roomPlaceholders}
        `,
          roomValues
        );
      }
    }

    // Láº¥y thÃ´ng tin sáº£n pháº©m Ä‘Ã£ cáº­p nháº­t
    const { rows: updatedProduct } = await db.query(
      `
      SELECT * FROM product WHERE product_id = $1
    `,
      [id]
    );

    res.json({
      message: "Product updated successfully",
      product: updatedProduct[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    XÃ³a sáº£n pháº©m
 * @access  Private (Admin only)
 */
router.delete("/:slug", verifyToken, isAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug khÃ´ng há»£p lá»‡" });
  function extractPublicIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w{3,4})?(?:\?.*)?$/);
    if (match && match[1]) {
      let publicId = match[1];
      const lastDotIndex = publicId.lastIndexOf(".");
      if (lastDotIndex > -1 && publicId.substring(lastDotIndex).length <= 5) {
        publicId = publicId.substring(0, lastDotIndex);
      }
      return publicId;
    }
    return null;
  }

  try {
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
          await client.query(
            "UPDATE product SET product_status = 0 WHERE product_id = $1",
            [product_id]
          );
          return { softHidden: true };
        }
      }

      for (const variant of variants) {
        const imageUrls = variant.variant_product_list_image
          ? variant.variant_product_list_image.split(",")
          : [];
        for (const url of imageUrls) {
          const publicId = extractPublicIdFromUrl(url.trim());
          if (publicId) {
            try {
              await cloudinary.uploader.destroy(publicId);
            } catch {}
          }
        }
      }

      if (product_image) {
        const publicId = extractPublicIdFromUrl(product_image.trim());
        if (publicId) {
          try {
            await cloudinary.uploader.destroy(publicId);
          } catch {}
        }
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

      await client.query(
        "DELETE FROM product_attribute_value WHERE product_id = $1",
        [product_id]
      );

      if (variantIds.length > 0) {
        await client.query("DELETE FROM wishlist WHERE variant_id = ANY($1::int[])", [
          variantIds,
        ]);
      }

      await client.query("DELETE FROM variant_product WHERE product_id = $1", [
        product_id,
      ]);
      await client.query("DELETE FROM room_product WHERE product_id = $1", [
        product_id,
      ]);
      await client.query("DELETE FROM product WHERE product_id = $1", [product_id]);

      return { deleted: true };
    });

    if (result.notFound) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (result.softHidden) {
      return res.json({
        message:
          "Sáº£n pháº©m Ä‘ang Ä‘Æ°á»£c mua trong Ä‘Æ¡n hÃ ng, khÃ´ng thá»ƒ xoÃ¡. Tráº¡ng thÃ¡i Ä‘Ã£ Ä‘Æ°á»£c chuyá»ƒn sang 'áº©n'.",
      });
    }
    return res.json({ message: "XoÃ¡ sáº£n pháº©m thÃ nh cÃ´ng" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete product" });
  }
});

/**
 * @route   GET /api/products/featured
 * @desc    Láº¥y danh sÃ¡ch sáº£n pháº©m ná»•i báº­t
 * @access  Public
 */
router.get("/featured/list", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

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

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch featured products" });
  }
});

/**
 * @route   GET /api/products/by-category/:categoryId
 * @desc    Láº¥y sáº£n pháº©m theo danh má»¥c
 * @access  Public
 */
router.get("/by-category/:categoryId", async (req, res) => {
  const categoryId = Number(req.params.categoryId);
  if (isNaN(categoryId))
    return res.status(400).json({ message: "Category ID pháº£i lÃ  sá»‘" });

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || LIMIT_PER_PAGE;
    const offset = (page - 1) * limit;

    // Äáº¿m tá»•ng sá»‘ sáº£n pháº©m trong danh má»¥c
    const { rows: countResult } = await db.query(
      'SELECT COUNT(*) AS "total" FROM product WHERE category_id = $1 AND product_status = 1',
      [categoryId]
    );

    const totalProducts = Number(countResult[0]?.total || 0);
    const totalPages = Math.ceil(totalProducts / limit);

    // Láº¥y sáº£n pháº©m theo danh má»¥c vá»›i phÃ¢n trang
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

    // Transform products
    const transformedProducts = products.map((product) => {
      return {
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
      };
    });

    res.json({
      products: transformedProducts,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        productsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products by category" });
  }
});
router.put("/status/:id", verifyToken, isAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { product_status } = req.body;
  if (isNaN(id) || ![0, 1].includes(Number(product_status))) {
    return res.status(400).json({ error: "Invalid product id or status" });
  }
  try {
    const { rowCount } = await db.query(
      "UPDATE product SET product_status = $1 WHERE product_id = $2",
      [product_status, id]
    );
    if (!rowCount) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product status updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update product status" });
  }
});
/**
 * @route   POST /api/products/add
 * @desc    ThÃªm sáº£n pháº©m má»›i (Admin)
 * @access  Private (Admin only)
 */

router.post("/add", markDeprecatedRoute("/api/products/add"), verifyToken, isAdmin, async (req, res) => {
  try {
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
    } = req.body;

    const errors = [];

    const isEmpty = (val) =>
      val === undefined || val === null || String(val).trim() === "";
    const isNumber = (val) => !isEmpty(val) && !isNaN(Number(val));

    if (isEmpty(name)) {
      errors.push({ field: "name", message: "TÃªn sáº£n pháº©m lÃ  báº¯t buá»™c" });
    }
    if (isEmpty(description)) {
      errors.push({
        field: "description",
        message: "MÃ´ táº£ sáº£n pháº©m lÃ  báº¯t buá»™c",
      });
    }
    if (isEmpty(slug)) {
      errors.push({ field: "slug", message: "Slug lÃ  báº¯t buá»™c" });
    }
    if (isEmpty(category_id)) {
      errors.push({ field: "category_id", message: "Danh má»¥c lÃ  báº¯t buá»™c" });
    }
    if (isEmpty(status)) {
      errors.push({ field: "status", message: "Vui lÃ²ng chá»n tráº¡ng thÃ¡i" });
    } else if (![0, 1, "0", "1"].includes(status)) {
      errors.push({ field: "status", message: "Tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡" });
    }
    if (isEmpty(main_image)) {
      errors.push({
        field: "main_image",
        message: "áº¢nh chÃ­nh sáº£n pháº©m lÃ  báº¯t buá»™c",
      });
    }
    if (!Array.isArray(room_ids) || room_ids.length === 0) {
      errors.push({
        field: "room_ids",
        message: "Vui lÃ²ng chá»n Ã­t nháº¥t má»™t phÃ²ng",
      });
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
        message: "Dá»¯ liá»‡u thuá»™c tÃ­nh sáº£n pháº©m khÃ´ng há»£p lá»‡.",
      });
    } else {
      const submittedAttributesMap = new Map();
      attributes.forEach((attr) => {
        submittedAttributesMap.set(attr.attribute_id, attr);
      });

      requiredAttributesFromDB.forEach((requiredAttr) => {
        const submittedAttr = submittedAttributesMap.get(
          requiredAttr.attribute_id
        );
        if (
          requiredAttr.is_required &&
          (!submittedAttr ||
            (isEmpty(submittedAttr.value) &&
              isEmpty(submittedAttr.material_id)))
        ) {
          errors.push({
            field: `attributes`,
            message: `Thuá»™c tÃ­nh báº¯t buá»™c (ID: ${requiredAttr.attribute_id}) cÃ²n thiáº¿u hoáº·c chÆ°a cÃ³ giÃ¡ trá»‹.`,
          });
        }
      });

      attributes.forEach((attr, i) => {
        if (isEmpty(attr.attribute_id)) {
          errors.push({
            field: `attributes[${i}].attribute_id`,
            message: `Thuá»™c tÃ­nh ${i + 1}: Thiáº¿u ID thuá»™c tÃ­nh.`,
          });
        }

        if (!isEmpty(attr.value) && !isEmpty(attr.material_id)) {
          errors.push({
            field: `attributes[${i}]`,
            message: `Thuá»™c tÃ­nh ${
              i + 1
            }: KhÃ´ng thá»ƒ cÃ³ cáº£ giÃ¡ trá»‹ vÃ  ID cháº¥t liá»‡u.`,
          });
        }
      });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      errors.push({
        field: "variants",
        message: "Pháº£i cÃ³ Ã­t nháº¥t má»™t biáº¿n thá»ƒ sáº£n pháº©m",
      });
    } else {
      variants.forEach((v, i) => {
        const idx = i + 1;
        if (isEmpty(v.color_id)) {
          errors.push({
            field: `variants[${i}].color_id`,
            message: `Biáº¿n thá»ƒ ${idx}: Thiáº¿u mÃ u sáº¯c`,
          });
        }
        if (isEmpty(v.variant_slug)) {
          errors.push({
            field: `variants[${i}].variant_slug`,
            message: `Biáº¿n thá»ƒ ${idx}: Thiáº¿u slug`,
          });
        }
        if (!isNumber(v.price)) {
          errors.push({
            field: `variants[${i}].price`,
            message: `Biáº¿n thá»ƒ ${idx}: GiÃ¡ khÃ´ng há»£p lá»‡`,
          });
        }
        if (!isNumber(v.quantity)) {
          errors.push({
            field: `variants[${i}].quantity`,
            message: `Biáº¿n thá»ƒ ${idx}: Sá»‘ lÆ°á»£ng khÃ´ng há»£p lá»‡`,
          });
        }
        if (!Array.isArray(v.list_image) || v.list_image.length === 0) {
          errors.push({
            field: `variants[${i}].list_image`,
            message: `Biáº¿n thá»ƒ ${idx}: Cáº§n Ã­t nháº¥t 1 áº£nh`,
          });
        } else {
          v.list_image.forEach((img, j) => {
            if (typeof img !== "string" || !img.startsWith("http")) {
              errors.push({
                field: `variants[${i}].list_image[${j}]`,
                message: `áº¢nh ${j + 1} cá»§a biáº¿n thá»ƒ ${idx} khÃ´ng há»£p lá»‡`,
              });
            }
          });
        }
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Dá»¯ liá»‡u khÃ´ng há»£p lá»‡", errors });
    }

    try {
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
          [
            name,
            description,
            slug,
            category_id,
            totalVariantQuantity,
            status,
            main_image,
          ]
        );
        const productId = productRows[0]?.product_id;

        if (attributes.length > 0) {
          const attributeValues = [];
          const attributePlaceholders = attributes
            .map((attr, idx) => {
              const base = idx * 4;
              attributeValues.push(
                productId,
                attr.attribute_id,
                attr.value === undefined || attr.value === "" ? null : attr.value,
                attr.material_id === undefined || attr.material_id === ""
                  ? null
                  : attr.material_id
              );
              return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
            })
            .join(", ");
          await client.query(
            `INSERT INTO product_attribute_value (product_id, attribute_id, value, material_id) VALUES ${attributePlaceholders}`,
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
          const roomPlaceholders = room_ids
            .map((rid, idx) => {
              const base = idx * 2;
              roomValues.push(productId, rid);
              return `($${base + 1}, $${base + 2})`;
            })
            .join(", ");
          await client.query(
            `INSERT INTO room_product (product_id, room_id) VALUES ${roomPlaceholders}`,
            roomValues
          );
        }

        return { productId };
      });

      return res.status(201).json({
        message: "Táº¡o sáº£n pháº©m thÃ nh cÃ´ng",
        product_id: createdProduct.productId,
      });
    } catch (insertErr) {
      return res.status(500).json({
        error: "Lá»—i server khi táº¡o sáº£n pháº©m",
        details: insertErr.message,
      });
    }
  } catch (err) {
    return res.status(500).json({ error: "Lá»—i server", details: err.message });
  }
});

/**
 *  @route   PUT /api/products/admin/:slug
 *  @desc    Cáº­p nháº­t sáº£n pháº©m
 *  @access  Private (Admin only)
 */

router.put("/admin/:slug", markDeprecatedRoute("/api/products/admin/:slug"), verifyToken, isAdmin, async (req, res) => {
  const { slug: currentSlug } = req.params;
  const {
    name,
    description,
    category_id,
    status,
    main_image,
    room_ids,
    removedImages = [],
    slug,
    attributes,
  } = req.body;

  const errors = [];
  const isEmpty = (val) =>
    val === undefined || val === null || String(val).trim() === "";
  const isNumber = (val) => !isEmpty(val) && !isNaN(Number(val));

  if (isEmpty(name)) {
    errors.push({ field: "name", message: "TÃªn sáº£n pháº©m lÃ  báº¯t buá»™c" });
  }
  if (isEmpty(description)) {
    errors.push({
      field: "description",
      message: "MÃ´ táº£ sáº£n pháº©m lÃ  báº¯t buá»™c",
    });
  }
  if (isEmpty(slug)) {
    errors.push({ field: "slug", message: "Slug lÃ  báº¯t buá»™c" });
  }

  if (!isEmpty(slug)) {
    try {
      const { rows: existingSlug } = await db.query(
        `SELECT product_id FROM product WHERE product_slug = $1 AND product_id <> (SELECT product_id FROM product WHERE product_slug = $2)`,
        [slug, currentSlug]
      );
      if (existingSlug.length > 0) {
        errors.push({
          field: "slug",
          message: "Slug Ä‘Ã£ tá»“n táº¡i. Vui lÃ²ng chá»n slug khÃ¡c.",
        });
      }
    } catch (dbErr) {
      errors.push({ field: "slug", message: "Lá»—i kiá»ƒm tra slug duy nháº¥t." });
    }
  }

  if (isEmpty(category_id)) {
    errors.push({ field: "category_id", message: "Danh má»¥c lÃ  báº¯t buá»™c" });
  }
  if (isEmpty(status)) {
    errors.push({ field: "status", message: "Vui lÃ²ng chá»n tráº¡ng thÃ¡i" });
  } else if (![0, 1, "0", "1"].includes(status)) {
    errors.push({ field: "status", message: "Tráº¡ng thÃ¡i khÃ´ng há»£p lá»‡" });
  }
  if (isEmpty(main_image)) {
    errors.push({
      field: "main_image",
      message: "áº¢nh chÃ­nh sáº£n pháº©m lÃ  báº¯t buá»™c",
    });
  }

  if (!Array.isArray(attributes)) {
    errors.push({
      field: "attributes",
      message: "Dá»¯ liá»‡u thuá»™c tÃ­nh khÃ´ng há»£p lá»‡.",
    });
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

      const payloadAttributeIds = new Set(
        attributes.map((attr) => attr.attribute_id)
      );

      for (const payloadAttr of attributes) {
        const meta = categoryAttributeMap.get(payloadAttr.attribute_id);

        if (!meta) {
          errors.push({
            field: `attributes[${payloadAttr.attribute_id}]`,
            message: `Thuá»™c tÃ­nh ID ${payloadAttr.attribute_id} khÃ´ng há»£p lá»‡ cho danh má»¥c nÃ y.`,
          });
          continue;
        }

        if (meta.is_required) {
          if (meta.value_type === "material_id") {
            if (isEmpty(payloadAttr.material_id)) {
              errors.push({
                field: `attributes[${payloadAttr.attribute_id}].material_id`,
                message: `Thuá»™c tÃ­nh "${meta.attribute_name}" (cháº¥t liá»‡u) lÃ  báº¯t buá»™c.`,
              });
            }
          } else {
            if (isEmpty(payloadAttr.value)) {
              errors.push({
                field: `attributes[${payloadAttr.attribute_id}].value`,
                message: `Thuá»™c tÃ­nh "${meta.attribute_name}" lÃ  báº¯t buá»™c.`,
              });
            }
          }
        }

        if (
          meta.value_type === "number" &&
          !isEmpty(payloadAttr.value) &&
          !isNumber(payloadAttr.value)
        ) {
          errors.push({
            field: `attributes[${payloadAttr.attribute_id}].value`,
            message: `GiÃ¡ trá»‹ cho "${meta.attribute_name}" pháº£i lÃ  sá»‘ há»£p lá»‡.`,
          });
        }

        if (
          meta.value_type === "material_id" &&
          !isEmpty(payloadAttr.material_id)
        ) {
          const { rows: materialExists } = await db.query(
            `SELECT material_id FROM materials WHERE material_id = $1`,
            [payloadAttr.material_id]
          );
          if (materialExists.length === 0) {
            errors.push({
              field: `attributes[${payloadAttr.attribute_id}].material_id`,
              message: `Cháº¥t liá»‡u ID ${payloadAttr.material_id} khÃ´ng tá»“n táº¡i.`,
            });
          }
        }
      }

      for (const meta of categoryAttributesMeta) {
        if (meta.is_required && !payloadAttributeIds.has(meta.attribute_id)) {
          errors.push({
            field: `attributes[${meta.attribute_id}]`,
            message: `Thuá»™c tÃ­nh "${meta.attribute_name}" lÃ  báº¯t buá»™c nhÆ°ng bá»‹ thiáº¿u.`,
          });
        }
      }
    } catch (attrErr) {
      errors.push({
        field: "attributes",
        message: "Lá»—i server khi xÃ¡c thá»±c thuá»™c tÃ­nh.",
      });
    }
  }

  if (!Array.isArray(room_ids) || room_ids.length === 0) {
    errors.push({
      field: "room_ids",
      message: "Vui lÃ²ng chá»n Ã­t nháº¥t má»™t phÃ²ng",
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: "Dá»¯ liá»‡u khÃ´ng há»£p lá»‡", errors });
  }

  if (removedImages.length) {
    for (const imageUrl of removedImages) {
      const matches = imageUrl.match(
        /\/upload\/(?:v\d+\/)?(.+?)\.(jpg|jpeg|png|webp|gif)$/
      );
      const publicId = matches ? matches[1] : null;

      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
        } catch (destroyErr) {}
      }
    }
  }

  try {
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
        [
          name,
          slug,
          description,
          category_id,
          status,
          main_image,
          newPriority,
          productId,
        ]
      );

      await client.query(`DELETE FROM product_attribute_value WHERE product_id = $1`, [
        productId,
      ]);

      if (attributes && attributes.length > 0) {
        const attributeValues = [];
        const attributePlaceholders = attributes
          .map((attr, idx) => {
            const base = idx * 4;
            attributeValues.push(
              productId,
              attr.attribute_id,
              attr.value ?? null,
              attr.material_id ?? null
            );
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
          })
          .join(", ");
        await client.query(
          `INSERT INTO product_attribute_value (product_id, attribute_id, value, material_id) VALUES ${attributePlaceholders}`,
          attributeValues
        );
      }

      await client.query(`DELETE FROM room_product WHERE product_id = $1`, [productId]);
      if (room_ids.length > 0) {
        const roomValues = [];
        const roomPlaceholders = room_ids
          .map((roomId, idx) => {
            const base = idx * 2;
            roomValues.push(productId, roomId);
            return `($${base + 1}, $${base + 2})`;
          })
          .join(", ");
        await client.query(
          `INSERT INTO room_product (product_id, room_id) VALUES ${roomPlaceholders}`,
          roomValues
        );
      }

      return { productId };
    });

    if (txResult.notFound) {
      return res.status(404).json({ error: "Product not found" });
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

    res.json({
      message: "Product updated successfully",
      product: {
        ...updatedProductRows[0],
        attributes: productAttributesValues,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update product",
      details: error.message,
    });
  }
});

/*
 * @route   GET /api/products/admin/:slug
 * @desc    Láº¥y thÃ´ng tin chi tiáº¿t sáº£n pháº©m (Admin)
 * @access  Private (Admin only)
 */

router.get("/admin/:slug", markDeprecatedRoute("/api/products/admin/:slug"), verifyToken, isAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!slug) return res.status(400).json({ message: "Slug khÃ´ng há»£p lá»‡" });

  try {
    // 1. Láº¥y thÃ´ng tin sáº£n pháº©m chÃ­nh

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
        p.variant_materials,       -- Giá»¯ láº¡i táº¡m thá»i theo cáº¥u trÃºc báº¡n cung cáº¥p
        p.variant_height,          -- Giá»¯ láº¡i táº¡m thá»i theo cáº¥u trÃºc báº¡n cung cáº¥p
        p.variant_width,           -- Giá»¯ láº¡i táº¡m thá»i theo cáº¥u trÃºc báº¡n cung cáº¥p
        p.variant_depth,           -- Giá»¯ láº¡i táº¡m thá»i theo cáº¥u trÃºc báº¡n cung cáº¥p
        p.variant_seating_height,  -- Giá»¯ láº¡i táº¡m thá»i theo cáº¥u trÃºc báº¡n cung cáº¥p
        p.variant_maximum_weight_load, -- Giá»¯ láº¡i táº¡m thá»i theo cáº¥u trÃºc báº¡n cung cáº¥p
        c.category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.category_id
      WHERE p.product_slug = $1
      `,
      [slug]
    );

    if (!productRows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productRows[0];

    // 2. Láº¥y danh sÃ¡ch biáº¿n thá»ƒ + mÃ u sáº¯c
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
        ? v.list_image
            .split(",")
            .map((img) => img.trim().replace(/^['"]+|['"]+$/g, ""))
        : [],
    }));

    // 3. Láº¥y danh sÃ¡ch phÃ²ng
    const { rows: rooms } = await db.query(
      `
      SELECT rp.room_id, r.room_name
      FROM room_product rp
      JOIN room r ON rp.room_id = r.room_id
      WHERE rp.product_id = $1
      `,
      [product.product_id]
    );

    // 4. Láº¥y cÃ¡c thuá»™c tÃ­nh Ä‘á»™ng tá»« báº£ng product_attribute_value
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

    return res.json({
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
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

module.exports = router;


