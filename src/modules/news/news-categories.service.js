"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { slugify } = require("../../shared/utils/slug");

// Unlike the shared positive-id parser, a negative id passes here and simply finds nothing.
function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function list() {
  return guard({ error: "Failed to fetch categories" }, async () => {
    const { rows } = await db.query(`
      SELECT
        c.news_category_id AS id,
        c.news_category_name AS name,
        c.news_category_slug AS slug,
        c.news_category_status AS status,
        NULL::text AS image,
        NULL::int AS priority,
        c.updated_at,
        c.created_at,
        c.deleted_at,
        COUNT(n.news_id)::int AS news_count
      FROM news_category c
      LEFT JOIN news n ON n.news_category_id = c.news_category_id
      GROUP BY c.news_category_id
      ORDER BY c.created_at DESC
    `);

    return rows;
  });
}

function getBySlug(slug) {
  return guard({ error: "Loi may chu." }, async () => {
    if (!slug || typeof slug !== "string") {
      throw new HttpError(400, { error: "Slug khong hop le." });
    }

    const { rows } = await db.query(
      `
      SELECT
        news_category_id,
        news_category_name,
        news_category_slug,
        news_category_status
      FROM news_category
      WHERE news_category_slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (rows.length === 0) {
      throw new HttpError(404, { error: "Khong tim thay danh muc theo slug." });
    }

    const category = rows[0];

    return {
      id: category.news_category_id,
      name: category.news_category_name,
      slug: category.news_category_slug,
      image: null,
      priority: null,
      status: category.news_category_status,
    };
  });
}

function create(body) {
  const { name, status = 1, image, priority } = body;

  if (!name || typeof name !== "string") {
    throw new HttpError(400, { error: "Ten danh muc la bat buoc va phai la chuoi." });
  }

  const statusNumber = Number(status);
  if (![0, 1].includes(statusNumber)) {
    throw new HttpError(400, { error: "Trang thai khong hop le." });
  }

  if (!image) {
    throw new HttpError(400, { error: "Khong the upload danh muc tin khong co hinh anh" });
  }

  if (
    priority === undefined ||
    priority === "" ||
    Number.isNaN(Number(priority)) ||
    Number(priority) < 0
  ) {
    throw new HttpError(400, { error: "Do uu tien la bat buoc va phai la so >= 0." });
  }

  return guard({ error: "Loi may chu khi tao danh muc" }, async () => {
    const slug = body.slug || slugify(name);

    const { rows: slugRows } = await db.query(
      "SELECT news_category_id FROM news_category WHERE news_category_slug = $1 LIMIT 1",
      [slug]
    );

    if (slugRows.length > 0) {
      throw new HttpError(400, {
        error: "Slug da ton tai, vui long nhap ten khac hoac chinh lai slug.",
      });
    }

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO news_category (
        news_category_name,
        news_category_slug,
        news_category_status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING news_category_id
      `,
      [name, slug, statusNumber]
    );

    return {
      message: "Tao danh muc thanh cong",
      category: {
        id: insertedRows[0].news_category_id,
        name,
        slug,
        image,
        status: statusNumber,
        priority: Number(priority),
      },
    };
  });
}

function updateStatus(rawId, body) {
  const id = parseId(rawId);
  const { status } = body;

  if (!id) {
    throw new HttpError(400, { error: "ID danh muc khong hop le." });
  }

  const statusNumber = Number(status);
  if (![0, 1].includes(statusNumber)) {
    throw new HttpError(400, { error: "Trang thai khong hop le. Chi chap nhan 0 hoac 1." });
  }

  return guard({ error: "Khong the cap nhat trang thai. Vui long thu lai." }, async () => {
    const { rowCount } = await db.query(
      `
      UPDATE news_category
      SET news_category_status = $1, updated_at = NOW()
      WHERE news_category_id = $2
      `,
      [statusNumber, id]
    );

    if (rowCount === 0) {
      throw new HttpError(404, { error: "Khong tim thay danh muc theo ID." });
    }

    return { message: "Cap nhat trang thai danh muc thanh cong." };
  });
}

function update(oldSlug, body) {
  const { name, slug: newSlug, image = null, priority, status } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    throw new HttpError(400, { error: "Ten danh muc tin la bat buoc va phai la chuoi." });
  }

  if (!newSlug || typeof newSlug !== "string" || newSlug.trim() === "") {
    throw new HttpError(400, { error: "Slug moi la bat buoc va phai la chuoi." });
  }

  const statusNumber = Number(status);
  if (![0, 1].includes(statusNumber)) {
    throw new HttpError(400, { error: "Trang thai khong hop le." });
  }

  const priorityNumber = Number(priority);
  if (Number.isNaN(priorityNumber) || priorityNumber < 0) {
    throw new HttpError(400, { error: "Do uu tien khong hop le." });
  }

  return guard({ error: "Khong the cap nhat danh muc. Vui long thu lai." }, async () => {
    const { rowCount } = await db.query(
      `
      UPDATE news_category
      SET
        news_category_name = $1,
        news_category_slug = $2,
        news_category_status = $3,
        updated_at = NOW()
      WHERE news_category_slug = $4
      `,
      [name.trim(), newSlug.trim(), statusNumber, oldSlug]
    );

    if (rowCount === 0) {
      throw new HttpError(404, { error: "Khong tim thay danh muc theo slug." });
    }

    return {
      message: "Cap nhat danh muc thanh cong.",
      category: {
        name: name.trim(),
        slug: newSlug.trim(),
        status: statusNumber,
        image,
        priority: priorityNumber,
      },
    };
  });
}

/** A category still used by articles cannot be deleted. */
function remove(rawId) {
  return guard({ error: "Khong the xoa danh muc" }, async () => {
    const categoryId = parseId(rawId);
    if (!categoryId || categoryId <= 0) {
      throw new HttpError(400, { error: "ID danh muc khong hop le" });
    }

    const { rows: categories } = await db.query(
      "SELECT news_category_id FROM news_category WHERE news_category_id = $1",
      [categoryId]
    );

    if (categories.length === 0) {
      throw new HttpError(404, { error: "Khong tim thay danh muc" });
    }

    const { rows: usedRows } = await db.query(
      "SELECT COUNT(*)::int AS count FROM news WHERE news_category_id = $1",
      [categoryId]
    );

    if (usedRows[0].count > 0) {
      throw new HttpError(400, {
        error: `Khong the xoa danh muc nay vi co ${usedRows[0].count} bai viet dang su dung.`,
      });
    }

    await db.query("DELETE FROM news_category WHERE news_category_id = $1", [categoryId]);

    return { message: "Xoa danh muc thanh cong" };
  });
}

/** Published articles of a category, newest first. */
function listNewsBySlug(slug) {
  return guard({ error: "Failed to fetch news" }, async () => {
    const { rows: categoryRows } = await db.query(
      `
      SELECT news_category_id, news_category_name, news_category_slug
      FROM news_category
      WHERE news_category_slug = $1
      LIMIT 1
      `,
      [slug]
    );

    if (!categoryRows.length) {
      throw new HttpError(404, { error: "Category not found" });
    }

    const category = categoryRows[0];

    const { rows: newsRows } = await db.query(
      `
      SELECT
        news_id,
        news_image,
        news_slug,
        news_title,
        created_at
      FROM news
      WHERE news_category_id = $1 AND news_status = 1
      ORDER BY created_at DESC
      `,
      [category.news_category_id]
    );

    return {
      news: newsRows,
      category: {
        id: category.news_category_id,
        name: category.news_category_name,
        slug: category.news_category_slug,
      },
    };
  });
}

module.exports = { list, getBySlug, create, updateStatus, update, remove, listNewsBySlug };
