# Sprint 16 - Regression Validation and Release Readiness

- Project: `SONA_SPACE-Server`
- Sprint type: stabilization and readiness
- Prepared date: 2026-05-10
- Suggested duration: 3-5 working days
- Current status: Completed
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-15-dashboard-debug-chat-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] MySQL guard is clean (`npm run check:mysql-patterns` => no findings).
- [x] Core runtime modules pass syntax + app smoke (`APP_OK`).

## 2. Sprint Goal

Validate PostgreSQL migration quality by running regression suites, data checks, and staging readiness tasks.

## 3. Baseline Metrics (2026-05-10)

| Metric | Value |
|---|---|
| Guard findings | 0 |
| App smoke import | APP_OK |

## 4. Scope

- Execute critical API regression paths for commerce/catalog/content/notify/social.
- Perform data reconciliation checks (orders, revenue, coupon, stock).
- Prepare staging cutover checklist and rollback sanity plan.

## 5. Out of Scope

- New feature development.
- Schema redesign beyond reconciliation fixes.

## 6. Checklist

### Day 1 - Regression Run

- [x] Critical API regression suite executed.
- [x] High-risk endpoint matrix recorded with pass/fail.
- [x] Route contract gap audit completed for legacy/public admin surfaces.

### Day 2 - Data Reconciliation

- [x] Orders, revenue, and coupon reconciliation report completed.
- [x] Catalog stock sanity check completed.

### Day 3 - Staging Drill Prep

- [x] Staging deploy checklist completed.
- [x] Rollback drill script and runbook reviewed.

### Day 4 - Readiness Review

- [x] Go/No-Go artifact prepared.
- [x] Final risk log updated.

## 7. Definition of Done

- [x] Regression suite has no blocker-level failures.
- [x] Data reconciliation approved.
- [x] Staging readiness checklist is complete.
- [x] Production readiness recommendation is documented.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S16-B001 | QA | Closed on `2026-06-25` after seeding a controlled local commerce dataset (`4` orders, `4` payments, `4` order_items, `1` return flow), rerunning commerce/revenue regressions, and confirming reconciliation/integrity checks all pass locally | High | TBD | Closed |
| S16-B002 | Route contract | Admin/dashboard mutation hardening across `products`, `variants`, `materials`, `typenotify`, `comments`, `chat`, `attributes`, and `upload` plus debug/test cleanup (`contactFormsDesign`, `wishlists-id`, `products/test`, app test pages) was completed on `2026-06-25`; targeted rerun evidence is now recorded | High | TBD | Closed |

## 9. Follow-up Queue

- [x] Sprint 17 QA/QC planning docs are prepared:
  - `docs/qa-qc-route-regression-playbook.md`
  - `docs/sprints/sprint-17-route-qaqc-full-coverage.md`
- [x] Sprint 16 closed blocker `S16-B001`; Sprint 17 can start from the recorded local baseline.

## 10. Daily Notes

### 2026-05-12

- Done:
  - Fixed major catalog regression in `routes/categories.js` where PostgreSQL route SQL referenced non-existent columns (`category_icon`, `category_banner`).
  - Added schema-safe compatibility mapping (`category_image AS category_icon`, `NULL::text AS category_banner`) and aligned create/update/delete category queries to the current `category` table contract.
  - Updated category product color aggregation to use `color.color_code`.
- Smoke/API evidence:
  - `node -c routes/categories.js`
  - `npm run check:mysql-patterns` -> `OK: no MySQL patterns found.`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`
  - Local HTTP smoke via temporary app listener:
    - `GET /api/categories/filter/` -> `200`
    - `GET /api/categories/` -> `200`
    - `GET /api/categories/:slug` -> `200`
- Blockers:
  - `S16-B001` remains open; full regression/reconciliation artifact is still incomplete.
- Next action:
  - Continue Sprint 16 Day 1 matrix execution for remaining high-risk routes (`rooms`, `color`, `banners`) and record pass/fail evidence.

### 2026-06-24

- Done:
  - Completed Sprint 16 Day 1 high-risk route validation for `rooms`, `color`, and `banners`.
  - Fixed `routes/color.js` against the actual PostgreSQL schema: replaced legacy `color_hex` usage with `color_code`, switched `/by-product/:slug` to resolve through `product.product_slug`, and added compatibility aliases (`color_hex`, computed `color_slug`, compatibility `status`) at the API layer.
  - Fixed API auth behavior in `middleware/auth.js` so mounted `/api/...` routes now return JSON `401` consistently by checking the original API URL instead of router-local `req.path`.
  - Restored admin protection on `POST /api/rooms`, which had drifted from the documented admin-only contract.
  - Extended the Day 1 regression sweep to `categories`, `orders`, `users`, and `notify` route contracts.
  - Locked down contract drift in private/admin endpoints: `GET /api/notify/admin`, `GET /api/orders/count`, `GET /api/users/admin/:id`, `PUT /api/users/admin/:id`, `GET /api/users/:id`, `GET /api/users/:id/orders`, `GET /api/users/:id/wishlist`, `GET /api/users/:id/reviews`, and `DELETE /api/users/:id` now require auth consistently instead of returning `200`/`500` without a token.
- Smoke/API evidence:
  - `node -c routes/color.js`
  - `node -c middleware/auth.js`
  - `node -c routes/rooms.js`
  - `node -c routes/banners.js`
  - `node -c routes/users.js`
  - `node -c routes/notify.js`
  - `node -c routes/orders.js`
  - `npm run check:mysql-patterns` -> `OK: no MySQL patterns found.`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`
  - Local HTTP smoke via temporary app listener:
    - `GET /api/rooms/` -> `200`
    - `GET /api/rooms/filter/` -> `200`
    - `GET /api/rooms/products` -> `200`
    - `GET /api/color/filter` -> `200`
    - `GET /api/color/by-product/modena-2-5-cho` -> `200`
    - `GET /api/banners/` -> `200`
    - `GET /api/banners/page/home` -> `200`
    - `GET /api/banners/page-types` -> `200`
    - `GET /api/rooms/admin` (no token) -> `401`
    - `POST /api/rooms` (no token) -> `401`
    - `GET /api/color/admin` (no token) -> `401`
    - `POST /api/banners` (no token) -> `401`
    - `GET /api/categories/` -> `200`
    - `GET /api/categories/filter/` -> `200`
    - `GET /api/categories/admin/all` (no token) -> `401`
    - `GET /api/notify/` (no token) -> `401`
    - `GET /api/notify/admin` (no token) -> `401` after route hardening
    - `GET /api/orders/count` (no token) -> `401` after route hardening
    - `GET /api/orders/` (no token) -> `401`
    - `GET /api/orders/status/count` (no token) -> `401`
    - `GET /api/users/1` (no token) -> `401` after route hardening
    - `GET /api/users/1/orders` (no token) -> `401` after route hardening
    - `GET /api/users/1/wishlist` (no token) -> `401` after route hardening
    - `GET /api/users/1/reviews` (no token) -> `401` after route hardening
    - `DELETE /api/users/1` (no token) -> `401` after route hardening
  - Local authenticated smoke using a short-lived admin JWT for existing admin `user_id=1`:
    - `GET /api/categories/admin/all` -> `200`
    - `GET /api/notify/` -> `200`
    - `GET /api/notify/admin` -> `200`
    - `POST /api/notify/` with empty body -> `400` validation error after auth passes
    - `GET /api/orders/count` -> `200`
    - `GET /api/orders/` -> `200`
    - `GET /api/orders/status/count` -> `200`
    - `GET /api/users/admin` -> `200`
    - `GET /api/users/admin/1` -> `200`
    - `GET /api/users/1` -> `200`
    - `GET /api/users/1/orders` -> `200`
    - `GET /api/users/1/wishlist` -> `200`
    - `GET /api/users/1/reviews` -> `200`
  - Day 2 baseline data snapshot:
    - `orders=0`, `payments=0`, `order_items=0`, `order_returns=0`
    - `couponcode=3`, `couponcode_used total=0`, `user_has_coupon=0`
    - `product=27`, `variant_product=48`, aggregate stock/quantity = `2896`
- Blockers:
  - `S16-B001` remains open; Day 1 route-access regression evidence is now broader, but functional authenticated flows, reconciliation, and staging-readiness artifacts are still incomplete.
  - Local DB snapshot has no transactional order/payment data, so Day 2 reconciliation for commerce/revenue cannot be meaningfully completed locally without staging data or additional seed data.
- Next action:
  - Day 1 route access/happy-path sampling is in a usable state; the next highest-value step is either staging-backed reconciliation for commerce data or creating a controlled local seed dataset for orders/payments before continuing Day 2.

### 2026-06-25

- Done:
  - Completed a route contract gap audit focused on Sprint 16 closure risk, covering the files with the strongest private/public drift and legacy dashboard dependencies.
  - Confirmed that the remaining Sprint 16 risk is not primarily SQL migration anymore; it is route hardening, debug/test endpoint cleanup, and readiness evidence.
  - Executed hardening batch 1 for `routes/products.js` and `routes/variants.js`.
  - Re-protected legacy dashboard/admin product endpoints: `GET /api/products/admin`, `GET /api/products/admin/:slug`, `POST /api/products/add`, `PUT /api/products/:id`, `PUT /api/products/admin/:slug`, and `DELETE /api/products/:slug`.
  - Re-protected legacy dashboard/admin variant endpoints: `POST /api/variants/:productId`, `PUT /api/variants/:variantId`, and `DELETE /api/variants/:variantId`.
  - Fixed product admin detail contract drift in `routes/products.js`:
    - replaced raw `color_priority` table reads with compatibility ordering based on `color_id`;
    - replaced missing `attributes.unit`, `attributes.is_required`, and `attributes.value_type` assumptions with schema-safe compatibility aliases for the current PostgreSQL schema.
  - Executed hardening batch 2 for `routes/materials.js` and `routes/typenotify.js`.
  - Re-protected dashboard material mutation endpoints: `POST /api/materials`, `PUT /api/materials/:slug`, `PUT /api/materials/:slug/toggle-status`, and `DELETE /api/materials/:slug`.
  - Re-protected dashboard notify-type mutation endpoints: `POST /api/typeNotify`, `PUT /api/typeNotify/:id/status`, `PUT /api/typeNotify/:id`, and `DELETE /api/typeNotify/:id`.
  - Executed hardening batch 3 for `routes/comments.js`, `routes/chat.js`, `routes/attributes.js`, and `routes/upload.js`.
  - Re-protected admin/dashboard moderation and utility endpoints:
    - `GET /api/comments/admin`
    - `PUT /api/comments/:comment_id/status`
    - `PUT /api/comments/:id/toggle-status`
    - `PUT /api/chat/context`
    - `POST /api/attribute/:categoryId`
    - `POST /api/upload/category`
    - `POST /api/upload/room`
    - `POST /api/upload/product`
    - `DELETE /api/upload/:publicId(*)`
    - `POST /api/upload/news`
    - `POST /api/upload/newscategorynews`
    - `POST /api/upload/event`
  - Fixed PostgreSQL schema drift in `routes/attributes.js` by removing reads/writes to non-existent `attributes.value_type`, `attributes.unit`, and `attributes.is_required` columns while keeping compatibility fields in the API response.
  - Tightened `routes/upload.js` delete behavior so missing Cloudinary assets now return `404` instead of a noisy `500`.
  - Completed debug/test cleanup for the remaining route-contract exceptions:
    - disabled `GET /api/contact-form-design/:id/details/debug`
    - disabled `GET /api/wishlists-id/test`
    - disabled `GET /api/products/test/:slug`
    - disabled `/test-categories`
    - disabled `/test-gemini-chatbot`
- Evidence:
  - `npm run check:mysql-patterns` -> `OK: no MySQL patterns found.`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`
  - `rg -n "router\\.(post|put|patch|delete)\\(" routes`
  - `rg -n "router\\.(post|put|patch|delete)\\([^\\n]*verifyToken" routes`
  - targeted caller scans across `views/dashboard/*` to confirm active dependencies on legacy routes
  - `node -c routes/products.js`
  - `node -c routes/variants.js`
  - targeted temporary-app auth regression:
    - `GET /api/products/admin` -> `401` without token, `200` with admin token
    - `GET /api/products/admin/:slug` -> `401` without token, `200` with admin token
    - `POST /api/products/add` -> `401` without token, `400` with admin token and empty payload
    - `PUT /api/products/admin/:slug` -> `401` without token, `400` with admin token and empty payload
    - `POST /api/variants/:productId` -> `401` without token, `400` with admin token and empty payload
    - `PUT /api/variants/:variantId` -> `401` without token, `400` with admin token and empty payload
    - public regression spot-checks stayed green:
      - `GET /api/products/:slug` -> `200`
      - `GET /api/products/all` -> `200`
  - `node -c routes/materials.js`
  - `node -c routes/typenotify.js`
  - targeted temporary-app auth regression for batch 2:
    - `GET /api/materials` -> `200`
    - `GET /api/typeNotify` -> `200`
    - `POST /api/materials` -> `401` without token, `400` with admin token and empty payload
    - `PUT /api/materials/:slug` -> `401` without token, `404` with admin token on a non-existent slug
    - `PUT /api/materials/:slug/toggle-status` -> `401` without token, `404` with admin token on a non-existent slug
    - `DELETE /api/materials/:slug` -> `401` without token, `404` with admin token on a non-existent slug
    - `POST /api/typeNotify` -> `401` without token, `400` with admin token and empty payload
    - `PUT /api/typeNotify/:id/status` -> `401` without token, `404` with admin token on a non-existent id
    - `PUT /api/typeNotify/:id` -> `401` without token, `404` with admin token on a non-existent id
    - `DELETE /api/typeNotify/:id` -> `401` without token, `404` with admin token on a non-existent id
  - `node -c routes/comments.js`
  - `node -c routes/chat.js`
  - `node -c routes/attributes.js`
  - `node -c routes/upload.js`
  - targeted temporary-app auth regression for batch 3:
    - `GET /api/comments/admin` -> `401` without token, `200` with admin token
    - `PUT /api/comments/:comment_id/status` -> `401` without token, `404` with admin token on a non-existent id
    - `PUT /api/comments/:id/toggle-status` -> `401` without token, `404` with admin token on a non-existent id
    - `GET /api/chat` -> `200`
    - `PUT /api/chat/context` -> `401` without token, `400` with admin token and empty payload
    - `POST /api/attribute/:categoryId` -> `401` without token, `400` with admin token and empty payload
    - `GET /api/attribute/:categoryId/attributes` -> `200` after the schema-compatibility fix
    - `POST /api/upload/category` -> `401` without token, `400` with admin token and no file
    - `POST /api/upload/room` -> `401` without token, `400` with admin token and no file
    - `POST /api/upload/product` -> `401` without token, `400` with admin token and no file
    - `POST /api/upload/news` -> `401` without token, `400` with admin token and no file
    - `POST /api/upload/newscategorynews` -> `401` without token, `400` with admin token and no file
    - `POST /api/upload/event` -> `401` without token, `400` with admin token and no file
    - `DELETE /api/upload/:publicId(*)` -> `401` without token, `404` with admin token on a non-existent Cloudinary asset
  - debug/test cleanup verification:
    - `node -c routes/contactFormsDesign.js`
    - `node -c routes/wishlists-id.js`
    - `node -c routes/index.js`
    - `node -c app.js`
    - `GET /api/contact-form-design/:id/details/debug` -> `404`
    - `GET /api/wishlists-id/test` -> `404`
    - `GET /api/products/test/:slug` -> `404`
    - `GET /test-categories` -> `404`
    - `GET /test-gemini-chatbot` -> `404`
  - `node -c routes/variants.js`
  - broader temporary-app L0/L1 regression rerun:
    - `44/44` checks passed
    - public reads stayed green:
      - `GET /api/products/all` -> `200`
      - `GET /api/products/:slug` -> `200`
      - `GET /api/materials` -> `200`
      - `GET /api/typeNotify` -> `200`
      - `GET /api/chat` -> `200`
      - `GET /api/attribute/:categoryId/attributes` -> `200`
      - `GET /api/categories` -> `200`
      - `GET /api/banners` -> `200`
    - protected/admin reads stayed closed without auth and healthy with admin auth:
      - `GET /api/products/admin` -> `401` without token, `200` with admin token
      - `GET /api/products/admin/:slug` -> `401` without token, `200` with admin token
      - `GET /api/comments/admin` -> `401` without token, `200` with admin token
      - `GET /api/notify/admin` -> `401` without token, `200` with admin token
      - `GET /api/orders/count` -> `401` without token, `200` with admin token
      - `GET /api/users/admin/:id` -> `401` without token, `200` with admin token
    - protected mutation spot-checks stayed closed without auth and fell through to validation/business responses with admin auth:
      - `POST /api/products/add` -> `401` without token, `400` with admin token and empty payload
      - `POST /api/variants/:productId` -> `401` without token, `400` with admin token and empty payload
      - `PUT /api/variants/:variantId` -> `401` without token, `400` with admin token and empty payload
      - `POST /api/materials` -> `401` without token, `400` with admin token and empty payload
      - `POST /api/typeNotify` -> `401` without token, `400` with admin token and empty payload
      - `PUT /api/comments/:comment_id/status` -> `401` without token, `404` with admin token on a non-existent id
      - `PUT /api/chat/context` -> `401` without token, `400` with admin token and empty payload
      - `POST /api/attribute/:categoryId` -> `401` without token, `400` with admin token and empty payload
      - `POST /api/upload/category` -> `401` without token, `400` with admin token and no file
      - `DELETE /api/upload/:publicId(*)` -> `401` without token, `404` with admin token on a non-existent Cloudinary asset
  - Day 2 local reconciliation snapshot after stock repair:
    - commerce row counts remain empty: `orders=0`, `payments=0`, `order_items=0`, `order_returns=0`, `return_items=0`
    - baseline reference counts: `couponcode=3`, `user_has_coupon=0`, `product=27`, `variant_product=47`, `product_attribute_value=0`, `materials=14`, `notification_types=3`
    - integrity checks returned `0` for:
      - `orders_missing_user`
      - `orders_missing_payment`
      - `orders_missing_coupon`
      - `order_items_missing_order`
      - `order_items_missing_variant`
      - `returns_missing_order`
      - `returns_missing_user`
      - `return_items_missing_return`
      - `return_items_missing_order_item`
      - `user_has_coupon_missing_user`
      - `user_has_coupon_missing_coupon`
      - `coupon_invalid_counters`
      - `products_missing_category`
      - `variants_missing_product`
      - `variants_missing_color`
      - `product_attribute_missing_product`
      - `product_attribute_missing_attribute`
      - `product_attribute_missing_material`
      - `soft_deleted_materials_in_use`
    - repaired deterministic stock drift:
      - `product_id=131` (`modena-2-5-cho`) synced from `product_stock=48` to `variant_stock=19`
      - post-repair `product_stock_mismatch` -> `0`
  - future stock consistency hardening:
    - `routes/variants.js` now syncs `product.product_stock` after variant create/update/delete
    - `POST /api/products/add` now initializes `product_stock` from the submitted variant quantities
  - controlled local commerce seed + reconciliation closeout:
    - seeded repeatable local commerce data directly in PostgreSQL using `S16-SEED-*` identifiers:
      - `4` orders
      - `4` payments
      - `4` order_items
      - `1` order_return
      - `1` return_item
      - `1` coupon usage row in `user_has_coupon`
    - seeded order mix:
      - `S16SEED0001` -> completed order with coupon `WELCOME10` plus approved return row
      - `S16SEED0002` -> completed order without coupon
      - `S16SEED0003` -> shipping order
      - `S16SEED0004` -> pending order
    - fixed the remaining commerce regression surfaced by seeded verification:
      - `GET /api/orders/admin` returned `500` on PostgreSQL because `or_latest.*` columns were not grouped
      - `routes/orders.js` was patched so the legacy admin order list now returns `200`
    - post-seed Day 2 snapshot:
      - row counts: `orders=4`, `payments=4`, `order_items=4`, `order_returns=1`, `return_items=1`, `couponcode=3`, `user_has_coupon=1`, `product=27`, `variant_product=47`, `product_attribute_value=0`, `materials=14`, `notification_types=3`
      - integrity checks returned `0` for:
        - `orders_missing_user`
        - `orders_missing_payment`
        - `orders_missing_coupon`
        - `order_items_missing_order`
        - `order_items_missing_variant`
        - `returns_missing_order`
        - `returns_missing_user`
        - `return_items_missing_return`
        - `return_items_missing_order_item`
        - `user_has_coupon_missing_user`
        - `user_has_coupon_missing_coupon`
        - `coupon_invalid_counters`
        - `products_missing_category`
        - `variants_missing_product`
        - `variants_missing_color`
        - `product_attribute_missing_product`
        - `product_attribute_missing_attribute`
        - `product_attribute_missing_material`
        - `soft_deleted_materials_in_use`
        - `product_stock_mismatch`
      - coupon counters after seeding:
        - `WELCOME10` -> `couponcode_used=1`
        - `SUMMER20` -> `couponcode_used=0`
        - `SONASPACE50` -> `couponcode_used=0`
      - stock sanity for seeded products stayed aligned:
        - `product_id=131` -> `product_stock=18`, `variant_stock=18`
        - `product_id=132` -> `product_stock=134`, `variant_stock=134`
        - `product_id=133` -> `product_stock=78`, `variant_stock=78`
  - seeded commerce regression verification:
    - auth gate remained correct:
      - `GET /api/orders/count` -> `401` without token, `200` with admin token
      - `GET /api/revenue/stats` -> `401` without token, `200` with admin token
    - admin/business reads now return seeded data correctly:
      - `GET /api/orders?limit=10&page=1` -> `200`, pagination `totalOrders=4`
      - `GET /api/orders/admin` -> `200`, legacy admin list returns `4` orders after the PostgreSQL `GROUP BY` fix
      - `GET /api/orders/hash/S16SEED0001` -> `200`, coupon/payment/product detail returned correctly
      - `GET /api/orders/complete/S16SEED0001` -> `200`
      - `GET /api/orders-id/3` -> `200`, `order_count=4`
      - `GET /api/orders-id/items/1` -> `200`, seeded return item surfaces as `RETURN_REQUESTED`
      - `GET /api/orders/status/count` -> `200`, counts now match the seeded mix:
        - `PENDING=1`
        - `SHIPPING=1`
        - `SUCCESS=2`
        - `CONFIRMED=0`
        - `DELIVERED=0`
        - `CANCELLED=0`
    - revenue verification:
      - `GET /api/revenue/stats` -> `200`
      - expected stats returned:
        - `totalOrder=4`
        - `completedOrder=2`
        - `shippingOrder=1`
        - `revenueThisMonth.total=38300000`
        - `revenueTotal.total=38300000`
      - `GET /api/revenue?type=day&from=2026-06-24&to=2026-06-25` -> `200`
      - daily series returned:
        - `2026-06-24` -> `17600000`
        - `2026-06-25` -> `20700000`
  - local performance sanity check:
    - 5-request smoke sample stayed within low double-digit latency on the local machine:
      - `GET /api/products/all` -> avg `15.35ms`, p95 `48.01ms`
      - `GET /api/categories/` -> avg `4.31ms`, p95 `5.07ms`
      - `GET /api/orders/count` -> avg `7.12ms`, p95 `9.10ms`
      - `GET /api/orders/admin` -> avg `7.68ms`, p95 `9.29ms`
      - `GET /api/revenue/stats` -> avg `8.93ms`, p95 `10.88ms`
  - Day 3 / Day 4 readiness artifact review:
    - `README.md` is now consistent with PostgreSQL-only runtime guidance and Docker/PostgreSQL startup flow
    - `docs/quy-trinh-thuc-thi-migration-va-sua-loi-backend.md` already contains the rollback/cutover runbook, phase gates, and PostgreSQL-only DoD
    - incident/readiness checklist was reviewed against the current local evidence, and no new blocker-level gaps were found beyond the already-queued Sprint 17 full-route QA expansion
    - Go/No-Go recommendation:
      - `GO` for advancing into Sprint 17 full-route QA/QC and any real staging drill using this Sprint 16 baseline
      - `NO-GO` for claiming a production cutover from local evidence alone; real staging deploy/rollback execution remains an environment task outside this local sprint artifact
- Findings:
  - Immediate admin/dashboard mutation hardening queue is now closed for the audited Sprint 16 route set.
  - The debug/test cleanup queue identified for `contactFormsDesign.js`, `products.js`, `wishlists-id.js`, and app-level test pages is now closed.
  - The route-contract portion of Sprint 16 is now locally clean enough to stop spending time on endpoint hardening and shift to the broader Sprint 17 route QA/QC backlog.
  - The former Day 2 data blocker is now closed: seeded commerce data, coupon counters, revenue stats, return flow, and stock reconciliation are all locally reproducible and internally consistent.
  - The only new runtime regression discovered during seeded verification was `GET /api/orders/admin`, and that PostgreSQL `GROUP BY` defect is now fixed in `routes/orders.js`.
  - `attributes.js` is now schema-safe for the current PostgreSQL contract, but `value_type`, `unit`, and `is_required` remain compatibility-only response fields rather than persisted schema columns.
- Next action:
  - Start Sprint 17 from this locked Sprint 16 baseline, then execute the full route QA/QC matrix and any real staging deploy/rollback drill in the target environment.

#### Route contract gap audit details

The remaining Sprint 16 risk is no longer mainly MySQL/PostgreSQL query syntax.

The main unresolved risk is route-contract drift:

- admin or mutation endpoints that are still publicly accessible;
- legacy duplicate admin endpoints that are still used by dashboard views;
- debug/test endpoints that should be removed, protected, or explicitly accepted as operational exceptions.

Audit totals:

| Type | Count |
|---|---:|
| Route files audited in detail | 8 |
| Immediate hardening endpoints | 29 |
| Debug/test endpoints needing remove/protect decision | 5 |
| Duplicate admin/legacy surfaces needing consolidation decision | 2 route families |

Immediate hardening queue:

| File | Endpoints | Current state | Caller evidence | Recommended action |
|---|---|---|---|---|
| `routes/products.js` | `GET /api/products/admin`, `GET /api/products/admin/:slug`, `POST /api/products/add`, `PUT /api/products/:id`, `PUT /api/products/admin/:slug`, `DELETE /api/products/:slug` | Protected on `2026-06-25` in hardening batch 1 | `views/dashboard/products/products.ejs`, `views/dashboard/products/edit.ejs`, `views/dashboard/products/add.ejs` | Keep protected; include in regression sweep and decide post-Sprint-16 consolidation |
| `routes/variants.js` | `POST /api/variants/:productId`, `PUT /api/variants/:variantId`, `DELETE /api/variants/:variantId` | Protected on `2026-06-25` in hardening batch 1 | `views/dashboard/products/edit.ejs` | Keep protected; include in regression sweep and decide post-Sprint-16 consolidation |
| `routes/materials.js` | `POST /api/materials`, `PUT /api/materials/:slug`, `PUT /api/materials/:slug/toggle-status`, `DELETE /api/materials/:slug` | Protected on `2026-06-25` in hardening batch 2 | `views/dashboard/material/*.ejs` and dashboard forms that fetch materials | Keep protected; include in regression sweep |
| `routes/typenotify.js` | `POST /api/typeNotify`, `PUT /api/typeNotify/:id/status`, `PUT /api/typeNotify/:id`, `DELETE /api/typeNotify/:id` | Protected on `2026-06-25` in hardening batch 2 | `views/dashboard/typeNotify/*.ejs` | Keep protected; include in regression sweep |
| `routes/comments.js` | `GET /api/comments/admin`, `PUT /api/comments/:comment_id/status`, `PUT /api/comments/:id/toggle-status` | Protected on `2026-06-25` in hardening batch 3 | `views/dashboard/comment/comment.ejs` | Keep protected; include in regression sweep |
| `routes/chat.js` | `PUT /api/chat/context` | Protected on `2026-06-25` in hardening batch 3 | `views/dashboard/context/context.ejs` | Keep protected; include in regression sweep |
| `routes/attributes.js` | `POST /api/attribute/:categoryId` | Protected on `2026-06-25` in hardening batch 3 | `views/dashboard/products/add.ejs`, `views/dashboard/products/edit.ejs` | Keep protected; monitor compatibility-only attribute metadata contract |
| `routes/upload.js` | `POST /api/upload/category`, `POST /api/upload/room`, `POST /api/upload/product`, `DELETE /api/upload/:publicId(*)`, `POST /api/upload/news`, `POST /api/upload/newscategorynews`, `POST /api/upload/event` | Protected on `2026-06-25` in hardening batch 3 | multiple dashboard pages under `views/dashboard/*` | Keep protected; include in regression sweep |

Duplicate/legacy route families:

- `products.js`
  - canonical protected path already exists: `POST /api/products`
  - legacy dashboard paths still active:
    - `GET /api/products/admin`
    - `GET /api/products/admin/:slug`
    - `POST /api/products/add`
    - `PUT /api/products/:id`
    - `PUT /api/products/admin/:slug`
    - `DELETE /api/products/:slug`
  - Sprint 16 action: protect all active admin/dashboard endpoints immediately.
  - Post-Sprint 16 action: choose one canonical admin write surface and deprecate the others.

- `variants.js`
  - protected canonical create path already exists: `POST /api/variants`
  - legacy dashboard write paths still active:
    - `POST /api/variants/:productId`
    - `PUT /api/variants/:variantId`
    - `DELETE /api/variants/:variantId`
  - Sprint 16 action: protect the active legacy dashboard endpoints immediately.
  - Post-Sprint 16 action: decide whether dashboard should keep the `:productId` route or move entirely to the canonical create/update/delete surface.

Debug/test/legacy decision queue:

| File | Endpoint | Current state | Recommendation |
|---|---|---|---|
| `routes/contactFormsDesign.js` | `GET /api/contact-form-design/:id/details/debug` | Disabled on `2026-06-25` | Keep disabled outside explicit local debugging |
| `routes/products.js` | `GET /api/products/test/:slug` | Disabled on `2026-06-25` | Keep disabled outside explicit local debugging |
| `routes/wishlists-id.js` | `GET /api/wishlists-id/test` | Disabled on `2026-06-25` | Keep disabled outside explicit local debugging |
| `routes/index.js` / `app.js` | `/test-categories`, `/test-chatbot`, `/test-gemini-chatbot` | Disabled on `2026-06-25` | Keep disabled outside explicit local debugging |

Deliberate exceptions reviewed:

- `POST /api/banners/pages`: public read-by-pageTypes helper despite being a `POST`.
- `POST /api/orders/payment/momo`: public commerce/payment entry point, not obviously an admin surface.
- public read routes in `products`, `rooms`, `events`, `news`, `categories`, `materials`, `variants`, `color` that are used by customer-facing flows.

Sprint 16 exit impact:

1. all immediate hardening endpoints above should be protected correctly;
2. debug/test routes should be removed or explicitly protected;
3. L0 should be rerun;
4. a targeted auth regression sweep should be executed for the hardened route set;
5. only then should Day 2 reconciliation and Day 3 readiness artifacts be treated as trustworthy.
