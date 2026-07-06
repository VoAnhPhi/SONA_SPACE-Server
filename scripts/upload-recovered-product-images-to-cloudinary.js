const fs = require("fs");
const path = require("path");

const cloudinary = require("../config/cloudinary");
const db = require("../config/database");

const DEFAULT_INPUT_MANIFEST = path.join(
  __dirname,
  "../public/uploads/recovered-products/manifest.json"
);
const DEFAULT_OUTPUT_MANIFEST = path.join(
  __dirname,
  "../public/uploads/recovered-products/cloudinary-upload-manifest.json"
);

function parseArgs(argv) {
  const options = {
    apply: false,
    force: false,
    limit: 0,
    inputManifest: DEFAULT_INPUT_MANIFEST,
    outputManifest: DEFAULT_OUTPUT_MANIFEST,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--limit") options.limit = Number(argv[++i] || 0);
    else if (arg === "--input-manifest") options.inputManifest = path.resolve(argv[++i]);
    else if (arg === "--output-manifest") options.outputManifest = path.resolve(argv[++i]);
    else if (arg === "--help") {
      console.log(`Usage:
  node scripts/upload-recovered-product-images-to-cloudinary.js [--apply] [--force] [--limit N]

Uploads downloaded recovered product images to Cloudinary folders:
  SonaSpace/Product/{productSlug}/main
  SonaSpace/Product/{productSlug}/variants/{variantSlug}

Default mode is dry-run. Use --apply to perform Cloudinary uploads.
Writes:
  public/uploads/recovered-products/cloudinary-upload-manifest.json
  public/uploads/recovered-products/cloudinary-upload-manifest.csv`);
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

function loadJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getUploadKey(entry) {
  return [
    entry.source,
    entry.source_id,
    entry.product_id,
    entry.variant_id || "",
    entry.image_index,
    entry.file_path,
  ].join("|");
}

function getPublicIdBase(entry) {
  const fileBase = path.basename(entry.file_path, path.extname(entry.file_path));
  return sanitizeFolderSegment(fileBase) || `${entry.source}-${entry.source_id}-${entry.image_index}`;
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

async function uploadEntry(entry, folder, options) {
  if (!fs.existsSync(entry.file_path)) {
    return {
      ...entry,
      status: "missing_file",
      cloudinary_folder: folder,
      error: "Local file does not exist",
    };
  }

  const publicIdBase = getPublicIdBase(entry);

  if (!options.apply) {
    return {
      ...entry,
      status: "dry_run",
      cloudinary_folder: folder,
      cloudinary_public_id: `${folder}/${publicIdBase}`,
    };
  }

  try {
    const result = await cloudinary.uploader.upload(entry.file_path, {
      folder,
      public_id: publicIdBase,
      overwrite: true,
      resource_type: "image",
    });

    return {
      ...entry,
      status: "uploaded",
      cloudinary_folder: folder,
      cloudinary_public_id: result.public_id,
      cloudinary_url: result.secure_url,
    };
  } catch (error) {
    return {
      ...entry,
      status: "failed",
      cloudinary_folder: folder,
      error: error.message,
    };
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const sourceManifest = loadJson(options.inputManifest, []);
  const existingResults = loadJson(options.outputManifest, []);
  const existingUploaded = new Map(
    existingResults
      .filter((entry) => entry.status === "uploaded")
      .map((entry) => [getUploadKey(entry), entry])
  );

  let entries = sourceManifest.filter((entry) => entry.status === "downloaded");
  if (options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  const slugMaps = await getSlugMaps();
  const results = [];

  console.log(
    `${options.apply ? "Uploading" : "Dry-run"} ${entries.length} recovered product image(s) to Cloudinary`
  );

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const key = getUploadKey(entry);
    if (!options.force && existingUploaded.has(key)) {
      results.push(existingUploaded.get(key));
      continue;
    }

    const folder = resolveFolder(entry, slugMaps);
    const result = await uploadEntry(entry, folder, options);
    results.push(result);

    const marker = result.status === "uploaded" || result.status === "dry_run" ? "OK" : "FAIL";
    console.log(
      `[${index + 1}/${entries.length}] ${marker} ${entry.source} ${entry.source_id} -> ${result.cloudinary_public_id || result.cloudinary_folder}`
    );
  }

  const output = writeOutput(results, options.outputManifest);
  const summary = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});

  console.log("\nSummary:", summary);
  console.log("Wrote:", output.jsonPath);
  console.log("Wrote:", output.csvPath);

  if (results.some((result) => result.status === "failed" || result.status === "missing_file")) {
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
