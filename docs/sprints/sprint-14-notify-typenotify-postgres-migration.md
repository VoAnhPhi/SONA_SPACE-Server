# Sprint 14 - Notify Type PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: notify migration
- Prepared date: 2026-05-10
- Completed date: 2026-05-10
- Current status: Done / Sprint 15 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-13-catalog-materials-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 13 catalog module is complete (`routes/materials.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate notify domain routes to PostgreSQL contract (`routes/typenotify.js`, `routes/notify.js`) and remove MySQL driver/result-pattern usage.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 53 |
| `routes/typenotify.js` findings | 15 |
| `routes/notify.js` findings | 11 |

## 4. Scope

- Migrate `routes/typenotify.js` queries to PostgreSQL placeholders and result shapes.
- Migrate `routes/notify.js` queries/results (`insertId`, `affectedRows`, mysql2 array-destructure) to PostgreSQL contract.
- Keep response payload compatibility for frontend integration where schema allows.

## 5. Out of Scope

- Full migration of `routes/dashboard.js`, `routes/debug.js`, `routes/chat.js`.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for notify routes (`typenotify`, `notify`).
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate read/list/detail endpoints in `routes/typenotify.js`.
- [x] Migrate read/list endpoints in `routes/notify.js`.

### Day 3 - Write/Mutate Slice Migration

- [x] Migrate create/update/delete notify-type endpoints.
- [x] Convert result contracts (`insertId`, `affectedRows`) to `RETURNING`, `rowCount` for notify flows.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 15 target.

## 7. Definition of Done

- [x] `routes/typenotify.js` has 0 MySQL guard findings.
- [x] `routes/notify.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Exit Evidence

Commands executed:

```bash
node -c routes/typenotify.js
node -c routes/notify.js
npm run check:mysql-patterns
node -e "require('./app'); console.log('APP_OK')"
```

Observed results:

- `routes/typenotify.js`: `15 -> 0` findings.
- `routes/notify.js`: `11 -> 0` findings.
- Global guard: `53 -> 27` after notify sprint core, then `27 -> 25` after immediate carry-forward fix in `routes/wishlists-id.js`.
- App smoke: `APP_OK`.

## 9. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S14-B001 | Notify | `routes/typenotify.js` still has 15 findings at kickoff | High | TBD | Closed |
| S14-B002 | Notify | `routes/notify.js` has 11 findings at kickoff | High | TBD | Closed |
