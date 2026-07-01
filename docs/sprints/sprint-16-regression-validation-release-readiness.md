# Sprint 16 - Regression Validation and Release Readiness

- Project: `SONA_SPACE-Server`
- Sprint type: stabilization and readiness
- Prepared date: 2026-05-10
- Suggested duration: 3-5 working days
- Current status: In Progress
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-15-dashboard-debug-chat-postgres-migration.md`
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`

## 1. Entry Criteria

- [x] MySQL guard is clean (`npm run check:mysql-patterns` => no findings).
- [x] Core runtime modules pass syntax + app smoke (`APP_OK`).

## 2. Sprint Goal

Validate PostgreSQL migration quality by running regression suites, data checks, and staging readiness tasks.

## 3. Baseline Metrics (2026-05-10)

| Metric | Value |
|---|---|
| Guard findings | 0 |
| App smoke import | APP_OK |

## 4. Scope

- Execute critical API regression paths for commerce/catalog/content/notify/social.
- Perform data reconciliation checks (orders, revenue, coupon, stock).
- Prepare staging cutover checklist and rollback sanity plan.

## 5. Out of Scope

- New feature development.
- Schema redesign beyond reconciliation fixes.

## 6. Checklist

### Day 1 - Regression Run

- [ ] Critical API regression suite executed.
- [ ] High-risk endpoint matrix recorded with pass/fail.

### Day 2 - Data Reconciliation

- [ ] Orders, revenue, and coupon reconciliation report completed.
- [ ] Catalog stock sanity check completed.

### Day 3 - Staging Drill Prep

- [ ] Staging deploy checklist completed.
- [ ] Rollback drill script and runbook reviewed.

### Day 4 - Readiness Review

- [ ] Go/No-Go artifact prepared.
- [ ] Final risk log updated.

## 7. Definition of Done

- [ ] Regression suite has no blocker-level failures.
- [ ] Data reconciliation approved.
- [ ] Staging readiness checklist is complete.
- [ ] Production readiness recommendation is documented.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S16-B001 | QA | Regression and reconciliation evidence not yet collected | High | TBD | Open |

## 9. Follow-up Queue

- [x] Sprint 17 QA/QC planning docs are prepared:
  - `docs/qa-qc-route-regression-playbook.md`
  - `docs/sprints/sprint-17-route-qaqc-full-coverage.md`
- [ ] Sprint 16 must close blocker `S16-B001` before Sprint 17 execution starts.

## 10. Daily Notes

### 2026-05-12

- Done:
  - Fixed major catalog regression in `routes/categories.js` where PostgreSQL route SQL referenced non-existent columns (`category_icon`, `category_banner`).
  - Added schema-safe compatibility mapping (`category_image AS category_icon`, `NULL::text AS category_banner`) and aligned create/update/delete category queries to the current `category` table contract.
  - Updated category product color aggregation to use `color.color_code`.
- Smoke/API evidence:
  - `node -c routes/categories.js`
  - `npm run check:mysql-patterns` -> `OK: no MySQL patterns found.`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`
  - Local HTTP smoke via temporary app listener:
    - `GET /api/categories/filter/` -> `200`
    - `GET /api/categories/` -> `200`
    - `GET /api/categories/:slug` -> `200`
- Blockers:
  - `S16-B001` remains open; full regression/reconciliation artifact is still incomplete.
- Next action:
  - Continue Sprint 16 Day 1 matrix execution for remaining high-risk routes (`rooms`, `color`, `banners`) and record pass/fail evidence.
