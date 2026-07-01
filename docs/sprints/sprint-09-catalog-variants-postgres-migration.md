# Sprint 9 - Catalog Variants PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: catalog migration
- Prepared date: 2026-05-10
- Suggested duration: 4-5 working days
- Current status: Done / Sprint 10 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-08-social-wishlists-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 8 social module is complete (`routes/wishlists.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/variants.js` to PostgreSQL contract and prepare handoff for remaining catalog/content modules.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 166 |
| `routes/variants.js` findings | 27 |
| `routes/newsCategories.js` findings | 23 |

## 4. Scope

- Migrate `routes/variants.js` queries to PostgreSQL placeholders and result shapes.
- Replace mysql2 destructuring, `?` placeholders, and result-contract patterns (`insertId`).
- Keep response payload compatibility for frontend integration.

## 5. Out of Scope

- Full migration of `routes/newsCategories.js`, `routes/events.js`, `routes/revenue.js`, `routes/materials.js` in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for `routes/variants.js`.
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate read/list/detail endpoints in `routes/variants.js`.
- [x] Validate pagination/filter SQL.

### Day 3 - Write/Mutate Slice Migration

- [x] Migrate create/update/delete variant endpoints.
- [x] Convert result contracts (`insertId`) to `RETURNING`.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 10 target.

## 7. Definition of Done

- [x] `routes/variants.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S9-B001 | Catalog | `routes/variants.js` still has 27 findings at kickoff | High | TBD | Closed |

## 9. Exit Evidence (2026-05-10)

- Commands:
  - `node -c routes/variants.js`
  - `node -e "require('./app'); console.log('APP_OK')"`
  - `npm run check:mysql-patterns`
- Result summary:
  - `routes/variants.js`: `27 -> 0` findings.
  - Global guard: `166 -> 139` findings.
  - App smoke: `APP_OK`.
