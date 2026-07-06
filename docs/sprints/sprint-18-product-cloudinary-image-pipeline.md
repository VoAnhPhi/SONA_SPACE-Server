# Sprint 18 - Product Cloudinary Image Pipeline

- Project: `SONA_SPACE-Server`
- Sprint type: Feature hardening and media workflow
- Current status: In Progress
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-17-route-qaqc-full-coverage.md`
  - `routes/upload.js`
  - `routes/products.js`
  - `routes/variants.js`
  - `config/cloudinary.js`
  - `middleware/upload.js`

## 1. Sprint Goal

Standardize product image upload on Cloudinary so product media follows the same storage model as room/category media, while saving the resulting Cloudinary URLs into the existing product and variant database fields.

## 2. Current Baseline

- `POST /api/upload/product` already uploads a single `image` file to Cloudinary.
- Product create/update routes currently expect uploaded image URLs in request JSON:
  - `main_image` maps to `product.product_image`.
  - `variants[].list_image` maps to `variant_product.variant_product_list_image`.
- Product delete/update logic already attempts to delete removed Cloudinary images.
- Upload folder selection is currently flexible through request body `folder` and `subfolder`.

## 3. In Scope

- Harden `POST /api/upload/product` for product-specific folders.
- Standardize Cloudinary folder naming for product main images and variant images.
- Ensure create product saves Cloudinary URLs into `product.product_image` and `variant_product.variant_product_list_image`.
- Ensure update product replaces image URLs safely and deletes removed Cloudinary assets when appropriate.
- Add validation around file type, file size, image role, product slug, and variant slug/color identifier.
- Add smoke/contract tests for upload + create/update persistence behavior.
- Document frontend/admin payload expectations for product image upload.

## 4. Out of Scope

- Redesign of product schema.
- Migration of every existing remote product image URL in the same sprint.
- UI redesign for the admin product form.
- Changing Cloudinary account credentials or production secrets.

## 5. Proposed Cloudinary Folder Contract

Use server-side folder resolution instead of trusting arbitrary client folder input.

```text
SonaSpace/Product/{productSlug}/main
SonaSpace/Product/{productSlug}/variants/{variantSlug}
```

Allowed request fields for `POST /api/upload/product`:

| Field | Required | Notes |
|---|---|---|
| `image` | yes | Multipart file field. |
| `imageType` | yes | `main` or `variant`. |
| `productSlug` | yes | Used to group images under one product folder. |
| `variantSlug` | when `imageType=variant` | Used for variant-specific folder. |

Response contract:

```json
{
  "message": "Upload thanh cong",
  "url": "https://res.cloudinary.com/...",
  "public_id": "SonaSpace/Product/..."
}
```

## 6. Task Checklist

### Upload Route

- [x] Refactor `routes/upload.js` to resolve product folders server-side.
- [x] Keep `verifyToken` and `isAdmin` protection on product upload.
- [x] Reject missing `image`, invalid `imageType`, missing `productSlug`, and missing `variantSlug` for variant images.
- [x] Keep image MIME allowlist: `image/jpeg`, `image/png`, `image/webp`.
- [x] Keep or confirm max product image size limit.
- [x] Return `url` and `public_id` consistently.
- [x] Avoid exposing Cloudinary secrets or raw stack traces in API responses.

### Product Persistence

- [ ] Confirm `POST /api/products/add` saves `main_image` into `product.product_image`.
- [ ] Confirm `POST /api/products/add` saves `variants[].list_image` into `variant_product.variant_product_list_image`.
- [ ] Confirm `PUT /api/products/admin/:slug` updates `product.product_image`.
- [ ] Confirm update flow accepts retained existing image URLs and newly uploaded Cloudinary URLs together.
- [ ] Confirm removed images are deleted from Cloudinary using extracted `public_id`.
- [ ] Confirm product delete deletes main image and variant image assets where possible.

### Validation And Safety

- [ ] Add folder-name sanitization for `productSlug` and `variantSlug`.
- [ ] Reject image URLs that are not HTTP(S) when saving product/variant payloads.
- [ ] Prefer project-owned Cloudinary URLs for newly uploaded product images.
- [ ] Do not hardcode Cloudinary credentials; keep using `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
- [ ] Keep SQL parameterized in all persistence routes.

### Tests And Verification

- [x] Add or extend upload route contract smoke for product image upload auth behavior.
- [x] Add a mocked Cloudinary test path if live Cloudinary credentials are unavailable locally.
- [x] Verify unauthenticated upload returns `401`.
- [x] Verify non-admin upload returns `403`.
- [ ] Verify invalid file type returns `400`.
- [x] Verify valid main image upload returns a Cloudinary URL and `public_id`.
- [x] Verify valid variant image upload returns a Cloudinary URL and `public_id`.
- [ ] Verify create product persists uploaded URLs into DB.
- [ ] Verify update product persists replacement URLs and removes deleted assets.
- [x] Run:
  - `node -c routes/upload.js`
  - `node -c scripts/qa-product-upload-contract.js`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
  - `npm run qa:product-upload-contract`

Evidence:

- `npm run qa:product-upload-contract` passed `7/7`.
- `node -c routes/upload.js` passed.
- `node -c scripts/qa-product-upload-contract.js` passed.
- `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` passed.

### Existing Recovered Image Upload

- [x] Add batch upload script for recovered local product images.
- [x] Upload all currently downloaded recovered images to Cloudinary.
- [x] Write Cloudinary upload manifest for DB review/update.
- [x] Update product and variant DB rows from the Cloudinary upload manifest.

Evidence:

- Script added: `scripts/upload-recovered-product-images-to-cloudinary.js`.
- NPM script added: `npm run upload:recovered-products`.
- Dry-run mapped `182` downloaded recovered images to Cloudinary folders.
- Upload run completed with summary `{ uploaded: 182 }`.
- Uploaded source split:
  - `variant`: `178`
  - `product`: `4`
- Output manifests:
  - `public/uploads/recovered-products/cloudinary-upload-manifest.json`
  - `public/uploads/recovered-products/cloudinary-upload-manifest.csv`
- Syntax check passed:
  - `node -c scripts/upload-recovered-product-images-to-cloudinary.js`

Correction:

- The first upload path used only the download manifest and covered `182` images.
- A full local folder scan found `403` recovered image files.
- Script added: `scripts/upload-all-local-product-images-to-cloudinary.js`.
- NPM script added: `npm run upload:all-local-product-images`.
- Full local upload completed with summary `{ uploaded: 403 }`.
- Output manifests:
  - `public/uploads/recovered-products/cloudinary-local-all-manifest.json`
  - `public/uploads/recovered-products/cloudinary-local-all-manifest.csv`
- Cloudinary API verification found `606` assets under `SonaSpace/Product/` after the full upload run. This includes pre-existing product assets plus the newly uploaded local recovered set.

### Existing Recovered Image DB Update

- [x] Add DB update script for uploaded Cloudinary image manifest.
- [x] Dry-run DB update before applying.
- [x] Apply DB update for uploaded product/variant image URLs.
- [x] Correct duplicate-original variant image positions by `image_index`.
- [x] Verify no uploaded manifest original URLs remain in DB.
- [x] Update production init seed with the current Cloudinary image URLs.

Evidence:

- Script added: `scripts/apply-cloudinary-product-image-manifest.js`.
- NPM script added: `npm run apply:cloudinary-product-images`.
- Initial dry-run summary: `{ would_update: 182 }`.
- Initial apply summary: `{ updated: 182 }`.
- Position correction dry-run summary: `{ already_updated: 171, would_correct: 11 }`.
- Position correction apply summary: `{ already_updated: 171, corrected: 11 }`.
- Final dry-run summary: `{ already_updated: 182 }`.
- DB verification summary:
  - uploaded manifest entries: `182`
  - manifest Cloudinary URLs now present in DB: `182`
  - uploaded manifest original URLs remaining in DB: `0`
  - old BoConcept/Amplience URLs still present because they were not recovered/uploaded: `195`
- Syntax/app checks passed:
  - `node -c scripts/apply-cloudinary-product-image-manifest.js`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`

Correction:

- Script added: `scripts/apply-local-all-cloudinary-product-images.js`.
- NPM script added: `npm run apply:all-local-product-images`.
- Dry-run summary before apply: `{ would_update: 75, already_updated: 11 }`.
- Apply summary: `{ updated: 75, already_updated: 11 }`.
- Final dry-run summary: `{ already_updated: 86 }`.
- DB verification in recovered scope:
  - uploaded local manifest entries: `403`
  - recovered products: `31`
  - recovered variants: `55`
  - DB image URLs in recovered scope: `376`
  - DB URLs matching local Cloudinary manifest: `376`
  - old BoConcept/Amplience URLs remaining in recovered scope: `0`
- Production init seed update:
  - Updated `db/init/init.sql` product seed rows from the current `product` table.
  - Updated `db/init/init.sql` variant seed rows from the current `variant_product` table.
  - Seed now contains `31` product rows and `55` variant rows.
  - Seed contains `376` `SonaSpace/Product/...` Cloudinary URLs.
  - Seed has `0` remaining `assets.boconcept.com` or `cdn.media.amplience.net` URL references.

### Documentation

- [ ] Document admin frontend upload flow:
  1. upload image file through `/api/upload/product`;
  2. store returned `url` in form state;
  3. submit product payload with `main_image` and `variants[].list_image`.
- [ ] Document Cloudinary folder convention.
- [x] Update handoff notes with verification results after implementation.

## 7. Definition of Done

- [ ] Product image upload uses the standardized Cloudinary folder contract.
- [x] Existing recovered product main image URLs are saved to `product.product_image`.
- [x] Existing recovered product variant image URLs are saved to `variant_product.variant_product_list_image`.
- [x] Production DB init seed uses the current recovered Cloudinary product and variant image URLs.
- [ ] Removed/replaced Cloudinary product images are cleaned up where safe.
- [ ] Auth, validation, and persistence smoke tests pass.
- [ ] Existing room/category upload behavior is not regressed.

## 8. Open Questions

- [x] Should existing recovered/local product images be migrated into Cloudinary in a later sprint?
- [ ] Should the DB store only URLs, or also Cloudinary `public_id` in new columns later?
- [ ] Should variant folders use `variantSlug`, `colorSlug`, or `colorId` when variant slug is not available before product creation?
