# Sprint 12 - Analytics Revenue PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: analytics migration
- Prepared date: 2026-05-10
- Suggested duration: 4-5 working days
- Current status: Done / Sprint 13 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-11-content-events-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 11 content module is complete (`routes/events.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/revenue.js` to PostgreSQL contract and prepare handoff for remaining notify/catalog modules.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 94 |
| `routes/revenue.js` findings | 22 |
| `routes/materials.js` findings | 19 |

## 4. Scope

- Migrate `routes/revenue.js` queries to PostgreSQL placeholders and result shapes.
- Replace MySQL SQL functions (`DATE_FORMAT`, `IFNULL`, `CURDATE`) with PostgreSQL equivalents.
- Keep response payload compatibility for frontend integration.

## 5. Out of Scope

- Full migration of `routes/materials.js`, `routes/notify.js`, `routes/typenotify.js`, `routes/dashboard.js` in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for `routes/revenue.js`.
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate revenue query endpoints in `routes/revenue.js`.
- [x] Validate date-range/filter SQL in PostgreSQL.

### Day 3 - Cleanup + Contract Alignment

- [x] Replace remaining MySQL SQL functions and array destructuring.
- [x] Re-check response compatibility and numeric casting.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 13 target.

## 7. Definition of Done

- [x] `routes/revenue.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S12-B001 | Analytics | `routes/revenue.js` still has 22 findings at kickoff | High | TBD | Closed |

## 9. Exit Evidence (2026-05-10)

- Commands:
  - `node -c routes/revenue.js`
  - `node -e "require('./app'); console.log('APP_OK')"`
  - `npm run check:mysql-patterns`
- Result summary:
  - `routes/revenue.js`: `22 -> 0` findings.
  - Global guard: `94 -> 72` findings.
  - App smoke: `APP_OK`.
