# Sprint 2 - Coupon to Commerce PostgreSQL Migration

- Project: `SONA_SPACE-Server`
- Sprint type: first full P0 module migration
- Prepared date: 2026-05-01
- Suggested duration: 5 working days
- Current status: Done / Sprint 3 handoff ready
- Source docs:
  - `docs/db-contract-postgres.md`
  - `docs/mysql-to-postgres-column-mapping.md`
  - `docs/migration-tracker.md`
  - `docs/sprints/sprint-01-postgres-migration-foundation.md`

## 1. Entry Criteria

- [x] PostgreSQL schema contract exists.
- [x] MySQL to PostgreSQL column mapping exists.
- [x] PostgreSQL transaction helper exists at `db/transaction.js`.
- [x] `routes/users.js` no longer contributes MySQL guard findings.
- [x] Coupon endpoint and SQL inventory exists in `docs/mysql-to-postgres-column-mapping.md`.
- [x] Low-risk coupon notification paths have first PostgreSQL fixes.
- [x] Final numeric `orders.order_status` business mapping is confirmed.
- [x] Final payment relation decision is confirmed: keep `orders.payment_id`.

## 2. Sprint Goal

Migrate `routes/couponcodes.js` to PostgreSQL contract, then clean the supporting commerce routes before the larger order flow migration.

## 3. Scope

- Convert remaining `routes/couponcodes.js` queries to PostgreSQL placeholders and `{ rows, rowCount }`.
- Replace coupon legacy columns with `couponcode_*` contract or documented API aliases.
- Replace `db.execute`, `insertId`, `affectedRows`, `DATE_SUB`, `IF(...)`, and `VALUES ?`.
- Use `withTransaction` for coupon create/update/delete paths that touch coupon, user assignment, and notifications.
- Confirm notification type handling for coupon events.
- Migrate `routes/payments.js` to the `orders.payment_id -> payments.payment_id` relation.
- Replace `routes/orderStatus.js` database dependency with the accepted numeric status catalog.
- Migrate `routes/orders-id.js` cancel/item read paths to PostgreSQL.
- Prepare order migration notes after supporting routes are clean.

## 4. Day-by-Day Checklist

### Day 1 - Coupon Reads

- [x] Convert remaining coupon read endpoints.
- [x] Add response aliases for frontend compatibility.
- [x] Run `npm run check:mysql-patterns` and reduce remaining `routes/couponcodes.js` findings from 63.

### Day 2 - Notification Paths

- [x] Convert notification read/read-all/delete endpoints.
- [x] Decide `coupon` vs `promotion` notification type.
- [x] Verify user notification flow.

### Day 3 - Coupon Create

- [x] Convert create endpoint with `RETURNING`.
- [x] Use `withTransaction`.
- [x] Replace bulk `VALUES ?` with PostgreSQL placeholder groups.

### Day 4 - Coupon Update/Delete/Validate

- [x] Convert dynamic update placeholders.
- [x] Wrap assignment replacement and delete flows in transactions.
- [x] Convert validation endpoint.

### Day 5 - Commerce Handoff

- [x] Run app smoke import.
- [x] Run guard and record latest count.
- [x] Confirm order/payment schema decisions.
- [x] Produce orders/payments SQL inventory for Sprint 3 or the next Sprint 2 slice.
- [x] Migrate `routes/payments.js`.
- [x] Migrate `routes/orderStatus.js`.
- [x] Migrate `routes/orders-id.js`.

## 5. Definition of Done

- [x] `routes/couponcodes.js` has zero MySQL guard findings.
- [x] Coupon create/update/delete paths use PostgreSQL transaction helper where needed.
- [x] Coupon API smoke tests are recorded.
- [x] `routes/payments.js` has zero MySQL guard findings.
- [x] `routes/orderStatus.js` has zero MySQL guard findings.
- [x] `routes/orders-id.js` has zero MySQL guard findings.
- [x] Tracker and sprint docs include latest guard count and blockers.
- [x] Orders/payments migration order is confirmed.

## 6. Known Blockers

| ID | Area | Blocker | Severity | Owner | Status |
|---|---|---|---|---|---|
| S2-B001 | Coupon | `couponcode.title`, `is_flash_sale`, and `combinations` do not exist in current PostgreSQL schema | High | TBD | Closed - response aliases used |
| S2-B002 | Notify | Seed has `promotion`, not `coupon`, in `notification_types` | Medium | TBD | Closed - fallback order is coupon, promotion, system |
| S2-B003 | Commerce | `orders.order_status` numeric business mapping is not finalized | High | TBD | Closed - numeric map documented |
| S2-B004 | Payments | Legacy routes expect `payments.order_id`; current schema stores `orders.payment_id` | High | TBD | Closed - keep current schema |

## 7. Evidence

- Syntax: `node -c routes/couponcodes.js` passed.
- App smoke: `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"` -> `APP_OK`.
- Guard: `npm run check:mysql-patterns` -> still fails outside completed slice, latest total 647 findings; `routes/couponcodes.js`, `routes/payments.js`, `routes/orderStatus.js`, `routes/orders-id.js`, `routes/auth.js`, and `routes/users.js` each have 0 findings.
- Coupon SQL smoke: `coupon_read_aliases: OK`, `coupon_user_aliases: OK`, `coupon_write_transaction: OK`.
- Payment SQL smoke: `payment_select_aliases: OK`; transaction write smoke skipped because local database has no orders.
- Order status route: static numeric status catalog, no dependency on removed `order_status` table.
- Orders-id route: migrated to numeric `orders.order_status`, `order_items.price`, `return_items`, `order_status_log`, and `withTransaction`; SQL parse smoke `orders_id_sql_parse: OK`.
- Commerce inventory remaining: `routes/orders.js` 16 endpoints / 157 findings.

## 8. Next Slice

Recommended order: `routes/orders.js`.

Sprint handoff note (2026-05-06):

- Sprint 3 has been activated in `docs/sprints/sprint-03-orders-core-postgres-migration.md`.
