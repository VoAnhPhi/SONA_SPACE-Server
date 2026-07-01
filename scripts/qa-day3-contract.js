const http = require("http");
const jwt = require("jsonwebtoken");

const app = require("../app");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "furnitown-secret-key";

function signToken(user) {
  return jwt.sign({ id: user.user_id, role: user.user_role }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

async function getFixtures() {
  const queries = {
    admin: `SELECT user_id, user_role, user_gmail FROM "user" WHERE deleted_at IS NULL AND user_role = 'admin' ORDER BY user_id LIMIT 1`,
    user: `SELECT user_id, user_role, user_gmail FROM "user" WHERE deleted_at IS NULL AND user_role = 'user' ORDER BY user_id LIMIT 1`,
    product: `SELECT product_id, product_slug FROM product WHERE product_status = 1 ORDER BY product_id LIMIT 1`,
    variant: `SELECT variant_id, product_id, color_id FROM variant_product ORDER BY variant_id LIMIT 1`,
    newsCategory: `SELECT news_category_id, news_category_slug FROM news_category ORDER BY news_category_id LIMIT 1`,
    event: `SELECT event_id FROM events ORDER BY event_id LIMIT 1`,
    banner: `SELECT banner_id FROM banners WHERE deleted_at IS NULL ORDER BY banner_id LIMIT 1`,
  };

  const fixtures = {};
  for (const [key, sql] of Object.entries(queries)) {
    const { rows } = await db.query(sql);
    fixtures[key] = rows[0] || null;
  }

  return fixtures;
}

function jsonShape(value) {
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return typeof value;
}

async function runRequest(baseUrl, check, token) {
  const headers = { Accept: "application/json" };
  let body;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (check.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(check.body);
  }

  const response = await fetch(`${baseUrl}${check.path}`, {
    method: check.method,
    headers,
    body,
    redirect: "manual",
  });

  const text = await response.text().catch(() => "");
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  const result = {
    group: check.group,
    name: check.name,
    status: response.status,
    expected: check.expected,
    ok: check.expected.includes(response.status),
    bodyPreview: text.slice(0, 160),
    location: response.headers.get("location"),
  };

  if (result.ok && typeof check.validate === "function") {
    const validation = check.validate(parsed, text, response);
    result.ok = validation.ok;
    result.validation = validation.message;
  }

  return result;
}

function summarize(results) {
  const summary = new Map();
  for (const result of results) {
    if (!summary.has(result.group)) {
      summary.set(result.group, { total: 0, failed: 0 });
    }
    const stats = summary.get(result.group);
    stats.total += 1;
    if (!result.ok) stats.failed += 1;
  }

  return [...summary.entries()]
    .map(([group, stats]) => ({
      group,
      total: stats.total,
      failed: stats.failed,
      passed: stats.total - stats.failed,
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

async function main() {
  const fixtures = await getFixtures();
  if (
    !fixtures.admin ||
    !fixtures.user ||
    !fixtures.product ||
    !fixtures.variant ||
    !fixtures.newsCategory ||
    !fixtures.event ||
    !fixtures.banner
  ) {
    throw new Error("Missing local fixtures for Day 3 smoke");
  }

  const tokens = {
    admin: signToken(fixtures.admin),
    user: signToken(fixtures.user),
  };

  const checks = [
    {
      group: "auth.js",
      name: "POST /api/auth/register invalid body",
      method: "POST",
      path: "/api/auth/register",
      body: {},
      expected: [400],
      validate: (body) => ({
        ok: jsonShape(body?.errors) === "object",
        message: "Expected validation errors object",
      }),
    },
    {
      group: "auth.js",
      name: "GET /api/auth/verify-email missing token",
      method: "GET",
      path: "/api/auth/verify-email",
      expected: [302],
      validate: (_, __, response) => ({
        ok: String(response.headers.get("location") || "").includes("xac-thuc-email"),
        message: "Expected redirect to frontend verification page",
      }),
    },
    {
      group: "auth.js",
      name: "POST /api/auth/login invalid body",
      method: "POST",
      path: "/api/auth/login",
      body: {},
      expected: [400],
    },
    {
      group: "auth.js",
      name: "GET /api/auth/profile",
      method: "GET",
      path: "/api/auth/profile",
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: body?.user?.id === fixtures.user.user_id,
        message: "Expected current user profile payload",
      }),
    },
    {
      group: "auth.js",
      name: "POST /api/auth/change-password wrong current password",
      method: "POST",
      path: "/api/auth/change-password",
      token: "user",
      body: {
        currentPassword: "definitely-wrong-password",
        newPassword: "1234567",
      },
      expected: [401],
    },
    {
      group: "auth.js",
      name: "POST /api/auth/admin-login invalid body",
      method: "POST",
      path: "/api/auth/admin-login",
      body: {},
      expected: [400],
    },
    {
      group: "auth.js",
      name: "GET /api/auth/check-token admin",
      method: "GET",
      path: "/api/auth/check-token",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: body?.user_id === fixtures.admin.user_id && body?.role === "admin",
        message: "Expected admin token metadata payload",
      }),
    },
    {
      group: "auth.js",
      name: "GET /api/auth/check-token non-admin",
      method: "GET",
      path: "/api/auth/check-token",
      token: "user",
      expected: [403],
    },
    {
      group: "auth.js",
      name: "POST /api/auth/send-otp invalid body",
      method: "POST",
      path: "/api/auth/send-otp",
      body: {},
      expected: [400],
    },
    {
      group: "auth.js",
      name: "POST /api/auth/verify-otp invalid body",
      method: "POST",
      path: "/api/auth/verify-otp",
      body: {},
      expected: [400],
    },
    {
      group: "auth.js",
      name: "POST /api/auth/reset-password invalid token",
      method: "POST",
      path: "/api/auth/reset-password",
      body: {
        newPassword: "1234567",
        token: "invalid-token",
      },
      expected: [401],
    },
    {
      group: "users.js",
      name: "GET /api/users admin list",
      method: "GET",
      path: "/api/users?page=1&limit=2",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.users) && jsonShape(body?.pagination) === "object",
        message: "Expected users array and pagination object",
      }),
    },
    {
      group: "users.js",
      name: "GET /api/users/simple",
      method: "GET",
      path: "/api/users/simple",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected simple users array",
      }),
    },
    {
      group: "users.js",
      name: "GET /api/users/admin",
      method: "GET",
      path: "/api/users/admin",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.users),
        message: "Expected admin users payload",
      }),
    },
    {
      group: "users.js",
      name: "GET /api/users/staff",
      method: "GET",
      path: "/api/users/staff",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.users),
        message: "Expected staff users payload",
      }),
    },
    {
      group: "users.js",
      name: "GET /api/users/admin/:id",
      method: "GET",
      path: `/api/users/admin/${fixtures.admin.user_id}`,
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: body?.id === fixtures.admin.user_id,
        message: "Expected admin user detail payload",
      }),
    },
    {
      group: "users.js",
      name: "PUT /api/users/admin/:id invalid",
      method: "PUT",
      path: "/api/users/admin/not-a-number",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "users.js",
      name: "GET /api/users/:id own",
      method: "GET",
      path: `/api/users/${fixtures.user.user_id}`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: body?.id === fixtures.user.user_id,
        message: "Expected own user payload",
      }),
    },
    {
      group: "users.js",
      name: "GET /api/users/:id forbidden cross-user",
      method: "GET",
      path: `/api/users/${fixtures.admin.user_id}`,
      token: "user",
      expected: [403],
    },
    {
      group: "users.js",
      name: "PUT /api/users/:id invalid",
      method: "PUT",
      path: "/api/users/not-a-number",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "users.js",
      name: "DELETE /api/users/:id missing",
      method: "DELETE",
      path: "/api/users/999999",
      token: "admin",
      expected: [404],
    },
    {
      group: "users.js",
      name: "GET /api/users/:id/orders own",
      method: "GET",
      path: `/api/users/${fixtures.user.user_id}/orders`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected orders array",
      }),
    },
    {
      group: "users.js",
      name: "GET /api/users/:id/wishlist own",
      method: "GET",
      path: `/api/users/${fixtures.user.user_id}/wishlist`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected wishlist array",
      }),
    },
    {
      group: "users.js",
      name: "GET /api/users/:id/reviews own",
      method: "GET",
      path: `/api/users/${fixtures.user.user_id}/reviews`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected reviews array",
      }),
    },
    {
      group: "comments.js",
      name: "GET /api/comments",
      method: "GET",
      path: "/api/comments?page=1&limit=2",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.comments) && jsonShape(body?.pagination) === "object",
        message: "Expected comments array and pagination object",
      }),
    },
    {
      group: "comments.js",
      name: "GET /api/comments invalid product filter",
      method: "GET",
      path: "/api/comments?product_id=not-a-number",
      expected: [400],
    },
    {
      group: "comments.js",
      name: "GET /api/comments/admin",
      method: "GET",
      path: "/api/comments/admin",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected admin comments array",
      }),
    },
    {
      group: "comments.js",
      name: "PUT /api/comments/:comment_id/status invalid",
      method: "PUT",
      path: "/api/comments/not-a-number/status",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "comments.js",
      name: "GET /api/comments/:id missing",
      method: "GET",
      path: "/api/comments/999999",
      expected: [404],
    },
    {
      group: "comments.js",
      name: "GET /api/comments/product/:productId",
      method: "GET",
      path: `/api/comments/product/${fixtures.product.product_id}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.product_id === fixtures.product.product_id && Array.isArray(body?.comments),
        message: "Expected product comments payload",
      }),
    },
    {
      group: "comments.js",
      name: "GET /api/comments/user/:userId own",
      method: "GET",
      path: `/api/comments/user/${fixtures.user.user_id}?page=1&limit=2`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: body?.user_id === fixtures.user.user_id && Array.isArray(body?.comments),
        message: "Expected user comments payload",
      }),
    },
    {
      group: "comments.js",
      name: "POST /api/comments invalid body",
      method: "POST",
      path: "/api/comments",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "comments.js",
      name: "PUT /api/comments/:id invalid",
      method: "PUT",
      path: "/api/comments/not-a-number",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "comments.js",
      name: "DELETE /api/comments/:id invalid",
      method: "DELETE",
      path: "/api/comments/not-a-number",
      token: "user",
      expected: [400],
    },
    {
      group: "comments.js",
      name: "PUT /api/comments/:id/toggle-status invalid",
      method: "PUT",
      path: "/api/comments/not-a-number/toggle-status",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "wishlists.js",
      name: "GET /api/wishlists status=1",
      method: "GET",
      path: "/api/wishlists?status=1",
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected wishlist array",
      }),
    },
    {
      group: "wishlists.js",
      name: "GET /api/wishlists status=0",
      method: "GET",
      path: "/api/wishlists?status=0",
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected cart array",
      }),
    },
    {
      group: "wishlists.js",
      name: "GET /api/wishlists invalid status",
      method: "GET",
      path: "/api/wishlists?status=nope",
      token: "user",
      expected: [400],
    },
    {
      group: "wishlists.js",
      name: "GET /api/wishlists/variant/:variantId",
      method: "GET",
      path: `/api/wishlists/variant/${fixtures.variant.variant_id}`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: typeof body?.exists === "boolean",
        message: "Expected wishlist variant existence payload",
      }),
    },
    {
      group: "wishlists.js",
      name: "POST /api/wishlists invalid body",
      method: "POST",
      path: "/api/wishlists",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "wishlists.js",
      name: "PUT /api/wishlists/:id invalid",
      method: "PUT",
      path: "/api/wishlists/not-a-number",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "wishlists.js",
      name: "DELETE /api/wishlists/clearid invalid body",
      method: "DELETE",
      path: "/api/wishlists/clearid",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "wishlists.js",
      name: "DELETE /api/wishlists/:id invalid",
      method: "DELETE",
      path: "/api/wishlists/not-a-number",
      token: "user",
      expected: [400],
    },
    {
      group: "wishlists.js",
      name: "DELETE /api/wishlists/variant/:variantId invalid",
      method: "DELETE",
      path: "/api/wishlists/variant/not-a-number",
      token: "user",
      expected: [400],
    },
    {
      group: "wishlists.js",
      name: "DELETE /api/wishlists/product/:productId invalid",
      method: "DELETE",
      path: "/api/wishlists/product/not-a-number",
      token: "user",
      expected: [400],
    },
    {
      group: "wishlists.js",
      name: "GET /api/wishlists/check/:productId",
      method: "GET",
      path: `/api/wishlists/check/${fixtures.product.product_id}`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: typeof body?.in_wishlist === "boolean",
        message: "Expected wishlist membership payload",
      }),
    },
    {
      group: "wishlists-id.js",
      name: "GET /api/wishlists-id/:userId",
      method: "GET",
      path: `/api/wishlists-id/${fixtures.user.user_id}`,
      expected: [200],
      validate: (body) => ({
        ok:
          (Array.isArray(body?.wishlists) && typeof body?.wishlist_count === "number") ||
          (Array.isArray(body?.wishlists) && typeof body?.message === "string"),
        message: "Expected public wishlist payload",
      }),
    },
    {
      group: "news.js",
      name: "GET /api/news",
      method: "GET",
      path: "/api/news?page=1&limit=2",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.news) && jsonShape(body?.pagination) === "object",
        message: "Expected news list payload",
      }),
    },
    {
      group: "news.js",
      name: "GET /api/news/simple",
      method: "GET",
      path: "/api/news/simple?page=1&limit=2",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.news) && jsonShape(body?.pagination) === "object",
        message: "Expected simple news payload",
      }),
    },
    {
      group: "news.js",
      name: "GET /api/news/admin",
      method: "GET",
      path: "/api/news/admin?page=1&limit=2",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.news) && jsonShape(body?.pagination) === "object",
        message: "Expected admin news payload",
      }),
    },
    {
      group: "news.js",
      name: "GET /api/news/views",
      method: "GET",
      path: "/api/news/views?page=1&limit=2",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.news) && jsonShape(body?.pagination) === "object",
        message: "Expected viewed news payload",
      }),
    },
    {
      group: "news.js",
      name: "GET /api/news/category/:categoryId",
      method: "GET",
      path: `/api/news/category/${fixtures.newsCategory.news_category_id}?page=1&limit=2`,
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.news) && jsonShape(body?.pagination) === "object",
        message: "Expected category news payload",
      }),
    },
    {
      group: "news.js",
      name: "POST /api/news invalid body",
      method: "POST",
      path: "/api/news",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "news.js",
      name: "GET /api/news/:slug missing",
      method: "GET",
      path: "/api/news/not-found-news-slug",
      expected: [404],
    },
    {
      group: "news.js",
      name: "PUT /api/news/:slug missing",
      method: "PUT",
      path: "/api/news/not-found-news-slug",
      token: "admin",
      body: {},
      expected: [404],
    },
    {
      group: "news.js",
      name: "DELETE /api/news/:id missing",
      method: "DELETE",
      path: "/api/news/999999",
      token: "admin",
      expected: [404],
    },
    {
      group: "newsCategories.js",
      name: "GET /api/news-categories",
      method: "GET",
      path: "/api/news-categories",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected news categories array",
      }),
    },
    {
      group: "newsCategories.js",
      name: "GET /api/news-categories/:slug",
      method: "GET",
      path: `/api/news-categories/${fixtures.newsCategory.news_category_slug}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.slug === fixtures.newsCategory.news_category_slug,
        message: "Expected news category detail payload",
      }),
    },
    {
      group: "newsCategories.js",
      name: "POST /api/news-categories invalid body",
      method: "POST",
      path: "/api/news-categories",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "newsCategories.js",
      name: "PUT /api/news-categories/:id/status invalid status",
      method: "PUT",
      path: `/api/news-categories/${fixtures.newsCategory.news_category_id}/status`,
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "newsCategories.js",
      name: "PUT /api/news-categories/:slug invalid body",
      method: "PUT",
      path: `/api/news-categories/${fixtures.newsCategory.news_category_slug}`,
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "newsCategories.js",
      name: "DELETE /api/news-categories/:id missing",
      method: "DELETE",
      path: "/api/news-categories/999999",
      token: "admin",
      expected: [404],
    },
    {
      group: "newsCategories.js",
      name: "GET /api/news-categories/news/:slug",
      method: "GET",
      path: `/api/news-categories/news/${fixtures.newsCategory.news_category_slug}`,
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.news) && jsonShape(body?.category) === "object",
        message: "Expected category news payload",
      }),
    },
    {
      group: "events.js",
      name: "GET /api/events/active",
      method: "GET",
      path: "/api/events/active",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected active events array",
      }),
    },
    {
      group: "events.js",
      name: "GET /api/events/admin",
      method: "GET",
      path: "/api/events/admin",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected admin events array",
      }),
    },
    {
      group: "events.js",
      name: "GET /api/events/admin/:id",
      method: "GET",
      path: `/api/events/admin/${fixtures.event.event_id}`,
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: body?.id === fixtures.event.event_id,
        message: "Expected event detail payload",
      }),
    },
    {
      group: "events.js",
      name: "POST /api/events/admin invalid body",
      method: "POST",
      path: "/api/events/admin",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "events.js",
      name: "PUT /api/events/admin/:id invalid",
      method: "PUT",
      path: "/api/events/admin/not-a-number",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "events.js",
      name: "PUT /api/events/admin/:id/toggle-status missing",
      method: "PUT",
      path: "/api/events/admin/999999/toggle-status",
      token: "admin",
      body: {},
      expected: [404],
    },
    {
      group: "events.js",
      name: "DELETE /api/events/:id missing",
      method: "DELETE",
      path: "/api/events/999999",
      token: "admin",
      expected: [404],
    },
    {
      group: "banners.js",
      name: "GET /api/banners",
      method: "GET",
      path: "/api/banners",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected banners array",
      }),
    },
    {
      group: "banners.js",
      name: "GET /api/banners/page/home",
      method: "GET",
      path: "/api/banners/page/home",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected page banners array",
      }),
    },
    {
      group: "banners.js",
      name: "POST /api/banners/pages invalid body",
      method: "POST",
      path: "/api/banners/pages",
      body: {},
      expected: [400],
    },
    {
      group: "banners.js",
      name: "GET /api/banners/pages",
      method: "GET",
      path: "/api/banners/pages?types=home",
      expected: [200],
      validate: (body) => ({
        ok: jsonShape(body) === "object" && Array.isArray(body?.home),
        message: "Expected page map payload",
      }),
    },
    {
      group: "banners.js",
      name: "GET /api/banners/page-types",
      method: "GET",
      path: "/api/banners/page-types",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected page types array",
      }),
    },
    {
      group: "banners.js",
      name: "GET /api/banners/:id",
      method: "GET",
      path: `/api/banners/${fixtures.banner.banner_id}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.id === fixtures.banner.banner_id,
        message: "Expected banner detail payload",
      }),
    },
    {
      group: "banners.js",
      name: "POST /api/banners invalid body",
      method: "POST",
      path: "/api/banners",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "banners.js",
      name: "PUT /api/banners/:id missing",
      method: "PUT",
      path: "/api/banners/999999",
      token: "admin",
      body: {},
      expected: [404],
    },
    {
      group: "banners.js",
      name: "DELETE /api/banners/:id missing",
      method: "DELETE",
      path: "/api/banners/999999",
      token: "admin",
      expected: [404],
    },
    {
      group: "banners.js",
      name: "PUT /api/banners/:id/toggle-status missing",
      method: "PUT",
      path: "/api/banners/999999/toggle-status",
      token: "admin",
      body: {},
      expected: [404],
    },
    {
      group: "auth.js",
      name: "POST /api/auth/logout",
      method: "POST",
      path: "/api/auth/logout",
      token: "user",
      expected: [200],
    },
  ];

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const results = [];

    for (const check of checks) {
      results.push(
        await runRequest(baseUrl, check, check.token ? tokens[check.token] : null)
      );
    }

    const failed = results.filter((result) => !result.ok);
    console.log(
      JSON.stringify(
        {
          summary: summarize(results),
          failed,
          results,
        },
        null,
        2
      )
    );

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
