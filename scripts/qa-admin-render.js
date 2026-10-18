// Admin render smoke (T1). Requests every GET /dashboard route of the live Express app with an
// admin cookie, expects 200 (or 302 for legacy redirects), and compares each page <title> and
// redirect target with scripts/baselines/admin-pages.json.
//
// Run:            npm run qa:admin-render
// Refresh golden: node scripts/qa-admin-render.js --write-baseline
const fs = require("fs");
const http = require("http");
const path = require("path");
const jwt = require("jsonwebtoken");

const app = require("../app");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET;
const BASELINE_FILE = path.join(__dirname, "baselines", "admin-pages.json");
const WRITE_BASELINE = process.argv.includes("--write-baseline");

function mountPath(layer) {
  if (layer.regexp && layer.regexp.fast_slash) return "";
  return layer.regexp.source
    .replace("^\\/", "/")
    .replace("\\/?(?=\\/|$)", "")
    .split("\\/")
    .join("/")
    .replace(/\(\?:\(\[\^\/\]\+\?\)\)/g, ":param")
    .replace(/\$$/, "")
    .replace(/^\^/, "")
    .replace(/\/$/, "");
}

function listDashboardGetRoutes() {
  const found = [];
  for (const layer of app._router.stack) {
    if (layer.name !== "router" || mountPath(layer) !== "/dashboard") continue;
    for (const inner of layer.handle.stack) {
      if (inner.route && inner.route.methods.get) found.push(`/dashboard${inner.route.path}`);
    }
  }
  return found.sort();
}

async function getFixtures() {
  const one = async (sql) => (await db.query(sql)).rows[0] || null;
  return {
    admin: await one(`SELECT user_id, user_role FROM "user" WHERE deleted_at IS NULL AND user_role = 'admin' ORDER BY user_id LIMIT 1`),
    order: await one(`SELECT order_id FROM orders WHERE deleted_at IS NULL ORDER BY order_id LIMIT 1`),
    slug: await one(`SELECT product_slug AS value FROM product ORDER BY product_id LIMIT 1`),
  };
}

function resolvePath(routePath, fixtures) {
  const id = /\/orders\//.test(routePath) ? fixtures.order.order_id : 1;
  return routePath.replace(/:id\b/g, String(id)).replace(/:slug\b/g, fixtures.slug?.value || "sample-slug");
}

function extractHeading(html) {
  const match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return match ? match[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : null;
}

function extractTitle(html) {
  const match = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

async function main() {
  const fixtures = await getFixtures();
  if (!fixtures.admin || !fixtures.order) {
    throw new Error("Missing admin user or order fixture; apply db/seeds/local-commerce-fixture.sql");
  }
  const token = jwt.sign({ id: fixtures.admin.user_id, role: fixtures.admin.user_role }, JWT_SECRET, { expiresIn: "1h" });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const routes = listDashboardGetRoutes();
  const results = {};
  const failures = [];

  for (const route of routes) {
    const resolved = resolvePath(route, fixtures);
    const response = await fetch(`${baseUrl}${resolved}`, {
      headers: { Cookie: `token=${token}` },
      redirect: "manual",
    });
    const status = response.status;
    const entry = { status };
    if (status === 302) {
      entry.location = response.headers.get("location");
    } else {
      const html = await response.text();
      entry.title = extractTitle(html);
      entry.heading = extractHeading(html);
      if (status === 200 && /class="error-state__code"|<body class="error-page"/i.test(html)) entry.errorLayout = true;
    }
    results[route] = entry;
    if (![200, 302].includes(status) || entry.errorLayout) failures.push(`${route} -> ${status}${entry.errorLayout ? " (error layout)" : ""}`);
  }

  const noToken = await fetch(`${baseUrl}/dashboard/`, { redirect: "manual" });
  if (noToken.status !== 302 || noToken.headers.get("location") !== "/") {
    failures.push(`/dashboard/ without token expected 302 -> / but got ${noToken.status} ${noToken.headers.get("location")}`);
  }

  server.close();

  if (WRITE_BASELINE) {
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(results, null, 2)}\n`);
    console.log(`Baseline written: ${routes.length} routes -> ${path.relative(process.cwd(), BASELINE_FILE)}`);
  } else if (fs.existsSync(BASELINE_FILE)) {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
    for (const route of Object.keys(baseline)) {
      if (!results[route]) failures.push(`${route} missing (was in baseline)`);
      else if (JSON.stringify(results[route]) !== JSON.stringify(baseline[route])) {
        failures.push(`${route} changed: ${JSON.stringify(baseline[route])} -> ${JSON.stringify(results[route])}`);
      }
    }
    for (const route of Object.keys(results)) {
      if (!baseline[route]) failures.push(`${route} is new (not in baseline)`);
    }
  } else {
    failures.push(`No baseline at ${BASELINE_FILE}; run with --write-baseline`);
  }

  console.log(`Admin render: ${routes.length - failures.length}/${routes.length} checks clean`);
  failures.forEach((line) => console.log(`FAIL ${line}`));
  process.exitCode = failures.length ? 1 : 0;
  await db.end?.();
  // No process.exit(): on Windows it can trip a libuv assertion and turn a green run into exit 127.
  // The pool is closed above and the exit code is already set, so the process ends by itself.
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
