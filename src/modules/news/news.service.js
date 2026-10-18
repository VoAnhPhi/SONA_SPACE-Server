"use strict";

const cloudinary = require("cloudinary").v2;
const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { slugify } = require("../../shared/utils/slug");

const FETCH_FAILED_BODY = { error: "Failed to fetch news" };

// SELECT used by the compact list endpoints (/simple and /admin)
const COMPACT_SELECT = `
        n.news_id,
        n.news_image,
        n.news_title,
        n.news_slug,
        n.news_view,
        n.news_status,
        n.created_at,
        n.updated_at,
        c.news_category_name AS category_name
`;

// Article with its author and category, used after create and update
const ARTICLE_WITH_RELATIONS_SQL = `
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
`;

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

function paginationOf({ page, limit }, totalNews) {
  const totalPages = Math.ceil(totalNews / limit);
  return {
    currentPage: page,
    totalPages,
    totalNews,
    newsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Shared by the three list endpoints: filter, count, page, then shape the rows.
 * `isAdminViewer` is false for anonymous requests, which only ever see published articles.
 */
async function queryNewsPage(query, { isAdminViewer, forceAdmin = false, keywordMode, selectSql, mapRow }) {
  const paging = parsePageAndLimit(query);

  const filters = buildNewsFilters({
    categoryId: query.category_id,
    keyword: query.keyword,
    status: query.status,
    allowStatusFilter: forceAdmin || isAdminViewer,
    publishedOnlyByDefault: !forceAdmin && !isAdminViewer,
    keywordMode,
  });

  if (filters.error) {
    throw new HttpError(400, { error: filters.error });
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

  const listParams = [...params, paging.limit, paging.offset];
  const limitIndex = `$${params.length + 1}`;
  const offsetIndex = `$${params.length + 2}`;

  const { rows } = await db.query(
    `
      SELECT
        ${selectSql}
      FROM news n
      LEFT JOIN news_category c ON n.news_category_id = c.news_category_id
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ${limitIndex} OFFSET ${offsetIndex}
      `,
    listParams
  );

  return { news: rows.map(mapRow), pagination: paginationOf(paging, totalNews) };
}

const compactRow = (item) => ({
  news_id: item.news_id,
  news_image: item.news_image,
  news_title: item.news_title,
  news_slug: item.news_slug,
  news_view: item.news_view,
  news_status: item.news_status,
  created_at: item.created_at,
  updated_at: item.updated_at,
  category_name: item.category_name,
});

/** Full articles; a missing description falls back to the start of the content. */
function list(query, { isAdminViewer }) {
  return guard(FETCH_FAILED_BODY, () =>
    queryNewsPage(query, {
      isAdminViewer,
      keywordMode: "titleAndContent",
      selectSql: "n.*,\n        c.news_category_name AS category_name",
      mapRow: (item) =>
        item.news_content && !item.news_description
          ? { ...item, news_description: `${item.news_content.substring(0, 150)}...` }
          : item,
    })
  );
}

function listSimple(query, { isAdminViewer }) {
  return guard(FETCH_FAILED_BODY, () =>
    queryNewsPage(query, {
      isAdminViewer,
      keywordMode: "titleOnly",
      selectSql: COMPACT_SELECT,
      mapRow: compactRow,
    })
  );
}

function listForAdmin(query) {
  return guard(FETCH_FAILED_BODY, () =>
    queryNewsPage(query, {
      forceAdmin: true,
      keywordMode: "titleOnly",
      selectSql: COMPACT_SELECT,
      mapRow: compactRow,
    })
  );
}

/** Most viewed first; the pagination block here is intentionally minimal. */
function listMostViewed(query) {
  return guard({ error: "Failed to fetch viewed news" }, async () => {
    const { page, limit, offset } = parsePageAndLimit(query);

    const { rows: news } = await db.query(
      `
      SELECT n.*
      FROM news n
      ORDER BY n.news_view DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return {
      news,
      pagination: {
        currentPage: page,
        newsPerPage: limit,
      },
    };
  });
}

function listByCategory(rawCategoryId, query) {
  return guard({ error: "Failed to fetch news by category" }, async () => {
    const categoryId = Number.parseInt(rawCategoryId, 10);

    if (!Number.isInteger(categoryId)) {
      throw new HttpError(400, { error: "Invalid category ID" });
    }

    const paging = parsePageAndLimit(query);

    const { rows: countRows } = await db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM news n
      WHERE n.news_category_id = $1 AND n.news_status = 1
      `,
      [categoryId]
    );

    const totalNews = Number(countRows[0]?.total || 0);

    const { rows: news } = await db.query(
      `
      SELECT n.*
      FROM news n
      WHERE n.news_category_id = $1 AND n.news_status = 1
      ORDER BY n.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [categoryId, paging.limit, paging.offset]
    );

    return { news, pagination: paginationOf(paging, totalNews) };
  });
}

function create(body, user) {
  return guard({ error: "Cannot create news article." }, async () => {
    const { title, slug, content, images, category_id, status } = body;

    if (!title || !content) {
      throw new HttpError(400, { error: "Title and content are required." });
    }

    const normalizedImages = normalizeNewsImages(images);
    if (!normalizedImages) {
      throw new HttpError(400, { error: "Image is required." });
    }

    let newsSlug = slugify(slug || title);

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
      throw new HttpError(400, { error: "Invalid category ID" });
    }

    const parsedStatus =
      status !== undefined && status !== null && status !== ""
        ? Number.parseInt(status, 10)
        : 1;

    if (!Number.isInteger(parsedStatus)) {
      throw new HttpError(400, { error: "Invalid status value" });
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
        String(user.id),
        parsedStatus,
      ]
    );

    const { rows: newNewsRows } = await db.query(ARTICLE_WITH_RELATIONS_SQL, [
      insertRows[0].news_id,
    ]);

    return {
      message: "News article created successfully.",
      news: newNewsRows[0],
    };
  });
}

/** Reading an article counts as a view. */
function getBySlugAndCountView(slug) {
  return guard({ error: "Internal server error" }, async () => {
    await db.query(
      "UPDATE news SET news_view = news_view + 1, updated_at = NOW() WHERE news_slug = $1",
      [slug]
    );

    const { rows } = await db.query("SELECT * FROM news WHERE news_slug = $1", [slug]);

    if (!rows.length) {
      throw new HttpError(404, { error: "News not found" });
    }

    return rows[0];
  });
}

function update(slugParam, body) {
  return guard({ error: "Failed to update news article" }, async () => {
    const { rows: existingRows } = await db.query("SELECT * FROM news WHERE news_slug = $1", [
      slugParam,
    ]);

    if (!existingRows.length) {
      throw new HttpError(404, { error: "News article not found" });
    }

    const newsItem = existingRows[0];
    const id = newsItem.news_id;

    const { title, slug, content, images, category_id, status } = body;

    let newsSlug = slug;
    if (!slug && title) {
      newsSlug = slugify(title);
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
        category_id === null || category_id === "" ? null : Number.parseInt(category_id, 10);

      if (parsedCategoryId !== null && !Number.isInteger(parsedCategoryId)) {
        throw new HttpError(400, { error: "Invalid category ID" });
      }

      values.push(parsedCategoryId);
      updates.push(`news_category_id = $${values.length}`);
    }

    if (status !== undefined) {
      const parsedStatus =
        status === null || status === "" ? null : Number.parseInt(status, 10);

      if (parsedStatus !== null && !Number.isInteger(parsedStatus)) {
        throw new HttpError(400, { error: "Invalid status value" });
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
      throw new HttpError(400, { error: "No update data provided" });
    }

    values.push(id);
    await db.query(
      `UPDATE news SET ${updates.join(", ")} WHERE news_id = $${values.length}`,
      values
    );

    const { rows: updatedRows } = await db.query(ARTICLE_WITH_RELATIONS_SQL, [id]);

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

    return {
      message: "News article updated successfully",
      news: updatedNewsItem,
    };
  });
}

/** Removes the cover and inline images from Cloudinary, then the article. */
function remove(rawId) {
  return guard({ error: "Failed to delete news" }, async () => {
    const id = Number.parseInt(rawId, 10);
    if (!Number.isInteger(id)) {
      throw new HttpError(400, { error: "Invalid news ID" });
    }

    const { rows: existingRows } = await db.query("SELECT * FROM news WHERE news_id = $1", [id]);

    if (!existingRows.length) {
      throw new HttpError(404, { error: "News not found" });
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

    return { message: "News deleted successfully" };
  });
}

module.exports = {
  list,
  listSimple,
  listForAdmin,
  listMostViewed,
  listByCategory,
  create,
  getBySlugAndCountView,
  update,
  remove,
};
