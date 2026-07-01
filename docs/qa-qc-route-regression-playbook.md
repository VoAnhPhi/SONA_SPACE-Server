# QA/QC Route Regression Playbook

- Project: `SONA_SPACE-Server`
- Scope: all backend routes in `routes/*.js`
- Prepared date: 2026-05-10
- Purpose: standardize QA/QC for API route stability after PostgreSQL migration

## 1. Baseline Route Inventory

Inventory command:

```bash
rg -n "router\.(get|post|put|patch|delete)\(" routes
```

Current baseline (2026-05-10):

| Metric | Value |
|---|---:|
| Route files | 31 |
| Total endpoints | 293 |
| GET | 177 |
| POST | 47 |
| PUT | 38 |
| PATCH | 2 |
| DELETE | 29 |

## 2. QA/QC Levels

### L0 - Runtime Safety (must pass first)

1. `npm run check:mysql-patterns`
2. `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
3. Syntax check for changed files: `node -c routes/<file>.js`

Pass criteria:

- Guard has no new MySQL pattern regressions.
- App boot returns `APP_OK`.
- No syntax errors on touched route files.

### L1 - API Contract Validation (all endpoints touched in sprint)

For each endpoint, verify:

1. HTTP status codes are correct for happy path and error path.
2. Response shape remains backward-compatible (keys and data types).
3. Auth behavior is correct:
   - no token -> `401` (if protected)
   - invalid role -> `403` (if admin-only)
4. Validation behavior is correct:
   - invalid params/body -> `400`
   - not found resources -> `404`
5. Internal failures return `500` with predictable error contract.

Pass criteria:

- 100% endpoints in changed route files have at least one happy-path check.
- 100% protected endpoints have auth checks.
- 100% mutation endpoints have validation and not-found checks.

### L2 - Business Flow Regression (critical flows)

1. Auth/login/register/profile.
2. Catalog list/detail/filter (`products`, `categories`, `rooms`, `variants`).
3. Commerce (`orders`, `payments`, `couponcodes`, `orderStatus`).
4. Social/content (`comments`, `wishlists`, `news`, `events`, `banners`).
5. Dashboard routes and admin screens that call these APIs.

Pass criteria:

- No blocker-level failures in critical flow matrix.
- Any medium/low issues are logged with owner and ETA.

### L3 - Data Integrity & Observability

1. Verify row counts and aggregates for high-risk flows (orders/revenue/coupon/stock).
2. Verify create/update/delete operations keep consistent references.
3. Capture structured execution evidence in sprint/tracker docs.

Pass criteria:

- No data corruption indicators.
- Reconciliation deltas are explained or fixed.

## 3. Minimum Test Matrix Per Endpoint Type

| Endpoint Type | Required checks |
|---|---|
| `GET` list/detail | 200, empty state, invalid param, 404 where applicable |
| `POST` create | 201/200, invalid payload 400, auth/role, duplicate/conflict path |
| `PUT/PATCH` update | 200, invalid payload 400, target missing 404, auth/role |
| `DELETE` | 200, missing target 404, foreign-key/business protection path |

## 4. Severity Classification

| Severity | Definition | Release impact |
|---|---|---|
| Critical | App crash, data corruption, auth bypass | Block release |
| High | Core flow fails (order/payment/catalog/auth) | Block release |
| Medium | Non-core API mismatch or unstable error handling | Can release with fix plan |
| Low | Cosmetic response differences or minor docs gaps | Can release |

## 5. Evidence Format (mandatory)

Use this template in sprint docs:

```md
Evidence:

- Command:
- Result:
- API smoke:
- Files changed:
- Notes:
```

## 6. Execution Cadence

1. On each backend change:
   - Run L0 immediately.
2. On each sprint day:
   - Run L1 for changed routes.
3. Before sprint closeout:
   - Run L2 + L3 and update blocker log.

## 7. Route Coverage Requirement

For Sprint 17+, every file under `routes/` must be marked in a QA matrix with:

1. endpoint inventory count,
2. last execution date,
3. current QA status (`[ ]` or `[x]`),
4. known blockers.

If a route file has no QA entry, sprint cannot be closed.

