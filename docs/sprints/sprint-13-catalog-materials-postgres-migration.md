# Sprint 13 - Catalog Materials PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: catalog migration
- Prepared date: 2026-05-10
- Suggested duration: 3-4 working days
- Current status: Done / Sprint 14 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-12-analytics-revenue-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 12 analytics module is complete (`routes/revenue.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/materials.js` to PostgreSQL contract and prepare handoff for remaining notify/debug modules.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 72 |
| `routes/materials.js` findings | 19 |
| `routes/typenotify.js` findings | 15 |

## 4. Scope

- Migrate `routes/materials.js` queries to PostgreSQL placeholders and result shapes.
- Replace mysql2 destructuring, `?` placeholders, and result-contract patterns (`insertId`, `affectedRows`).
- Keep response payload compatibility for frontend integration.

## 5. Out of Scope

- Full migration of `routes/typenotify.js`, `routes/notify.js`, `routes/dashboard.js`, `routes/debug.js`, `routes/chat.js` in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for `routes/materials.js`.
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate read/list/detail endpoints in `routes/materials.js`.
- [x] Validate pagination/filter SQL.

### Day 3 - Write/Mutate Slice Migration

- [x] Migrate create/update/delete material endpoints.
- [x] Convert result contracts (`insertId`, `affectedRows`) to `RETURNING`, `rowCount`.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 14 target.

## 7. Definition of Done

- [x] `routes/materials.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S13-B001 | Catalog | `routes/materials.js` still has 19 findings at kickoff | High | TBD | Closed |

## 9. Exit Evidence (2026-05-10)

- Commands:
  - `node -c routes/materials.js`
  - `node -e "require('./app'); console.log('APP_OK')"`
  - `npm run check:mysql-patterns`
- Result summary:
  - `routes/materials.js`: `19 -> 0` findings.
  - Global guard: `72 -> 53` findings.
  - App smoke: `APP_OK`.
