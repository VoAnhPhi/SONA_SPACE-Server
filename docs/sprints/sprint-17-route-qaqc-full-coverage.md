# Sprint 17 - Route QA/QC Full Coverage

- Project: `SONA_SPACE-Server`
- Sprint type: QA/QC hardening and regression coverage
- Prepared date: 2026-05-10
- Suggested duration: 5-7 working days
- Current status: Closed locally on `2026-06-26`
- Source docs:
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-16-regression-validation-release-readiness.md`
  - `docs/qa-qc-route-regression-playbook.md`
  - `docs/quy-trinh-thuc-thi-migration-va-sua-loi-backend.md`

## 1. Entry Criteria

- [x] Sprint 16 blocker `S16-B001` is closed with regression evidence.
- [x] L0 checks are green on target branch:
  - `npm run check:mysql-patterns`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
- [x] QA environment and test data snapshot are ready.

## 2. Sprint Goal

Establish and execute a full QA/QC process for all route files to ensure API stability, contract consistency, and release readiness.

## 3. Baseline Metrics (2026-06-25 refresh)

Inventory command:

```bash
rg -n "router\.(get|post|put|patch|delete)\(" routes
```

Result:

| Metric | Value |
|---|---:|
| Route files | 31 |
| Total endpoints | 286 |
| GET | 171 |
| POST | 47 |
| PUT | 38 |
| PATCH | 2 |
| DELETE | 28 |

High-density route files:

| File | Endpoints |
|---|---:|
| `dashboard.js` | 56 |
| `products.js` | 19 |
| `orders.js` | 18 |
| `couponcodes.js` | 15 |
| `users.js` | 13 |
| `auth.js` | 12 |
| `rooms.js` | 12 |
| `wishlists.js` | 10 |

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

- [x] Confirm L0/L1/L2/L3 process from playbook.
- [x] Prepare endpoint smoke scripts/templates.
- [x] Baseline all protected routes auth behavior.

Evidence:

- Command output:
- API smoke:
- Notes:

### Day 2 - Commerce + Catalog Regression

- [x] Execute QA matrix for `orders`, `payments`, `couponcodes`, `products`, `variants`, `categories`, `rooms`, `materials`, `color`, `attributes`.
- [x] Log all contract mismatches and schema errors.

Evidence:

- Command output:
- API smoke:
- Notes:

### Day 3 - Auth/User + Social/Content Regression

- [x] Execute QA matrix for `auth`, `users`, `comments`, `wishlists`, `wishlists-id`, `news`, `newsCategories`, `events`, `banners`.
- [x] Validate legacy compatibility responses used by frontend.

Evidence:

- Command output:
- API smoke:
- Notes:

### Day 4 - Dashboard/Debug/Notify Regression

- [x] Execute QA matrix for `dashboard`, `debug`, `chat`, `notify`, `typenotify`, `upload`, `contactForms`, `contactFormsDesign`, `index`.
- [x] Verify dashboard pages calling API routes no longer hit 500/404 regressions.

Evidence:

- Command output:
  - `node -c routes/contactFormsDesign.js`
  - `node -c routes/dashboard.js`
  - `node -c scripts/qa-day4-contract.js`
  - `npm run qa:day4-contract`
- API smoke:
  - Day 4 suite passed `97/97` checks with zero failures:
    - `dashboard.js`: `58/58`
    - `debug.js`: `7/7`
    - `chat.js`: `4/4`
    - `notify.js`: `4/4`
    - `typenotify.js`: `6/6`
    - `upload.js`: `7/7`
    - `contactForms.js`: `1/1`
    - `contactFormsDesign.js`: `9/9`
    - `index.js`: `1/1`
- Notes:
  - Replaced the remaining MySQL-era `contactFormsDesign` write/read assumptions with PostgreSQL-safe compatibility mapping:
    - persisted form compatibility fields inside `contact_form_design.note`
    - persisted detail compatibility fields inside `contact_form_design_details.note`
    - mapped numeric `status` to legacy labels expected by dashboard/frontend
  - Fixed `GET /dashboard/orders/view/:id` by redirecting it to `/dashboard/orders/detail/:id` instead of rendering the detail view without required locals.
  - Confirmed legacy dashboard aliases are valid compatibility redirects rather than regressions:
    - `/dashboard/accounts` -> `/dashboard/users`
    - `/dashboard/staff` -> `/dashboard/users`
    - `/dashboard/categories/add` -> `/dashboard/addcategories`
    - `/dashboard/categories/edit/:slug` -> `/dashboard/editcategories/:slug`
    - `/dashboard/notifications/type-list` -> `/dashboard/typeNotify`
  - Confirmed `GET /` still intentionally serves the login page (`200`) after the route-surface cleanup.

### Day 5 - Consolidation + Release Gate

- [x] Re-run full L0 + critical L2 suites.
- [x] Update blocker log with owner and ETA.
- [x] Prepare Go/No-Go QA report.

Evidence:

- Command output:
  - `npm run check:mysql-patterns`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
  - `npm run qa:auth-smoke`
  - `npm run qa:day2-contract`
  - `npm run qa:day3-contract`
  - `npm run qa:day4-contract`
- API smoke:
  - Release gate rerun passed cleanly:
    - `qa:auth-smoke`: `96/96`
    - `qa:day2-contract`: `56/56`
    - `qa:day3-contract`: `80/80`
    - `qa:day4-contract`: `97/97`
  - Aggregate Sprint 17 reusable suite evidence now covers `329` checks with zero open failures on the local PostgreSQL baseline.
- Notes:
  - `npm run check:mysql-patterns` returned `OK: no MySQL patterns found.`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` returned `APP_OK`.
  - Go/No-Go: `Go` for local server QA closeout. No Critical/High blocker remains in Sprint 17 after the Day 4 compatibility fixes and the full rerun gate.

## 7. Definition of Done

- [x] 100% route files in matrix are evaluated.
- [x] No Critical/High open QA blockers.
- [x] All newly discovered route regressions are fixed or accepted with explicit risk sign-off.
- [x] Sprint/tracker docs include reproducible evidence for every closed checklist item.

## 8. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S17-B001 | QA | Full route QA matrix has now been executed end-to-end and the reusable Sprint 17 suites passed on the local PostgreSQL baseline (`329/329` checks across Day 1-Day 4 reruns on `2026-06-26`) | High | Backend | Closed |
| S17-B002 | Dependency | Sprint 16 regression artifact is complete; Sprint 17 was started from the closed local baseline on `2026-06-25` | High | TBD | Closed |

## 9. Route QA Matrix (All Route Files)

Legend: `[ ]` not tested, `[x]` tested and passed for current sprint cycle.

| Route file | Total | GET | POST | PUT | PATCH | DELETE | QA Status |
|---|---:|---:|---:|---:|---:|---:|---|
| `attributes.js` | 2 | 1 | 1 | 0 | 0 | 0 | [x] |
| `auth.js` | 12 | 3 | 9 | 0 | 0 | 0 | [x] |
| `banners.js` | 10 | 5 | 2 | 2 | 0 | 1 | [x] |
| `categories.js` | 10 | 7 | 1 | 1 | 0 | 1 | [x] |
| `chat.js` | 2 | 1 | 0 | 1 | 0 | 0 | [x] |
| `color.js` | 8 | 4 | 1 | 2 | 0 | 1 | [x] |
| `comments.js` | 10 | 5 | 1 | 3 | 0 | 1 | [x] |
| `contactForms.js` | 1 | 0 | 1 | 0 | 0 | 0 | [x] |
| `contactFormsDesign.js` | 9 | 3 | 2 | 2 | 0 | 2 | [x] |
| `couponcodes.js` | 15 | 7 | 3 | 2 | 1 | 2 | [x] |
| `dashboard.js` | 56 | 56 | 0 | 0 | 0 | 0 | [x] |
| `debug.js` | 5 | 5 | 0 | 0 | 0 | 0 | [x] |
| `events.js` | 7 | 3 | 1 | 2 | 0 | 1 | [x] |
| `index.js` | 1 | 1 | 0 | 0 | 0 | 0 | [x] |
| `materials.js` | 6 | 2 | 1 | 2 | 0 | 1 | [x] |
| `news.js` | 9 | 6 | 1 | 1 | 0 | 1 | [x] |
| `newsCategories.js` | 7 | 3 | 1 | 2 | 0 | 1 | [x] |
| `notify.js` | 4 | 2 | 1 | 0 | 0 | 1 | [x] |
| `orders.js` | 18 | 9 | 5 | 2 | 1 | 1 | [x] |
| `orders-id.js` | 5 | 2 | 0 | 3 | 0 | 0 | [x] |
| `orderStatus.js` | 5 | 2 | 1 | 1 | 0 | 1 | [x] |
| `payments.js` | 6 | 3 | 1 | 1 | 0 | 1 | [x] |
| `products.js` | 19 | 13 | 2 | 3 | 0 | 1 | [x] |
| `revenue.js` | 3 | 3 | 0 | 0 | 0 | 0 | [x] |
| `rooms.js` | 12 | 7 | 2 | 1 | 0 | 2 | [x] |
| `typenotify.js` | 6 | 2 | 1 | 2 | 0 | 1 | [x] |
| `upload.js` | 8 | 0 | 6 | 0 | 0 | 2 | [x] |
| `users.js` | 13 | 9 | 0 | 3 | 0 | 1 | [x] |
| `variants.js` | 7 | 3 | 2 | 1 | 0 | 1 | [x] |
| `wishlists.js` | 10 | 3 | 1 | 1 | 0 | 5 | [x] |
| `wishlists-id.js` | 1 | 1 | 0 | 0 | 0 | 0 | [x] |

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

### 2026-06-25

- Done:
  - Started Sprint 17 from the closed Sprint 16 local baseline.
  - Removed disabled or stray route surface from the active inventory: `/test-categories`, `/test-gemini-chatbot`, `GET /api/products/test/:slug`, `GET /api/contact-form-design/:id/details/debug`, `GET /api/wishlists-id/test`, and `GET /api/wishlists/wwww`.
  - Removed the unused `indexRouter` import path from `app.js` and trimmed `routes/index.js` down to the login page route only.
- Route files touched:
  - `app.js`
  - `routes/index.js`
  - `routes/products.js`
  - `routes/contactFormsDesign.js`
  - `routes/wishlists.js`
  - `routes/wishlists-id.js`
- Evidence:
  - `rg -n "router\\.(get|post|put|patch|delete)\\(" routes`
  - refreshed inventory: `31` route files / `286` endpoints (`GET=171`, `POST=47`, `PUT=38`, `PATCH=2`, `DELETE=28`)
  - `rg -n "test-chatbot|test-gemini-chatbot|test-categories|/test/:slug|/details/debug|/wwww|/test\\b" app.js routes`
  - `node -c app.js`
  - `node -c routes/products.js`
  - `node -c routes/contactFormsDesign.js`
  - `node -c routes/wishlists.js`
  - `node -c routes/wishlists-id.js`
  - `npm run check:mysql-patterns`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
  - temporary-app HTTP auth/contract smoke with local JWTs (`admin user_id=1`, `user user_id=3`):
    - `GET /api/orders/count` -> `401` without token, `200` with admin token
    - `GET /api/products/admin` -> `401` without token, `200` with admin token
    - `GET /api/payments` -> `401` without token, `200` with admin token
    - `GET /api/couponcodes` -> `401` without token, `200` with admin token
    - `GET /api/couponcodes/notification` -> `200` with user token
    - `GET /api/users/admin/1` -> `401` without token, `200` with admin token
    - removed route probes now fall through to real `404`:
      - `GET /api/wishlists/wwww?status=1`
      - `GET /api/products/test/demo`
      - `GET /api/contact-form-design/1/details/debug`
- Next action:
  - Continue Sprint 17 Day 1 auth/contract QA from this baseline by extending the same smoke approach to `variants.js`, `categories.js`, `rooms.js`, `materials.js`, `notify.js`, and `upload.js`, then mark the first matrix rows as passed/failed with explicit evidence.

### 2026-06-26

- Done:
  - Confirmed the L0/L1/L2/L3 process from `docs/qa-qc-route-regression-playbook.md` and used it as the Day 1 execution gate.
  - Added reusable auth smoke tooling in `scripts/qa-auth-smoke.js` and exposed it through `npm run qa:auth-smoke`.
  - Ran a protected-route auth baseline across `28` route groups / `96` auth scenarios using a temporary local app server plus short-lived local JWTs for `admin user_id=1` and `user user_id=3`.
  - Fixed a real PostgreSQL schema mismatch in `routes/contactFormsDesign.js` so `GET /api/contact-form-design` now returns `200` for admin instead of `500`.
  - Confirmed `routes/orderStatus.js` mutation endpoints intentionally return `410` for admin because the catalog is static in the PostgreSQL contract; this is now treated as valid Day 1 behavior, not a blocker.
  - Added reusable Day 2 contract tooling in `scripts/qa-day2-contract.js` and exposed it through `npm run qa:day2-contract`.
  - Executed Day 2 contract/depth smoke across `11` route groups (`56` checks total) covering `orders`, `payments`, `couponcodes`, `products`, `variants`, `categories`, `rooms`, `materials`, `color`, `attributes`, and the adjacent static `orderStatus` catalog.
  - Fixed a real PostgreSQL runtime mismatch in `routes/variants.js` by replacing the stale `color.color_priority` read with the schema-safe compatibility alias `color_id AS color_priority`, restoring `GET /api/variants/:productSlug/:colorId` to `200`.
  - Aligned the Day 2 smoke expectations to the current API contracts where the route behavior is intentional rather than broken:
    - `GET /api/products/search` uses query param `q` and returns `{ results: [...] }`
    - `GET /api/rooms/:slug/products` returns `{ room, products, pagination }`
    - `GET /api/orders/hash/:orderHash` returns `{ success, order }` with `order.products`
    - `GET /api/orders` returns `{ orders, pagination }`
    - `GET /api/orders/:id` returns a direct order object payload
    - `GET /api/order-status*` is protected at `app.js` mount level and returns data only for authenticated users
  - Added reusable Day 3 contract tooling in `scripts/qa-day3-contract.js` and exposed it through `npm run qa:day3-contract`.
  - Executed Day 3 contract/depth smoke across `9` route groups (`80` checks total) covering `auth`, `users`, `comments`, `wishlists`, `wishlists-id`, `news`, `newsCategories`, `events`, and `banners`.
  - Confirmed the PostgreSQL compatibility responses expected by the frontend are stable even on sparse local data:
    - `comments`, `wishlists`, and `news` list endpoints return empty arrays with intact pagination/shape instead of `500`
    - `wishlists-id` returns `{ message, wishlists: [] }` when the user has no items
    - `news-categories/news/:slug`, `events/active`, and banner page aggregation all return schema-safe payloads
- Route files touched:
  - `scripts/qa-auth-smoke.js`
  - `scripts/qa-day2-contract.js`
  - `scripts/qa-day3-contract.js`
  - `package.json`
  - `routes/contactFormsDesign.js`
  - `routes/variants.js`
- Critical/High blockers:
  - None from Day 1/Day 2/Day 3 after the `contactFormsDesign` and `variants` compatibility fixes.
  - `S17-B001` remains open because full route QA coverage is still unfinished.
- Evidence:
  - `node -c scripts/qa-auth-smoke.js`
  - `node -c scripts/qa-day2-contract.js`
  - `node -c scripts/qa-day3-contract.js`
  - `npm run check:mysql-patterns`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
  - `npm run qa:auth-smoke`
  - `node -c routes/variants.js`
  - `npm run qa:day2-contract`
  - `npm run qa:day3-contract`
  - Day 1 auth smoke passed with no failed checks after the fix:
    - dashboard gate: `GET /dashboard` -> `302` without token, `403` with user token, `200` with admin token
    - admin API samples: `GET /api/orders/count`, `GET /api/products/admin`, `GET /api/payments`, `GET /api/revenue/stats`, `GET /api/users/admin/1` -> `401` without token, `403` with user token, `200` with admin token
    - user-protected API samples: `GET /api/auth/profile`, `GET /api/users/3`, `GET /api/wishlists?status=1`, `GET /api/couponcodes/notification` -> `401` without token and success (`200`) with a valid user token
    - admin mutation auth samples: `POST /api/attribute/1`, `POST /api/banners`, `PUT /api/chat/context`, `POST /api/materials`, `POST /api/news-categories`, `POST /api/typeNotify`, `POST /api/upload/category`, `POST /api/variants` -> `401` without token, `403` with user token, and business-validation responses (`400`) with admin token
    - compatibility fix verification: `GET /api/contact-form-design` -> `401` without token, `403` with user token, `200` with admin token
    - intentional static catalog behavior: `POST /api/order-status` -> `401` without token, `403` with user token, `410` with admin token
  - Day 2 contract smoke passed with no failed checks after the `variants` fix:
    - `orders.js`: `7/7` checks passed, including `GET /api/orders/complete/:orderHash`, `GET /api/orders/hash/:orderHash`, admin list pagination, owned detail, invalid create payload, and status counts
    - `payments.js`: `6/6` checks passed, including admin list, owned order/payment detail, invalid order id, invalid create payload, and missing update payload
    - `couponcodes.js`: `6/6` checks passed, including user code list, admin list/detail, missing id `404`, invalid validate payload, and invalid create payload
    - `products.js`: `6/6` checks passed, including public list, search, detail, missing slug `404`, admin detail, and invalid create payload
    - `variants.js`: `6/6` checks passed after replacing stale `color_priority` usage
    - `categories.js`: `6/6` checks passed
    - `rooms.js`: `5/5` checks passed
    - `materials.js`: `5/5` checks passed
    - `color.js`: `4/4` checks passed
    - `attributes.js`: `2/2` checks passed
    - `orderStatus.js`: `3/3` checks passed for authenticated reads
  - Day 3 contract smoke passed with no failed checks:
    - `auth.js`: `12/12` checks passed, including invalid public auth payloads, profile read, admin token metadata, non-admin `403`, OTP/reset validation, and logout
    - `users.js`: `13/13` checks passed, including admin lists/detail, staff read, own/private reads, cross-user `403`, missing delete, and orders/wishlist/reviews payloads
    - `comments.js`: `11/11` checks passed, including empty-list compatibility, product stats payload, own user review list, invalid moderation/body checks, and missing detail `404`
    - `wishlists.js`: `11/11` checks passed, including `status=0/1` reads, invalid status validation, variant/product membership checks, and invalid mutation payloads
    - `wishlists-id.js`: `1/1` check passed with the expected empty-state `{ message, wishlists: [] }` payload
    - `news.js`: `9/9` checks passed, including public/admin list shapes, viewed/category feeds, invalid create payload, missing detail/update/delete paths
    - `newsCategories.js`: `7/7` checks passed, including category list/detail, invalid create/update payloads, missing delete, and `news/:slug` aggregate payload
    - `events.js`: `7/7` checks passed, including public active feed, admin list/detail, invalid create/update validation, and missing toggle/delete paths
    - `banners.js`: `10/10` checks passed, including public list/page/page-types payloads, page aggregation, detail read, invalid create payload, and missing update/delete/toggle paths
- Next action:
  - Move to Sprint 17 Day 4 and run the same contract/depth approach for `dashboard.js`, `debug.js`, `chat.js`, `notify.js`, `typenotify.js`, `upload.js`, `contactForms.js`, `contactFormsDesign.js`, and `index.js`, then update the remaining matrix rows.

### 2026-06-26 (Day 4 + Day 5 Closeout)

- Done:
  - Added reusable Day 4 tooling in `scripts/qa-day4-contract.js` and exposed it through `npm run qa:day4-contract`.
  - Rewrote `routes/contactFormsDesign.js` around the actual PostgreSQL schema while preserving the legacy frontend/dashboard payload contract:
    - form compatibility fields are serialized into `contact_form_design.note`
    - detail compatibility fields are serialized into `contact_form_design_details.note`
    - numeric `status` values are mapped to the legacy string lifecycle labels
  - Fixed `routes/dashboard.js` so `GET /dashboard/orders/view/:id` now redirects to the prepared detail route instead of crashing with `500`.
  - Executed Day 4 across `9` route groups (`97` checks total) and validated the remaining dashboard aliases / root login page behavior.
  - Re-ran the Sprint 17 release gate: MySQL guard, app smoke, Day 1 auth smoke, Day 2 contract suite, Day 3 contract suite, and Day 4 contract suite all passed on the local PostgreSQL baseline.
- Route files touched:
  - `scripts/qa-day4-contract.js`
  - `package.json`
  - `routes/contactFormsDesign.js`
  - `routes/dashboard.js`
- Critical/High blockers:
  - None remain. `S17-B001` is now closed after full-route coverage was completed and rerun end-to-end.
- Evidence:
  - `node -c routes/contactFormsDesign.js`
  - `node -c routes/dashboard.js`
  - `node -c scripts/qa-day4-contract.js`
  - `npm run qa:day4-contract`
  - `npm run check:mysql-patterns`
  - `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
  - `npm run qa:auth-smoke`
  - `npm run qa:day2-contract`
  - `npm run qa:day3-contract`
  - `npm run qa:day4-contract`
  - Day 4 suite passed with no failed checks:
    - `dashboard.js`: `58/58`
    - `debug.js`: `7/7`
    - `chat.js`: `4/4`
    - `notify.js`: `4/4`
    - `typenotify.js`: `6/6`
    - `upload.js`: `7/7`
    - `contactForms.js`: `1/1`
    - `contactFormsDesign.js`: `9/9`
    - `index.js`: `1/1`
  - Full rerun gate passed cleanly:
    - `qa:auth-smoke`: `96/96`
    - `qa:day2-contract`: `56/56`
    - `qa:day3-contract`: `80/80`
    - `qa:day4-contract`: `97/97`
- Next action:
  - Sprint 17 local server QA is complete. The next practical step is environment deployment validation using the existing deploy/rollback runbook against staging or production-like infrastructure.
