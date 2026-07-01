# Sprint 17 - Route QA/QC Full Coverage

- Project: `SONA_SPACE-Server`
- Sprint type: QA/QC hardening and regression coverage
- Prepared date: 2026-05-10
- Suggested duration: 5-7 working days
- Current status: Planned (Queue, wait Sprint 16 closeout)
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-16-regression-validation-release-readiness.md`
  - `docs/qa-qc-route-regression-playbook.md`
  - `docs/quy-trinh-thuc-thi-migration-va-sua-loi-backend.md`

## 1. Entry Criteria

- [ ] Sprint 16 blocker `S16-B001` is closed with regression evidence.
- [ ] L0 checks are green on target branch:
  - `npm run check:mysql-patterns`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
- [ ] QA environment and test data snapshot are ready.

## 2. Sprint Goal

Establish and execute a full QA/QC process for all route files to ensure API stability, contract consistency, and release readiness.

## 3. Baseline Metrics (2026-05-10)

Inventory command:

```bash
rg -n "router\.(get|post|put|patch|delete)\(" routes
```

Result:

| Metric | Value |
|---|---:|
| Route files | 31 |
| Total endpoints | 293 |
| GET | 177 |
| POST | 47 |
| PUT | 38 |
| PATCH | 2 |
| DELETE | 29 |

High-density route files:

| File | Endpoints |
|---|---:|
| `dashboard.js` | 56 |
| `products.js` | 20 |
| `orders.js` | 18 |
| `couponcodes.js` | 15 |
| `users.js` | 13 |
| `auth.js` | 12 |
| `rooms.js` | 12 |
| `wishlists.js` | 11 |

## 4. In Scope

- Build and run QA/QC matrix for all files in `routes/`.
- Standardize pass/fail criteria for:
  - auth/authorization
  - request validation
  - error contract (`400/401/403/404/500`)
  - response compatibility for frontend dashboard/API clients
- Record evidence in sprint doc + tracker daily log.
- Open blockers with severity and owner for any route that fails.

## 5. Out of Scope

- New feature implementation unrelated to route stability.
- Large schema redesign.
- Non-backend UI redesign.

## 6. Day-by-Day Checklist

### Day 1 - QA Framework and Tooling

- [ ] Confirm L0/L1/L2/L3 process from playbook.
- [ ] Prepare endpoint smoke scripts/templates.
- [ ] Baseline all protected routes auth behavior.

Evidence:

- Command output:
- API smoke:
- Notes:

### Day 2 - Commerce + Catalog Regression

- [ ] Execute QA matrix for `orders`, `payments`, `couponcodes`, `products`, `variants`, `categories`, `rooms`, `materials`, `color`, `attributes`.
- [ ] Log all contract mismatches and schema errors.

Evidence:

- Command output:
- API smoke:
- Notes:

### Day 3 - Auth/User + Social/Content Regression

- [ ] Execute QA matrix for `auth`, `users`, `comments`, `wishlists`, `wishlists-id`, `news`, `newsCategories`, `events`, `banners`.
- [ ] Validate legacy compatibility responses used by frontend.

Evidence:

- Command output:
- API smoke:
- Notes:

### Day 4 - Dashboard/Debug/Notify Regression

- [ ] Execute QA matrix for `dashboard`, `debug`, `chat`, `notify`, `typenotify`, `upload`, `contactForms`, `contactFormsDesign`, `index`.
- [ ] Verify dashboard pages calling API routes no longer hit 500/404 regressions.

Evidence:

- Command output:
- API smoke:
- Notes:

### Day 5 - Consolidation + Release Gate

- [ ] Re-run full L0 + critical L2 suites.
- [ ] Update blocker log with owner and ETA.
- [ ] Prepare Go/No-Go QA report.

Evidence:

- Command output:
- API smoke:
- Notes:

## 7. Definition of Done

- [ ] 100% route files in matrix are evaluated.
- [ ] No Critical/High open QA blockers.
- [ ] All newly discovered route regressions are fixed or accepted with explicit risk sign-off.
- [ ] Sprint/tracker docs include reproducible evidence for every closed checklist item.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S17-B001 | QA | Full route QA matrix has not been executed yet | High | TBD | Open |
| S17-B002 | Dependency | Sprint 16 regression artifact is still incomplete | High | TBD | Open |

## 9. Route QA Matrix (All Route Files)

Legend: `[ ]` not tested, `[x]` tested and passed for current sprint cycle.

| Route file | Total | GET | POST | PUT | PATCH | DELETE | QA Status |
|---|---:|---:|---:|---:|---:|---:|---|
| `attributes.js` | 2 | 1 | 1 | 0 | 0 | 0 | [ ] |
| `auth.js` | 12 | 3 | 9 | 0 | 0 | 0 | [ ] |
| `banners.js` | 10 | 5 | 2 | 2 | 0 | 1 | [ ] |
| `categories.js` | 10 | 7 | 1 | 1 | 0 | 1 | [ ] |
| `chat.js` | 2 | 1 | 0 | 1 | 0 | 0 | [ ] |
| `color.js` | 8 | 4 | 1 | 2 | 0 | 1 | [ ] |
| `comments.js` | 10 | 5 | 1 | 3 | 0 | 1 | [ ] |
| `contactForms.js` | 1 | 0 | 1 | 0 | 0 | 0 | [ ] |
| `contactFormsDesign.js` | 10 | 4 | 2 | 2 | 0 | 2 | [ ] |
| `couponcodes.js` | 15 | 7 | 3 | 2 | 1 | 2 | [ ] |
| `dashboard.js` | 56 | 56 | 0 | 0 | 0 | 0 | [ ] |
| `debug.js` | 5 | 5 | 0 | 0 | 0 | 0 | [ ] |
| `events.js` | 7 | 3 | 1 | 2 | 0 | 1 | [ ] |
| `index.js` | 3 | 3 | 0 | 0 | 0 | 0 | [ ] |
| `materials.js` | 6 | 2 | 1 | 2 | 0 | 1 | [ ] |
| `news.js` | 9 | 6 | 1 | 1 | 0 | 1 | [ ] |
| `newsCategories.js` | 7 | 3 | 1 | 2 | 0 | 1 | [ ] |
| `notify.js` | 4 | 2 | 1 | 0 | 0 | 1 | [ ] |
| `orders.js` | 18 | 9 | 5 | 2 | 1 | 1 | [ ] |
| `orders-id.js` | 5 | 2 | 0 | 3 | 0 | 0 | [ ] |
| `orderStatus.js` | 5 | 2 | 1 | 1 | 0 | 1 | [ ] |
| `payments.js` | 6 | 3 | 1 | 1 | 0 | 1 | [ ] |
| `products.js` | 20 | 14 | 2 | 3 | 0 | 1 | [ ] |
| `revenue.js` | 3 | 3 | 0 | 0 | 0 | 0 | [ ] |
| `rooms.js` | 12 | 7 | 2 | 1 | 0 | 2 | [ ] |
| `typenotify.js` | 6 | 2 | 1 | 2 | 0 | 1 | [ ] |
| `upload.js` | 8 | 0 | 6 | 0 | 0 | 2 | [ ] |
| `users.js` | 13 | 9 | 0 | 3 | 0 | 1 | [ ] |
| `variants.js` | 7 | 3 | 2 | 1 | 0 | 1 | [ ] |
| `wishlists.js` | 11 | 4 | 1 | 1 | 0 | 5 | [ ] |
| `wishlists-id.js` | 2 | 2 | 0 | 0 | 0 | 0 | [ ] |

## 10. Notes for Daily Updates

Use this format:

```md
### YYYY-MM-DD

- Done:
- Route files tested:
- Critical/High blockers:
- Evidence:
- Next action:
```

