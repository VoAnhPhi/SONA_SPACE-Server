# Sprint 1 - PostgreSQL Migration Foundation

- Project: `SONA_SPACE-Server`
- Sprint type: migration hardening + first P0 slice
- Prepared date: 2026-04-30
- Suggested duration: 5 working days
- Current status: Done / Sprint 2 handoff completed
- Source docs:
  - `docs/bao-cao-migration-backend-mysql-to-postgresql.md`
  - `docs/quy-trinh-thuc-thi-migration-va-sua-loi-backend.md`
  - `docs/migration-tracker.md`

## 1. Current Snapshot

### Done

- [x] PostgreSQL pool is wired in `config/database.js` through `pg.Pool`.
- [x] Dev Docker Compose includes PostgreSQL 16 and loads `db/init/init.sql`.
- [x] PostgreSQL init schema exists at `db/init/init.sql`.
- [x] Local guard command exists: `npm run check:mysql-patterns`.
- [x] CI guard workflow exists: `.github/workflows/mysql-pattern-guard.yml`.
- [x] `routes/auth.js` no longer appears in the MySQL pattern guard findings.
- [x] Tracker already records `routes/auth.js` migration and OTP/notification validation.
- [x] App smoke import passes: `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`.

### Not Done Yet

- [ ] No dedicated sprint docs existed before this file.
- [x] `docs/db-contract-postgres.md` has been created.
- [x] `docs/mysql-to-postgres-column-mapping.md` has been created.
- [x] `db/transaction.js` PostgreSQL transaction helper has been added.
- [x] README database setup is PostgreSQL-only, with MySQL marked as legacy migration source.
- [ ] `mysql2` still exists in `package.json`.
- [ ] Legacy migration/model files still contain MySQL patterns:
  - `migrations/add-user-token-field.js`
  - `models/productModel.js`
- [ ] `npm run check:mysql-patterns` is still failing outside the completed Auth/User slice.

## 2. Baseline Metrics

Baseline command:

```bash
npm run check:mysql-patterns
```

Result on 2026-04-30:

| Metric | Count |
|---|---:|
| Total MySQL pattern findings | 835 |
| `?` placeholders | 386 |
| mysql2-style array destructuring | 281 |
| `insertId` / `affectedRows` | 39 |
| MySQL transaction API | 38 |
| MySQL SQL functions/syntax | 36 |
| `db.execute` / `db.getConnection` | 29 |
| MySQL `LIMIT offset, limit` | 12 |
| MySQL JSON functions | 9 |
| Backtick quoted tables | 5 |

Top affected files:

| File | Findings |
|---|---:|
| `routes/orders.js` | 157 |
| `routes/products.js` | 138 |
| `routes/couponcodes.js` | 76 |
| `routes/comments.js` | 56 |
| `routes/news.js` | 45 |
| `routes/orders-id.js` | 44 |
| `routes/contactFormsDesign.js` | 44 |
| `routes/payments.js` | 42 |
| `routes/wishlists.js` | 41 |
| `routes/variants.js` | 27 |

Latest command after Sprint 1 work on 2026-05-01:

| Metric | Count |
|---|---:|
| Total MySQL pattern findings | 819 |
| Reduction from baseline | 16 |
| `routes/users.js` guard findings | 0 |
| `routes/couponcodes.js` findings | 63 |

## 3. Sprint Goal

By the end of Sprint 1, the team should have a stable PostgreSQL migration foundation and one completed P0 follow-up slice after `auth.js`.

Sprint 1 success means:

- [x] PostgreSQL schema contract and column mapping are documented.
- [x] DB access patterns for new work are standardized.
- [x] Transaction helper pattern is available and documented.
- [x] Guard baseline is reduced from 835 and remaining findings are assigned by module.
- [x] `routes/users.js` is migrated or explicitly closed as already PostgreSQL-safe.
- [x] The next P0 module to migrate is selected with endpoint and SQL inventory completed.

## 4. In Scope

- Phase 0 deliverables:
  - [x] Create `docs/db-contract-postgres.md`.
  - [x] Create `docs/mysql-to-postgres-column-mapping.md`.
  - [x] Confirm table/column names for Auth/User, Coupon, Product, Order, Payment.
  - [x] Record any schema decision that changes route code expectations.
- Phase 1 deliverables:
  - [x] Add PostgreSQL transaction helper or document the approved transaction pattern.
  - [x] Standardize result contract examples: `{ rows, rowCount }`.
  - [x] Keep `npm run check:mysql-patterns` as the mandatory local/CI guard.
  - [x] Add a per-module MySQL finding inventory to the tracker.
- First P0 slice:
  - [x] Finish review/migration of `routes/users.js`.
  - [x] Inventory all SQL in `routes/couponcodes.js`.
  - [x] Decide whether Sprint 2 starts with Coupon or Commerce Order flow.
- Documentation cleanup:
  - [x] Update README database section to PostgreSQL-only or clearly mark MySQL as legacy.
  - [x] Add sprint evidence links to `docs/migration-tracker.md`.

## 5. Out of Scope

- Full migration of `routes/orders.js` and `routes/products.js`.
- Production cutover.
- Large schema redesign without team approval.
- Removing `mysql2` before all runtime imports and legacy scripts are confirmed safe.

## 6. Day-by-Day Checklist

### Day 1 - Kickoff and Contract

- [x] Assign owners for Auth/User, Commerce, Catalog, Content/CRM.
- [x] Review current tracker and confirm baseline count: 835 findings.
- [x] Draft `docs/db-contract-postgres.md`.
- [x] Draft `docs/mysql-to-postgres-column-mapping.md`.
- [x] Confirm whether PostgreSQL schema names in `db/init/init.sql` are source of truth.
- [x] Record open schema questions in the blocker log.

Evidence:

- Command output: `npm run check:mysql-patterns` confirmed baseline was 835 findings before Sprint 1 changes.
- PR/commit: local working tree changes, not committed.
- Notes: Created `docs/db-contract-postgres.md` and `docs/mysql-to-postgres-column-mapping.md`; confirmed `db/init/init.sql` as current source of truth.

### Day 2 - DB Access Standardization

- [x] Add or document PostgreSQL transaction helper pattern.
- [x] Add examples for `RETURNING`, `rowCount`, and `$1..$n` placeholders.
- [x] Review `config/database.js` default credentials and comments.
- [x] Decide how to handle legacy `migrations/add-user-token-field.js`.
- [x] Re-run `npm run check:mysql-patterns` and record count.

Evidence:

- Command output: `node -e "const {withTransaction}=require('./db/transaction'); console.log(typeof withTransaction === 'function' ? 'TX_HELPER_OK' : 'TX_HELPER_MISSING'); process.exit(0)"` -> `TX_HELPER_OK`.
- PR/commit: local working tree changes, not committed.
- Notes: Added `db/transaction.js`; documented `{ rows, rowCount }`, `RETURNING`, and `$1..$n` examples in `docs/db-contract-postgres.md`.

### Day 3 - Auth/User Completion

- [x] Audit `routes/users.js` active code paths, not only commented code.
- [x] Confirm all user endpoints use PostgreSQL result shape.
- [x] Confirm auth/profile/admin user flows against PostgreSQL schema.
- [x] Remove or rewrite stale MySQL snippets in comments if they keep guard noisy.
- [x] Update Auth/User row in `docs/migration-tracker.md`.

Evidence:

- Command output: `npm run check:mysql-patterns` -> `routes/users.js: 0`, `routes/auth.js: 0`, total 819 findings.
- API smoke tests: Representative PostgreSQL query-shape checks passed: `users_admin_count`, `user_orders_shape`, `user_wishlist_shape`, `user_reviews_shape`.
- PR/commit: local working tree changes, not committed.
- Notes: Updated `routes/users.js` active order/payment/wishlist/review queries to match `db/init/init.sql`.

### Day 4 - Coupon Inventory and First Fixes

- [x] List all endpoints in `routes/couponcodes.js`.
- [x] List all table/column mismatches for coupon, notification, user coupon assignment.
- [x] Convert low-risk read queries from MySQL contract to PostgreSQL contract.
- [x] Identify high-risk write paths that need transaction handling.
- [x] Re-run guard and record reduced count.

Evidence:

- Command output: Coupon inventory found 15 endpoints, 41 `db.query` calls before first fixes, 2 `db.execute` calls before first fixes, and guard findings reduced from 76 to 63 for `routes/couponcodes.js`.
- API smoke tests: App smoke import passed after coupon notification first fixes: `APP_OK`; direct PostgreSQL query checks passed for `coupon_list`, `coupon_notifications`, and `coupon_notification_read_check`.
- PR/commit: local working tree changes, not committed.
- Notes: Converted low-risk coupon notification paths and `GET /api/couponcodes` to PostgreSQL query/result contract; high-risk create/update/delete/validate paths are assigned to Sprint 2.

### Day 5 - Sprint Review and Sprint 2 Handoff

- [x] Run app smoke import.
- [x] Run `npm run check:mysql-patterns`.
- [x] Update this sprint doc with final counts.
- [x] Update `docs/migration-tracker.md` daily log and module statuses.
- [x] Choose Sprint 2 module order: Coupon -> Orders, or Orders -> Payments.
- [x] Document unresolved blockers with owner and ETA.

Evidence:

- App smoke: `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
- Guard count: `npm run check:mysql-patterns` -> fail as expected outside completed slice, latest total 819 findings.
- PR/commit: local working tree changes, not committed.
- Notes: Sprint 2 starts with Coupon, then Orders/Payments; entry criteria are documented in `docs/sprints/sprint-02-coupon-commerce-handoff.md`.

## 7. Definition of Done

- [x] New sprint docs exist and are linked from the tracker.
- [x] Contract docs exist for schema and column mapping.
- [x] `routes/auth.js` remains clean in guard.
- [x] `routes/users.js` is either clean or has documented remaining items.
- [x] Guard count is lower than 835, or every unchanged finding is explicitly assigned.
- [x] README database status is corrected.
- [x] Sprint 2 entry criteria are written.

## 8. Sprint 2 Entry Criteria

- [ ] P0 schema decisions are no longer blocked.
- [x] Transaction helper/pattern is ready for order/payment work.
- [x] Coupon/order/payment table mapping is clear.
- [x] Sprint 2 module order is selected.
- [x] Baseline and latest guard counts are recorded.

## 9. Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S1-B001 | Schema | `db-contract-postgres.md` and column mapping are missing | High | TBD | Closed |
| S1-B002 | Codebase | Guard still fails with 819 MySQL findings outside completed slice | High | TBD | Open |
| S1-B003 | Docs | README still describes MySQL as supported setup | Medium | TBD | Closed |
| S1-B004 | Legacy | `migrations/add-user-token-field.js` and `models/productModel.js` still use MySQL contracts | Medium | TBD | Open |
| S1-B005 | Commerce | Final `orders.order_status` numeric map and `payments` ownership relation need team confirmation | High | TBD | Open |

## 10. Notes for Daily Updates

Use this format when closing each day:

```md
### YYYY-MM-DD

- Done:
- Guard count:
- Smoke/API evidence:
- Blockers:
- Next action:
```

### 2026-05-01

- Done: Created PostgreSQL contract and column mapping docs; added `db/transaction.js`; migrated/audited `routes/users.js`; converted low-risk coupon notification reads/writes; created Sprint 2 handoff doc.
- Guard count: 819 findings, down from 835 baseline; `routes/auth.js` and `routes/users.js` both have 0 guard findings; `routes/couponcodes.js` has 63 remaining findings.
- Smoke/API evidence: App import returned `APP_OK`; transaction helper returned `TX_HELPER_OK`; representative user SQL checks returned OK.
- Blockers: `orders.order_status` numeric business map, `payments` relation decision, and remaining legacy migration/model files.
- Next action: Start Sprint 2 with `routes/couponcodes.js`, then continue Orders/Payments after schema decisions are confirmed.
