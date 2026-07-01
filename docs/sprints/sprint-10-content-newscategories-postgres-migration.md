# Sprint 10 - Content News Categories PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: content migration
- Prepared date: 2026-05-10
- Suggested duration: 4-5 working days
- Current status: Done / Sprint 11 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-09-catalog-variants-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 9 catalog module is complete (`routes/variants.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/newsCategories.js` to PostgreSQL contract and prepare handoff for remaining content/analytics modules.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 139 |
| `routes/newsCategories.js` findings | 23 |
| `routes/events.js` findings | 22 |

## 4. Scope

- Migrate `routes/newsCategories.js` queries to PostgreSQL placeholders and result shapes.
- Replace mysql2 destructuring, `?` placeholders, and result-contract patterns (`insertId`, `affectedRows`).
- Keep response payload compatibility for frontend integration.

## 5. Out of Scope

- Full migration of `routes/events.js`, `routes/revenue.js`, `routes/materials.js`, `routes/notify.js` in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for `routes/newsCategories.js`.
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate read/list/detail endpoints in `routes/newsCategories.js`.
- [x] Validate pagination/filter SQL.

### Day 3 - Write/Mutate Slice Migration

- [x] Migrate create/update/delete category endpoints.
- [x] Convert result contracts (`insertId`, `affectedRows`) to `RETURNING`, `rowCount`.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 11 target.

## 7. Definition of Done

- [x] `routes/newsCategories.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S10-B001 | Content | `routes/newsCategories.js` still has 23 findings at kickoff | High | TBD | Closed |

## 9. Exit Evidence (2026-05-10)

- Commands:
  - `node -c routes/newsCategories.js`
  - `node -e "require('./app'); console.log('APP_OK')"`
  - `npm run check:mysql-patterns`
- Result summary:
  - `routes/newsCategories.js`: `23 -> 0` findings.
  - Global guard: `139 -> 116` findings.
  - App smoke: `APP_OK`.
