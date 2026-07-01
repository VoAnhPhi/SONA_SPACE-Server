# Sprint 8 - Social Wishlists PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: social migration
- Prepared date: 2026-05-10
- Suggested duration: 4-5 working days
- Current status: Done / Sprint 9 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-07-crm-contactforms-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 7 CRM module is complete (`routes/contactFormsDesign.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/wishlists.js` to PostgreSQL contract and prepare handoff for the remaining social/content modules.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 207 |
| `routes/wishlists.js` findings | 41 |
| `routes/variants.js` findings | 27 |

## 4. Scope

- Migrate `routes/wishlists.js` queries to PostgreSQL placeholders and result shapes.
- Replace mysql2 destructuring, `?` placeholders, and MySQL JSON SQL patterns (`JSON_ARRAYAGG`, `JSON_OBJECT`, `insertId`).
- Keep response payload compatibility for frontend integration.

## 5. Out of Scope

- Full migration of `routes/wishlists-id.js`, `routes/newsCategories.js`, `routes/events.js`, `routes/variants.js` in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for `routes/wishlists.js`.
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate read/list/detail endpoints in `routes/wishlists.js`.
- [x] Replace MySQL JSON aggregation with PostgreSQL JSON builders.

### Day 3 - Write/Mutate Slice Migration

- [x] Migrate create/update/delete wishlist endpoints.
- [x] Convert result contracts (`insertId`) to `RETURNING`.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 9 target.

## 7. Definition of Done

- [x] `routes/wishlists.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S8-B001 | Social | `routes/wishlists.js` still has 41 findings at kickoff | High | TBD | Closed |

## 9. Exit Evidence (2026-05-10)

- Commands:
  - `node -c routes/wishlists.js`
  - `node -e "require('./app'); console.log('APP_OK')"`
  - `npm run check:mysql-patterns`
- Result summary:
  - `routes/wishlists.js`: `41 -> 0` findings.
  - Global guard: `207 -> 166` findings.
  - App smoke: `APP_OK`.
