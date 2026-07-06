const http = require("http");
const jwt = require("jsonwebtoken");

const app = require("../app");
const cloudinary = require("../config/cloudinary");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "furnitown-secret-key";

function signToken(user) {
  return jwt.sign({ id: user.user_id, role: user.user_role }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

async function getFixtures() {
  const [adminResult, userResult] = await Promise.all([
    db.query(
      `SELECT user_id, user_role FROM "user" WHERE deleted_at IS NULL AND user_role = 'admin' ORDER BY user_id LIMIT 1`
    ),
    db.query(
      `SELECT user_id, user_role FROM "user" WHERE deleted_at IS NULL AND user_role = 'user' ORDER BY user_id LIMIT 1`
    ),
  ]);

  return {
    admin: adminResult.rows[0] || null,
    user: userResult.rows[0] || null,
  };
}

function makeImageForm(fields = {}) {
  const form = new FormData();
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
  form.append("image", new Blob([bytes], { type: "image/jpeg" }), "product.jpg");
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return form;
}

async function request(baseUrl, check, tokens) {
  const headers = { Accept: "application/json" };
  if (check.token) {
    const token = tokens[check.token];
    headers.Authorization = `Bearer ${token}`;
    headers.Cookie = `token=${token}`;
  }

  const response = await fetch(`${baseUrl}${check.path}`, {
    method: check.method,
    headers,
    body: check.body,
    redirect: "manual",
  });

  const text = await response.text().catch(() => "");
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  const validation = check.validate
    ? check.validate(parsed, response)
    : { ok: true, message: "No custom validation" };
  const ok = check.expected.includes(response.status) && validation.ok;

  return {
    group: "upload.js",
    name: check.name,
    status: response.status,
    expected: check.expected,
    ok,
    validation: validation.message,
    bodyPreview: text.slice(0, 160),
  };
}

function printResults(results) {
  for (const result of results) {
    const marker = result.ok ? "PASS" : "FAIL";
    console.log(
      `${marker} ${result.group} ${result.name} -> ${result.status} expected ${result.expected.join("/")}`
    );
    if (!result.ok) {
      console.log(`  validation: ${result.validation}`);
      console.log(`  body: ${result.bodyPreview}`);
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\nProduct upload contract: ${results.length - failed.length}/${results.length} passed`
  );

  if (failed.length) {
    process.exitCode = 1;
  }
}

async function main() {
  const fixtures = await getFixtures();
  if (!fixtures.admin || !fixtures.user) {
    throw new Error("Missing admin/user fixtures for product upload contract smoke");
  }

  const originalUpload = cloudinary.uploader.upload;
  const seenFolders = [];
  cloudinary.uploader.upload = async (_image, options) => {
    seenFolders.push(options.folder);
    return {
      secure_url: `https://res.cloudinary.com/test/image/upload/v1/${options.folder}/mock.jpg`,
      public_id: `${options.folder}/mock`,
    };
  };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const tokens = {
      admin: signToken(fixtures.admin),
      user: signToken(fixtures.user),
    };

    const checks = [
      {
        name: "POST /api/upload/product without token",
        method: "POST",
        path: "/api/upload/product",
        body: makeImageForm({
          imageType: "main",
          productSlug: "sofa-demo",
        }),
        expected: [401],
      },
      {
        name: "POST /api/upload/product with user token",
        method: "POST",
        path: "/api/upload/product",
        token: "user",
        body: makeImageForm({
          imageType: "main",
          productSlug: "sofa-demo",
        }),
        expected: [403],
      },
      {
        name: "POST /api/upload/product missing imageType",
        method: "POST",
        path: "/api/upload/product",
        token: "admin",
        body: makeImageForm({
          productSlug: "sofa-demo",
        }),
        expected: [400],
        validate: (body) => ({
          ok: body?.field === "imageType",
          message: "Expected imageType validation error",
        }),
      },
      {
        name: "POST /api/upload/product missing productSlug",
        method: "POST",
        path: "/api/upload/product",
        token: "admin",
        body: makeImageForm({
          imageType: "main",
        }),
        expected: [400],
        validate: (body) => ({
          ok: body?.field === "productSlug",
          message: "Expected productSlug validation error",
        }),
      },
      {
        name: "POST /api/upload/product missing variantSlug",
        method: "POST",
        path: "/api/upload/product",
        token: "admin",
        body: makeImageForm({
          imageType: "variant",
          productSlug: "sofa-demo",
        }),
        expected: [400],
        validate: (body) => ({
          ok: body?.field === "variantSlug",
          message: "Expected variantSlug validation error",
        }),
      },
      {
        name: "POST /api/upload/product main image",
        method: "POST",
        path: "/api/upload/product",
        token: "admin",
        body: makeImageForm({
          imageType: "main",
          productSlug: "sofa-demo",
        }),
        expected: [200],
        validate: (body) => ({
          ok:
            body?.url?.includes("SonaSpace/Product/sofa-demo/main") &&
            body?.public_id === "SonaSpace/Product/sofa-demo/main/mock",
          message: "Expected main image Cloudinary folder",
        }),
      },
      {
        name: "POST /api/upload/product variant image",
        method: "POST",
        path: "/api/upload/product",
        token: "admin",
        body: makeImageForm({
          imageType: "variant",
          productSlug: "sofa-demo",
          variantSlug: "mau-den",
        }),
        expected: [200],
        validate: (body) => ({
          ok:
            body?.url?.includes("SonaSpace/Product/sofa-demo/variants/mau-den") &&
            body?.public_id === "SonaSpace/Product/sofa-demo/variants/mau-den/mock",
          message: "Expected variant image Cloudinary folder",
        }),
      },
    ];

    const results = [];
    for (const check of checks) {
      results.push(await request(baseUrl, check, tokens));
    }

    printResults(results);
  } finally {
    cloudinary.uploader.upload = originalUpload;
    await new Promise((resolve) => server.close(resolve));
    await db.end?.();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
