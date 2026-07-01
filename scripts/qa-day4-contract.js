const fs = require("fs");
const http = require("http");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = require("../app");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "furnitown-secret-key";
const DASHBOARD_FILE = path.join(__dirname, "../routes/dashboard.js");

function signToken(user) {
  return jwt.sign({ id: user.user_id, role: user.user_role }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

async function getFixtures() {
  const queries = {
    admin: `SELECT user_id, user_role, user_gmail FROM "user" WHERE deleted_at IS NULL AND user_role = 'admin' ORDER BY user_id LIMIT 1`,
    user: `SELECT user_id, user_role, user_gmail FROM "user" WHERE deleted_at IS NULL AND user_role = 'user' ORDER BY user_id LIMIT 1`,
    staff: `SELECT user_id, user_role, user_gmail FROM "user" WHERE deleted_at IS NULL AND user_role = 'staff' ORDER BY user_id LIMIT 1`,
    order: `SELECT order_id FROM orders ORDER BY order_id LIMIT 1`,
    product: `SELECT product_id, product_slug FROM product WHERE product_status = 1 ORDER BY product_id LIMIT 1`,
    variant: `
      SELECT
        vp.variant_id,
        vp.product_id,
        vp.color_id,
        COALESCE(vp.variant_product_price_sale, vp.variant_product_price) AS unit_price
      FROM variant_product vp
      ORDER BY vp.variant_id
      LIMIT 1
    `,
    material: `SELECT material_id, slug FROM materials WHERE deleted_at IS NULL ORDER BY material_id LIMIT 1`,
    banner: `SELECT banner_id FROM banners WHERE deleted_at IS NULL ORDER BY banner_id LIMIT 1`,
    notifyType: `SELECT id, type_code FROM notification_types ORDER BY id LIMIT 1`,
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
  const headers = { Accept: check.accept || "*/*" };
  let body;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers.Cookie = `token=${token}`;
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

  return { result, parsed, text, response };
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

function parseDashboardRoutes() {
  const source = fs.readFileSync(DASHBOARD_FILE, "utf8");
  const regex = /router\.get\(\s*["']([^"']+)["']/g;
  const routes = [];
  let match;

  while ((match = regex.exec(source))) {
    routes.push(match[1]);
  }

  return routes;
}

function resolveDashboardPath(routePath, fixtures) {
  let resolved = routePath;

  if (resolved.includes("/orders/detail/:id") || resolved.includes("/orders/invoice/:id") || resolved.includes("/orders/view/:id")) {
    resolved = resolved.replace(":id", String(fixtures.order.order_id));
  } else if (resolved.includes("/contact-forms-design/:id")) {
    resolved = resolved.replace(":id", String(fixtures.contactFormId || 1));
  } else if (resolved.includes(":id")) {
    resolved = resolved.replace(":id", String(fixtures.notifyType?.id || 1));
  }

  if (resolved.includes(":slug")) {
    resolved = resolved.replace(":slug", fixtures.product?.product_slug || fixtures.material?.slug || "sample-slug");
  }

  return `/dashboard${resolved}`;
}

function expectedDashboardStatuses(resolvedPath) {
  const redirectPaths = [
    "/dashboard/orders/view/",
    "/dashboard/accounts",
    "/dashboard/staff",
    "/dashboard/categories/add",
    "/dashboard/categories/edit/",
    "/dashboard/notifications/type-list",
  ];

  if (redirectPaths.some((prefix) => resolvedPath.startsWith(prefix))) {
    return [302];
  }

  return [200];
}

async function main() {
  const fixtures = await getFixtures();
  if (
    !fixtures.admin ||
    !fixtures.user ||
    !fixtures.staff ||
    !fixtures.order ||
    !fixtures.product ||
    !fixtures.variant ||
    !fixtures.material ||
    !fixtures.banner ||
    !fixtures.notifyType
  ) {
    throw new Error("Missing local fixtures for Day 4 smoke");
  }

  const tokens = {
    admin: signToken(fixtures.admin),
    user: signToken(fixtures.user),
    staff: signToken(fixtures.staff),
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const results = [];

    const basicChecks = [
      {
        group: "debug.js",
        name: "GET /api/debug/public",
        method: "GET",
        path: "/api/debug/public",
        expected: [200],
        validate: (body) => ({
          ok: typeof body?.message === "string",
          message: "Expected public debug payload",
        }),
      },
      {
        group: "debug.js",
        name: "GET /api/debug/protected without token",
        method: "GET",
        path: "/api/debug/protected",
        expected: [401],
      },
      {
        group: "debug.js",
        name: "GET /api/debug/protected",
        method: "GET",
        path: "/api/debug/protected",
        token: "user",
        expected: [200],
        validate: (body) => ({
          ok: body?.user?.id === fixtures.user.user_id,
          message: "Expected protected debug user payload",
        }),
      },
      {
        group: "debug.js",
        name: "GET /api/debug/admin with user token",
        method: "GET",
        path: "/api/debug/admin",
        token: "user",
        expected: [403],
      },
      {
        group: "debug.js",
        name: "GET /api/debug/admin",
        method: "GET",
        path: "/api/debug/admin",
        token: "admin",
        expected: [200],
        validate: (body) => ({
          ok: body?.user?.id === fixtures.admin.user_id,
          message: "Expected admin debug user payload",
        }),
      },
      {
        group: "debug.js",
        name: "GET /api/debug/query-test",
        method: "GET",
        path: "/api/debug/query-test",
        token: "user",
        expected: [200],
        validate: (body) => ({
          ok: typeof body?.result?.count === "number",
          message: "Expected query count payload",
        }),
      },
      {
        group: "debug.js",
        name: "GET /api/debug/join-test",
        method: "GET",
        path: "/api/debug/join-test",
        token: "user",
        expected: [200],
      },
      {
        group: "chat.js",
        name: "GET /api/chat",
        method: "GET",
        path: "/api/chat",
        expected: [200],
        validate: (body) => ({
          ok: typeof body?.context === "string",
          message: "Expected chatbot context payload",
        }),
      },
      {
        group: "chat.js",
        name: "PUT /api/chat/context without token",
        method: "PUT",
        path: "/api/chat/context",
        body: {},
        expected: [401],
      },
      {
        group: "chat.js",
        name: "PUT /api/chat/context with user token",
        method: "PUT",
        path: "/api/chat/context",
        token: "user",
        body: {},
        expected: [403],
      },
      {
        group: "chat.js",
        name: "PUT /api/chat/context invalid body",
        method: "PUT",
        path: "/api/chat/context",
        token: "admin",
        body: {},
        expected: [400],
      },
      {
        group: "notify.js",
        name: "GET /api/notify",
        method: "GET",
        path: "/api/notify",
        token: "admin",
        expected: [200],
        validate: (body) => ({
          ok: Array.isArray(body),
          message: "Expected notifications array",
        }),
      },
      {
        group: "notify.js",
        name: "GET /api/notify/admin",
        method: "GET",
        path: "/api/notify/admin",
        token: "admin",
        expected: [200],
        validate: (body) => ({
          ok: Array.isArray(body),
          message: "Expected admin notifications array",
        }),
      },
      {
        group: "notify.js",
        name: "POST /api/notify invalid body",
        method: "POST",
        path: "/api/notify",
        token: "user",
        body: {},
        expected: [400],
      },
      {
        group: "notify.js",
        name: "DELETE /api/notify/:id missing",
        method: "DELETE",
        path: "/api/notify/999999",
        token: "admin",
        expected: [404],
      },
      {
        group: "typenotify.js",
        name: "GET /api/typeNotify",
        method: "GET",
        path: "/api/typeNotify",
        expected: [200],
        validate: (body) => ({
          ok: Array.isArray(body),
          message: "Expected notification types array",
        }),
      },
      {
        group: "typenotify.js",
        name: "GET /api/typeNotify/:id",
        method: "GET",
        path: `/api/typeNotify/${fixtures.notifyType.id}`,
        expected: [200],
        validate: (body) => ({
          ok: body?.id === fixtures.notifyType.id || body?.notification_type_id === fixtures.notifyType.id,
          message: "Expected notification type detail payload",
        }),
      },
      {
        group: "typenotify.js",
        name: "POST /api/typeNotify invalid body",
        method: "POST",
        path: "/api/typeNotify",
        token: "admin",
        body: {},
        expected: [400],
      },
      {
        group: "typenotify.js",
        name: "PUT /api/typeNotify/:id/status invalid body",
        method: "PUT",
        path: `/api/typeNotify/${fixtures.notifyType.id}/status`,
        token: "admin",
        body: {},
        expected: [400],
      },
      {
        group: "typenotify.js",
        name: "PUT /api/typeNotify/:id missing",
        method: "PUT",
        path: "/api/typeNotify/999999",
        token: "admin",
        body: {},
        expected: [404],
      },
      {
        group: "typenotify.js",
        name: "DELETE /api/typeNotify/:id missing",
        method: "DELETE",
        path: "/api/typeNotify/999999",
        token: "admin",
        expected: [404],
      },
      {
        group: "upload.js",
        name: "POST /api/upload/category invalid body",
        method: "POST",
        path: "/api/upload/category",
        token: "admin",
        expected: [400],
      },
      {
        group: "upload.js",
        name: "POST /api/upload/room invalid body",
        method: "POST",
        path: "/api/upload/room",
        token: "admin",
        expected: [400],
      },
      {
        group: "upload.js",
        name: "POST /api/upload/product invalid body",
        method: "POST",
        path: "/api/upload/product",
        token: "admin",
        expected: [400],
      },
      {
        group: "upload.js",
        name: "POST /api/upload/news invalid body",
        method: "POST",
        path: "/api/upload/news",
        token: "admin",
        expected: [400],
      },
      {
        group: "upload.js",
        name: "POST /api/upload/newscategorynews invalid body",
        method: "POST",
        path: "/api/upload/newscategorynews",
        token: "admin",
        expected: [400],
      },
      {
        group: "upload.js",
        name: "POST /api/upload/event invalid body",
        method: "POST",
        path: "/api/upload/event",
        token: "admin",
        expected: [400],
      },
      {
        group: "upload.js",
        name: "DELETE /api/upload/:publicId missing",
        method: "DELETE",
        path: "/api/upload/non-existent-public-id",
        token: "admin",
        expected: [404],
      },
      {
        group: "contactForms.js",
        name: "POST /api/contact-forms invalid body",
        method: "POST",
        path: "/api/contact-forms",
        body: {},
        expected: [400],
      },
      {
        group: "index.js",
        name: "GET / login page",
        method: "GET",
        path: "/",
        accept: "text/html",
        expected: [200],
      },
    ];

    for (const check of basicChecks) {
      const { result } = await runRequest(
        baseUrl,
        check,
        check.token ? tokens[check.token] : null
      );
      results.push(result);
    }

    const createContactFormCheck = {
      group: "contactFormsDesign.js",
      name: "POST /api/contact-form-design valid body",
      method: "POST",
      path: "/api/contact-form-design",
      body: {
        name: "Sprint 17 QA Contact",
        email: "qa-contact@example.com",
        phone: "0909999999",
        room_name: "Living Room",
        design_description: "Need a compact modern layout",
        require_design: "Full package",
        style_design: "Modern",
        budget: 15000000,
        different_information: "Generated by Sprint 17 Day 4 smoke",
        design_fee: 2500000,
      },
      expected: [200],
      validate: (body) => ({
        ok: body?.success === true && typeof body?.contactId === "number",
        message: "Expected created contact form payload",
      }),
    };

    const createdContactForm = await runRequest(baseUrl, createContactFormCheck, null);
    results.push(createdContactForm.result);

    const createdContactId =
      createdContactForm.parsed?.contactId || fixtures.contactFormId || null;
    fixtures.contactFormId = createdContactId;

    const contactChecks = [
      {
        group: "contactFormsDesign.js",
        name: "GET /api/contact-form-design",
        method: "GET",
        path: "/api/contact-form-design?page=1&limit=5",
        token: "admin",
        expected: [200],
        validate: (body) => ({
          ok: Array.isArray(body?.forms) && jsonShape(body?.pagination) === "object",
          message: "Expected contact forms payload",
        }),
      },
      {
        group: "contactFormsDesign.js",
        name: "GET /api/contact-form-design/:id",
        method: "GET",
        path: `/api/contact-form-design/${createdContactId}`,
        token: "admin",
        expected: [200],
        validate: (body) => ({
          ok: body?.contact_form_design_id === createdContactId,
          message: "Expected contact form detail payload",
        }),
      },
      {
        group: "contactFormsDesign.js",
        name: "PUT /api/contact-form-design/:id",
        method: "PUT",
        path: `/api/contact-form-design/${createdContactId}`,
        token: "admin",
        body: {
          remarks: "Updated by Day 4 smoke",
          budget: 18000000,
          user_id: fixtures.staff.user_id,
        },
        expected: [200],
      },
      {
        group: "contactFormsDesign.js",
        name: "GET /api/contact-form-design/:id/details initial",
        method: "GET",
        path: `/api/contact-form-design/${createdContactId}/details`,
        token: "admin",
        expected: [200],
        validate: (body) => ({
          ok: Array.isArray(body),
          message: "Expected empty design details array",
        }),
      },
      {
        group: "contactFormsDesign.js",
        name: "POST /api/contact-form-design/:id/details",
        method: "POST",
        path: `/api/contact-form-design/${createdContactId}/details`,
        token: "admin",
        body: {
          variant_id: fixtures.variant.variant_id,
          quantity: 2,
          unit_price: Number(fixtures.variant.unit_price || 1000000),
        },
        expected: [201],
        validate: (body) => ({
          ok: typeof body?.detailId === "number",
          message: "Expected created design detail payload",
        }),
      },
      {
        group: "contactFormsDesign.js",
        name: "PUT /api/contact-form-design/:id/details/:variant_id",
        method: "PUT",
        path: `/api/contact-form-design/${createdContactId}/details/${fixtures.variant.variant_id}`,
        token: "admin",
        body: {
          quantity: 3,
        },
        expected: [200],
      },
      {
        group: "contactFormsDesign.js",
        name: "DELETE /api/contact-form-design/:id/details/:variant_id",
        method: "DELETE",
        path: `/api/contact-form-design/${createdContactId}/details/${fixtures.variant.variant_id}`,
        token: "admin",
        expected: [200],
      },
      {
        group: "contactFormsDesign.js",
        name: "DELETE /api/contact-form-design/:id",
        method: "DELETE",
        path: `/api/contact-form-design/${createdContactId}`,
        token: "admin",
        expected: [200],
      },
    ];

    for (const check of contactChecks) {
      const { result } = await runRequest(
        baseUrl,
        check,
        check.token ? tokens[check.token] : null
      );
      results.push(result);
    }

    const dashboardRoutes = parseDashboardRoutes();

    const dashboardGuardChecks = [
      {
        group: "dashboard.js",
        name: "GET /dashboard without token",
        method: "GET",
        path: "/dashboard",
        accept: "text/html",
        expected: [302],
      },
      {
        group: "dashboard.js",
        name: "GET /dashboard with user token",
        method: "GET",
        path: "/dashboard",
        accept: "text/html",
        token: "user",
        expected: [403],
      },
    ];

    for (const check of dashboardGuardChecks) {
      const { result } = await runRequest(
        baseUrl,
        check,
        check.token ? tokens[check.token] : null
      );
      results.push(result);
    }

    for (const dashboardRoute of dashboardRoutes) {
      const resolvedPath = resolveDashboardPath(dashboardRoute, fixtures);
      const { result } = await runRequest(
        baseUrl,
        {
          group: "dashboard.js",
          name: `GET ${resolvedPath}`,
          method: "GET",
          path: resolvedPath,
          accept: "text/html",
          expected: expectedDashboardStatuses(resolvedPath),
        },
        tokens.admin
      );
      results.push(result);
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
