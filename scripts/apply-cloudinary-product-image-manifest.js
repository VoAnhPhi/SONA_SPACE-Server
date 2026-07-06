const fs = require("fs");
const path = require("path");

const db = require("../config/database");

const DEFAULT_INPUT_MANIFEST = path.join(
  __dirname,
  "../public/uploads/recovered-products/cloudinary-upload-manifest.json"
);
const DEFAULT_OUTPUT_MANIFEST = path.join(
  __dirname,
  "../public/uploads/recovered-products/db-image-update-manifest.json"
);

function parseArgs(argv) {
  const options = {
    apply: false,
    inputManifest: DEFAULT_INPUT_MANIFEST,
    outputManifest: DEFAULT_OUTPUT_MANIFEST,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--input-manifest") options.inputManifest = path.resolve(argv[++i]);
    else if (arg === "--output-manifest") options.outputManifest = path.resolve(argv[++i]);
    else if (arg === "--help") {
      console.log(`Usage:
  node scripts/apply-cloudinary-product-image-manifest.js [--apply]

Dry-runs or applies DB image URL replacement from:
  public/uploads/recovered-products/cloudinary-upload-manifest.json

Updates only exact URL matches:
  product.product_image
  variant_product.variant_product_list_image

Writes:
  public/uploads/recovered-products/db-image-update-manifest.json
  public/uploads/recovered-products/db-image-update-manifest.csv`);
      process.exit(0);
    }
  }

  return options;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
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

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function groupBy(entries, keyFn) {
  const groups = new Map();
  for (const entry of entries) {
    const key = keyFn(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return groups;
}

function writeOutput(results, outputManifest) {
  const csvPath = outputManifest.replace(/\.json$/i, ".csv");
  fs.mkdirSync(path.dirname(outputManifest), { recursive: true });
  fs.writeFileSync(outputManifest, JSON.stringify(results, null, 2), "utf8");

  const headers = [
    "source",
    "source_id",
    "product_id",
    "variant_id",
    "image_index",
    "status",
    "original_url",
    "cloudinary_url",
    "error",
  ];
  const lines = [
    headers.join(","),
    ...results.map((result) =>
      headers.map((header) => csvEscape(result[header])).join(",")
    ),
  ];
  fs.writeFileSync(csvPath, `${lines.join("\n")}\n`, "utf8");
  return { jsonPath: outputManifest, csvPath };
}

function buildEntries(manifest) {
  return manifest.filter(
    (entry) =>
      entry.status === "uploaded" &&
      isHttpUrl(entry.original_url) &&
      isHttpUrl(entry.cloudinary_url) &&
      ["product", "variant"].includes(entry.source)
  );
}

async function handleProductEntries(entries, options, client) {
  const results = [];

  for (const entry of entries) {
    const { rows } = await client.query(
      `SELECT product_id, product_image FROM product WHERE product_id = $1`,
      [entry.product_id]
    );

    if (!rows.length) {
      results.push({ ...entry, status: "not_found", error: "Product not found" });
      continue;
    }

    const currentUrl = String(rows[0].product_image || "").trim();
    if (currentUrl === entry.cloudinary_url) {
      results.push({ ...entry, status: "already_updated" });
      continue;
    }

    if (currentUrl !== entry.original_url) {
      results.push({
        ...entry,
        status: "no_match",
        error: "Current product_image does not match manifest original_url",
      });
      continue;
    }

    if (options.apply) {
      const update = await client.query(
        `UPDATE product SET product_image = $1 WHERE product_id = $2 AND product_image = $3`,
        [entry.cloudinary_url, entry.product_id, entry.original_url]
      );
      results.push({
        ...entry,
        status: update.rowCount === 1 ? "updated" : "update_skipped",
      });
    } else {
      results.push({ ...entry, status: "would_update" });
    }
  }

  return results;
}

async function handleVariantGroup(variantId, entries, options, client) {
  const { rows } = await client.query(
    `SELECT variant_id, variant_product_list_image FROM variant_product WHERE variant_id = $1`,
    [variantId]
  );

  if (!rows.length) {
    return entries.map((entry) => ({
      ...entry,
      status: "not_found",
      error: "Variant not found",
    }));
  }

  const currentImages = normalizeImageList(rows[0].variant_product_list_image);
  const uploadedCloudinaryUrls = new Set(entries.map((entry) => entry.cloudinary_url));
  let replacementCount = 0;
  const nextImages = [...currentImages];

  const results = entries
    .slice()
    .sort((a, b) => Number(a.image_index) - Number(b.image_index))
    .map((entry) => {
      const imageIndex = Number(entry.image_index);
      const arrayIndex = imageIndex - 1;
      const currentAtIndex = currentImages[arrayIndex];

      if (currentAtIndex === entry.cloudinary_url) {
        return { ...entry, status: "already_updated" };
      }

      if (currentAtIndex === entry.original_url) {
        nextImages[arrayIndex] = entry.cloudinary_url;
        replacementCount += 1;
        return { ...entry, status: options.apply ? "updated" : "would_update" };
      }

      if (uploadedCloudinaryUrls.has(currentAtIndex)) {
        nextImages[arrayIndex] = entry.cloudinary_url;
        replacementCount += 1;
        return { ...entry, status: options.apply ? "corrected" : "would_correct" };
      }

      return {
        ...entry,
        status: "no_match",
        error:
          "Current variant image at manifest image_index does not match original_url or uploaded Cloudinary URL",
      };
    });

  if (options.apply && replacementCount > 0) {
    await client.query(
      `UPDATE variant_product SET variant_product_list_image = $1 WHERE variant_id = $2`,
      [nextImages.join(","), variantId]
    );
  }

  return results;
}

async function main() {
  const options = parseArgs(process.argv);
  const manifest = loadJson(options.inputManifest);
  const entries = buildEntries(manifest);
  const productEntries = entries.filter((entry) => entry.source === "product");
  const variantGroups = groupBy(
    entries.filter((entry) => entry.source === "variant"),
    (entry) => Number(entry.variant_id)
  );

  console.log(
    `${options.apply ? "Applying" : "Dry-run"} DB updates from ${entries.length} uploaded image manifest entries`
  );

  const client = await db.connect();
  const results = [];

  try {
    if (options.apply) await client.query("BEGIN");

    results.push(...(await handleProductEntries(productEntries, options, client)));

    for (const [variantId, groupEntries] of variantGroups.entries()) {
      results.push(...(await handleVariantGroup(variantId, groupEntries, options, client)));
    }

    if (options.apply) await client.query("COMMIT");
  } catch (error) {
    if (options.apply) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const output = writeOutput(results, options.outputManifest);
  const summary = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});

  console.log("Summary:", summary);
  console.log("Wrote:", output.jsonPath);
  console.log("Wrote:", output.csvPath);

  if (results.some((result) => ["not_found", "update_skipped"].includes(result.status))) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.end?.();
  });
