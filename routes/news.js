const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

function parsePageAndLimit(query) {
  const page = Number.parseInt(query.page, 10);
  const limit = Number.parseInt(query.limit, 10);

  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

function buildNewsFilters({
  categoryId,
  keyword,
  status,
  allowStatusFilter,
  publishedOnlyByDefault,
  keywordMode,
}) {
  const conditions = [];
  const params = [];

  if (categoryId !== undefined) {
    const parsedCategoryId = Number.parseInt(categoryId, 10);
    if (!Number.isInteger(parsedCategoryId)) {
      return { error: "Invalid category ID" };
    }

    params.push(parsedCategoryId);
    conditions.push(`n.news_category_id = $${params.length}`);
  }

  if (keyword) {
    const likeKeyword = `%${keyword}%`;

    if (keywordMode === "titleAndContent") {
      params.push(likeKeyword);
      const titleIndex = params.length;
      params.push(likeKeyword);
      const contentIndex = params.length;
      conditions.push(
        `(n.news_title ILIKE $${titleIndex} OR n.news_content ILIKE $${contentIndex})`
      );
    } else {
      params.push(likeKeyword);
      conditions.push(`n.news_title ILIKE $${params.length}`);
    }
  }

  if (allowStatusFilter && status !== undefined) {
    const parsedStatus = Number.parseInt(status, 10);
    if (!Number.isInteger(parsedStatus)) {
      return { error: "Invalid status value" };
    }

    params.push(parsedStatus);
    conditions.push(`n.news_status = $${params.length}`);
  } else if (publishedOnlyByDefault) {
    conditions.push("n.news_status = 1");
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return {
    whereClause,
    params,
  };
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
}

function normalizeNewsImages(images) {
  if (Array.isArray(images)) {
    const normalized = images.filter(Boolean).slice(0, 5);
    return normalized.length > 0 ? JSON.stringify(normalized) : null;
  }

  return images || null;
}

function getImageInContent(content) {
  const imgRegex = /<img[^>]+src=['\"]([^'\"]+)['\"]/g;
  let matches;
  const links = [];

  while ((matches = imgRegex.exec(content || "")) !== null) {
    links.push(matches[1]);
  }

  return links;
}

function getCloudinaryPublicId(url) {
  if (!url) {
    return null;
  }

  const match = url.match(/\/upload\/v\d+\/(.+?)\.(jpg|jpeg|png|webp)$/i);
  return match ? match[1] : null;
}

/**
 * @route   GET /api/news
 * @desc    Lay danh sach bai viet
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const { page, limit, offset } = parsePageAndLimit(req.query);

    const filters = buildNewsFilters({
      categoryId: req.query.category_id,
      keyword: req.query.keyword,
      status: req.query.status,
      allowStatusFilter: Boolean(req.user && req.user.isAdmin),
      publishedOnlyByDefault: !(req.user && req.user.isAdmin),
      keywordMode: "titleAndContent",
    });

    if (filters.error) {
      return res.status(400).json({ error: filters.error });
    }

    const { whereClause, params } = filters;

    const { rows: countRows } = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      `,
      params
    );

    const totalNews = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalNews / limit);

    const listParams = [...params, limit, offset];
    const limitIndex = `$${params.length + 1}`;
    const offsetIndex = `$${params.length + 2}`;

    const { rows: news } = await db.query(
      `
      SELECT
        n.*,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ${limitIndex} OFFSET ${offsetIndex}
      `,
      listParams
    );

    const processedNews = news.map((item) => {
      if (item.news_content && !item.news_description) {
        return {
          ...item,
          news_description: `${item.news_content.substring(0, 150)}...`,
        };
      }

      return item;
    });

    return res.json({
      news: processedNews,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/simple", async (req, res) => {
  try {
    const { page, limit, offset } = parsePageAndLimit(req.query);

    const filters = buildNewsFilters({
      categoryId: req.query.category_id,
      keyword: req.query.keyword,
      status: req.query.status,
      allowStatusFilter: Boolean(req.user && req.user.isAdmin),
      publishedOnlyByDefault: !(req.user && req.user.isAdmin),
      keywordMode: "titleOnly",
    });

    if (filters.error) {
      return res.status(400).json({ error: filters.error });
    }

    const { whereClause, params } = filters;

    const { rows: countRows } = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      `,
      params
    );

    const totalNews = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalNews / limit);

    const listParams = [...params, limit, offset];
    const limitIndex = `$${params.length + 1}`;
    const offsetIndex = `$${params.length + 2}`;

    const { rows: newsRaw } = await db.query(
      `
      SELECT
        n.news_id,
        n.news_image,
        n.news_title,
        n.news_slug,
        n.news_view,
        n.news_status,
        n.created_at,
        n.updated_at,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ${limitIndex} OFFSET ${offsetIndex}
      `,
      listParams
    );

    const news = newsRaw.map((item) => ({
      news_id: item.news_id,
      news_image: item.news_image,
      news_title: item.news_title,
      news_slug: item.news_slug,
      news_view: item.news_view,
      news_status: item.news_status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      category_name: item.category_name,
    }));

    return res.json({
      news,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const { page, limit, offset } = parsePageAndLimit(req.query);

    const filters = buildNewsFilters({
      categoryId: req.query.category_id,
      keyword: req.query.keyword,
      status: req.query.status,
      allowStatusFilter: true,
      publishedOnlyByDefault: false,
      keywordMode: "titleOnly",
    });

    if (filters.error) {
      return res.status(400).json({ error: filters.error });
    }

    const { whereClause, params } = filters;

    const { rows: countRows } = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      `,
      params
    );

    const totalNews = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalNews / limit);

    const listParams = [...params, limit, offset];
    const limitIndex = `$${params.length + 1}`;
    const offsetIndex = `$${params.length + 2}`;

    const { rows: newsRaw } = await db.query(
      `
      SELECT
        n.news_id,
        n.news_image,
        n.news_title,
        n.news_slug,
        n.news_view,
        n.news_status,
        n.created_at,
        n.updated_at,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ${limitIndex} OFFSET ${offsetIndex}
      `,
      listParams
    );

    const news = newsRaw.map((item) => ({
      news_id: item.news_id,
      news_image: item.news_image,
      news_title: item.news_title,
      news_slug: item.news_slug,
      news_view: item.news_view,
      news_status: item.news_status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      category_name: item.category_name,
    }));

    return res.json({
      news,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/views", async (req, res) => {
  try {
    const { page, limit, offset } = parsePageAndLimit(req.query);

    const { rows: news } = await db.query(
      `
      SELECT n.*
      FROM news n
      ORDER BY n.news_view DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return res.json({
      news,
      pagination: {
        currentPage: page,
        newsPerPage: limit,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch viewed news" });
  }
});

/**
 * @route   GET /api/news/category/:categoryId
 * @desc    Lay bai viet theo danh muc
 * @access  Public
 */
router.get("/category/:categoryId", async (req, res) => {
  try {
    const categoryId = Number.parseInt(req.params.categoryId, 10);

    if (!Number.isInteger(categoryId)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    const { page, limit, offset } = parsePageAndLimit(req.query);

    const { rows: countRows } = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM news n
      WHERE n.news_category_id = $1 AND n.news_status = 1
      `,
      [categoryId]
    );

    const totalNews = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalNews / limit);

    const { rows: news } = await db.query(
      `
      SELECT n.*
      FROM news n
      WHERE n.news_category_id = $1 AND n.news_status = 1
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [categoryId, limit, offset]
    );

    return res.json({
      news,
      pagination: {
        currentPage: page,
        totalPages,
        totalNews,
        newsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch news by category" });
  }
});

/**
 * @route   POST /api/news
 * @desc    Tao bai viet moi
 * @access  Private
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, slug, content, images, category_id, status } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required." });
    }

    const normalizedImages = normalizeNewsImages(images);
    if (!normalizedImages) {
      return res.status(400).json({ error: "Image is required." });
    }

    let newsSlug = generateSlug(slug || title);

    const { rows: slugExists } = await db.query(
      "SELECT news_id FROM news WHERE news_slug = $1 LIMIT 1",
      [newsSlug]
    );

    if (slugExists.length > 0) {
      newsSlug = `${newsSlug}-${Date.now().toString().slice(-6)}`;
    }

    const parsedCategoryId =
      category_id !== undefined && category_id !== null && category_id !== ""
        ? Number.parseInt(category_id, 10)
        : null;

    if (parsedCategoryId !== null && !Number.isInteger(parsedCategoryId)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    const parsedStatus =
      status !== undefined && status !== null && status !== ""
        ? Number.parseInt(status, 10)
        : 1;

    if (!Number.isInteger(parsedStatus)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const { rows: insertRows } = await db.query(
      `
      INSERT INTO news (
        news_title,
        news_slug,
        news_content,
        news_image,
        news_category_id,
        news_author,
        news_status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING news_id
      `,
      [
        title,
        newsSlug,
        content,
        normalizedImages,
        parsedCategoryId,
        String(req.user.id),
        parsedStatus,
      ]
    );

    const createdNewsId = insertRows[0].news_id;

    const { rows: newNewsRows } = await db.query(
      `
      SELECT
        n.*,
        u.user_name AS author_name,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN "user" u
        ON n.news_author ~ '^[0-9]+$'
       AND n.news_author::int = u.user_id
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      WHERE n.news_id = $1
      `,
      [createdNewsId]
    );

    return res.status(201).json({
      message: "News article created successfully.",
      news: newNewsRows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: "Cannot create news article." });
  }
});

// GET /api/news/:slug
router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    await db.query(
      "UPDATE news SET news_view = news_view + 1, updated_at = NOW() WHERE news_slug = $1",
      [slug]
    );

    const { rows } = await db.query("SELECT * FROM news WHERE news_slug = $1", [
      slug,
    ]);

    if (!rows.length) {
      return res.status(404).json({ error: "News not found" });
    }

    return res.json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/news/:slug
router.put("/:slug", verifyToken, async (req, res) => {
  try {
    const slugParam = req.params.slug;
    const { rows: existingRows } = await db.query(
      "SELECT * FROM news WHERE news_slug = $1",
      [slugParam]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "News article not found" });
    }

    const newsItem = existingRows[0];
    const id = newsItem.news_id;

    const { title, slug, content, images, category_id, status } = req.body;

    let newsSlug = slug;
    if (!slug && title) {
      newsSlug = generateSlug(title);
    }

    if (newsSlug && newsSlug !== newsItem.news_slug) {
      const { rows: slugRows } = await db.query(
        "SELECT news_id FROM news WHERE news_slug = $1 AND news_id != $2 LIMIT 1",
        [newsSlug, id]
      );

      if (slugRows.length > 0) {
        newsSlug = `${newsSlug}-${Date.now().toString().slice(-4)}`;
      }
    }

    const updates = [];
    const values = [];

    if (title !== undefined) {
      values.push(title);
      updates.push(`news_title = $${values.length}`);
    }

    if (newsSlug !== undefined) {
      values.push(newsSlug);
      updates.push(`news_slug = $${values.length}`);
    }

    if (content !== undefined) {
      values.push(content);
      updates.push(`news_content = $${values.length}`);
    }

    if (category_id !== undefined) {
      const parsedCategoryId =
        category_id === null || category_id === ""
          ? null
          : Number.parseInt(category_id, 10);

      if (parsedCategoryId !== null && !Number.isInteger(parsedCategoryId)) {
        return res.status(400).json({ error: "Invalid category ID" });
      }

      values.push(parsedCategoryId);
      updates.push(`news_category_id = $${values.length}`);
    }

    if (status !== undefined) {
      const parsedStatus =
        status === null || status === ""
          ? null
          : Number.parseInt(status, 10);

      if (parsedStatus !== null && !Number.isInteger(parsedStatus)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      values.push(parsedStatus);
      updates.push(`news_status = $${values.length}`);
    }

    if (images !== undefined) {
      const normalizedImages = normalizeNewsImages(images);
      values.push(normalizedImages);
      updates.push(`news_image = $${values.length}`);
    }

    updates.push("updated_at = NOW()");

    if (updates.length === 1) {
      return res.status(400).json({ error: "No update data provided" });
    }

    values.push(id);
    await db.query(
      `UPDATE news SET ${updates.join(", ")} WHERE news_id = $${values.length}`,
      values
    );

    const { rows: updatedRows } = await db.query(
      `
      SELECT
        n.*,
        u.user_name AS author_name,
        c.news_category_name AS category_name
      FROM news n
      LEFT JOIN "user" u
        ON n.news_author ~ '^[0-9]+$'
       AND n.news_author::int = u.user_id
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      WHERE n.news_id = $1
      `,
      [id]
    );

    const updatedNewsItem = updatedRows[0];

    if (
      updatedNewsItem &&
      updatedNewsItem.news_image &&
      typeof updatedNewsItem.news_image === "string"
    ) {
      try {
        updatedNewsItem.images = JSON.parse(updatedNewsItem.news_image);
      } catch (parseError) {
        updatedNewsItem.images = [];
      }
    }

    return res.json({
      message: "News article updated successfully",
      news: updatedNewsItem,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update news article" });
  }
});

/**
 * @route   DELETE /api/news/:id
 * @desc    Xoa bai viet
 * @access  Private (Admin only)
 */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid news ID" });
    }

    const { rows: existingRows } = await db.query(
      "SELECT * FROM news WHERE news_id = $1",
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "News not found" });
    }

    const { news_image, news_content } = existingRows[0];
    let imageUrl = news_image;
    const imagesInContent = getImageInContent(news_content);

    try {
      const parsed = JSON.parse(news_image);
      if (Array.isArray(parsed) && parsed.length > 0) {
        imageUrl = parsed[0];
      }
    } catch (error) {
      // Keep raw image value when it is not JSON.
    }

    const coverImagePublicId = getCloudinaryPublicId(imageUrl);
    if (coverImagePublicId) {
      await cloudinary.uploader.destroy(coverImagePublicId);
    }

    for (const url of imagesInContent) {
      const contentImagePublicId = getCloudinaryPublicId(url);
      if (contentImagePublicId) {
        await cloudinary.uploader.destroy(contentImagePublicId);
      }
    }

    await db.query("DELETE FROM news WHERE news_id = $1", [id]);

    return res.json({ message: "News deleted successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete news" });
  }
});

module.exports = router;
