# Sprint 5 - Social Comments PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: social/core review migration
- Prepared date: 2026-05-09
- Suggested duration: 4-5 working days
- Current status: Done / Sprint 6 active
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-04-catalog-products-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 4 products module is complete (`routes/products.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/comments.js` to PostgreSQL contract and prepare handoff for remaining social/content modules.

## 3. Baseline Metrics (2026-05-09)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 352 |
| `routes/comments.js` findings | 56 |
| `routes/news.js` findings | 45 |

## 4. Scope

- Migrate `routes/comments.js` endpoints from MySQL patterns to PostgreSQL query contract.
- Replace `?` placeholders with `$1..$n`.
- Replace mysql2 result destructuring with `{ rows, rowCount }`.
- Replace MySQL transaction API (`db.getConnection`, `beginTransaction`) with `withTransaction`.
- Align comment-product relations with current schema contract (`comment.order_item_id` path).

## 5. Out of Scope

- Full migration of `routes/news.js`, `routes/contactFormsDesign.js`, and other modules in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Endpoint Inventory

- [x] Re-run guard and capture `comments.js` baseline.
- [x] Inventory all read/write endpoints in `routes/comments.js`.

Evidence:

- Baseline snapshot:
  - Total findings: `352`
  - `routes/comments.js`: `56`
  - `routes/news.js`: `45`
- Inventory: `routes/comments.js` contains 10 endpoints (`6` read, `4` write/mutate).

### Day 2 - Read Endpoints Migration

- [x] Migrate comments read/list/detail endpoints.
- [x] Validate pagination/search SQL under PostgreSQL syntax.

Evidence:

- Migrated read endpoints:
  - `GET /api/comments`
  - `GET /api/comments/admin`
  - `GET /api/comments/:id`
  - `GET /api/comments/product/:productId`
  - `GET /api/comments/user/:userId`
- Converted to PostgreSQL placeholders and `{ rows }` contract.
- Aligned product mapping via schema path `comment -> order_items -> variant_product -> product`.

### Day 3 - Write + Transaction Flows

- [x] Migrate create/update/delete/comment-status flows.
- [x] Replace transaction API with `withTransaction`.

Evidence:

- Migrated write endpoints:
  - `POST /api/comments`
  - `PUT /api/comments/:id`
  - `DELETE /api/comments/:id`
  - `PUT /api/comments/:comment_id/status`
  - `PUT /api/comments/:id/toggle-status`
- Replaced legacy transaction flow with `withTransaction` for comment create flow.
- Removed MySQL APIs/patterns from module (`db.getConnection`, `beginTransaction`, `insertId`, `?` placeholders).

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and capture final deltas.
- [x] Update tracker/sprint docs and propose Sprint 6 target.

Evidence:

- Validation:
  - `node -c routes/comments.js` -> pass.
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
  - Guard delta: total findings `352 -> 296`; `routes/comments.js` findings `56 -> 0`.

Recommendation:

1. `routes/news.js` (`45` findings)
2. `routes/contactFormsDesign.js` (`44` findings)
3. `routes/wishlists.js` (`41` findings)

## 7. Definition of Done

- [x] `routes/comments.js` has 0 MySQL guard findings.
- [x] All comment write flows use PostgreSQL transaction/query contracts.
- [x] App smoke import passes after module migration.
- [x] Sprint doc and migration tracker are updated with evidence.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S5-B001 | Social | `routes/comments.js` hotspot resolved; guard for module reached 0 | High | TBD | Closed |
