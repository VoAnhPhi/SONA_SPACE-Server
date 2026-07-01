const http = require("http");
const jwt = require("jsonwebtoken");

const app = require("../app");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "furnitown-secret-key";

const PASS_MUTATION = [200, 201, 400, 404, 409];
const PASS_READ = [200, 404];

const checks = [
  {
    group: "dashboard.js",
    name: "GET /dashboard",
    method: "GET",
    path: "/dashboard",
    scenarios: {
      none: [302],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "auth.js",
    name: "GET /api/auth/profile",
    method: "GET",
    path: "/api/auth/profile",
    scenarios: {
      none: [401],
      user: [200],
      admin: [200],
    },
  },
  {
    group: "attributes.js",
    name: "POST /api/attribute/1",
    method: "POST",
    path: "/api/attribute/1",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: PASS_MUTATION,
    },
  },
  {
    group: "banners.js",
    name: "POST /api/banners",
    method: "POST",
    path: "/api/banners",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: PASS_MUTATION,
    },
  },
  {
    group: "categories.js",
    name: "GET /api/categories/admin/all",
    method: "GET",
    path: "/api/categories/admin/all",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "chat.js",
    name: "PUT /api/chat/context",
    method: "PUT",
    path: "/api/chat/context",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: PASS_MUTATION,
    },
  },
  {
    group: "color.js",
    name: "GET /api/color/admin",
    method: "GET",
    path: "/api/color/admin",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "comments.js",
    name: "GET /api/comments/admin",
    method: "GET",
    path: "/api/comments/admin",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "comments.js",
    name: "POST /api/comments",
    method: "POST",
    path: "/api/comments",
    body: {},
    scenarios: {
      none: [401],
      user: PASS_MUTATION,
      admin: PASS_MUTATION,
    },
  },
  {
    group: "contactFormsDesign.js",
    name: "GET /api/contact-form-design",
    method: "GET",
    path: "/api/contact-form-design",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "couponcodes.js",
    name: "GET /api/couponcodes",
    method: "GET",
    path: "/api/couponcodes",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "couponcodes.js",
    name: "GET /api/couponcodes/notification",
    method: "GET",
    path: "/api/couponcodes/notification",
    scenarios: {
      none: [401],
      user: [200],
      admin: [200],
    },
  },
  {
    group: "debug.js",
    name: "GET /api/debug/admin",
    method: "GET",
    path: "/api/debug/admin",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "events.js",
    name: "GET /api/events/admin",
    method: "GET",
    path: "/api/events/admin",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "materials.js",
    name: "POST /api/materials",
    method: "POST",
    path: "/api/materials",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: PASS_MUTATION,
    },
  },
  {
    group: "news.js",
    name: "GET /api/news/admin",
    method: "GET",
    path: "/api/news/admin",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "news.js",
    name: "POST /api/news",
    method: "POST",
    path: "/api/news",
    body: {},
    scenarios: {
      none: [401],
      user: PASS_MUTATION,
      admin: PASS_MUTATION,
    },
  },
  {
    group: "newsCategories.js",
    name: "POST /api/news-categories",
    method: "POST",
    path: "/api/news-categories",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: PASS_MUTATION,
    },
  },
  {
    group: "notify.js",
    name: "GET /api/notify/admin",
    method: "GET",
    path: "/api/notify/admin",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "notify.js",
    name: "POST /api/notify",
    method: "POST",
    path: "/api/notify",
    body: {},
    scenarios: {
      none: [401],
      user: PASS_MUTATION,
      admin: PASS_MUTATION,
    },
  },
  {
    group: "orders.js",
    name: "GET /api/orders/count",
    method: "GET",
    path: "/api/orders/count",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "orders-id.js",
    name: "PUT /api/orders-id/cancel",
    method: "PUT",
    path: "/api/orders-id/cancel",
    body: {},
    scenarios: {
      none: [401],
      user: PASS_MUTATION,
      admin: PASS_MUTATION,
    },
  },
  {
    group: "orderStatus.js",
    name: "POST /api/order-status",
    method: "POST",
    path: "/api/order-status",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: [200, 410],
    },
  },
  {
    group: "payments.js",
    name: "GET /api/payments",
    method: "GET",
    path: "/api/payments",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "products.js",
    name: "GET /api/products/admin",
    method: "GET",
    path: "/api/products/admin",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "revenue.js",
    name: "GET /api/revenue/stats",
    method: "GET",
    path: "/api/revenue/stats",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "rooms.js",
    name: "GET /api/rooms/admin",
    method: "GET",
    path: "/api/rooms/admin",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "typenotify.js",
    name: "POST /api/typeNotify",
    method: "POST",
    path: "/api/typeNotify",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: PASS_MUTATION,
    },
  },
  {
    group: "upload.js",
    name: "POST /api/upload/category",
    method: "POST",
    path: "/api/upload/category",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: PASS_MUTATION,
    },
  },
  {
    group: "users.js",
    name: "GET /api/users/admin/1",
    method: "GET",
    path: "/api/users/admin/1",
    scenarios: {
      none: [401],
      user: [403],
      admin: [200],
    },
  },
  {
    group: "users.js",
    name: "GET /api/users/3",
    method: "GET",
    path: "/api/users/3",
    scenarios: {
      none: [401],
      user: [200],
      admin: [200],
    },
  },
  {
    group: "variants.js",
    name: "POST /api/variants",
    method: "POST",
    path: "/api/variants",
    body: {},
    scenarios: {
      none: [401],
      user: [403],
      admin: PASS_MUTATION,
    },
  },
  {
    group: "wishlists.js",
    name: "GET /api/wishlists?status=1",
    method: "GET",
    path: "/api/wishlists?status=1",
    scenarios: {
      none: [401],
      user: [200],
      admin: [200],
    },
  },
];

function signToken(user) {
  return jwt.sign({ id: user.user_id, role: user.user_role }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

async function getFixtureUsers() {
  const { rows: adminRows } = await db.query(
    `SELECT user_id, user_role FROM "user" WHERE deleted_at IS NULL AND user_role = 'admin' ORDER BY user_id LIMIT 1`
  );
  const { rows: userRows } = await db.query(
    `SELECT user_id, user_role FROM "user" WHERE deleted_at IS NULL AND user_role = 'user' ORDER BY user_id LIMIT 1`
  );

  if (!adminRows.length || !userRows.length) {
    throw new Error("Missing local admin/user fixtures for auth smoke");
  }

  return {
    admin: adminRows[0],
    user: userRows[0],
  };
}

async function runRequest(baseUrl, check, role, token) {
  const headers = {
    Accept: "application/json,text/html",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body;
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

  return {
    group: check.group,
    name: check.name,
    role,
    status: response.status,
    expected: check.scenarios[role],
    ok: check.scenarios[role].includes(response.status),
    bodyPreview: text.slice(0, 160),
  };
}

function summarize(results) {
  const byGroup = new Map();
  for (const result of results) {
    if (!byGroup.has(result.group)) {
      byGroup.set(result.group, { total: 0, failed: 0 });
    }

    const group = byGroup.get(result.group);
    group.total += 1;
    if (!result.ok) {
      group.failed += 1;
    }
  }

  return [...byGroup.entries()]
    .map(([group, stats]) => ({
      group,
      total: stats.total,
      failed: stats.failed,
      passed: stats.total - stats.failed,
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}

async function main() {
  const fixtures = await getFixtureUsers();
  const tokens = {
    none: null,
    user: signToken(fixtures.user),
    admin: signToken(fixtures.admin),
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const results = [];

    for (const check of checks) {
      for (const role of Object.keys(check.scenarios)) {
        results.push(await runRequest(baseUrl, check, role, tokens[role]));
      }
    }

    const failed = results.filter((result) => !result.ok);
    const summary = summarize(results);

    console.log(JSON.stringify({ summary, failed, results }, null, 2));

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
