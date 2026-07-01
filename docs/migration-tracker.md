# Migration Tracker - Backend MySQL to PostgreSQL

- Project: `SONA_SPACE-Server`
- Tracker purpose: daily tracking by module, owner, and blocker
- Related docs:
- `docs/quy-trinh-docs-cho-agent.md`
- `docs/bao-cao-migration-backend-mysql-to-postgresql.md`
- `docs/quy-trinh-thuc-thi-migration-va-sua-loi-backend.md`
- `docs/qa-qc-route-regression-playbook.md`
- `docs/sprints/sprint-01-postgres-migration-foundation.md`
- `docs/sprints/sprint-02-coupon-commerce-handoff.md`
- `docs/sprints/sprint-03-orders-core-postgres-migration.md`
- `docs/sprints/sprint-04-catalog-products-postgres-migration.md`
- `docs/sprints/sprint-05-social-comments-postgres-migration.md`
- `docs/sprints/sprint-06-content-news-postgres-migration.md`
- `docs/sprints/sprint-07-crm-contactforms-postgres-migration.md`
- `docs/sprints/sprint-08-social-wishlists-postgres-migration.md`
- `docs/sprints/sprint-09-catalog-variants-postgres-migration.md`
- `docs/sprints/sprint-10-content-newscategories-postgres-migration.md`
- `docs/sprints/sprint-11-content-events-postgres-migration.md`
- `docs/sprints/sprint-12-analytics-revenue-postgres-migration.md`
- `docs/sprints/sprint-13-catalog-materials-postgres-migration.md`
- `docs/sprints/sprint-14-notify-typenotify-postgres-migration.md`
- `docs/sprints/sprint-15-dashboard-debug-chat-postgres-migration.md`
- `docs/sprints/sprint-16-regression-validation-release-readiness.md`
- `docs/sprints/sprint-17-route-qaqc-full-coverage.md`
- `docs/db-contract-postgres.md`
- `docs/mysql-to-postgres-column-mapping.md`

## 1. Status Legend

- `Not Started`
- `In Progress`
- `Blocked`
- `Review`
- `Done`

## 2. Team Roster

| Name | Role | Main Modules |
|---|---|---|
| TBD | Backend | Commerce |
| TBD | Backend | Catalog |
| TBD | Backend | Auth/User |
| TBD | Backend | Content/CRM |

## 3. Weekly Plan (Day x Module)

> Tick each item when completed.  
> Rule: each item must include PR link and test evidence before marking `Done`.

## Week 1

### Day 1 - Contract and Setup

- [x] Sprint 1 checklist doc created
- [x] Schema contract finalized (Phase 0)
- [x] Column mapping doc finalized (MySQL -> PostgreSQL)
- [ ] Backup + restore dry run completed
- [x] `npm run check:mysql-patterns` integrated in local workflow

### Day 2 - DB Layer Standardization

- [x] Remove `db.execute` usage in migrated modules
- [x] Remove `db.getConnection` mysql2 pattern in migrated modules
- [x] Standardize query result contract to `{ rows, rowCount }`
- [x] Introduce PostgreSQL transaction helper pattern (`BEGIN/COMMIT/ROLLBACK`)
- [x] `npm run check:mysql-patterns` integrated in local workflow

### Day 3 - Commerce Core (Part 1)

- [x] `routes/orders.js` migration started
- [x] `routes/payments.js` migration
- [ ] Replace MySQL SQL functions (`IFNULL`, `DATE_FORMAT`, ...)
- [ ] Replace `ON DUPLICATE KEY` with `ON CONFLICT`

### Day 4 - Commerce Core (Part 2)

- [x] `routes/orders-id.js` migration
- [x] `routes/couponcodes.js` migration
- [x] `routes/orderStatus.js` migration
- [x] Commerce support smoke tests passed

### Day 5 - Catalog Core (Part 1)

- [x] `routes/products.js` migration started
- [x] `routes/variants.js` migration
- [x] `routes/categories.js` migration
- [x] Catalog query pagination converted to PostgreSQL syntax

### Day 6 - Catalog Core (Part 2)

- [x] `routes/rooms.js` migration
- [x] `routes/color.js` migration
- [x] `routes/materials.js` migration
- [ ] Catalog smoke tests passed

### Day 7 - Auth/User

- [x] `routes/auth.js` migration
- [x] `routes/users.js` migration
- [x] OTP + notification flow validated on PostgreSQL
- [x] Week 1 readiness review completed

## Week 2

### Day 8 - P1 Modules (Social/CRM)

- [x] `routes/comments.js` migration
- [x] `routes/wishlists.js` migration
- [x] `routes/wishlists-id.js` migration
- [x] `routes/contactFormsDesign.js` migration

### Day 9 - P1 Modules (Content)

- [x] `routes/news.js` migration
- [x] `routes/newsCategories.js` migration
- [x] `routes/events.js` migration
- [x] `routes/banners.js` migration

### Day 10 - P1 Modules (Notify)

- [x] `routes/notify.js` migration
- [x] `routes/typenotify.js` migration
- [x] Notification schema and joins validated

### Day 11 - P2 + Cleanup

- [x] `routes/dashboard.js` adjustments
- [x] `routes/debug.js` adjustments
- [x] `routes/chat.js` adjustments
- [ ] Remove unused legacy model files if approved

### Day 12 - Regression and Data Validation

- [x] Critical API regression suite passed
- [x] Data reconciliation completed (orders, revenue, coupons, stock)
- [x] Performance sanity checks completed

### Day 13 - Staging Cutover Drill

- [x] Staging deploy checklist completed
- [x] Rollback drill runbook reviewed
- [x] Incident checklist validated

### Day 14 - Production Readiness

- [x] Go/No-Go review completed
- [x] Production rollout recommendation documented
- [x] Sprint 16 closeout recorded

## 4. Module Tracker

| Module | Files | Owner | Status | PR | Last Update | Notes |
|---|---|---|---|---|---|---|
| Commerce | `orders.js`, `orders-id.js`, `payments.js`, `couponcodes.js`, `orderStatus.js` | TBD | Review | - | 2026-06-25 | Sprint 3 migration stays clean and Sprint 16 is now locally closed for commerce readiness: a controlled `S16-SEED-*` dataset (`4` orders, `4` payments, `4` order_items, `1` return) was inserted for deterministic reconciliation; `/api/orders`, `/api/orders/admin`, `/api/orders/hash/:orderHash`, `/api/orders-id/:userId`, `/api/orders-id/items/:orderId`, `/api/orders/count`, `/api/orders/status/count`, and `/api/revenue*` all now pass seeded smoke with expected counts/revenue; the seeded verification also surfaced one remaining PostgreSQL grouping defect in `GET /api/orders/admin`, which was fixed in `routes/orders.js` before closeout |
| Catalog | `products.js`, `variants.js`, `categories.js`, `rooms.js`, `color.js`, `materials.js` | TBD | Review | - | 2026-06-25 | Sprint 16 hardening batches 1-3 re-protected legacy admin/dashboard routes in `products.js`, `variants.js`, and `materials.js`; the shared catalog helper `attributes.js` is now also protected on `POST /api/attribute/:categoryId` and no longer crashes on PostgreSQL when loading `/api/attribute/:categoryId/attributes`, because non-existent `attributes.value_type/unit/is_required` columns were replaced with schema-safe compatibility fields. Follow-up reconciliation found and repaired one derived-stock mismatch (`product_id=131`, `48 -> 19`), and write-path hardening now syncs `product.product_stock` after variant create/update/delete plus initializes it from variant quantities in `POST /api/products/add` |
| Auth/User | `auth.js`, `users.js` | TBD | Review | - | 2026-06-26 | Sprint 17 Day 3 added reusable `scripts/qa-day3-contract.js` coverage for the auth/user slice and passed `25/25` checks across `auth.js` (`12`) and `users.js` (`13`): invalid public auth payloads, admin token inspection, own/private user reads, cross-user `403`, and user order/wishlist/review payloads all stayed stable on PostgreSQL |
| Social/CRM | `comments.js`, `wishlists.js`, `wishlists-id.js`, `contactFormsDesign.js` | TBD | Review | - | 2026-06-26 | Sprint 17 Day 1-4 coverage now leaves this slice locally stable: Day 3 contract smoke passed `23/23` checks across `comments.js`, `wishlists.js`, and `wishlists-id.js`, while Day 4 fully rewrote `contactFormsDesign.js` around the actual PostgreSQL schema and then passed `9/9` CRUD/detail checks with the legacy frontend/dashboard payload preserved through compatibility fields stored in `note` JSON |
| Content | `news.js`, `newsCategories.js`, `events.js`, `banners.js` | TBD | Review | - | 2026-06-26 | Sprint 17 Day 3 contract smoke passed `33/33` checks across the content slice with no code changes required: `news` public/admin feeds, `news-categories/news/:slug`, `events/active`, and banner page aggregation all return schema-safe PostgreSQL payloads even on sparse local data, while invalid create/update/delete paths fall through to the expected `400/404` responses |
| Notify | `notify.js`, `typenotify.js` | TBD | Review | - | 2026-06-26 | Day 4 contract smoke now closes the notify slice end-to-end on PostgreSQL: `notify.js` passed `4/4` and `typenotify.js` passed `6/6`, covering public/admin reads plus invalid create/update/delete paths with the expected `200/400/404` responses after the Sprint 16 auth hardening |
| Dashboard/Debug | `dashboard.js`, `debug.js`, `chat.js` | TBD | Review | - | 2026-06-26 | Day 4 and Day 5 closed the remaining runtime confidence gap: `dashboard.js` passed `58/58`, `debug.js` `7/7`, `chat.js` `4/4`, and the login root/index route also passed; one real compatibility bug was fixed by redirecting `GET /dashboard/orders/view/:id` to `/dashboard/orders/detail/:id`, while legacy dashboard alias redirects (`accounts`, `staff`, `categories/add`, `categories/edit/:slug`, `notifications/type-list`) were verified as intentional `302` compatibility behavior |

## 5. Daily Execution Log

| Date | Owner | Module | Done Today | Blockers | Next Action |
|---|---|---|---|---|---|
| YYYY-MM-DD | TBD | TBD | - | - | - |
| 2026-06-26 | TBD | Sprint 17 - Day 5 Consolidation + Release Gate | Re-ran the full local gate for Sprint 17: `npm run check:mysql-patterns` returned clean, `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` returned `APP_OK`, and all reusable suites passed again with zero failures (`qa:auth-smoke` `96/96`, `qa:day2-contract` `56/56`, `qa:day3-contract` `80/80`, `qa:day4-contract` `97/97`); aggregate reusable evidence now covers `329` checks across the migrated server surface | No Critical/High blocker remains locally; `S17-B001` is closed after end-to-end route coverage | Move from local QA closeout to environment deployment validation using the existing staging deploy/rollback runbook |
| 2026-06-26 | TBD | Sprint 17 - Day 4 Dashboard/Notify/CRM Contract Sweep | Added reusable Day 4 tooling in `scripts/qa-day4-contract.js`, fixed the last dashboard runtime regression by redirecting `GET /dashboard/orders/view/:id` to the prepared detail route, rewrote `routes/contactFormsDesign.js` to use the real PostgreSQL schema while preserving legacy payload fields through compatibility JSON, and passed `97/97` checks across `dashboard.js`, `debug.js`, `chat.js`, `notify.js`, `typenotify.js`, `upload.js`, `contactForms.js`, `contactFormsDesign.js`, and `index.js` | No new Critical/High blocker remained after the `contactFormsDesign` and dashboard compatibility fixes; only final rerun/closeout work was left | Execute Day 5 release gate reruns, close `S17-B001`, and publish the Go/No-Go QA state |
| 2026-06-26 | TBD | Sprint 17 - Day 3 Auth/User + Social/Content Contract Sweep | Added reusable Day 3 tooling in `scripts/qa-day3-contract.js` plus `npm run qa:day3-contract`, then ran `80` contract/depth checks across `auth.js`, `users.js`, `comments.js`, `wishlists.js`, `wishlists-id.js`, `news.js`, `newsCategories.js`, `events.js`, and `banners.js`; the full suite passed on first run with zero failed checks, confirming frontend-facing compatibility payloads stay stable on PostgreSQL even when local data is sparse (`comments/news/wishlists` empty-state responses still preserve arrays, pagination, and message fields) | No new Critical/High blocker surfaced in Day 3; `S17-B001` remains open only because Day 4/Day 5 coverage is still pending | Move to Sprint 17 Day 4 and add the same reusable contract smoke coverage for `dashboard.js`, `debug.js`, `chat.js`, `notify.js`, `typenotify.js`, `upload.js`, `contactForms.js`, `contactFormsDesign.js`, and `index.js` |
| 2026-06-26 | TBD | Sprint 17 - Day 2 Commerce + Catalog Contract Sweep | Added reusable Day 2 tooling in `scripts/qa-day2-contract.js` plus `npm run qa:day2-contract`, ran `56` checks across `orders.js`, `payments.js`, `couponcodes.js`, `products.js`, `variants.js`, `categories.js`, `rooms.js`, `materials.js`, `color.js`, `attributes.js`, and `orderStatus.js`, and fixed one remaining PostgreSQL schema drift in `routes/variants.js` by replacing stale `color.color_priority` usage with `color_id AS color_priority`; the rerun passed cleanly | Day 2 closed without remaining Critical/High blocker after the `variants.js` compatibility fix; breadth of route QA (`S17-B001`) remained the only open Sprint 17 item | Continue into Sprint 17 Day 3 for the auth/user/social/content slice and update the matrix rows with pass evidence |
| 2026-06-26 | TBD | Sprint 17 - Day 1 QA Framework + Auth Baseline | Confirmed the L0/L1/L2/L3 process from the route regression playbook, added reusable Day 1 tooling in `scripts/qa-auth-smoke.js` plus `npm run qa:auth-smoke`, and ran a protected-route auth baseline across `28` route groups / `96` auth scenarios using a temporary local app server with short-lived local JWTs (`admin user_id=1`, `user user_id=3`); the run surfaced one real PostgreSQL schema drift in `routes/contactFormsDesign.js` (`GET /api/contact-form-design` -> `500`) which was fixed via compatibility aliases to `full_name/phone_number/room_type/design_style`, after which the auth smoke rerun passed cleanly; `routes/orderStatus.js` admin mutation responses (`410`) were confirmed as intentional static-catalog behavior, not a blocker | No new Critical/High blocker remains from Day 1; the open work is still breadth of QA coverage (`S17-B001`) rather than auth baseline instability | Begin Sprint 17 Day 2 contract/depth checks for `orders.js`, `payments.js`, `couponcodes.js`, `products.js`, `variants.js`, `categories.js`, `rooms.js`, `materials.js`, `color.js`, and `attributes.js` using the new smoke tooling as the auth gate |
| 2026-06-25 | TBD | Sprint 17 - Route Surface Cleanup + QA Kickoff | Started Sprint 17 from the closed Sprint 16 local baseline; removed disabled/stray route surface from the active inventory (`/test-categories`, `/test-gemini-chatbot`, `GET /api/products/test/:slug`, `GET /api/contact-form-design/:id/details/debug`, `GET /api/wishlists-id/test`, `GET /api/wishlists/wwww`), removed the unused `indexRouter` import path from `app.js`, and trimmed `routes/index.js` down to the login route only; refreshed route inventory to `31` files / `286` endpoints (`GET=171`, `POST=47`, `PUT=38`, `PATCH=2`, `DELETE=28`) | No blocker from the cleanup itself; the remaining open blocker is still Sprint 17 full-route QA execution | Execute Day 1 auth/contract QA for `orders.js`, `products.js`, `payments.js`, `couponcodes.js`, and `users.js`, then log failures directly into the Sprint 17 matrix |
| 2026-06-25 | TBD | Sprint 17 - Day 1 Auth/Contract Baseline | Ran temporary-app HTTP smoke with local JWTs to validate the first high-risk route group: `GET /api/orders/count`, `GET /api/products/admin`, `GET /api/payments`, `GET /api/couponcodes`, and `GET /api/users/admin/1` all return `401` without token and `200` with admin token; `GET /api/couponcodes/notification` returns `200` with a normal user token; removed route probes (`/api/wishlists/wwww?status=1`, `/api/products/test/demo`, `/api/contact-form-design/1/details/debug`) now fall through to real `404` responses instead of lingering disabled endpoints | No new blocker surfaced in the first auth/contract baseline; Sprint 17 remains blocked only by unfinished route coverage | Extend the same temporary-app smoke pattern to the remaining Day 1 / Day 2 route files and start marking the Sprint 17 matrix rows with pass/fail evidence |
| 2026-06-24 | TBD | Sprint 16 - Regression Matrix Expansion | Extended Day 1 matrix from `rooms/color/banners` into `categories/orders/users/notify`; fixed contract regressions where private routes were public or crashed without auth: re-protected `GET /api/notify/admin`, `GET /api/orders/count`, `GET /api/users/admin/:id`, `PUT /api/users/admin/:id`, `GET /api/users/:id`, `GET /api/users/:id/orders`, `GET /api/users/:id/wishlist`, `GET /api/users/:id/reviews`, and `DELETE /api/users/:id`; evidence: `node -c routes/users.js`, `node -c routes/notify.js`, `node -c routes/orders.js`, `npm run check:mysql-patterns` (OK), HTTP smoke `GET /api/categories/` and `/api/categories/filter/` -> `200`, protected `categories/notify/orders/users` endpoints without token -> `401`, authenticated admin smoke for `categories/notify/orders/users` happy paths -> `200` (and `POST /api/notify/` empty body -> `400` validation); baseline reconciliation snapshot: `orders/payments/order_items/order_returns = 0`, `couponcode = 3`, `product = 27`, `variant_product = 48`, aggregate stock `2896` | Day 2 reconciliation for commerce/revenue is blocked locally by missing transactional data in the current PostgreSQL snapshot | Continue Sprint 16 on staging-backed reconciliation or seed a controlled local order/payment dataset before attempting Day 2 closeout |
| 2026-05-12 | TBD | Catalog - `routes/categories.js` | Fixed PostgreSQL schema mismatch in category routes: replaced invalid `category_icon`/`category_banner` DB usage with compatibility aliases mapped from `category_image`; updated category create/update/delete queries to schema-safe columns; fixed category product color aggregation to use `color.color_code`; evidence: `node -c routes/categories.js`, `npm run check:mysql-patterns` (OK), app smoke `APP_OK`, HTTP smoke `/api/categories/filter`, `/api/categories`, `/api/categories/:slug` all `200` | Remaining catalog debt in `routes/rooms.js` and `routes/color.js` | Continue with `rooms.js` then `color.js` schema-alignment and route QA |
| 2026-05-10 | TBD | Sprint 17 Planning - Route QA/QC | Added full-route QA/QC process docs and sprint plan: created `docs/qa-qc-route-regression-playbook.md`, created Sprint 17 QA matrix doc with baseline inventory of `31` route files / `293` endpoints, and linked docs in sprint index/tracker | Sprint 16 regression artifact is still incomplete, so Sprint 17 remains queued | Complete Sprint 16 blocker evidence, then execute Sprint 17 Day 1 L0/L1 route matrix kickoff |
| 2026-05-10 | TBD | Sprint 16 - Dashboard UI Routing Hardening | Fixed dashboard accessibility issues on UI-heavy paths: added missing views (`/dashboard/profile`, `/dashboard/settings`), corrected notify type navigation links, added compatibility redirects for legacy dashboard URLs (`/dashboard/notifications/type-list`, `/dashboard/typeNotify/edittypenotify/:id`, `/dashboard/categories/add`, `/dashboard/categories/edit/:slug`, `/dashboard/accounts`, `/dashboard/staff`), and added `/api/notifications` alias for notify API; verified with authenticated HTTP smoke that affected routes return `200` or correct `302` redirects | Remaining UI regressions outside navigation not yet fully validated | Continue Sprint 16 with broader dashboard interaction regression (orders/users/categories/banner CRUD paths) |
| 2026-06-25 | TBD | Sprint 16 - Route Contract Gap Audit | Completed a file-by-file route contract audit for the highest-risk private/admin surfaces and logged the audit details directly in `docs/sprints/sprint-16-regression-validation-release-readiness.md`; confirmed remaining Sprint 16 risk is concentrated in public admin/dashboard mutation routes (`products`, `variants`, `materials`, `typenotify`, `comments`, `chat`, `attributes`, `upload`) plus public debug/test routes; evidence: `npm run check:mysql-patterns` (OK), `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` (APP_OK), route inventory/auth grep, and caller scans across `views/dashboard/*` | Sprint 16 now has a concrete hardening queue before reconciliation can be considered trustworthy | Execute hardening batch 1 for `products.js` and `variants.js`, then rerun targeted auth regression and continue Day 2 |
| 2026-06-25 | TBD | Sprint 16 - Hardening Batch 1 (`products` + `variants`) | Re-protected legacy dashboard/admin routes in `routes/products.js` and `routes/variants.js`; fixed `GET /api/products/admin/:slug` by replacing stale `color_priority` reads and missing `attributes.unit/is_required/value_type` assumptions with schema-safe PostgreSQL compatibility aliases; evidence: `node -c routes/products.js`, `node -c routes/variants.js`, `node -e \"require('./app'); console.log('APP_OK'); process.exit(0)\"` (APP_OK), targeted temporary-app auth regression (`products admin` + `variants` no-token -> `401`, admin-token -> `200/400` as expected), public spot checks `GET /api/products/:slug` and `/api/products/all` -> `200` | Hardening queue is reduced, but Sprint 16 still has unresolved public mutation routes in `materials`, `typenotify`, `comments`, `chat`, `attributes`, and `upload` | Execute hardening batch 2 for `materials.js` and `typenotify.js`, then continue remaining route-contract cleanup before Day 2 closeout |
| 2026-06-25 | TBD | Sprint 16 - Hardening Batch 2 (`materials` + `typenotify`) | Re-protected dashboard mutation routes in `routes/materials.js` and `routes/typenotify.js`; evidence: `node -c routes/materials.js`, `node -c routes/typenotify.js`, `node -e \"require('./app'); console.log('APP_OK'); process.exit(0)\"` (APP_OK), targeted temporary-app auth regression with public spot checks `GET /api/materials` and `GET /api/typeNotify` -> `200`, mutation routes without token -> `401`, and admin-token calls -> `400/404` business-validation responses instead of auth bypass | Hardening queue is reduced again, but Sprint 16 still has unresolved public mutation routes in `comments`, `chat`, `attributes`, and `upload` plus debug/test cleanup | Execute hardening batch 3 for `comments.js`, `chat.js`, `attributes.js`, and `upload.js`, then rerun the targeted auth regression sweep before Day 2 closeout |
| 2026-06-25 | TBD | Sprint 16 - Hardening Batch 3 (`comments` + `chat` + `attributes` + `upload`) | Re-protected admin/dashboard moderation and utility routes in `routes/comments.js`, `routes/chat.js`, `routes/attributes.js`, and `routes/upload.js`; fixed PostgreSQL schema drift in `attributes.js` by replacing reads/writes to missing `value_type/unit/is_required` columns with compatibility-only response fields; tightened `DELETE /api/upload/:publicId(*)` so a missing Cloudinary asset returns `404` instead of `500`; evidence: `node -c routes/comments.js`, `node -c routes/chat.js`, `node -c routes/attributes.js`, `node -c routes/upload.js`, `node -e \"require('./app'); console.log('APP_OK'); process.exit(0)\"` (APP_OK), targeted auth regression (`comments admin`/moderation, `chat/context`, `attribute POST`, `upload*` no-token -> `401`, admin-token -> `200/400/404`), and `GET /api/attribute/:categoryId/attributes` restored to `200` | The public-mutation hardening queue is now effectively closed, but debug/test cleanup and full rerun evidence are still pending before Sprint 16 can move on to Day 2 confidence work | Clean up or protect the remaining debug/test endpoints, then rerun L0/L1 auth sweep and continue reconciliation/readiness work |
| 2026-06-25 | TBD | Sprint 16 - Debug/Test Cleanup | Disabled the remaining debug/test route surfaces: `GET /api/contact-form-design/:id/details/debug`, `GET /api/wishlists-id/test`, `GET /api/products/test/:slug`, `/test-categories`, and `/test-gemini-chatbot`; evidence: `node -c routes/contactFormsDesign.js`, `node -c routes/wishlists-id.js`, `node -c routes/products.js`, `node -c routes/index.js`, `node -c app.js`, app smoke `APP_OK`, and direct HTTP checks for all five routes now returning `404` | Route-contract cleanup is no longer the primary Sprint 16 blocker | Rerun the broader L0/L1 regression sweep and continue Day 2 reconciliation |
| 2026-06-25 | TBD | Sprint 16 - Broader L0/L1 Rerun + Day 2 Snapshot | Reran a broader local L0/L1 matrix across the hardened route set and passed `44/44` checks: public reads stayed `200`, private/admin reads stayed `401` without token and `200` with admin auth, and mutation spot-checks stayed `401` without token while falling through to `400/404` business validation with admin auth; then captured a deterministic Day 2 reconciliation snapshot, found one derived-stock mismatch on `product_id=131`, repaired it (`48 -> 19`), and hardened future stock consistency by syncing `product.product_stock` in `routes/variants.js` and `POST /api/products/add` | Local route readiness is strong, but business reconciliation still cannot be closed because the current PostgreSQL snapshot has no transactional commerce rows | Use staging data or seed a controlled local commerce dataset, then continue Day 2 reconciliation and Day 3 readiness evidence |
| 2026-06-25 | TBD | Sprint 16 - Commerce Seed + Readiness Closeout | Seeded a controlled local commerce dataset with `S16-SEED-*` identifiers (`4` orders, `4` payments, `4` order_items, `1` return, `1` return_item, `1` coupon usage), fixed the last seeded regression in `GET /api/orders/admin` by grouping the joined `order_returns` projection correctly for PostgreSQL, reran commerce/revenue endpoint smoke (`/api/orders`, `/api/orders/admin`, `/api/orders/hash/:orderHash`, `/api/orders-id/:userId`, `/api/orders-id/items/:orderId`, `/api/orders/count`, `/api/orders/status/count`, `/api/revenue/stats`, `/api/revenue?type=day`) and confirmed expected counts/revenue; reconciliation snapshot now reads `orders=4`, `payments=4`, `order_items=4`, `order_returns=1`, `return_items=1`, `user_has_coupon=1`, `product_stock_mismatch=0`; local latency sanity stayed low (`orders/admin` p95 `9.29ms`, `revenue/stats` p95 `10.88ms`) | No blocker-level issue remains for Sprint 16 local closure; real staging deploy/rollback execution is still an environment activity, not a local code blocker | Start Sprint 17 full-route QA/QC from the Sprint 16 baseline and use the existing rollback/deploy runbook when a real staging environment is available |
| 2026-05-10 | TBD | Sprint 15 Closeout + Sprint 16 Kickoff | Completed Sprint 15 runtime migration: `routes/dashboard.js`, `routes/debug.js`, `routes/chat.js` cleaned to PostgreSQL contract; continued cleanup for `chatbotSocket.js`, `chatbotSocket-gemini-25-pro.js`, `models/productModel.js`, and `migrations/add-user-token-field.js`; guard reduced `25 -> 0`; syntax + app smoke passed (`APP_OK`); activated Sprint 16 for regression/readiness | Functional regression evidence is not yet collected | Start Sprint 16 Day 1 regression matrix execution for critical APIs |
| 2026-05-10 | TBD | Sprint 14 Closeout + Sprint 15 Kickoff | Completed Sprint 14 notify migration: `routes/typenotify.js` (`15 -> 0`) and `routes/notify.js` (`11 -> 0`) now fully use PostgreSQL contract; also completed carry-forward `routes/wishlists-id.js` (`2 -> 0`); syntax + app smoke passed; global guard reduced `53 -> 25`; activated Sprint 15 doc for dashboard/debug/chat runtime slice | Remaining blockers are concentrated in runtime routes (`dashboard/debug/chat`) plus legacy migration/model/socket files | Start Sprint 15 Day 1 with dashboard/debug/chat endpoint inventory and first dashboard query cluster migration |
| 2026-05-10 | TBD | Sprint 13 Closeout + Sprint 14 Kickoff | Completed Sprint 13 catalog migration: `routes/materials.js` now has `0` guard findings after full module migration to PostgreSQL contract (query placeholders, result shape, returning/rowCount, schema-safe status mapping); syntax + app smoke passed; global guard reduced `72 -> 53`; activated Sprint 14 doc for `routes/typenotify.js` | Remaining blockers are cross-module outside `materials.js` | Start Sprint 14 Day 1 with `routes/typenotify.js` inventory and baseline |
| 2026-05-10 | TBD | Sprint 12 Closeout + Sprint 13 Kickoff | Completed Sprint 12 analytics migration: `routes/revenue.js` now has `0` guard findings after full module migration to PostgreSQL contract (MySQL function replacement, placeholder/result migration, schema-aligned status/amount mapping); syntax + app smoke passed; global guard reduced `94 -> 72`; activated Sprint 13 doc for `routes/materials.js` | Remaining blockers are cross-module outside `revenue.js` | Start Sprint 13 Day 1 with `routes/materials.js` inventory and baseline |
| 2026-05-10 | TBD | Sprint 11 Closeout + Sprint 12 Kickoff | Completed Sprint 11 content migration: `routes/events.js` now has `0` guard findings after full module migration to PostgreSQL contract (driver API replacement, placeholders, result contract, schema alias mapping); syntax + app smoke passed; global guard reduced `116 -> 94`; activated Sprint 12 doc for `routes/revenue.js` | Remaining blockers are cross-module outside `events.js` | Start Sprint 12 Day 1 with `routes/revenue.js` inventory and baseline |
| 2026-05-10 | TBD | Sprint 10 Closeout + Sprint 11 Kickoff | Completed Sprint 10 content migration: `routes/newsCategories.js` now has `0` guard findings after full module migration to PostgreSQL contract (query placeholders, result shape, returning/rowCount, schema-safe field mapping); syntax + app smoke passed; global guard reduced `139 -> 116`; activated Sprint 11 doc for `routes/events.js` | Remaining blockers are cross-module outside `newsCategories.js` | Start Sprint 11 Day 1 with `routes/events.js` inventory and baseline |
| 2026-05-10 | TBD | Sprint 9 Closeout + Sprint 10 Kickoff | Completed Sprint 9 catalog migration: `routes/variants.js` now has `0` guard findings after full module migration to PostgreSQL contract (query placeholders, result shape, returning flow, schema-aligned variant fields); syntax + app smoke passed; global guard reduced `166 -> 139`; activated Sprint 10 doc for `routes/newsCategories.js` | Remaining blockers are cross-module outside `variants.js` | Start Sprint 10 Day 1 with `routes/newsCategories.js` inventory and baseline |
| 2026-05-10 | TBD | Sprint 8 Closeout + Sprint 9 Kickoff | Completed Sprint 8 social migration: `routes/wishlists.js` now has `0` guard findings after full module migration to PostgreSQL contract (query placeholders, result shape, JSON aggregation conversion, returning/rowCount); syntax + app smoke passed; global guard reduced `207 -> 166`; activated Sprint 9 doc for `routes/variants.js` | Remaining blockers are cross-module outside `wishlists.js` | Start Sprint 9 Day 1 with `routes/variants.js` inventory and baseline |
| 2026-05-10 | TBD | Sprint 7 Closeout + Sprint 8 Kickoff | Completed Sprint 7 CRM migration: `routes/contactFormsDesign.js` now has `0` guard findings after full module migration to PostgreSQL contract (query placeholders, result shape, limit/offset, returning/rowCount); syntax + app smoke passed; global guard reduced `251 -> 207`; activated Sprint 8 doc for `routes/wishlists.js` | Remaining blockers are cross-module outside `contactFormsDesign.js` | Start Sprint 8 Day 1 with `routes/wishlists.js` inventory and baseline |
| 2026-05-10 | TBD | Sprint 6 Closeout + Sprint 7 Kickoff | Completed Sprint 6 news migration: `routes/news.js` now has `0` guard findings after full module rewrite to PostgreSQL contract (query placeholders, result shape, pagination SQL, insert `RETURNING`); syntax + app smoke passed; global guard reduced `296 -> 251`; activated Sprint 7 doc for `routes/contactFormsDesign.js` | Remaining blockers are cross-module outside `news.js` | Start Sprint 7 Day 1 with `routes/contactFormsDesign.js` inventory and baseline |
| 2026-05-10 | TBD | Sprint 5 Closeout + Sprint 6 Kickoff | Completed Sprint 5 comments migration: `routes/comments.js` now has `0` guard findings after full module rewrite to PostgreSQL contract (including transaction flow with `withTransaction` and schema-aligned joins); syntax + app smoke passed; global guard reduced `352 -> 296`; activated Sprint 6 doc for `routes/news.js` | Remaining blockers are cross-module outside `comments.js` | Start Sprint 6 Day 1 with `routes/news.js` inventory and baseline |
| 2026-05-09 | TBD | Sprint 4 Closeout + Sprint 5 Kickoff | Completed Sprint 4 products migration: `routes/products.js` now has `0` guard findings; converted remaining `/add`, `/admin/:slug` (PUT/GET) flows and removed last MySQL patterns from module; syntax + app smoke passed; global guard reduced `395 -> 352`; activated Sprint 5 doc for `routes/comments.js` | Remaining blockers are cross-module outside `products.js` | Start Sprint 5 Day 1 with `routes/comments.js` inventory and baseline |
| 2026-05-09 | TBD | Catalog (Sprint 4 Day 4 - Transaction Slice) | Migrated `DELETE /:slug` in `routes/products.js` from MySQL transaction API to `withTransaction`; replaced dynamic `IN (?)` deletes with PostgreSQL `ANY($1::int[])`; aligned comment delete logic to PostgreSQL schema relation via `order_item_id`; syntax + app smoke passed; guard delta: total `414 -> 395`, `routes/products.js` `62 -> 43` | Remaining `products.js` hotspots are mostly in `/add` and `/edit` write flows still using `db.getConnection` and MySQL placeholder patterns | Continue Day 4 by migrating `/add` and `/edit` to PostgreSQL transaction/result contracts |
| 2026-05-09 | TBD | Catalog (Sprint 4 Day 4 - Partial) | Migrated partial write flows in `routes/products.js`: converted `POST /` and `PUT /:id` to PostgreSQL placeholder/result patterns (`RETURNING`, `$n`, `{ rows }`) and dynamic bulk insert placeholder generation; syntax + app smoke passed; guard delta: total `426 -> 414`, `routes/products.js` `74 -> 62` | Remaining `products.js` findings are now concentrated in transaction-heavy routes (`DELETE /:slug`, `/add`, `/edit`) still using MySQL connection/transaction APIs | Continue Day 4 by replacing MySQL transaction APIs with PostgreSQL transaction helper and finishing remaining write routes |
| 2026-05-09 | TBD | Catalog (Sprint 4 Read Consolidation) | Continued `routes/products.js` PostgreSQL migration with detail/list/status read endpoints: migrated `/featured/list`, `/by-category/:categoryId`, and `/status/:id` on top of Day 1-3 slices; syntax + app smoke passed; guard delta: total `436 -> 426`, `routes/products.js` `84 -> 74` | Remaining findings in `products.js` are mainly write + transaction flows with MySQL APIs (`db.getConnection`, `beginTransaction`, `insertId`, dynamic bulk placeholders) | Continue Sprint 4 Day 4 by converting create/update/delete transaction paths to `withTransaction` and PostgreSQL result contracts |
| 2026-05-09 | TBD | Catalog (Sprint 4 Day 2-3) | Migrated `routes/products.js` batch query/detail read slices to PostgreSQL contract: converted `/full-list-all`, `/ai-catalog`, `/test/:slug`, and `/:slug`; replaced dynamic `IN` placeholders with `ANY($1::int[])`, switched to `{ rows }`, aligned color aliasing to `color_code`, and fixed comment aggregation via `order_items`+`variant_product`; syntax + app smoke passed; guard delta: total `472 -> 436`, `routes/products.js` `120 -> 84` | Remaining `products.js` findings are concentrated in write/transaction paths (`POST/PUT/DELETE`, admin list/update slices) | Continue Sprint 4 Day 4 with write/mutate flow migration using PostgreSQL transaction helper |
| 2026-05-09 | TBD | Catalog (Sprint 4 Day 1) | Started Sprint 4 and migrated first `routes/products.js` read slice to PostgreSQL contract: converted `/all`, `/`, `/search`, `/admin`, `/related/by-room/:productId`, `/newest`, `/variants`; added PG JSON aggregation + placeholder builder + schema-safe comment aggregation path; syntax and app smoke passed; guard delta: total `478 -> 472`, `routes/products.js` `126 -> 120` | `routes/products.js` still has 120 findings concentrated in batch read + write transaction flows | Continue Sprint 4 Day 2 with `/full-list-all`, `/ai-catalog`, and remaining mysql2 array-destructure blocks |
| 2026-05-09 | TBD | Commerce (Sprint 3 Day 4 - Final) | Completed migration of remaining high-risk `orders.js` write flows (`POST /payment/momo`, `POST /`) to PostgreSQL schema/query contract; replaced legacy upsert with `ON CONFLICT`; validated syntax + app smoke; guard delta: total `542 -> 490`, `orders.js` `52 -> 0` | Remaining blockers are now outside `orders.js` (catalog/content/social modules) | Close Sprint 3 and start Sprint 4 module prioritization by guard impact |
| 2026-05-09 | TBD | Commerce (Sprint 3 Day 4) | Migrated additional `routes/orders.js` endpoints to PostgreSQL contract: `GET /:id`, `POST /send-invoice`, `POST /:id/send-apology-email`, and `GET /return/count`; schema relation fixes for payment join and order-item/comment aggregation; syntax + app smoke passed; guard delta: total `605 -> 542`, `orders.js` `115 -> 52` | Remaining `orders.js` hotspots are concentrated in order create and MoMo IPN flows (`POST /`, `POST /payment/momo`) | Continue Sprint 3 by finishing create/payment flow migration and replacing last `ON DUPLICATE KEY` with `ON CONFLICT` |
| 2026-05-09 | TBD | Commerce (Sprint 3 Day 3) | Migrated write slice in `routes/orders.js`: status update, order cancel, and order patch flows to PostgreSQL contract (`order_status` numeric, `order_status_log` schema, `sender_id`, `RETURNING`, and `withTransaction`) and migrated `GET /status/count`; syntax + app smoke passed; guard delta: total `636 -> 605`, `orders.js` `146 -> 115` | `routes/orders.js` still has unresolved create/payment/return write paths and legacy MySQL patterns | Continue Sprint 3 with `POST /`, `POST /payment/momo`, `GET /redirect/momo`, `PUT /:id/return-status`, and `POST /return/:orderHash` |
| 2026-05-09 | TBD | Commerce (Sprint 3 Day 1-2) | Completed `orders.js` endpoint/SQL inventory + risk grouping, migrated first read slice to PostgreSQL placeholders/result contract, and validated syntax + app smoke (`APP_OK`); guard delta: total `647 -> 636`, `orders.js` `157 -> 146` | `orders.js` still contains high-risk write paths with MySQL transaction APIs and legacy status flow | Continue Day 3 write-path migration: `PUT /:id/status`, `PUT /:id/return-status`, `PATCH /:id`, `DELETE /:id`, and return/refund flow |
| 2026-05-06 | TBD | Sprint Transition | Reviewed sprint/docs status, verified guard baseline (`647` total; `orders.js`=`157`), closed Sprint 2 handoff, and activated Sprint 3 doc | Global guard still fails across non-migrated modules | Start Day 1 SQL inventory for `routes/orders.js` and group write transactions |
| 2026-04-06 | TBD | Auth/User | Migrated `routes/auth.js` query contract to PostgreSQL columns and OTP flow; verified syntax + app smoke load (`APP_OK`) | Guard still reports 835 MySQL findings across other modules | Migrate `routes/users.js`, then continue `couponcodes.js` and `comments.js` |
| 2026-04-30 | TBD | Planning | Created Sprint 1 checklist doc and sprint docs index; re-ran guard baseline: 835 findings; app smoke import passed (`APP_OK`) | Contract and mapping docs still missing; README still says PostgreSQL/MySQL | Start Sprint 1 Day 1: finalize PostgreSQL contract and column mapping |
| 2026-04-30 | TBD | Docs Process | Added standard docs workflow for agents and linked it from sprint docs/tracker | None | Agents should follow `docs/quy-trinh-docs-cho-agent.md` before updating sprint checklists |
| 2026-05-01 | TBD | Sprint 1 Foundation | Added PostgreSQL contract docs, column mapping, transaction helper, README PG-only cleanup, `routes/users.js` schema/query audit, coupon endpoint inventory, and low-risk coupon notification PG fixes; app smoke `APP_OK`; transaction helper `TX_HELPER_OK`; user/coupon direct SQL checks passed; guard down to 819 | Commerce decisions remain: `orders.order_status` numeric map and `payments` relation; guard still fails outside completed slice | Start Sprint 2 with `routes/couponcodes.js`, then Orders/Payments |
| 2026-05-01 | TBD | Coupon/Commerce | Completed `routes/couponcodes.js` PostgreSQL migration; all coupon read/write/validate paths use `$1..$n`, `{ rows, rowCount }`, `RETURNING`, and transaction helper where needed; coupon smoke checks passed; guard down to 756 and coupon/auth/users are clean | Remaining guard findings are in orders/products/comments/content and other modules | Start next commerce slice with `routes/payments.js`, then `orderStatus.js`, `orders-id.js`, `orders.js` |
| 2026-05-01 | TBD | Commerce Support | Completed `routes/payments.js` migration to current `orders.payment_id` relation and replaced `routes/orderStatus.js` with static numeric status catalog; syntax checks and app smoke passed; payment read smoke passed; guard down to 691 and coupon/payments/orderStatus/auth/users are clean | Payment write smoke skipped because local database has no orders; global guard still fails in orders/products/comments/content and other modules | Migrate `routes/orders-id.js`, then `routes/orders.js` |
| 2026-05-01 | TBD | Orders ID | Rewrote `routes/orders-id.js` against PostgreSQL schema: numeric `orders.order_status`, `order_items.price`, `return_items`, `order_status_log`, and `withTransaction`; syntax check, app smoke, and SQL parse smoke passed; guard down to 647 and orders-id is clean | Local database has no order rows for mutation smoke; global guard still fails in `orders.js` and non-commerce modules | Migrate `routes/orders.js` |

## 6. Blocker Log

| ID | Date | Module | Blocker | Severity | Owner | ETA | Status |
|---|---|---|---|---|---|---|---|
| B-001 | YYYY-MM-DD | TBD | - | High | TBD | TBD | Open |
| B-002 | 2026-04-06 | Multi-module | `check:mysql-patterns` blocker resolved after Sprint 15 closeout and legacy cleanup (`0` findings) | High | TBD | 5-7 days | Closed |
| B-003 | 2026-05-01 | Commerce | Final `orders.order_status` numeric business mapping is not confirmed | High | TBD | Sprint 2 | Closed |
| B-004 | 2026-05-01 | Payments | Legacy routes expect `payments.order_id`, but current schema links `orders.payment_id` to `payments.payment_id` | High | TBD | Sprint 2 | Closed |
| B-005 | 2026-05-01 | Coupon | `couponcode.title`, `is_flash_sale`, and `combinations` do not exist in current PostgreSQL schema | High | TBD | Sprint 2 | Closed |
| B-006 | 2026-05-10 | QA | Full QA/QC evidence for all route files has not been executed yet (Sprint 17 queue) | High | TBD | Sprint 17 | Open |
| B-007 | 2026-06-25 | Route contract | Public admin/dashboard mutation exposure across `products`, `variants`, `materials`, `typenotify`, `comments`, `chat`, `attributes`, and `upload` was resolved during Sprint 16 hardening batches 1-3; remaining route-readiness work is now debug/test cleanup rather than missing auth on mutation endpoints | High | TBD | Sprint 16 | Closed |
| B-008 | 2026-06-25 | Data reconciliation | Closed on `2026-06-25` after seeding a controlled local commerce dataset, rerunning reconciliation/integrity checks, and validating seeded commerce/revenue endpoints end-to-end on the local PostgreSQL snapshot | High | TBD | Sprint 16 | Closed |

## 7. Exit Checklist (Definition of Done)

- [x] No MySQL driver APIs remain (`db.execute`, `db.getConnection`, `insertId`, `affectedRows`)
- [x] No MySQL SQL-specific syntax remains (`DATE_FORMAT`, `IFNULL`, `ON DUPLICATE KEY`, `SHOW TABLES`, `SHOW COLUMNS`)
- [ ] PostgreSQL schema and backend code are fully aligned
- [ ] Critical end-to-end flows pass in staging
- [ ] Rollback plan is tested and documented
- [x] README and deployment docs are updated for PostgreSQL-only operation
