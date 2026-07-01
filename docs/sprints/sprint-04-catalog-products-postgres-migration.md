# Sprint 4 - Catalog Products PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: catalog core migration
- Prepared date: 2026-05-09
- Suggested duration: 5 working days
- Current status: Done / Sprint 5 active
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-03-orders-core-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 3 orders core is complete (`routes/orders.js` has 0 findings).
- [x] PostgreSQL contract and column mapping are already documented.
- [x] Transaction helper `db/transaction.js` is available.

## 2. Sprint Goal

Migrate `routes/products.js` to PostgreSQL query contract as Sprint 4 priority module, then prepare handoff to remaining catalog/social modules.

## 3. Baseline Metrics (2026-05-09)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 472 |
| `routes/products.js` findings | 120 |
| `routes/comments.js` findings | 56 |

## 4. Scope

- Migrate `routes/products.js` endpoints from MySQL query patterns to PostgreSQL contract.
- Replace `?` placeholders with `$1..$n`.
- Replace MySQL-only SQL syntax (`IFNULL`, `JSON_ARRAYAGG`, MySQL LIMIT style) with PostgreSQL equivalents.
- Remove mysql2 result destructuring and use `{ rows, rowCount }`.
- Align product-related comment aggregation with PostgreSQL schema (`comment -> order_items -> variant_product -> product`).
- Keep response payload compatibility where frontend depends on current field names.

## 5. Out of Scope

- Full migration of all catalog modules (`variants.js`, `categories.js`, `rooms.js`, `color.js`, `materials.js`) in this sprint.
- Full migration of social/content modules.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + First Read Slice

- [x] Run guard baseline and confirm Sprint 4 target counts.
- [x] Migrate first `products.js` read endpoint slice.
- [x] Validate syntax and app smoke.

Evidence:

- Migrated endpoints in this pass:
  - `GET /api/products/all`
  - `GET /api/products/`
  - `GET /api/products/search`
  - `GET /api/products/admin`
  - `GET /api/products/related/by-room/:productId`
  - `GET /api/products/newest`
  - `GET /api/products/variants`
- Validation:
  - `node -c routes/products.js` -> pass.
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
  - Guard snapshot: total findings `478 -> 472`; `routes/products.js` findings `126 -> 120` in this pass.

### Day 2 - Batch Query Slices (`full-list-all`, `ai-catalog`)

- [x] Convert dynamic IN-clause and batch queries to PostgreSQL placeholders/result shapes.
- [x] Remove remaining MySQL array destructuring in these slices.

Evidence:

- Migrated endpoint/query slices:
  - `GET /api/products/full-list-all`
  - `GET /api/products/ai-catalog`
- Converted:
  - Dynamic `IN (?, ?, ...)` to `= ANY($1::int[])`
  - mysql2 array destructuring to `{ rows }`
  - `color.color_hex` to `color.color_code AS color_hex` (response compatibility)
  - Comment aggregation to PostgreSQL schema join path (`comment -> order_items -> variant_product -> product`)
- Validation:
  - `node -c routes/products.js` -> pass.
  - Guard snapshot: total findings `472 -> 453`; `routes/products.js` findings `120 -> 101`.

### Day 3 - Product Detail Reads (`/:slug`, `/test/:slug`, related helpers)

- [x] Migrate product detail endpoints and dependent queries.
- [x] Validate response compatibility for frontend-facing fields.

Evidence:

- Migrated endpoints:
  - `GET /api/products/test/:slug`
  - `GET /api/products/:slug`
- Converted:
  - `?` placeholders to `$1..$n`
  - mysql2 array destructuring to `{ rows }`
  - `color.color_hex` to `color.color_code AS color_hex`
  - Added `await` for product view update query in `/test/:slug`
- Validation:
  - `node -c routes/products.js` -> pass.
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
  - Guard snapshot after this pass: total findings `453 -> 436`; `routes/products.js` findings `101 -> 84`.

Additional cleanup in this phase:

- Migrated supporting endpoints:
  - `GET /api/products/featured/list`
  - `GET /api/products/by-category/:categoryId`
  - `PUT /api/products/status/:id`
- Validation:
  - Guard snapshot after this cleanup: total findings `436 -> 426`; `routes/products.js` findings `84 -> 74`.

### Day 4 - Product Write/Mutate Flows

- [x] Replace legacy `db.getConnection` transaction usage with PostgreSQL transaction helper.
- [x] Replace MySQL result contracts (`insertId`, `affectedRows`) in create/update/delete flows.

Progress:

- Migrated write endpoints:
  - `POST /api/products/`
  - `PUT /api/products/:id`
- Converted:
  - mysql2 array destructuring to `{ rows }`
  - `?` placeholders to `$1..$n`
  - `insertId` flow to `RETURNING product_id`
  - dynamic bulk insert placeholders to PostgreSQL `$n` sequences
- Validation:
  - `node -c routes/products.js` -> pass.
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
  - Guard snapshot after this pass: total findings `426 -> 414`; `routes/products.js` findings `74 -> 62`.

- Additional write migration:
  - `DELETE /api/products/:slug` migrated from MySQL `db.getConnection/beginTransaction/commit/rollback` to `withTransaction`.
  - Converted dynamic variant/order/wishlist deletion checks to PostgreSQL placeholders (`ANY($1::int[])`).
  - Updated comment delete path to PostgreSQL schema contract via `order_item_id` relation.
- Validation:
  - Guard snapshot after this migration: total findings `414 -> 395`; `routes/products.js` findings `62 -> 43`.

- Final write completion:
  - Migrated `POST /api/products/add`, `PUT /api/products/admin/:slug`, and `GET /api/products/admin/:slug`.
  - Completed replacement of remaining MySQL patterns in `routes/products.js` (`db.getConnection`, transaction APIs, `VALUES ?`, `?` placeholders, mysql2 result destructuring).
- Validation:
  - Guard snapshot after completion: total findings `395 -> 352`; `routes/products.js` findings `43 -> 0`.
  - `node -c routes/products.js` -> pass.
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.

### Day 5 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record latest count.
- [x] Update tracker module statuses and blockers.
- [x] Propose next Sprint 4 follow-up target by guard impact.

Recommendation:

1. `routes/comments.js` (`56` findings)
2. `routes/news.js` (`45` findings)
3. `routes/contactFormsDesign.js` (`44` findings)

## 7. Definition of Done

- [x] `routes/products.js` has 0 MySQL guard findings.
- [x] All product write flows use PostgreSQL-safe transaction/query contracts.
- [x] App smoke import passes after full module migration.
- [x] Sprint doc and migration tracker are updated with evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S4-B001 | Catalog | `routes/products.js` hotspot resolved; guard for module reached 0 | High | TBD | Closed |
