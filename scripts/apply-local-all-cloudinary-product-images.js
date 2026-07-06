const fs = require("fs");
const path = require("path");

const db = require("../config/database");

const DEFAULT_INPUT_MANIFEST = path.join(
  __dirname,
  "../public/uploads/recovered-products/cloudinary-local-all-manifest.json"
);
const DEFAULT_OUTPUT_MANIFEST = path.join(
  __dirname,
  "../public/uploads/recovered-products/db-local-all-image-update-manifest.json"
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
  node scripts/apply-local-all-cloudinary-product-images.js [--apply]

Updates DB image fields from cloudinary-local-all-manifest.json:
  product.product_image -> first product image for each product
  variant_product.variant_product_list_image -> all variant folder images, sorted by filename`);
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
  fs.writeFileSync(outputManifest, JSON.stringify(results, null, 2), "utf8");

  const headers = [
    "source",
    "product_id",
    "variant_id",
    "status",
    "image_count",
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

function getUploadedEntries(manifest) {
  return manifest
    .filter(
      (entry) =>
        entry.status === "uploaded" &&
        typeof entry.cloudinary_url === "string" &&
        entry.cloudinary_url.startsWith("http")
    )
    .sort((a, b) => String(a.file_name).localeCompare(String(b.file_name)));
}

async function handleProductGroups(productGroups, options, client) {
  const results = [];

  for (const [productId, entries] of productGroups.entries()) {
    const first = entries[0];
    const { rows } = await client.query(
      `SELECT product_id, product_image FROM product WHERE product_id = $1`,
      [productId]
    );

    if (!rows.length) {
      results.push({
        source: "product",
        product_id: productId,
        status: "not_found",
        error: "Product not found",
      });
      continue;
    }

    if (rows[0].product_image === first.cloudinary_url) {
      results.push({
        source: "product",
        product_id: productId,
        status: "already_updated",
        image_count: entries.length,
        cloudinary_url: first.cloudinary_url,
      });
      continue;
    }

    if (options.apply) {
      await client.query(`UPDATE product SET product_image = $1 WHERE product_id = $2`, [
        first.cloudinary_url,
        productId,
      ]);
    }

    results.push({
      source: "product",
      product_id: productId,
      status: options.apply ? "updated" : "would_update",
      image_count: entries.length,
      cloudinary_url: first.cloudinary_url,
    });
  }

  return results;
}

async function handleVariantGroups(variantGroups, options, client) {
  const results = [];

  for (const [variantId, entries] of variantGroups.entries()) {
    const urls = entries.map((entry) => entry.cloudinary_url);
    const nextValue = urls.join(",");
    const { rows } = await client.query(
      `SELECT variant_id, variant_product_list_image FROM variant_product WHERE variant_id = $1`,
      [variantId]
    );

    if (!rows.length) {
      results.push({
        source: "variant",
        variant_id: variantId,
        status: "not_found",
        error: "Variant not found",
      });
      continue;
    }

    if (rows[0].variant_product_list_image === nextValue) {
      results.push({
        source: "variant",
        variant_id: variantId,
        status: "already_updated",
        image_count: entries.length,
      });
      continue;
    }

    if (options.apply) {
      await client.query(
        `UPDATE variant_product SET variant_product_list_image = $1 WHERE variant_id = $2`,
        [nextValue, variantId]
      );
    }

    results.push({
      source: "variant",
      variant_id: variantId,
      status: options.apply ? "updated" : "would_update",
      image_count: entries.length,
    });
  }

  return results;
}

async function main() {
  const options = parseArgs(process.argv);
  const manifest = getUploadedEntries(loadJson(options.inputManifest));
  const productGroups = groupBy(
    manifest.filter((entry) => entry.source === "product"),
    (entry) => Number(entry.product_id)
  );
  const variantGroups = groupBy(
    manifest.filter((entry) => entry.source === "variant"),
    (entry) => Number(entry.variant_id)
  );

  console.log(
    `${options.apply ? "Applying" : "Dry-run"} DB updates from all local Cloudinary image manifest: ${productGroups.size} product(s), ${variantGroups.size} variant(s)`
  );

  const client = await db.connect();
  const results = [];

  try {
    if (options.apply) await client.query("BEGIN");
    results.push(...(await handleProductGroups(productGroups, options, client)));
    results.push(...(await handleVariantGroups(variantGroups, options, client)));
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

  if (results.some((result) => result.status === "not_found")) {
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
