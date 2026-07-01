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

- [ ] `routes/rooms.js` migration
- [ ] `routes/color.js` migration
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
- [ ] `routes/banners.js` migration

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

- [ ] Critical API regression suite passed
- [ ] Data reconciliation completed (orders, revenue, coupons, stock)
- [ ] Performance sanity checks completed

### Day 13 - Staging Cutover Drill

- [ ] Staging deploy passed
- [ ] Rollback drill passed
- [ ] Incident checklist validated

### Day 14 - Production Readiness

- [ ] Go/No-Go review completed
- [ ] Production rollout plan approved
- [ ] Final sign-off completed

## 4. Module Tracker

| Module | Files | Owner | Status | PR | Last Update | Notes |
|---|---|---|---|---|---|---|
| Commerce | `orders.js`, `orders-id.js`, `payments.js`, `couponcodes.js`, `orderStatus.js` | TBD | Review | - | 2026-05-09 | Sprint 3 commerce core completed: `orders.js` now uses PostgreSQL contract across read/write/payment/create flows (including `POST /payment/momo` and `POST /`), with guard dropped from `157` to `0`; `couponcodes.js`, `payments.js`, `orderStatus.js`, `orders-id.js` remain clean |
| Catalog | `products.js`, `variants.js`, `categories.js`, `rooms.js`, `color.js`, `materials.js` | TBD | In Progress | - | 2026-05-12 | Categories compatibility fix completed for PostgreSQL schema mismatch (`category_icon` and `category_banner`), route smoke for `/api/categories/filter`, `/api/categories`, and `/api/categories/:slug` passed locally; `rooms.js` and `color.js` remain pending |
| Auth/User | `auth.js`, `users.js` | TBD | Done | - | 2026-05-01 | `auth.js` and `users.js` have 0 guard findings; representative user SQL checks passed against PostgreSQL schema |
| Social/CRM | `comments.js`, `wishlists.js`, `wishlists-id.js`, `contactFormsDesign.js` | TBD | Done | - | 2026-05-10 | `comments.js`, `wishlists.js`, `wishlists-id.js`, and `contactFormsDesign.js` are all clean (0 guard findings) after PostgreSQL contract migration |
| Content | `news.js`, `newsCategories.js`, `events.js`, `banners.js` | TBD | In Progress | - | 2026-05-10 | Sprint 11 completed for `events.js`: module reached `0` findings after full PostgreSQL contract migration; `news.js` and `newsCategories.js` remain clean; follow-up content module `banners.js` remains pending |
| Notify | `notify.js`, `typenotify.js` | TBD | Done | - | 2026-05-10 | Sprint 14 completed: both notify routes migrated to PostgreSQL contract and reached 0 guard findings |
| Dashboard/Debug | `dashboard.js`, `debug.js`, `chat.js` | TBD | Done | - | 2026-05-10 | Sprint 15 completed: dashboard/debug/chat migrated to PostgreSQL contract and clean on guard |

## 5. Daily Execution Log

| Date | Owner | Module | Done Today | Blockers | Next Action |
|---|---|---|---|---|---|
| YYYY-MM-DD | TBD | TBD | - | - | - |
| 2026-05-12 | TBD | Catalog - `routes/categories.js` | Fixed PostgreSQL schema mismatch in category routes: replaced invalid `category_icon`/`category_banner` DB usage with compatibility aliases mapped from `category_image`; updated category create/update/delete queries to schema-safe columns; fixed category product color aggregation to use `color.color_code`; evidence: `node -c routes/categories.js`, `npm run check:mysql-patterns` (OK), app smoke `APP_OK`, HTTP smoke `/api/categories/filter`, `/api/categories`, `/api/categories/:slug` all `200` | Remaining catalog debt in `routes/rooms.js` and `routes/color.js` | Continue with `rooms.js` then `color.js` schema-alignment and route QA |
| 2026-05-10 | TBD | Sprint 17 Planning - Route QA/QC | Added full-route QA/QC process docs and sprint plan: created `docs/qa-qc-route-regression-playbook.md`, created Sprint 17 QA matrix doc with baseline inventory of `31` route files / `293` endpoints, and linked docs in sprint index/tracker | Sprint 16 regression artifact is still incomplete, so Sprint 17 remains queued | Complete Sprint 16 blocker evidence, then execute Sprint 17 Day 1 L0/L1 route matrix kickoff |
| 2026-05-10 | TBD | Sprint 16 - Dashboard UI Routing Hardening | Fixed dashboard accessibility issues on UI-heavy paths: added missing views (`/dashboard/profile`, `/dashboard/settings`), corrected notify type navigation links, added compatibility redirects for legacy dashboard URLs (`/dashboard/notifications/type-list`, `/dashboard/typeNotify/edittypenotify/:id`, `/dashboard/categories/add`, `/dashboard/categories/edit/:slug`, `/dashboard/accounts`, `/dashboard/staff`), and added `/api/notifications` alias for notify API; verified with authenticated HTTP smoke that affected routes return `200` or correct `302` redirects | Remaining UI regressions outside navigation not yet fully validated | Continue Sprint 16 with broader dashboard interaction regression (orders/users/categories/banner CRUD paths) |
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

## 7. Exit Checklist (Definition of Done)

- [x] No MySQL driver APIs remain (`db.execute`, `db.getConnection`, `insertId`, `affectedRows`)
- [x] No MySQL SQL-specific syntax remains (`DATE_FORMAT`, `IFNULL`, `ON DUPLICATE KEY`, `SHOW TABLES`, `SHOW COLUMNS`)
- [ ] PostgreSQL schema and backend code are fully aligned
- [ ] Critical end-to-end flows pass in staging
- [ ] Rollback plan is tested and documented
- [ ] README and deployment docs are updated for PostgreSQL-only operation
