const fs = require("fs");
const path = require("path");

const cloudinary = require("../config/cloudinary");
const db = require("../config/database");

const DEFAULT_INPUT_DIR = path.join(
  __dirname,
  "../public/uploads/recovered-products"
);
const DEFAULT_OUTPUT_MANIFEST = path.join(
  __dirname,
  "../public/uploads/recovered-products/cloudinary-local-all-manifest.json"
);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function parseArgs(argv) {
  const options = {
    apply: false,
    force: false,
    inputDir: DEFAULT_INPUT_DIR,
    outputManifest: DEFAULT_OUTPUT_MANIFEST,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--input-dir") options.inputDir = path.resolve(argv[++i]);
    else if (arg === "--output-manifest") options.outputManifest = path.resolve(argv[++i]);
    else if (arg === "--help") {
      console.log(`Usage:
  node scripts/upload-all-local-product-images-to-cloudinary.js [--apply] [--force]

Scans every local image under public/uploads/recovered-products and uploads it to:
  SonaSpace/Product/{productSlug}/main
  SonaSpace/Product/{productSlug}/variants/{variantSlug}

Default mode is dry-run. Use --apply to upload to Cloudinary.`);
      process.exit(0);
    }
  }

  return options;
}

function sanitizeFolderSegment(value) {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function getAllImageFiles(inputDir) {
  const files = [];

  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(fullPath);
      } else if (IMAGE_EXTENSIONS.has(path.extname(item.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  walk(inputDir);
  return files.sort((a, b) => a.localeCompare(b));
}

function parseLocalImage(filePath, inputDir) {
  const relativeParts = path.relative(inputDir, filePath).split(path.sep);
  const productMatch = relativeParts[0]?.match(/^product-(\d+)$/);
  if (!productMatch) return null;

  const productId = Number(productMatch[1]);
  const variantMatch = relativeParts[1]?.match(/^variant-(\d+)$/);

  return {
    source: variantMatch ? "variant" : "product",
    product_id: productId,
    variant_id: variantMatch ? Number(variantMatch[1]) : null,
    file_path: filePath,
    file_name: path.basename(filePath),
    file_stem: path.basename(filePath, path.extname(filePath)),
  };
}

async function getSlugMaps() {
  const [productsResult, variantsResult] = await Promise.all([
    db.query(`SELECT product_id, product_slug FROM product`),
    db.query(`SELECT variant_id, variant_product_slug FROM variant_product`),
  ]);

  return {
    products: new Map(
      productsResult.rows.map((row) => [
        Number(row.product_id),
        sanitizeFolderSegment(row.product_slug) || `product-${row.product_id}`,
      ])
    ),
    variants: new Map(
      variantsResult.rows.map((row) => [
        Number(row.variant_id),
        sanitizeFolderSegment(row.variant_product_slug) || `variant-${row.variant_id}`,
      ])
    ),
  };
}

function resolveFolder(entry, slugMaps) {
  const productSlug = slugMaps.products.get(Number(entry.product_id)) || `product-${entry.product_id}`;
  if (entry.source === "product") {
    return `SonaSpace/Product/${productSlug}/main`;
  }

  const variantSlug =
    slugMaps.variants.get(Number(entry.variant_id)) || `variant-${entry.variant_id}`;
  return `SonaSpace/Product/${productSlug}/variants/${variantSlug}`;
}

async function uploadEntry(entry, options) {
  if (!options.apply) {
    return {
      ...entry,
      status: "dry_run",
      cloudinary_public_id: `${entry.cloudinary_folder}/${entry.file_stem}`,
    };
  }

  try {
    const result = await cloudinary.uploader.upload(entry.file_path, {
      folder: entry.cloudinary_folder,
      public_id: entry.file_stem,
      overwrite: true,
      resource_type: "image",
    });

    return {
      ...entry,
      status: "uploaded",
      cloudinary_public_id: result.public_id,
      cloudinary_url: result.secure_url,
    };
  } catch (error) {
    return {
      ...entry,
      status: "failed",
      error: error.message,
    };
  }
}

function writeOutput(results, outputManifest) {
  const csvPath = outputManifest.replace(/\.json$/i, ".csv");
  fs.writeFileSync(outputManifest, JSON.stringify(results, null, 2), "utf8");

  const headers = [
    "source",
    "product_id",
    "variant_id",
    "status",
    "file_path",
    "cloudinary_folder",
    "cloudinary_public_id",
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

async function main() {
  const options = parseArgs(process.argv);
  const slugMaps = await getSlugMaps();
  const entries = getAllImageFiles(options.inputDir)
    .map((filePath) => parseLocalImage(filePath, options.inputDir))
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      cloudinary_folder: resolveFolder(entry, slugMaps),
    }));

  console.log(
    `${options.apply ? "Uploading" : "Dry-run"} ${entries.length} local recovered image(s) to Cloudinary`
  );

  const results = [];
  for (let index = 0; index < entries.length; index += 1) {
    const result = await uploadEntry(entries[index], options);
    results.push(result);
    const marker = result.status === "uploaded" || result.status === "dry_run" ? "OK" : "FAIL";
    console.log(
      `[${index + 1}/${entries.length}] ${marker} ${result.source} ${result.variant_id || result.product_id} -> ${result.cloudinary_public_id || result.cloudinary_folder}`
    );
  }

  const summary = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  const output = writeOutput(results, options.outputManifest);

  console.log("\nSummary:", summary);
  console.log("Wrote:", output.jsonPath);
  console.log("Wrote:", output.csvPath);

  if (results.some((result) => result.status === "failed")) {
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
