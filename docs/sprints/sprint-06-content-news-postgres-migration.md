# Sprint 6 - Content News PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: content migration
- Prepared date: 2026-05-10
- Suggested duration: 4-5 working days
- Current status: Done / Sprint 7 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-05-social-comments-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 5 comments module is complete (`routes/comments.js` has 0 findings).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate `routes/news.js` to PostgreSQL contract and prepare handoff for remaining content modules.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 296 |
| `routes/news.js` findings | 45 |
| `routes/contactFormsDesign.js` findings | 44 |

## 4. Scope

- Migrate `routes/news.js` queries to PostgreSQL placeholders and result shapes.
- Replace mysql2 destructuring, `?` placeholders, and MySQL-specific SQL patterns.
- Keep response payload compatibility for frontend integration.

## 5. Out of Scope

- Full migration of `routes/contactFormsDesign.js`, `routes/newsCategories.js`, `routes/events.js` in this sprint.
- Production cutover.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for `routes/news.js`.
- [x] Inventory read/write endpoints and SQL hotspots.

### Day 2 - Read Slice Migration

- [x] Migrate read endpoints in `routes/news.js`.
- [x] Validate pagination/filter SQL.

### Day 3 - Write/Mutate Slice Migration

- [x] Migrate create/update/delete news endpoints.
- [x] Convert transaction/result contracts if needed.

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 7 target.

## 7. Definition of Done

- [x] `routes/news.js` has 0 MySQL guard findings.
- [x] App smoke import passes after module migration.
- [x] Sprint docs/tracker include evidence and blockers.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S6-B001 | Content | `routes/news.js` still has 45 findings at kickoff | High | TBD | Closed |

## 9. Exit Evidence (2026-05-10)

- Commands:
  - `node -c routes/news.js`
  - `node -e "require('./app'); console.log('APP_OK')"`
  - `npm run check:mysql-patterns`
- Result summary:
  - `routes/news.js`: `45 -> 0` findings.
  - Global guard: `296 -> 251` findings.
  - App smoke: `APP_OK`.
