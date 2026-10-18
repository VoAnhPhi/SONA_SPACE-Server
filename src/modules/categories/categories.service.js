"use strict";

const cloudinary = require("cloudinary").v2;
const db = require("../../config/database");
const { withTransaction } = require("../../shared/db/transaction");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

const CATEGORY_COMPAT_SELECT = `
  c.category_id,
  c.category_name,
  c.category_description,
  c.slug,
  c.category_image,
  c.category_image AS category_icon,
  c.category_banner,
  c.status,
  c.status AS category_status,
  c.category_priority,
  c.created_at,
  c.updated_at,
  c.deleted_at
`;

const requireSlug = (slug) => {
  if (!slug) throw new HttpError(400, { message: "Slug is required" });
};

// "https://res.cloudinary.com/<cloud>/image/upload/v123/SonaSpace/Category/x.jpg" -> "SonaSpace/Category/x"
function cloudinaryPublicId(url) {
  return url
    .split("/")
    .slice(7)
    .join("/")
    .replace(/\.(jpg|jpeg|png|webp)$/i, "");
}

async function destroyImage(url) {
  if (!url) return;
  await cloudinary.uploader.destroy(cloudinaryPublicId(url));
}

// After a delete the rows are gone, so a failed image removal only logs
async function destroyImageQuietly(url) {
  if (!url) return;
  const publicId = cloudinaryPublicId(url);
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting category image from Cloudinary:", publicId, error.message);
  }
}

/** Active categories for the public filter bar. */
function listForFilter() {
  return guard("Failed to fetch categories", async () => {
    const { rows } = await db.query(`
      SELECT
        category_id,
        category_name,
        slug,
        category_image,
        category_image AS category_icon,
        category_banner,
        status,
        status AS category_status,
        category_priority
      FROM category
      WHERE status = 1
      ORDER BY category_priority ASC
    `);
    return rows;
  });
}

const failWithDetails = (error) => ({ error: "Failed to fetch categories", details: error.message });

/** Active categories with their product counts. */
function listActive() {
  return guard(failWithDetails, async () => {
    const sql = `
      SELECT
        ${CATEGORY_COMPAT_SELECT},
        (SELECT COUNT(*)::int FROM product WHERE category_id = c.category_id) as product_count
      FROM category c WHERE status = 1
      ORDER BY c.category_priority ASC
    `;
    try {
      const { rows: categories } = await db.query(sql);
      return categories;
    } catch (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }
  });
}

/** Every category, including inactive ones (admin). */
function listAll() {
  return guard(failWithDetails, async () => {
    const sql = `
      SELECT
        ${CATEGORY_COMPAT_SELECT},
        (SELECT COUNT(*)::int FROM product WHERE category_id = c.category_id) as product_count
      FROM category c
      ORDER BY c.category_priority ASC
    `;
    try {
      const { rows: categories } = await db.query(sql);
      return categories;
    } catch (dbError) {
      throw new Error(`Database error: ${dbError.message}`);
    }
  });
}

function getBySlug(slug) {
  requireSlug(slug);
  return guard("Failed to fetch category", async () => {
    const sql = `
      SELECT
        ${CATEGORY_COMPAT_SELECT},
        (SELECT COUNT(*)::int FROM product WHERE category_id = c.category_id) as product_count
      FROM category c
      WHERE c.slug = $1
    `;
    const { rows: category } = await db.query(sql, [slug]);

    if (!category || category.length === 0) {
      throw new HttpError(404, { error: "Category not found" });
    }

    return category[0];
  });
}

/** Attribute definitions of a category (all, including deleted ones). */
function listAttributes(rawCategoryId) {
  const failure = () => ({
    success: false,
    message: "Lỗi máy chủ khi lấy danh sách thuộc tính danh mục.",
  });

  return guard(failure, async () => {
    const categoryId = rawCategoryId;
    if (!categoryId || isNaN(categoryId)) {
      throw new HttpError(400, { success: false, message: "ID danh mục không hợp lệ." });
    }

    const sql = `
      SELECT
        attribute_id,
        attribute_name,
        unit,
        is_required
      FROM attributes
      WHERE category_id = $1
      ORDER BY attribute_name ASC
    `;
    const { rows: attributes } = await db.query(sql, [categoryId]);
    return attributes;
  });
}

function create(body) {
  const { name, image, banner, slug, status, priority } = body;

  if (!name || !slug) {
    throw new HttpError(400, { error: "Category name and slug are required" });
  }

  return guard("Failed to create category", async () => {
    const { rows: existingCategories } = await db.query(
      "SELECT category_id FROM category WHERE slug = $1",
      [slug]
    );

    if (existingCategories.length > 0) {
      throw new HttpError(400, { error: "Category slug already exists" });
    }

    await db.query(
      "INSERT INTO category (category_name, category_image, category_banner, status, category_priority, created_at, slug) VALUES ($1, $2, $3, $4, $5, NOW(), $6)",
      [
        name,
        image || null,
        banner || null,
        typeof status === "number" ? status : Number(status) || 1,
        typeof priority === "number" ? priority : Number(priority) || 0,
        slug,
      ]
    );

    const { rows: newCategory } = await db.query(
      `
      SELECT
        ${CATEGORY_COMPAT_SELECT}
      FROM category c
      WHERE c.slug = $1
      `,
      [slug]
    );

    return {
      message: "Category created successfully",
      category: newCategory[0],
    };
  });
}

function update(slug, body) {
  requireSlug(slug);

  return guard("Failed to update category", async () => {
    const { name, image, banner, priority, status, slug: nextSlugValue } = body;
    const nextSlug =
      typeof nextSlugValue === "string" ? nextSlugValue.trim() : nextSlugValue;

    if (nextSlugValue !== undefined && !nextSlug) {
      throw new HttpError(400, { error: "Category slug is required" });
    }

    const { rows: oldData } = await db.query(
      "SELECT category_id, category_image, category_banner FROM category WHERE slug = $1",
      [slug]
    );
    if (!oldData.length) {
      throw new HttpError(404, { error: "Category not found" });
    }

    const oldImage = oldData[0].category_image;
    const oldBanner = oldData[0].category_banner;

    if (name) {
      const { rows: duplicateName } = await db.query(
        "SELECT category_id FROM category WHERE category_name = $1 AND slug != $2",
        [name, slug]
      );
      if (duplicateName.length > 0) {
        throw new HttpError(400, { error: "Category name already exists" });
      }
    }

    if (nextSlug && nextSlug !== slug) {
      const { rows: duplicateSlug } = await db.query(
        "SELECT category_id FROM category WHERE slug = $1 AND slug != $2",
        [nextSlug, slug]
      );
      if (duplicateSlug.length > 0) {
        throw new HttpError(400, { error: "Category slug already exists" });
      }
    }

    if (image && image !== oldImage) {
      await destroyImage(oldImage);
    }
    if (banner && banner !== oldBanner) {
      await destroyImage(oldBanner);
    }

    await db.query(
      `
      UPDATE category
      SET
        category_name = COALESCE($1, category_name),
        category_image = COALESCE($2, category_image),
        category_banner = COALESCE($3, category_banner),
        slug = COALESCE($4, slug),
        category_priority = COALESCE($5, category_priority),
        status = COALESCE($6, status),
        updated_at = NOW()
      WHERE slug = $7
      `,
      [
        name || null,
        image || null,
        banner || null,
        nextSlug && nextSlug !== slug ? nextSlug : null,
        priority === undefined || priority === null || priority === ""
          ? null
          : Number(priority),
        status === undefined || status === null || status === ""
          ? null
          : Number(status),
        slug,
      ]
    );

    const resolvedSlug = nextSlug && nextSlug !== slug ? nextSlug : slug;

    const { rows: updatedCategory } = await db.query(
      `
      SELECT
        ${CATEGORY_COMPAT_SELECT}
      FROM category c
      WHERE c.slug = $1
      `,
      [resolvedSlug]
    );

    return {
      message: "Category updated successfully",
      category: updatedCategory[0],
    };
  });
}

/** Deletes a category with its attribute definitions in one transaction; refuses while it is in use. */
function remove(slug) {
  requireSlug(slug);

  const failure = (error) => {
    console.error("Error deleting category:", error);
    return { error: "Không thể xóa danh mục. Vui lòng thử lại." };
  };

  return guard(failure, async () => {
    const { body, images } = await withTransaction(async (client) => {
      const { rows: categoryData } = await client.query(
        "SELECT category_id, category_image, category_banner FROM category WHERE slug = $1 FOR UPDATE",
        [slug]
      );
      if (!categoryData.length) {
        throw new HttpError(404, { error: "Không tìm thấy danh mục" });
      }
      const { category_id: categoryId, category_image, category_banner } = categoryData[0];

      // Products and banners still pointing at the category must be moved first
      const { rows: products } = await client.query(
        "SELECT product_id FROM product WHERE category_id = $1",
        [categoryId]
      );
      if (products.length > 0) {
        throw new HttpError(409, {
          error: `Danh mục còn ${products.length} sản phẩm. Hãy chuyển hoặc xóa các sản phẩm này trước.`,
          totalProducts: products.length,
          productIds: products.map((p) => p.product_id).join(", "),
        });
      }
      const { rows: banners } = await client.query(
        "SELECT COUNT(*)::int AS total FROM banners WHERE category_id = $1",
        [categoryId]
      );
      if (banners[0].total > 0) {
        throw new HttpError(409, {
          error: `Danh mục đang được dùng cho ${banners[0].total} banner. Hãy đổi hoặc xóa các banner đó trước.`,
        });
      }

      // The category's own attribute definitions go with it, unless a product still stores a value for one
      const { rows: usedValues } = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM product_attribute_value pav
         JOIN attributes a ON a.attribute_id = pav.attribute_id
         WHERE a.category_id = $1`,
        [categoryId]
      );
      if (usedValues[0].total > 0) {
        throw new HttpError(409, {
          error: "Thuộc tính của danh mục vẫn đang được sản phẩm sử dụng.",
        });
      }
      await client.query("DELETE FROM attributes WHERE category_id = $1", [categoryId]);
      await client.query("DELETE FROM category WHERE category_id = $1", [categoryId]);

      return {
        body: { message: "Category deleted successfully" },
        images: [category_image, category_banner],
      };
    });

    // Images are removed only after the rows are gone; a failed delete must not cost the images
    await Promise.all(images.map(destroyImageQuietly));
    return body;
  });
}

/** Paginated products of one category. */
function listProducts(slug, query) {
  requireSlug(slug);

  return guard("Failed to fetch products by category", async () => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 8;
    const offset = (page - 1) * limit;

    const allowedSortFields = ["created_at", "updated_at", "product_name"];
    const sort_by = allowedSortFields.includes(query.sort_by)
      ? query.sort_by
      : "created_at";

    const sort_order =
      query.sort_order?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { rows: category } = await db.query(
      "SELECT category_id, category_name FROM category WHERE slug = $1",
      [slug]
    );

    if (!category.length) {
      throw new HttpError(404, { error: "Category not found" });
    }

    const categoryId = category[0].category_id;

    const { rows: countResult } = await db.query(
      "SELECT COUNT(*) as total FROM product WHERE category_id = $1",
      [categoryId]
    );

    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    const { rows: products } = await db.query(
      `
       SELECT
  p.product_id AS id,
  p.product_name AS name,
  p.product_slug AS slug,
  p.product_image AS image,
  p.category_id,
  c.category_id,
  c.category_name,
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

        FROM product p
        LEFT JOIN category c ON p.category_id = c.category_id
        LEFT JOIN variant_product vp ON p.product_id = vp.product_id
        LEFT JOIN color col ON vp.color_id = col.color_id
        WHERE p.category_id = $1
        GROUP BY p.product_id, c.category_id, c.category_name
        ORDER BY p.${sort_by} ${sort_order}
        LIMIT $2 OFFSET $3
    `,
      [categoryId, limit, offset]
    );

    const transformedProducts = products.map((product) => {
      const colorHex = product.color_hex || [];

      return {
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
        color_hex: colorHex,
      };
    });

    return {
      category: category[0],
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

function listByProductSlug(slug) {
  requireSlug(slug);

  return guard("Failed to fetch categories by product", async () => {
    const { rows } = await db.query(
      `
      SELECT c.category_id, c.category_name, c.slug
      FROM category c
      JOIN product p ON c.category_id = p.category_id
      WHERE p.product_slug = $1
    `,
      [slug]
    );

    if (!rows.length) {
      throw new HttpError(404, { error: "Category not found" });
    }

    return rows;
  });
}

module.exports = {
  listForFilter,
  listActive,
  listAll,
  getBySlug,
  listAttributes,
  create,
  update,
  remove,
  listProducts,
  listByProductSlug,
};
