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
    admin: `SELECT user_id, user_role FROM "user" WHERE deleted_at IS NULL AND user_role = 'admin' ORDER BY user_id LIMIT 1`,
    user: `SELECT user_id, user_role FROM "user" WHERE deleted_at IS NULL AND user_role = 'user' ORDER BY user_id LIMIT 1`,
    product: `SELECT product_id, product_slug FROM product WHERE product_status = 1 ORDER BY product_id LIMIT 1`,
    productByRoom: `
      SELECT DISTINCT p.product_id, p.product_slug
      FROM room_product rp
      JOIN product p ON p.product_id = rp.product_id
      WHERE p.product_status = 1
      ORDER BY p.product_id
      LIMIT 1
    `,
    variant: `SELECT variant_id, product_id, color_id FROM variant_product ORDER BY variant_id LIMIT 1`,
    category: `SELECT category_id, slug FROM category ORDER BY category_id LIMIT 1`,
    room: `SELECT room_id, slug FROM room ORDER BY room_id LIMIT 1`,
    roomProduct: `SELECT room_id, product_id FROM room_product ORDER BY room_id, product_id LIMIT 1`,
    material: `SELECT slug FROM materials WHERE deleted_at IS NULL ORDER BY material_id LIMIT 1`,
    order: `SELECT order_id, order_hash, user_id FROM orders ORDER BY order_id LIMIT 1`,
    payment: `SELECT payment_id FROM payments WHERE deleted_at IS NULL ORDER BY payment_id LIMIT 1`,
    coupon: `SELECT couponcode_id, couponcode_code FROM couponcode WHERE deleted_at IS NULL ORDER BY couponcode_id LIMIT 1`,
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
  };

  if (result.ok && typeof check.validate === "function") {
    const validation = check.validate(parsed, text);
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
  if (!fixtures.admin || !fixtures.user) {
    throw new Error("Missing local admin/user fixtures for Day 2 smoke");
  }

  const tokens = {
    admin: signToken(fixtures.admin),
    user: signToken(fixtures.user),
  };

  const checks = [
    {
      group: "orders.js",
      name: "GET /api/orders/complete/:orderHash",
      method: "GET",
      path: `/api/orders/complete/${fixtures.order.order_hash}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.success === true && body?.order?.order_hash === fixtures.order.order_hash,
        message: "Expected success=true and matching order_hash",
      }),
    },
    {
      group: "orders.js",
      name: "GET /api/orders/complete/:orderHash missing",
      method: "GET",
      path: "/api/orders/complete/NOT_FOUND_HASH",
      expected: [404],
    },
    {
      group: "orders.js",
      name: "GET /api/orders/hash/:orderHash",
      method: "GET",
      path: `/api/orders/hash/${fixtures.order.order_hash}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.success === true && jsonShape(body?.order) === "object" && Array.isArray(body?.order?.products),
        message: "Expected success=true, order object, products array",
      }),
    },
    {
      group: "orders.js",
      name: "GET /api/orders admin list",
      method: "GET",
      path: "/api/orders?limit=2&page=1",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.orders) && jsonShape(body?.pagination) === "object",
        message: "Expected orders array and pagination object",
      }),
    },
    {
      group: "orders.js",
      name: "GET /api/orders/:id owned",
      method: "GET",
      path: `/api/orders/${fixtures.order.order_id}`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: body?.order_id === fixtures.order.order_id,
        message: "Expected owned order detail payload",
      }),
    },
    {
      group: "orders.js",
      name: "POST /api/orders invalid body",
      method: "POST",
      path: "/api/orders",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "orders.js",
      name: "GET /api/orders/status/count",
      method: "GET",
      path: "/api/orders/status/count",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected array of status counts",
      }),
    },
    {
      group: "payments.js",
      name: "GET /api/payments",
      method: "GET",
      path: "/api/payments?page=1&limit=2",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.payments) && jsonShape(body?.pagination) === "object",
        message: "Expected payments array and pagination object",
      }),
    },
    {
      group: "payments.js",
      name: "GET /api/payments/order/:orderId",
      method: "GET",
      path: `/api/payments/order/${fixtures.order.order_id}`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: body?.order_id === fixtures.order.order_id && Array.isArray(body?.payments),
        message: "Expected order payments payload",
      }),
    },
    {
      group: "payments.js",
      name: "GET /api/payments/order/:orderId invalid",
      method: "GET",
      path: "/api/payments/order/not-a-number",
      token: "user",
      expected: [400],
    },
    {
      group: "payments.js",
      name: "GET /api/payments/:id",
      method: "GET",
      path: `/api/payments/${fixtures.payment.payment_id}`,
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: body?.payment_id === fixtures.payment.payment_id,
        message: "Expected payment detail payload",
      }),
    },
    {
      group: "payments.js",
      name: "POST /api/payments invalid body",
      method: "POST",
      path: "/api/payments",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "payments.js",
      name: "PUT /api/payments/:id missing",
      method: "PUT",
      path: "/api/payments/999999",
      token: "admin",
      body: {},
      expected: [400, 404],
    },
    {
      group: "couponcodes.js",
      name: "GET /api/couponcodes/codes",
      method: "GET",
      path: "/api/couponcodes/codes",
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected coupon code array",
      }),
    },
    {
      group: "couponcodes.js",
      name: "GET /api/couponcodes admin list",
      method: "GET",
      path: "/api/couponcodes",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected admin coupon array",
      }),
    },
    {
      group: "couponcodes.js",
      name: "GET /api/couponcodes/:id",
      method: "GET",
      path: `/api/couponcodes/${fixtures.coupon.couponcode_id}`,
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: body?.couponcode_id === fixtures.coupon.couponcode_id || body?.id === fixtures.coupon.couponcode_id,
        message: "Expected coupon detail payload",
      }),
    },
    {
      group: "couponcodes.js",
      name: "GET /api/couponcodes/:id missing",
      method: "GET",
      path: "/api/couponcodes/999999",
      token: "admin",
      expected: [404],
    },
    {
      group: "couponcodes.js",
      name: "POST /api/couponcodes/validate invalid body",
      method: "POST",
      path: "/api/couponcodes/validate",
      token: "user",
      body: {},
      expected: [400],
    },
    {
      group: "couponcodes.js",
      name: "POST /api/couponcodes invalid body",
      method: "POST",
      path: "/api/couponcodes",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "products.js",
      name: "GET /api/products/all",
      method: "GET",
      path: "/api/products/all?limit=2&page=1",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.products) && jsonShape(body?.pagination) === "object",
        message: "Expected products array and pagination object",
      }),
    },
    {
      group: "products.js",
      name: "GET /api/products/search",
      method: "GET",
      path: "/api/products/search?q=sofa",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body?.results),
        message: "Expected search results array payload",
      }),
    },
    {
      group: "products.js",
      name: "GET /api/products/:slug",
      method: "GET",
      path: `/api/products/${fixtures.product.product_slug}`,
      expected: [200],
      validate: (body) => ({
        ok: jsonShape(body?.product) === "object" && Array.isArray(body?.colors),
        message: "Expected product object and colors array",
      }),
    },
    {
      group: "products.js",
      name: "GET /api/products/:slug missing",
      method: "GET",
      path: "/api/products/not-found-slug",
      expected: [404],
    },
    {
      group: "products.js",
      name: "GET /api/products/admin/:slug",
      method: "GET",
      path: `/api/products/admin/${fixtures.product.product_slug}`,
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: jsonShape(body) === "object",
        message: "Expected admin product detail object",
      }),
    },
    {
      group: "products.js",
      name: "POST /api/products/add invalid body",
      method: "POST",
      path: "/api/products/add",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "variants.js",
      name: "GET /api/variants list",
      method: "GET",
      path: `/api/variants?product_id=${fixtures.variant.product_id}`,
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected variants array",
      }),
    },
    {
      group: "variants.js",
      name: "GET /api/variants/by-product/:slug",
      method: "GET",
      path: `/api/variants/by-product/${fixtures.product.product_slug}`,
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected variants by product array",
      }),
    },
    {
      group: "variants.js",
      name: "GET /api/variants/:productSlug/:colorId",
      method: "GET",
      path: `/api/variants/${fixtures.product.product_slug}/${fixtures.variant.color_id}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.variantId === fixtures.variant.variant_id,
        message: "Expected matching variant detail payload",
      }),
    },
    {
      group: "variants.js",
      name: "GET /api/variants/:productSlug/:colorId invalid",
      method: "GET",
      path: `/api/variants/${fixtures.product.product_slug}/not-a-number`,
      expected: [400],
    },
    {
      group: "variants.js",
      name: "POST /api/variants invalid body",
      method: "POST",
      path: "/api/variants",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "variants.js",
      name: "PUT /api/variants/:variantId missing",
      method: "PUT",
      path: "/api/variants/999999",
      token: "admin",
      body: {},
      expected: [400, 404],
    },
    {
      group: "categories.js",
      name: "GET /api/categories/filter",
      method: "GET",
      path: "/api/categories/filter/",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected category filter array",
      }),
    },
    {
      group: "categories.js",
      name: "GET /api/categories",
      method: "GET",
      path: "/api/categories/",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected category list array",
      }),
    },
    {
      group: "categories.js",
      name: "GET /api/categories/:slug",
      method: "GET",
      path: `/api/categories/${fixtures.category.slug}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.slug === fixtures.category.slug,
        message: "Expected category detail payload",
      }),
    },
    {
      group: "categories.js",
      name: "GET /api/categories/:slug missing",
      method: "GET",
      path: "/api/categories/not-found-category",
      expected: [404],
    },
    {
      group: "categories.js",
      name: "GET /api/categories/by-product/:slug",
      method: "GET",
      path: `/api/categories/by-product/${fixtures.product.product_slug}`,
      expected: [200],
    },
    {
      group: "categories.js",
      name: "POST /api/categories invalid body",
      method: "POST",
      path: "/api/categories",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "rooms.js",
      name: "GET /api/rooms",
      method: "GET",
      path: "/api/rooms/",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected room list array",
      }),
    },
    {
      group: "rooms.js",
      name: "GET /api/rooms/:slug",
      method: "GET",
      path: `/api/rooms/${fixtures.room.slug}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.slug === fixtures.room.slug,
        message: "Expected room detail payload",
      }),
    },
    {
      group: "rooms.js",
      name: "GET /api/rooms/:slug missing",
      method: "GET",
      path: "/api/rooms/not-found-room",
      expected: [404],
    },
    {
      group: "rooms.js",
      name: "GET /api/rooms/:slug/products",
      method: "GET",
      path: `/api/rooms/${fixtures.room.slug}/products`,
      expected: [200],
      validate: (body) => ({
        ok: jsonShape(body?.room) === "object" && Array.isArray(body?.products),
        message: "Expected room object and products array",
      }),
    },
    {
      group: "rooms.js",
      name: "POST /api/rooms invalid body",
      method: "POST",
      path: "/api/rooms",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "materials.js",
      name: "GET /api/materials",
      method: "GET",
      path: "/api/materials",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected materials array",
      }),
    },
    {
      group: "materials.js",
      name: "GET /api/materials/:slug",
      method: "GET",
      path: `/api/materials/${fixtures.material.slug}`,
      expected: [200],
      validate: (body) => ({
        ok: body?.success === true && jsonShape(body?.material) === "object",
        message: "Expected material detail payload",
      }),
    },
    {
      group: "materials.js",
      name: "GET /api/materials/:slug missing",
      method: "GET",
      path: "/api/materials/not-found-material",
      expected: [404],
    },
    {
      group: "materials.js",
      name: "POST /api/materials invalid body",
      method: "POST",
      path: "/api/materials",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "materials.js",
      name: "PUT /api/materials/:slug missing",
      method: "PUT",
      path: "/api/materials/not-found-material",
      token: "admin",
      body: {
        material_name: "tmp",
        slug: "tmp",
      },
      expected: [404],
    },
    {
      group: "color.js",
      name: "GET /api/color/filter",
      method: "GET",
      path: "/api/color/filter",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected color filter array",
      }),
    },
    {
      group: "color.js",
      name: "GET /api/color/by-product/:slug",
      method: "GET",
      path: `/api/color/by-product/${fixtures.product.product_slug}`,
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected color by product array",
      }),
    },
    {
      group: "color.js",
      name: "GET /api/color/admin",
      method: "GET",
      path: "/api/color/admin",
      token: "admin",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected admin color array",
      }),
    },
    {
      group: "color.js",
      name: "POST /api/color/admin invalid body",
      method: "POST",
      path: "/api/color/admin",
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "attributes.js",
      name: "GET /api/attribute/:categoryId/attributes",
      method: "GET",
      path: `/api/attribute/${fixtures.category.category_id}/attributes`,
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected attribute array",
      }),
    },
    {
      group: "attributes.js",
      name: "POST /api/attribute/:categoryId invalid body",
      method: "POST",
      path: `/api/attribute/${fixtures.category.category_id}`,
      token: "admin",
      body: {},
      expected: [400],
    },
    {
      group: "orderStatus.js",
      name: "GET /api/order-status",
      method: "GET",
      path: "/api/order-status",
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: Array.isArray(body),
        message: "Expected static order status array",
      }),
    },
    {
      group: "orderStatus.js",
      name: "GET /api/order-status/:id",
      method: "GET",
      path: "/api/order-status/0",
      token: "user",
      expected: [200],
      validate: (body) => ({
        ok: body?.id === 0 || body?.order_status_id === 0,
        message: "Expected pending status payload",
      }),
    },
    {
      group: "orderStatus.js",
      name: "GET /api/order-status/:id missing",
      method: "GET",
      path: "/api/order-status/999999",
      token: "user",
      expected: [404],
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
