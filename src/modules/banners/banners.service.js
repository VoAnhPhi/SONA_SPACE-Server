"use strict";

const path = require("path");
const fs = require("fs");
const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { parsePositiveId } = require("../../shared/utils/parse-id");
const { BANNER_UPLOAD_DIR } = require("./banners.upload");

const PAGE_TYPES = [
  "home",
  "danh-muc",
  "san-pham",
  "gio-hang",
  "thanh-toan",
  "dat-hang-thanh-cong",
  "khong-gian",
  "dich-vu-thiet-ke",
  "ho-so-kien-truc",
  "lien-he",
  "dang-ky",
  "dang-nhap",
  "quen-mat-khau",
  "tai-khoan",
  "chi-tiet-don-hang",
  "dieu-khoan-su-dung",
  "chinh-sach-bao-mat",
  "tin-tuc",
];

const FAILURE = { error: "Internal server error" };

function toImageUrl(fileName) {
  if (!fileName) return null;
  if (String(fileName).startsWith("http")) return fileName;
  return `/uploads/banners/${path.basename(fileName)}`;
}

function normalizeStatus(status) {
  if (status === "active" || status === 1 || status === "1" || status === true) {
    return 1;
  }
  return 0;
}

function normalizePageType(pageType) {
  const normalized = String(pageType || "home").trim().toLowerCase();
  return PAGE_TYPES.includes(normalized) ? normalized : "home";
}

function normalizeOptionalDate(dateValue) {
  if (dateValue === undefined || dateValue === null || dateValue === "") {
    return null;
  }
  return dateValue;
}

function mapBannerRow(row) {
  const numericStatus = Number(row.status) === 1 ? 1 : 0;
  return {
    ...row,
    id: row.banner_id,
    title: row.banner_title,
    subtitle: row.banner_description,
    image_url: toImageUrl(row.banner_image),
    link_url: row.banner_link,
    position: row.banner_priority ?? 0,
    is_active: numericStatus,
    status: numericStatus === 1 ? "active" : "inactive",
    page_type: row.page_type || "home",
    start_date: row.start_date,
    end_date: row.end_date,
  };
}

function requireBannerId(rawId) {
  const bannerId = parsePositiveId(rawId);
  if (!bannerId) throw new HttpError(400, { error: "Invalid banner ID" });
  return bannerId;
}

function removeLocalImage(fileName) {
  if (fileName && !String(fileName).startsWith("http")) {
    const imagePath = path.join(BANNER_UPLOAD_DIR, path.basename(fileName));
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
}

async function findActiveBanner(bannerId) {
  const { rows } = await db.query(
    "SELECT * FROM banners WHERE banner_id = $1 AND deleted_at IS NULL",
    [bannerId]
  );
  if (!rows.length) throw new HttpError(404, { error: "Banner not found" });
  return rows[0];
}

function groupByPageType(normalizedPageTypes, rows) {
  const grouped = normalizedPageTypes.reduce((acc, pageType) => {
    acc[pageType] = [];
    return acc;
  }, {});

  rows.map(mapBannerRow).forEach((banner) => {
    if (!grouped[banner.page_type]) {
      grouped[banner.page_type] = [];
    }
    grouped[banner.page_type].push(banner);
  });

  return grouped;
}

async function fetchVisibleForPageTypes(normalizedPageTypes) {
  const { rows } = await db.query(
    `
      SELECT *
      FROM banners
      WHERE deleted_at IS NULL
        AND status = 1
        AND page_type = ANY($1::text[])
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY banner_priority ASC, created_at DESC
      `,
    [normalizedPageTypes]
  );
  return groupByPageType(normalizedPageTypes, rows);
}

function listAll() {
  return guard(FAILURE, async () => {
    const { rows } = await db.query(
      `
      SELECT
        b.*,
        c.category_name
      FROM banners b
      LEFT JOIN category c ON b.category_id = c.category_id
      WHERE b.deleted_at IS NULL
      ORDER BY b.banner_priority ASC, b.created_at DESC
      `
    );
    return rows.map(mapBannerRow);
  });
}

/** Visible banners of one page type (active and inside their date window). */
function listForPage(rawPageType) {
  return guard(FAILURE, async () => {
    const pageType = normalizePageType(rawPageType);
    const { rows } = await db.query(
      `
      SELECT *
      FROM banners
      WHERE deleted_at IS NULL
        AND status = 1
        AND LOWER(page_type) = $1
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY banner_priority ASC, created_at DESC
      `,
      [pageType]
    );
    return rows.map(mapBannerRow);
  });
}

/** Visible banners grouped by page type; the list comes from the request body. */
function groupedForPageTypesFromBody(body) {
  return guard(FAILURE, async () => {
    const { pageTypes } = body;
    if (!Array.isArray(pageTypes) || pageTypes.length === 0) {
      throw new HttpError(400, { error: "pageTypes array is required" });
    }
    return fetchVisibleForPageTypes(pageTypes.map(normalizePageType));
  });
}

/** Same as above, with the list in the `types` query parameter (comma separated or repeated). */
function groupedForPageTypesFromQuery(query) {
  return guard(FAILURE, async () => {
    const { types } = query;
    if (!types) {
      throw new HttpError(400, { error: "types query parameter is required" });
    }
    const pageTypes = Array.isArray(types) ? types : String(types).split(",");
    return fetchVisibleForPageTypes(pageTypes.map(normalizePageType));
  });
}

function listPageTypes() {
  return PAGE_TYPES;
}

function getById(rawId) {
  return guard(FAILURE, async () => {
    const bannerId = requireBannerId(rawId);

    const { rows } = await db.query(
      "SELECT *, banner_id AS id FROM banners WHERE banner_id = $1 AND deleted_at IS NULL",
      [bannerId]
    );

    if (!rows.length) {
      throw new HttpError(404, { error: "Banner not found" });
    }

    return mapBannerRow(rows[0]);
  });
}

function create(body, file) {
  return guard(FAILURE, async () => {
    const { title, subtitle, link_url, position, category_id, page_type, start_date, end_date } = body;

    if (!title || !file) {
      throw new HttpError(400, { error: "Title and image are required" });
    }

    const status = normalizeStatus(body.status);
    const { rows } = await db.query(
      `
      INSERT INTO banners (
        banner_title,
        banner_description,
        banner_image,
        banner_link,
        banner_priority,
        page_type,
        status,
        category_id,
        start_date,
        end_date,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NULL)
      RETURNING *
      `,
      [
        title,
        subtitle || null,
        path.basename(file.path),
        link_url || null,
        Number(position) || 0,
        normalizePageType(page_type),
        status,
        category_id ? Number(category_id) : null,
        normalizeOptionalDate(start_date),
        normalizeOptionalDate(end_date),
      ]
    );

    return mapBannerRow(rows[0]);
  });
}

function update(rawId, body, file) {
  return guard(FAILURE, async () => {
    const bannerId = requireBannerId(rawId);
    const existing = await findActiveBanner(bannerId);
    let nextImage = existing.banner_image;

    if (file) {
      removeLocalImage(existing.banner_image);
      nextImage = path.basename(file.path);
    }

    const nextStatus =
      body.status === undefined ? Number(existing.status) : normalizeStatus(body.status);

    await db.query(
      `
      UPDATE banners
      SET
        banner_title = $1,
        banner_description = $2,
        banner_image = $3,
        banner_link = $4,
        banner_priority = $5,
        page_type = $6,
        status = $7,
        category_id = $8,
        start_date = $9,
        end_date = $10,
        updated_at = NOW()
      WHERE banner_id = $11
      `,
      [
        body.title || existing.banner_title,
        body.subtitle !== undefined ? body.subtitle : existing.banner_description,
        nextImage,
        body.link_url !== undefined ? body.link_url : existing.banner_link,
        body.position !== undefined ? Number(body.position) : existing.banner_priority,
        body.page_type !== undefined ? normalizePageType(body.page_type) : existing.page_type,
        nextStatus,
        body.category_id !== undefined && body.category_id !== ""
          ? Number(body.category_id)
          : existing.category_id,
        body.start_date !== undefined
          ? normalizeOptionalDate(body.start_date)
          : existing.start_date,
        body.end_date !== undefined ? normalizeOptionalDate(body.end_date) : existing.end_date,
        bannerId,
      ]
    );

    const { rows: updatedRows } = await db.query("SELECT * FROM banners WHERE banner_id = $1", [
      bannerId,
    ]);

    return mapBannerRow(updatedRows[0]);
  });
}

function remove(rawId) {
  return guard(FAILURE, async () => {
    const bannerId = requireBannerId(rawId);
    const existing = await findActiveBanner(bannerId);

    removeLocalImage(existing.banner_image);

    await db.query("DELETE FROM banners WHERE banner_id = $1", [bannerId]);
    return { message: "Banner deleted successfully" };
  });
}

function toggleStatus(rawId) {
  return guard(FAILURE, async () => {
    const bannerId = requireBannerId(rawId);
    const existing = await findActiveBanner(bannerId);
    const newStatus = Number(existing.status) === 1 ? 0 : 1;

    await db.query("UPDATE banners SET status = $1, updated_at = NOW() WHERE banner_id = $2", [
      newStatus,
      bannerId,
    ]);

    const { rows: updatedRows } = await db.query("SELECT * FROM banners WHERE banner_id = $1", [
      bannerId,
    ]);

    return {
      message: `Banner ${newStatus === 1 ? "da duoc hien thi" : "da duoc an"}`,
      banner: mapBannerRow(updatedRows[0]),
      is_active: newStatus,
    };
  });
}

module.exports = {
  listAll,
  listForPage,
  groupedForPageTypesFromBody,
  groupedForPageTypesFromQuery,
  listPageTypes,
  getById,
  create,
  update,
  remove,
  toggleStatus,
};
