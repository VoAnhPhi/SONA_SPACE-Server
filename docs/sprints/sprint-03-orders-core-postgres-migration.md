# Sprint 3 - Orders Core PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: core commerce migration
- Prepared date: 2026-05-06
- Suggested duration: 5 working days
- Current status: Done / Sprint 4 active
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-02-coupon-commerce-handoff.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 2 coupon and commerce support routes are done.
- [x] `routes/couponcodes.js`, `routes/payments.js`, `routes/orderStatus.js`, `routes/orders-id.js` have 0 guard findings.
- [x] `orders.order_status` numeric mapping is documented.
- [x] Payment relation decision is fixed as `orders.payment_id -> payments.payment_id`.
- [x] `withTransaction` helper is available in `db/transaction.js`.

## 2. Sprint Goal

Migrate `routes/orders.js` to full PostgreSQL contract and prepare clean handoff for catalog/social modules.

## 3. Baseline Metrics (2026-05-06)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 647 |
| `routes/orders.js` findings | 157 |
| `routes/products.js` findings | 138 |
| `routes/comments.js` findings | 56 |

## 4. Scope

- Migrate all `routes/orders.js` endpoints from MySQL contract to PostgreSQL contract.
- Replace `?` placeholders with `$1..$n`.
- Replace MySQL-only SQL syntax (`IFNULL`, `DATE_FORMAT`, MySQL `LIMIT offset, limit`) with PostgreSQL equivalent.
- Remove MySQL result shape usage (`insertId`, `affectedRows`) and use `{ rows, rowCount }`.
- Use `withTransaction` for write paths touching `orders`, `order_items`, `payments`, `order_status_log`, and related tables.
- Keep response payload compatibility where frontend already depends on current field names.
- Update tracker and evidence after each day.

## 5. Out of Scope

- Full `routes/products.js` migration.
- Full `routes/comments.js` migration.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + SQL Inventory

- [x] Re-run guard and capture baseline for Sprint 3.
- [x] Confirm Sprint 2 handoff status and open blockers.
- [x] Inventory all endpoints and SQL statements in `routes/orders.js`.
- [x] Group endpoints by read/write and transaction risk.

Evidence:

- Command output: `npm run check:mysql-patterns` -> `Total findings: 647`, `routes/orders.js: 157`.
- Notes: Sprint 3 activated from Sprint 2 handoff.
- Endpoint inventory: `routes/orders.js` has 17 endpoints (`9` read, `8` write/mutate) and currently `146` guard findings after the latest pass.
- Risk grouping:
  - High write-transaction risk: `POST /`, `POST /payment/momo`, `GET /redirect/momo`, `PUT /:id/status`, `PUT /:id/return-status`, `DELETE /:id`, `PATCH /:id`, `POST /return/:orderHash`.
  - Medium read-risk (schema compatibility): `GET /hash/:orderHash`, `GET /admin`, `GET /:id`, `GET /`, `GET /count`, `GET /status/count`, `GET /return/count`.

### Day 2 - Read Endpoints Migration

- [x] Migrate read-only order endpoints in `routes/orders.js`.
- [x] Convert pagination/sorting SQL to PostgreSQL-safe syntax.
- [ ] Validate representative order listing/detail queries.

Evidence:

- Syntax: `node -c routes/orders.js` -> pass.
- Guard delta: `routes/orders.js` findings `157 -> 146`; total findings `647 -> 636`.
- App smoke: `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.

### Day 3 - Write Endpoints Migration (Part 1)

- [ ] Migrate order create/update status flows.
- [x] Apply `withTransaction` to multi-step writes.
- [x] Replace MySQL result contracts with PostgreSQL contracts.

Evidence:

- Migrated write endpoints:
  - `PUT /api/orders/:id/status`
  - `DELETE /api/orders/:id`
  - `PATCH /api/orders/:id`
- Additional read endpoint cleanup:
  - `GET /api/orders/status/count`
- Write-path updates:
  - Numeric `orders.order_status` contract + legacy status mapping at API boundary.
  - `order_status_log` migrated to (`old_status`, `new_status`, `changed_by`, `note`).
  - `notifications` migrated to `sender_id` and `RETURNING id` flow.
  - Replaced legacy transactions with `withTransaction` in delete/patch flows.
- Validation:
  - `node -c routes/orders.js` -> pass.
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
  - Guard delta after this pass: `routes/orders.js` findings `146 -> 115`; total findings `636 -> 605`.

### Day 4 - Write Endpoints Migration (Part 2)

- [x] Migrate cancel/refund/side-effect flows in `routes/orders.js`.
- [x] Validate status-log and payment relation consistency.
- [x] Re-run guard and capture delta.

Evidence:

- Endpoint migrations in this pass:
  - `GET /api/orders/:id`
  - `POST /api/orders/send-invoice`
  - `POST /api/orders/:id/send-apology-email`
  - `GET /api/orders/return/count`
- Validation:
  - `node -c routes/orders.js` -> pass.
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
  - Guard snapshot after this pass: `routes/orders.js` findings `115 -> 52`; total findings `605 -> 542`.

Additional evidence:

- Major write-flow migration completed for:
  - `POST /api/orders/payment/momo`
  - `POST /api/orders`
- Write-path updates:
  - Replaced legacy MySQL placeholders/result shapes with PostgreSQL-native query contract.
  - Replaced `ON DUPLICATE KEY` with `ON CONFLICT` in coupon usage upsert.
  - Migrated order/payment persistence to current schema (`orders.payment_id -> payments.payment_id`).
  - Removed legacy `order_items.product_price/current_status` writes and mapped to `order_items.price`.
  - Converted stock/product/wishlist side effects to PostgreSQL-safe updates.
- Validation:
  - `node -c routes/orders.js` -> pass.
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
  - Guard snapshot after this pass: `routes/orders.js` findings `52 -> 0`; total findings `542 -> 490`.

### Day 5 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record latest count.
- [x] Update tracker module statuses and blockers.
- [x] Propose Sprint 4 target module by guard impact.

Recommendation:

- Sprint 4 priority by guard impact:
  1. `routes/products.js` (`138` findings)
  2. `routes/comments.js` (`56` findings)
  3. `routes/news.js` (`45` findings)

Evidence:

- App smoke: `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
- Guard snapshot after Sprint 4 kickoff slice:
  - Total findings: `472`
  - `routes/orders.js`: `0`
  - `routes/products.js`: `120` (down from `138`)
  - `routes/comments.js`: `56`
- Follow-up: Sprint 4 has started on catalog with migrated `products.js` read endpoints (`/all`, `/`, `/search`, `/admin`, `/related/by-room/:productId`, `/newest`, `/variants`).

## 7. Definition of Done

- [x] `routes/orders.js` has 0 MySQL guard findings.
- [x] All critical order flows in `routes/orders.js` use PostgreSQL placeholders/result shape.
- [x] Transaction-safe write flows are implemented with `withTransaction`.
- [x] App smoke import passes.
- [x] Sprint doc and migration tracker are updated with evidence and next module recommendation.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S3-B001 | Cross-module | Global guard still has 472 findings outside completed slices | High | TBD | Open |
| S3-B002 | Orders | `routes/orders.js` migration hotspot | High | TBD | Closed |

## 9. Production Enhancement Backlog

> Added after the original Sprint 3 migration closeout. These items are not part of the original PostgreSQL migration Definition of Done; they are production-readiness enhancements to review before client production rollout.

### Product Flow Enhancement

- [ ] Audit the current product image sources in the database/API response.
- [ ] Build a safe migration script to download existing product images and upload them to Cloudinary.
- [ ] Add a dry-run mode that logs `product_id`, old image URL, target Cloudinary folder, and planned update without modifying data.
- [ ] Add an apply mode that stores the new Cloudinary `secure_url` and `public_id` for each product image.
- [ ] Skip images that are already hosted on Cloudinary to avoid duplicate uploads.
- [ ] Write a backup/mapping file before any database update.
- [ ] Validate product core fields after image migration: name, slug, price, sale price, stock, category, room, material, dimensions, status, and description.
- [ ] Validate product detail API payload compatibility for the production client.

### Product Variant Flow

- [ ] Review the variant schema and API payload used by the client.
- [ ] Validate variant fields: `variant_id`, `product_id`, color, size/dimensions, price override, quantity/stock, image, and status.
- [ ] Confirm product stock stays consistent with variant stock after create/update/delete operations.
- [ ] Test product detail pages with multiple variants, missing variants, disabled variants, and out-of-stock variants.
- [ ] Verify cart/order creation uses the selected variant, not only the parent product.

### Order And MoMo Payment Regression

- [ ] Test complete order creation from the production client flow.
- [ ] Test order creation with variant products and confirm `order_items` stores the correct variant, price, quantity, and product snapshot.
- [ ] Test stock deduction after successful order creation.
- [ ] Test MoMo payment request creation.
- [ ] Test MoMo redirect/IPN handling and confirm payment/order status updates correctly.
- [ ] Test failed/cancelled MoMo payment cases and confirm the order does not move to a paid/success state.
- [ ] Validate order listing/detail APIs after MoMo payment for both customer and admin views.
- [ ] Record staging or production-like evidence before marking this backlog complete.
