# Sprint 15 - Dashboard Debug Chat PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: runtime stability migration
- Prepared date: 2026-05-10
- Completed date: 2026-05-10
- Current status: Done / Sprint 16 handoff complete
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-14-notify-typenotify-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] Sprint 14 notify routes are complete (`routes/typenotify.js`, `routes/notify.js` are clean).
- [x] PostgreSQL contract and transaction helper are available.

## 2. Sprint Goal

Migrate runtime-critical endpoints in `routes/dashboard.js`, `routes/debug.js`, and `routes/chat.js` to PostgreSQL contract.

## 3. Baseline Metrics (2026-05-10)

Baseline command:

```bash
npm run check:mysql-patterns
```

Result:

| Metric | Count |
|---|---:|
| Total findings | 25 |
| `routes/dashboard.js` findings | 10 |
| `routes/debug.js` findings | 3 |
| `routes/chat.js` findings | 4 |

## 4. Scope

- Replace mysql2 array-destructure patterns in dashboard/debug/chat routes.
- Replace `?` placeholders with `$1..$n` in affected dashboard queries.
- Replace MySQL result-shape usage (`insertId`) in chat route.
- Keep API response compatibility.

## 5. Out of Scope

- Legacy migration script cleanup (`migrations/add-user-token-field.js`).
- Legacy model/socket cleanup (`models/productModel.js`, `chatbotSocket*.js`).

## 6. Day-by-Day Checklist

### Day 1 - Kickoff + Inventory

- [x] Capture baseline for dashboard/debug/chat.
- [x] Inventory hotspots by endpoint.

### Day 2 - Dashboard Read Slice

- [x] Migrate first dashboard query cluster to PostgreSQL placeholder/result contract.
- [x] Validate list/report endpoints touched in this slice.

### Day 3 - Debug + Chat Write Slice

- [x] Migrate `routes/debug.js` query patterns.
- [x] Migrate `routes/chat.js` insert/result contract (`RETURNING`/rowCount-safe flow).

### Day 4 - Sprint Review + Handoff

- [x] Run app smoke import.
- [x] Run guard and record final deltas.
- [x] Update tracker/sprint docs and propose Sprint 16 target.

## 7. Definition of Done

- [x] `routes/dashboard.js` has 0 MySQL guard findings.
- [x] `routes/debug.js` has 0 MySQL guard findings.
- [x] `routes/chat.js` has 0 MySQL guard findings.
- [x] App smoke import passes after migration.

## 8. Exit Evidence

Commands executed:

```bash
node -c routes/dashboard.js
node -c routes/debug.js
node -c routes/chat.js
node -c chatbotSocket.js
node -c chatbotSocket-gemini-25-pro.js
npm run check:mysql-patterns
node -e "require('./app'); console.log('APP_OK')"
```

Observed results:

- Runtime route guard reduction: `25 -> 7` after dashboard/debug/chat migration.
- Additional cleanup completed after runtime scope: `chatbotSocket.js`, `chatbotSocket-gemini-25-pro.js`, `models/productModel.js`, `migrations/add-user-token-field.js`.
- Global guard: `25 -> 0`.
- App smoke: `APP_OK`.

## 9. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S15-B001 | Runtime | Dashboard route still has mixed mysql2 + `?` placeholders at kickoff | High | TBD | Closed |
