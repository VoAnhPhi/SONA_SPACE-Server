const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const db = require("../config/database");

const DEFAULT_OUTPUT_DIR = path.join(
  __dirname,
  "../public/uploads/recovered-products"
);

const CONTENT_TYPE_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

function parseArgs(argv) {
  const options = {
    dryRun: false,
    hosts: [],
    limit: 0,
    outputDir: DEFAULT_OUTPUT_DIR,
    timeoutMs: 30000,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--host") options.hosts.push(String(argv[++i] || "").trim().toLowerCase());
    else if (arg === "--limit") options.limit = Number(argv[++i] || 0);
    else if (arg === "--output-dir") options.outputDir = path.resolve(argv[++i]);
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++i] || 30000);
    else if (arg === "--help") {
      console.log(`Usage:
  node scripts/download-product-images.js [--dry-run] [--host HOST] [--limit N] [--output-dir DIR] [--timeout-ms MS]

Downloads remote product and variant image URLs from PostgreSQL into:
  public/uploads/recovered-products/

It does not update database rows. It writes manifest.json and manifest.csv so
the DB update can be reviewed and applied separately.`);
      process.exit(0);
    }
  }

  return options;
}

function normalizeImageList(value) {
  if (!value || typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  return trimmed
    .split(/\s*(?:,|\n|\r|\|)\s*/)
    .map((url) => url.trim())
    .filter(Boolean);
}

function isRemoteUrl(value) {
  return /^https?:\/\//i.test(value);
}

function getHost(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hashUrl(url) {
  return crypto.createHash("sha1").update(url).digest("hex").slice(0, 10);
}

function extensionFromUrl(url) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) {
      return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {
    return "";
  }

  return "";
}

function publicPathFor(filePath) {
  const publicRoot = path.resolve(__dirname, "../public");
  const relative = path.relative(publicRoot, filePath).replace(/\\/g, "/");
  return `/${relative}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; SonaSpaceImageRecovery/1.0; +local-project)",
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getImageRows() {
  const { rows } = await db.query(`
    SELECT
      'product' AS source,
      product_id AS source_id,
      product_id,
      NULL::int AS variant_id,
      product_image AS images
    FROM product
    WHERE product_image IS NOT NULL AND btrim(product_image) <> ''

    UNION ALL

    SELECT
      'variant' AS source,
      variant_id AS source_id,
      product_id,
      variant_id,
      variant_product_list_image AS images
    FROM variant_product
    WHERE variant_product_list_image IS NOT NULL
      AND btrim(variant_product_list_image) <> ''

    ORDER BY product_id, source, variant_id NULLS FIRST
  `);

  const entries = [];
  for (const row of rows) {
    const urls = normalizeImageList(row.images).filter(isRemoteUrl);
    urls.forEach((url, index) => {
      entries.push({
        source: row.source,
        source_id: row.source_id,
        product_id: row.product_id,
        variant_id: row.variant_id,
        image_index: index + 1,
        original_url: url,
      });
    });
  }

  return entries;
}

async function downloadEntry(entry, options) {
  const folder =
    entry.source === "product"
      ? `product-${entry.product_id}`
      : `product-${entry.product_id}/variant-${entry.variant_id}`;
  const dir = path.join(options.outputDir, folder);
  fs.mkdirSync(dir, { recursive: true });

  const baseName = `${entry.source}-${entry.source_id}-${String(entry.image_index).padStart(
    2,
    "0"
  )}-${hashUrl(entry.original_url)}`;

  try {
    const response = await fetchWithTimeout(entry.original_url, options.timeoutMs);
    if (!response.ok) {
      return {
        ...entry,
        status: "failed",
        http_status: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    const contentType = (response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const ext = CONTENT_TYPE_EXTENSIONS[contentType] || extensionFromUrl(entry.original_url) || ".img";
    const filePath = path.join(dir, `${baseName}${ext}`);

    if (!fs.existsSync(filePath)) {
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
    }

    return {
      ...entry,
      status: "downloaded",
      http_status: response.status,
      content_type: contentType,
      file_path: filePath,
      public_path: publicPathFor(filePath),
    };
  } catch (error) {
    return {
      ...entry,
      status: "failed",
      error: error.message,
    };
  }
}

function writeManifest(results, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "manifest.json");
  const csvPath = path.join(outputDir, "manifest.csv");

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

  const headers = [
    "source",
    "source_id",
    "product_id",
    "variant_id",
    "image_index",
    "status",
    "http_status",
    "original_url",
    "public_path",
    "file_path",
    "error",
  ];
  const lines = [
    headers.join(","),
    ...results.map((result) =>
      headers.map((header) => csvEscape(result[header])).join(",")
    ),
  ];

  fs.writeFileSync(csvPath, `${lines.join("\n")}\n`, "utf8");
  return { jsonPath, csvPath };
}

async function main() {
  const options = parseArgs(process.argv);
  const entries = await getImageRows();
  const filtered =
    options.hosts.length > 0
      ? entries.filter((entry) => options.hosts.includes(getHost(entry.original_url)))
      : entries;
  const selected = options.limit > 0 ? filtered.slice(0, options.limit) : filtered;

  console.log(`Rows expanded to remote image URLs: ${entries.length}`);
  if (options.hosts.length > 0) console.log(`Host filter: ${options.hosts.join(", ")}`);
  console.log(`Selected: ${selected.length}`);
  console.log(`Output: ${options.outputDir}`);

  if (options.dryRun) {
    const bySource = selected.reduce((acc, entry) => {
      acc[entry.source] = (acc[entry.source] || 0) + 1;
      return acc;
    }, {});
    console.log("Dry run only. Counts:", bySource);
    console.log("First 10 URLs:");
    selected.slice(0, 10).forEach((entry) => {
      console.log(
        `${entry.source} product=${entry.product_id} variant=${entry.variant_id || "-"} #${entry.image_index}: ${entry.original_url}`
      );
    });
    process.exit(0);
  }

  const results = [];
  for (let i = 0; i < selected.length; i += 1) {
    const entry = selected[i];
    const result = await downloadEntry(entry, options);
    results.push(result);
    const label = `${i + 1}/${selected.length}`;
    if (result.status === "downloaded") {
      console.log(`[${label}] OK ${result.public_path}`);
    } else {
      console.log(`[${label}] FAIL ${entry.original_url} (${result.error})`);
    }
  }

  const manifest = writeManifest(results, options.outputDir);
  const downloaded = results.filter((item) => item.status === "downloaded").length;
  const failed = results.length - downloaded;

  console.log(`Done. Downloaded=${downloaded}, Failed=${failed}`);
  console.log(`Manifest JSON: ${manifest.jsonPath}`);
  console.log(`Manifest CSV: ${manifest.csvPath}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
