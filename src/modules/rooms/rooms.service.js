"use strict";

const cloudinary = require("cloudinary").v2;
const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

const requireSlug = (slug, body = { error: "Invalid room slug" }) => {
  if (!slug) throw new HttpError(400, body);
};

async function destroyImage(url) {
  if (!url) return;
  const publicId = url
    .split("/")
    .slice(7)
    .join("/")
    .replace(/\.(jpg|jpeg|png|webp)$/i, "");
  await cloudinary.uploader.destroy(publicId);
}

/** Rooms that are visible, with product counts. */
function listActive() {
  return guard("Failed to fetch rooms", async () => {
    const { rows } = await db.query(`
      SELECT
        r.*,
        (SELECT COUNT(*) FROM room_product rp WHERE rp.room_id = r.room_id) as product_count
      FROM room r where r.status = 1
      ORDER BY r.room_name ASC
    `);
    return rows;
  });
}

/** Every room, including hidden ones (admin). */
function listAll() {
  return guard("Failed to fetch rooms", async () => {
    const { rows } = await db.query(`
      SELECT
        r.*,
        (SELECT COUNT(*) FROM room_product rp WHERE rp.room_id = r.room_id) as product_count
      FROM room r
      ORDER BY r.room_name ASC
    `);
    return rows;
  });
}

async function listForFilter() {
  const { rows } = await db.query(`
    SELECT room_id, room_name, slug
    FROM room
    WHERE deleted_at IS NULL
  `);
  return rows;
}

/** First variant of every product, used by the admin room editor. */
function listProductVariants() {
  return guard("Failed to fetch products", async () => {
    const { rows: products } = await db.query(`
      SELECT
        p.product_id,
        p.product_name,
        vp.variant_id,
        vp.color_id,
        vp.variant_product_price AS price,
        vp.variant_product_price_sale AS price_sale,
        vp.variant_product_quantity AS quantity,
        vp.variant_product_slug AS slug,
        vp.variant_product_list_image AS list_image
      FROM product p
      LEFT JOIN (
          SELECT *
          FROM variant_product v1
          WHERE v1.variant_id = (
              SELECT MIN(v2.variant_id)
              FROM variant_product v2
              WHERE v2.product_id = v1.product_id
          )
      ) vp ON vp.product_id = p.product_id
      ORDER BY p.product_id
    `);

    return products.map((v) => ({
      product_id: v.product_id,
      product_name: v.product_name,
      variant_id: v.variant_id,
      color_id: v.color_id,
      price: v.price,
      price_sale: v.price_sale,
      quantity: v.quantity,
      slug: v.slug,
      first_image: v.list_image
        ? v.list_image
            .split(",")[0]
            .trim()
            .replace(/^['"]+|['"]+$/g, "")
        : null,
    }));
  });
}

function getBySlug(slug) {
  return guard("Failed to fetch room", async () => {
    requireSlug(slug);

    const { rows } = await db.query(
      `
       SELECT
        r.*,
        COUNT(rp.product_id) as product_count
      FROM room r
      LEFT JOIN room_product rp ON r.room_id = rp.room_id
      WHERE r.slug = $1
      GROUP BY r.room_id
    `,
      [slug]
    );

    if (rows.length === 0) {
      throw new HttpError(404, { error: "Room not found" });
    }

    return rows[0];
  });
}

function create(body) {
  return guard("Failed to create room", async () => {
    const { name, description, banner, image, slug, status } = body;

    if (!name || !slug) {
      throw new HttpError(400, { error: "Room name and slug are required" });
    }

    if (!image) {
      throw new HttpError(400, { error: "Không thể upload phòng không có hình ảnh phòng" });
    }

    if (!banner) {
      throw new HttpError(400, { error: "Không thể upload phòng không có hình ảnh banner" });
    }

    const { rows: existingRooms } = await db.query(
      "SELECT room_id FROM room WHERE room_name = $1 AND slug = $2",
      [name, slug]
    );

    if (existingRooms.length > 0) {
      throw new HttpError(400, { error: "Room name already exists" });
    }

    const { rows: insertResult } = await db.query(
      "INSERT INTO room (room_name, room_description, room_image, room_banner, status, slug, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *",
      [name, description || null, image || null, banner || null, status ?? 0, slug]
    );

    return {
      message: "Room created successfully",
      room: insertResult[0],
    };
  });
}

function update(slug, body) {
  requireSlug(slug, { message: "Slug is required" });

  return guard("Failed to update room", async () => {
    const { name, image, banner, priority, status } = body;

    const { rows: oldData } = await db.query(
      "SELECT room_id, room_image, room_banner FROM room WHERE slug = $1",
      [slug]
    );
    if (!oldData.length) {
      throw new HttpError(404, { error: "Room not found" });
    }

    const oldImage = oldData[0].room_image;
    const oldBanner = oldData[0].room_banner;

    if (name) {
      const { rows: duplicateName } = await db.query(
        "SELECT room_id FROM room WHERE room_name = $1 AND slug != $2",
        [name, slug]
      );
      if (duplicateName.length > 0) {
        throw new HttpError(400, { error: "Room name already exists" });
      }
    }

    if (image && image !== oldImage) {
      await destroyImage(oldImage);
    }

    if (banner && banner !== oldBanner) {
      await destroyImage(oldBanner);
    }

    const { rows: updatedRoom } = await db.query(
      `
      UPDATE room
      SET
        room_name = COALESCE($1, room_name),
        room_image = COALESCE($2, room_image),
        room_banner = COALESCE($3, room_banner),
        room_priority = COALESCE($4, room_priority),
        status = COALESCE($5, status),
        updated_at = NOW()
      WHERE slug = $6
      RETURNING *
      `,
      [name || null, image || null, banner || null, priority || 0, status ?? 1, slug]
    );

    return {
      message: "Room updated successfully",
      room: updatedRoom[0],
    };
  });
}

/** Deletes the room, its images and its product links. */
function remove(slug) {
  requireSlug(slug);

  return guard("Failed to delete room", async () => {
    const { rows: roomData } = await db.query(
      "SELECT room_id, room_image, room_banner FROM room WHERE slug = $1",
      [slug]
    );

    if (!roomData.length) {
      throw new HttpError(404, { error: "Room not found" });
    }

    const { room_id, room_image, room_banner } = roomData[0];

    await destroyImage(room_image);
    await destroyImage(room_banner);

    await db.query("DELETE FROM room_product WHERE room_id = $1", [room_id]);
    await db.query("DELETE FROM room WHERE room_id = $1", [room_id]);

    return { message: "Room deleted successfully" };
  });
}

/** Paginated products of one room. */
function listProducts(slug, query) {
  const failure = (error) => {
    console.error(error);
    return { error: "Failed to fetch room products" };
  };

  return guard(failure, async () => {
    requireSlug(slug);

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 8;
    const offset = (page - 1) * limit;

    const { rows: roomRows } = await db.query(
      "SELECT room_id, room_name FROM room WHERE slug = $1",
      [slug]
    );

    if (roomRows.length === 0) {
      throw new HttpError(404, { error: "Room not found" });
    }

    const room = roomRows[0];
    const roomId = room.room_id;

    const { rows: countResult } = await db.query(
      `SELECT COUNT(*) as total
       FROM room_product rp
       JOIN product p ON rp.product_id = p.product_id
       WHERE rp.room_id = $1`,
      [roomId]
    );

    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    const { rows: products } = await db.query(
      `SELECT
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
          ORDER BY vp2.variant_id ASC
          LIMIT 1
        ) AS price_sale,

        COALESCE(json_agg(DISTINCT col.color_code) FILTER (WHERE col.color_code IS NOT NULL), '[]') AS color_hex

      FROM room_product rp
      JOIN product p ON rp.product_id = p.product_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id

      WHERE rp.room_id = $1
      GROUP BY p.product_id, cat.category_name
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [roomId, limit, offset]
    );

    const transformedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      image: product.image,
      category_id: product.category_id,
      category_name: product.category_name,
      created_at: product.created_at,
      updated_at: product.updated_at,
      price: product.price ?? "0.00",
      price_sale: product.price_sale ?? "0.00",
      color_hex: product.color_hex || [],
    }));

    return {
      room,
      products: transformedProducts,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        productsPerPage: limit,
      },
    };
  });
}

/** Link products to a room; products that are unknown or already linked are reported, not added. */
function addProducts(slug, body) {
  const failure = (error) => {
    console.error(error);
    return { error: "Failed to add products to room" };
  };

  return guard(failure, async () => {
    const { product_ids } = body;

    requireSlug(slug);

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      throw new HttpError(400, { error: "Product IDs array is required" });
    }

    const { rows: roomRows } = await db.query("SELECT room_id FROM room WHERE slug = $1", [slug]);

    if (roomRows.length === 0) {
      throw new HttpError(404, { error: "Room not found" });
    }

    const roomId = roomRows[0].room_id;

    const addedProducts = [];
    const existingProducts = [];
    const invalidProducts = [];

    for (const productId of product_ids) {
      const { rows: productRows } = await db.query(
        "SELECT product_id FROM product WHERE product_id = $1",
        [productId]
      );
      if (productRows.length === 0) {
        invalidProducts.push(productId);
        continue;
      }

      const { rows: existing } = await db.query(
        "SELECT 1 FROM room_product WHERE room_id = $1 AND product_id = $2",
        [roomId, productId]
      );

      if (existing.length > 0) {
        existingProducts.push(productId);
        continue;
      }

      await db.query("INSERT INTO room_product (room_id, product_id) VALUES ($1, $2)", [
        roomId,
        productId,
      ]);

      addedProducts.push(productId);
    }

    if (addedProducts.length === 0) {
      throw new HttpError(400, {
        error: "No products added. All are invalid or already exist in the room.",
        existing_products: existingProducts,
        invalid_products: invalidProducts,
      });
    }

    return {
      message: "Products added to room successfully",
      added_count: addedProducts.length,
      added_products: addedProducts,
      existing_products: existingProducts,
    };
  });
}

function removeProduct(slug, rawProductId) {
  return guard("Failed to remove product from room", async () => {
    const productId = Number(rawProductId);

    if (!slug || isNaN(productId)) {
      throw new HttpError(400, { error: "Invalid room slug or product ID" });
    }

    const { rows: roomRows } = await db.query("SELECT room_id FROM room WHERE slug = $1", [slug]);

    if (roomRows.length === 0) {
      throw new HttpError(404, { error: "Room not found" });
    }

    const roomId = roomRows[0].room_id;

    const { rows: existing } = await db.query(
      "SELECT * FROM room_product WHERE room_id = $1 AND product_id = $2",
      [roomId, productId]
    );

    if (existing.length === 0) {
      throw new HttpError(404, { error: "Product not found in room" });
    }

    await db.query("DELETE FROM room_product WHERE room_id = $1 AND product_id = $2", [
      roomId,
      productId,
    ]);

    return { message: "Product removed from room successfully" };
  });
}

function listByProductSlug(slug) {
  if (!slug) throw new HttpError(400, { error: "Missing product slug" });

  return guard("Failed to fetch rooms by product", async () => {
    const { rows } = await db.query(
      `
      SELECT DISTINCT r.room_id, r.room_name, r.slug
FROM room r
JOIN room_product rp ON r.room_id = rp.room_id
JOIN product p ON rp.product_id = p.product_id
WHERE p.product_slug = $1
    `,
      [slug]
    );
    return rows;
  });
}

module.exports = {
  listActive,
  listAll,
  listForFilter,
  listProductVariants,
  getBySlug,
  create,
  update,
  remove,
  listProducts,
  addProducts,
  removeProduct,
  listByProductSlug,
};
