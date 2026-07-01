# Sprint 11 - Content Events PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: content migration
- Prepared date: 2026-05-10
- Suggested duration: 4-5 working days
- Current status: Done / Sprint 12 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-10-content-newscategories-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 10 content module is complete (`routes/newsCategories.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/events.js` to PostgreSQL contract and prepare handoff for remaining analytics/notify modules.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 116 |
| `routes/events.js` findings | 22 |
| `routes/revenue.js` findings | 22 |

## 4. Scope

- Migrate `routes/events.js` queries to PostgreSQL placeholders and result shapes.
- Replace MySQL driver API (`db.execute`) and MySQL-style result contracts.
- Keep response payload compatibility for frontend integration.

## 5. Out of Scope

- Full migration of `routes/revenue.js`, `routes/materials.js`, `routes/notify.js`, `routes/typenotify.js` in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for `routes/events.js`.
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate read/list/detail endpoints in `routes/events.js`.
- [x] Validate pagination/filter SQL.

### Day 3 - Write/Mutate Slice Migration

- [x] Migrate create/update/delete event endpoints.
- [x] Convert result contracts (`insertId`, `affectedRows`) to `RETURNING`, `rowCount`.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 12 target.

## 7. Definition of Done

- [x] `routes/events.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S11-B001 | Content | `routes/events.js` still has 22 findings at kickoff | High | TBD | Closed |

## 9. Exit Evidence (2026-05-10)

- Commands:
  - `node -c routes/events.js`
  - `node -e "require('./app'); console.log('APP_OK')"`
  - `npm run check:mysql-patterns`
- Result summary:
  - `routes/events.js`: `22 -> 0` findings.
  - Global guard: `116 -> 94` findings.
  - App smoke: `APP_OK`.
