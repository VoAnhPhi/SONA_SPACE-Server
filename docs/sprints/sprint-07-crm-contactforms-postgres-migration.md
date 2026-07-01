# Sprint 7 - CRM Contact Forms PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: CRM migration
- Prepared date: 2026-05-10
- Suggested duration: 4-5 working days
- Current status: Done / Sprint 8 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-06-content-news-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 6 content-news module is complete (`routes/news.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/contactFormsDesign.js` to PostgreSQL contract and prepare handoff for remaining CRM/social modules.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 251 |
| `routes/contactFormsDesign.js` findings | 44 |
| `routes/wishlists.js` findings | 41 |

## 4. Scope

- Migrate `routes/contactFormsDesign.js` queries to PostgreSQL placeholders and result shapes.
- Replace mysql2 destructuring, `?` placeholders, and MySQL-specific SQL patterns (`SHOW COLUMNS`, `LIMIT ?, ?`, `insertId`, `affectedRows`).
- Keep response payload compatibility for frontend integration.

## 5. Out of Scope

- Full migration of `routes/wishlists.js`, `routes/wishlists-id.js`, `routes/newsCategories.js`, `routes/events.js` in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for `routes/contactFormsDesign.js`.
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate read/list/detail endpoints in `routes/contactFormsDesign.js`.
- [x] Validate pagination/filter SQL.

### Day 3 - Write/Mutate Slice Migration

- [x] Migrate create/update/delete contact forms endpoints.
- [x] Convert result contracts (`insertId`/`affectedRows`) to `RETURNING`/`rowCount`.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 8 target.

## 7. Definition of Done

- [x] `routes/contactFormsDesign.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S7-B001 | CRM | `routes/contactFormsDesign.js` still has 44 findings at kickoff | High | TBD | Closed |

## 9. Exit Evidence (2026-05-10)

- Commands:
  - `node -c routes/contactFormsDesign.js`
  - `node -e "require('./app'); console.log('APP_OK')"`
  - `npm run check:mysql-patterns`
- Result summary:
  - `routes/contactFormsDesign.js`: `44 -> 0` findings.
  - Global guard: `251 -> 207` findings.
  - App smoke: `APP_OK`.
