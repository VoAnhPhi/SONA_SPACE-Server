const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const db = require("../config/database");

const OUTPUT_DIR = path.join(__dirname, "../public/uploads/recovered-products");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");

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

  return ".img";
}

function expectedFileName(entry) {
  const prefix =
    entry.source === "product"
      ? `product-${entry.product_id}`
      : `variant-${entry.variant_id}`;
  const index = String(entry.image_index).padStart(2, "0");
  return `${prefix}-${index}-${hashUrl(entry.original_url)}${extensionFromUrl(
    entry.original_url
  )}`;
}

function expectedFilePath(entry) {
  const parts =
    entry.source === "product"
      ? [OUTPUT_DIR, `product-${entry.product_id}`, expectedFileName(entry)]
      : [
          OUTPUT_DIR,
          `product-${entry.product_id}`,
          `variant-${entry.variant_id}`,
          expectedFileName(entry),
        ];

  return path.join(...parts);
}

function entryKey(entry) {
  return [
    entry.source,
    entry.product_id,
    entry.variant_id || "",
    entry.image_index,
    entry.original_url,
  ].join("|");
}

function readDownloadedManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return new Map();
  const rows = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const map = new Map();
  for (const row of rows) {
    if (row.original_url) map.set(entryKey(row), row);
  }
  return map;
}

async function getImageRows() {
  const { rows } = await db.query(`
    SELECT
      'product' AS source,
      product_id AS source_id,
      product_id,
      NULL::int AS variant_id,
      product_name,
      NULL::text AS variant_slug,
      product_image AS images
    FROM product
    WHERE product_image IS NOT NULL AND btrim(product_image) <> ''

    UNION ALL

    SELECT
      'variant' AS source,
      variant_id AS source_id,
      vp.product_id,
      variant_id,
      p.product_name,
      variant_product_slug AS variant_slug,
      variant_product_list_image AS images
    FROM variant_product vp
    JOIN product p ON p.product_id = vp.product_id
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
        product_name: row.product_name,
        variant_id: row.variant_id,
        variant_slug: row.variant_slug,
        image_index: index + 1,
        original_url: url,
      });
    });
  }

  return entries;
}

function groupEntries(entries) {
  const products = new Map();
  for (const entry of entries) {
    if (!products.has(entry.product_id)) {
      products.set(entry.product_id, {
        product_id: entry.product_id,
        product_name: entry.product_name,
        product: [],
        variants: new Map(),
      });
    }

    const product = products.get(entry.product_id);
    if (entry.source === "product") {
      product.product.push(entry);
    } else {
      if (!product.variants.has(entry.variant_id)) {
        product.variants.set(entry.variant_id, {
          variant_id: entry.variant_id,
          variant_slug: entry.variant_slug,
          images: [],
        });
      }
      product.variants.get(entry.variant_id).images.push(entry);
    }
  }

  return products;
}

function formatEntry(entry, downloaded) {
  const downloadedRow = downloaded.get(entryKey(entry));
  const status = downloadedRow?.status === "downloaded" ? "DOWNLOADED" : "MISSING";
  const fileName = downloadedRow?.file_path
    ? path.basename(downloadedRow.file_path)
    : expectedFileName(entry);
  const saveAs = downloadedRow?.file_path || expectedFilePath(entry);

  return [
    `- status: ${status}`,
    `  source: ${entry.source}`,
    `  product_id: ${entry.product_id}`,
    `  variant_id: ${entry.variant_id || ""}`,
    `  image_index: ${entry.image_index}`,
    `  file_name: ${fileName}`,
    `  save_as: ${saveAs}`,
    `  url: ${entry.original_url}`,
  ].join("\n");
}

function writeProductFiles(products, downloaded) {
  let missing = 0;
  let downloadedCount = 0;
  let urlCount = 0;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const summary = [
    "# Product Image Download Checklist",
    "",
    "Generated from PostgreSQL product and variant image fields.",
    "Save manually downloaded files to the `save_as` path shown in each folder file.",
    "",
  ];

  for (const product of products.values()) {
    const productDir = path.join(OUTPUT_DIR, `product-${product.product_id}`);
    fs.mkdirSync(productDir, { recursive: true });

    const productLines = [
      `# Product ${product.product_id} Image Links`,
      "",
      `product_id: ${product.product_id}`,
      `product_name: ${product.product_name || ""}`,
      "",
      "## Product Images",
      "",
    ];

    if (product.product.length === 0) {
      productLines.push("(none)");
    } else {
      for (const entry of product.product) {
        const isDownloaded = downloaded.get(entryKey(entry))?.status === "downloaded";
        downloadedCount += isDownloaded ? 1 : 0;
        missing += isDownloaded ? 0 : 1;
        urlCount += 1;
        productLines.push(formatEntry(entry, downloaded), "");
      }
    }

    productLines.push("## Variants", "");

    for (const variant of product.variants.values()) {
      const variantDir = path.join(productDir, `variant-${variant.variant_id}`);
      fs.mkdirSync(variantDir, { recursive: true });

      productLines.push(
        `- variant_id: ${variant.variant_id}`,
        `  folder: variant-${variant.variant_id}`,
        `  images: ${variant.images.length}`,
        ""
      );

      const variantLines = [
        `# Variant ${variant.variant_id} Image Links`,
        "",
        `product_id: ${product.product_id}`,
        `product_name: ${product.product_name || ""}`,
        `variant_id: ${variant.variant_id}`,
        `variant_slug: ${variant.variant_slug || ""}`,
        "",
      ];

      for (const entry of variant.images) {
        const isDownloaded = downloaded.get(entryKey(entry))?.status === "downloaded";
        downloadedCount += isDownloaded ? 1 : 0;
        missing += isDownloaded ? 0 : 1;
        urlCount += 1;
        variantLines.push(formatEntry(entry, downloaded), "");
      }

      fs.writeFileSync(
        path.join(variantDir, "IMAGE_LINKS.txt"),
        `${variantLines.join("\n").trim()}\n`,
        "utf8"
      );
    }

    fs.writeFileSync(
      path.join(productDir, "IMAGE_LINKS.txt"),
      `${productLines.join("\n").trim()}\n`,
      "utf8"
    );
  }

  summary.push(
    `products: ${products.size}`,
    `urls: ${urlCount}`,
    `downloaded: ${downloadedCount}`,
    `missing: ${missing}`,
    "",
    "Main folders:",
    ...[...products.keys()].map((productId) => `- product-${productId}/IMAGE_LINKS.txt`)
  );

  fs.writeFileSync(path.join(OUTPUT_DIR, "DOWNLOAD_CHECKLIST.txt"), `${summary.join("\n")}\n`, "utf8");

  return { products: products.size, urlCount, downloadedCount, missing };
}

async function main() {
  const entries = await getImageRows();
  const downloaded = readDownloadedManifest();
  const products = groupEntries(entries);
  const result = writeProductFiles(products, downloaded);

  console.log(`Created product image folders in: ${OUTPUT_DIR}`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
