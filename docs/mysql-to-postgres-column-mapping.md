# MySQL to PostgreSQL Column Mapping

- Project: `SONA_SPACE-Server`
- Source of truth: `db/init/init.sql`
- Prepared for: Sprint 1 PostgreSQL Migration Foundation
- Last updated: 2026-05-01

## 1. SQL and Driver Mapping

| MySQL pattern | PostgreSQL pattern | Notes |
|---|---|---|
| `?` | `$1`, `$2`, ... | Positional placeholders are 1-based. |
| `const [rows] = await db.query(...)` | `const { rows } = await db.query(...)` | `pg` returns an object. |
| `result.insertId` | `rows[0].id` from `RETURNING id` | Add `RETURNING` to inserts. |
| `result.affectedRows` | `rowCount` | Returned by `pg`. |
| `db.execute(...)` | `db.query(...)` | No `execute` method on `pg.Pool`. |
| `db.getConnection()` transaction | `withTransaction(async (client) => {})` | Use `db/transaction.js`. |
| `DATE_SUB(NOW(), INTERVAL 30 DAY)` | `NOW() - INTERVAL '30 days'` | PostgreSQL interval literal. |
| `IF(condition, a, b)` | `CASE WHEN condition THEN a ELSE b END` | Used in coupon reads. |
| `IFNULL(a, b)` | `COALESCE(a, b)` | Same null fallback behavior. |
| `LIMIT offset, limit` | `LIMIT $limit OFFSET $offset` | Order is reversed. |
| `VALUES ?` bulk insert | Build numbered placeholder groups | Example: `($1,$2),($3,$4)`. |

## 2. Auth/User Mapping

| Legacy/code expectation | PostgreSQL table.column | Status | Notes |
|---|---|---|---|
| `user.id` | `"user".user_id` | Accepted | API can still return `id` alias. |
| `email` | `"user".user_gmail` | Accepted | Login/register uses gmail column. |
| `full_name` / `name` | `"user".user_name` | Accepted | API response alias only. |
| `phone` | `"user".user_number` | Accepted | API response alias only. |
| `password` | `"user".user_password` | Accepted | Hashed password. |
| `role` | `"user".user_role` | Accepted | Enum: `admin`, `user`, `staff`. |
| `gender` | `"user".user_gender` | Accepted | Enum: `male`, `female`, `other`. |
| email active flag | `"user".user_email_active` | Accepted | Current schema uses `SMALLINT`. |
| disabled timestamp | `"user".user_disabled_at` | Accepted | Soft disable for account status. |
| verification token | `"user".user_token` | Accepted | Auth route clears token after verify. |
| remember token | `"user".remember_token` | Accepted | Present in schema. |
| OTP code | `otps.otp_code` | Accepted | `otps.user_id` references `"user"`. |

## 3. Coupon Mapping

| Legacy/code expectation | PostgreSQL table.column | Status | Notes |
|---|---|---|---|
| `couponcode.code` | `couponcode.couponcode_code` | Must migrate | Route currently uses `code`. |
| `couponcode.title` | API alias from `couponcode.couponcode_code` | Accepted | Current PostgreSQL schema has no separate title column. |
| `couponcode.description` | `couponcode.couponcode_description` | Must migrate | API can alias to `description`. |
| `couponcode.start_time` | `couponcode.couponcode_startday` | Must migrate | Date only in current schema. |
| `couponcode.exp_time` | `couponcode.couponcode_endday` | Must migrate | Date only in current schema. |
| `couponcode.value_price` percentage | `couponcode.couponcode_percent` | Must migrate | For percentage coupons. |
| `couponcode.value_price` fixed amount | `couponcode.couponcode_amount` | Must migrate | For fixed amount coupons. |
| `couponcode.min_order` | `couponcode.couponcode_minimum_order` | Must migrate | Decimal. |
| max discount | `couponcode.couponcode_maximum_discount` | Accepted | Present in schema. |
| `couponcode.used` as remaining quantity | `GREATEST(couponcode_quantity - couponcode_used, 0)` | Accepted | API keeps `used` as remaining quota for frontend compatibility. |
| used count | `couponcode.couponcode_used` | Accepted | Increment when consumed. |
| `couponcode.status` | `couponcode.couponcode_status` | Must migrate | `SMALLINT`. |
| `couponcode.discount_type` | `couponcode.couponcode_type` | Accepted | `0=percentage`, `1=fixed`. |
| `is_flash_sale` | API alias `false` | Accepted | No persisted column in current schema. |
| `combinations` | API alias `null` | Accepted | No persisted column in current schema. |
| user coupon status | `user_has_coupon.status` | Accepted | `0` available, `1` used by legacy route. |

## 4. Notification Mapping

| Legacy/code expectation | PostgreSQL table.column | Status | Notes |
|---|---|---|---|
| `notification_types.type_code = 'coupon'` | Prefer `coupon`, then `promotion`, then `system` | Accepted | Current seed has `promotion`; route uses fallback order. |
| `notifications.created_by` | `notifications.sender_id` | Must migrate | Current schema has integer sender ID. |
| `notifications.id` | `notifications.id` | Accepted | Primary key unchanged. |
| `user_notifications.is_read = 0/1` | `user_notifications.is_read` | Accepted | `SMALLINT`; API returns boolean-like values. |
| soft delete notification | `user_notifications.is_deleted` | Accepted | `SMALLINT`. |

## 5. Product/Catalog Mapping

| Legacy/code expectation | PostgreSQL table.column | Status | Notes |
|---|---|---|---|
| `category.category_status` | `category.status` | Must migrate | Already documented root mismatch. |
| `product.price` / `product.product_price` | `variant_product.variant_product_price` | Must migrate | Price is variant-specific. |
| sale price | `variant_product.variant_product_price_sale` | Accepted | Nullable. |
| stock | `variant_product.variant_product_quantity` or `product.product_stock` | Needs decision | Current schema has both aggregate and variant quantity. |
| `color.color_hex` | `color.color_code` | Must migrate | Route should alias if needed. |
| `materials.material_priority` | No direct column | Needs decision | Add column or remove ordering. |

## 6. Commerce Mapping

| Legacy/code expectation | PostgreSQL table.column | Status | Notes |
|---|---|---|---|
| `orders.current_status` | `orders.order_status` | Accepted | `-1=cancelled`, `0=pending`, `1=confirmed`, `2=shipping`, `3=delivered`, `4=completed/success`. |
| `orders.order_total_final` | `orders.order_final_total` | Must migrate | Name difference only. |
| `orders.shipping_fee` | `orders.order_shipping_fee` | Must migrate | Name difference only. |
| `orders.payment_method` | `orders.order_payment_method` | Must migrate | Enum: `cod`, `momo`, `vnpay`, `zalopay`. |
| `payments.order_id` | `orders.payment_id` references `payments.payment_id` | Accepted | Keep current schema for next migration; payment history would require a later schema migration. |
| `payments.method` | `payments.payment_method` | Migrated | `routes/payments.js` keeps `method` response alias. |
| `payments.status` | `payments.payment_status` | Migrated | `routes/payments.js` keeps `status` response alias. |
| `payments.amount` | `payments.payment_amount` | Migrated | `routes/payments.js` keeps `amount` response alias. |
| `payments.transaction_code` | `payments.payment_transaction_id` | Migrated | `routes/payments.js` uses `transaction_id` response alias. |
| `order_items.product_id` | `order_items.variant_id -> variant_product.product_id` | Must migrate | Product is derived through variant. |
| `order_items.product_price` | `order_items.price` | Partially migrated | `routes/orders-id.js` uses `price`; `routes/orders.js` still pending. |
| `comment.product_id` | `comment.order_item_id -> order_items.variant_id -> variant_product.product_id` | Must migrate | User route now follows this path. |
| `wishlist.product_id` | `wishlist.variant_id -> variant_product.product_id` | Must migrate | User route now follows this path. |

## 7. Sprint 2 Coupon SQL Inventory

| Endpoint | Current risk | Sprint 2 action |
|---|---|---|
| `GET /api/couponcodes` | MySQL result destructuring | Convert to `{ rows }` and native `couponcode_*` aliases. |
| `GET /api/couponcodes/notification` | `?`, `is_deleted = 0` | Convert placeholders; keep smallint comparisons. |
| `PATCH /api/couponcodes/notification/read/:id` | `db.execute`, `?` | Convert to `db.query`, `rowCount`. |
| `GET /api/couponcodes/user-has-coupon` | Legacy coupon columns | Map all coupon fields to `couponcode_*`. |
| `GET /api/couponcodes/codes` | `IF(...)`, legacy coupon columns | Use `CASE WHEN`; map coupon fields. |
| `GET /api/couponcodes/admin` | Legacy coupon columns | Map to native columns or API aliases. |
| `GET /api/couponcodes/userCoupon` | Legacy coupon columns | Map to native columns or API aliases. |
| `GET /api/couponcodes/:id` | `?`, `DATE_SUB`, unquoted `user` | Convert placeholders and interval; quote `"user"`. |
| `POST /api/couponcodes/mark-all-read` | `affectedRows` | Use `rowCount`. |
| `POST /api/couponcodes` | Insert ID, bulk `VALUES ?`, notification schema mismatch | Use transaction helper, `RETURNING`, generated placeholders, `sender_id`. |
| `PUT /api/couponcodes/:id/status` | `?`, legacy `status` | Use `couponcode_status`, `rowCount`. |
| `PUT /api/couponcodes/:id` | dynamic `?`, bulk `VALUES ?`, duplicate delete block | Rebuild dynamic placeholders and wrap user assignment in transaction. |
| `DELETE /api/couponcodes/notification/:id` | `affectedRows` | Use `rowCount`. |
| `DELETE /api/couponcodes/:id` | multi-step delete without transaction | Wrap in `withTransaction`. |
| `POST /api/couponcodes/validate` | legacy coupon columns, repeated checks | Map fields; clarify global coupon semantics. |

Sprint 2 result: `routes/couponcodes.js` has zero MySQL guard findings and keeps frontend response aliases while using PostgreSQL-native columns internally.

## 8. Commerce SQL Inventory

| File | Endpoints | DB calls | Main risks |
|---|---:|---:|---|
| `routes/orders.js` | 16 | 74 `db.query`, 4 `db.getConnection` | 157 guard findings; legacy string `current_status`; `payments.order_id`; MySQL transactions; many `?` placeholders; `insertId`; bulk order/item writes. |
| `routes/payments.js` | 6 | 22 `db.query` | Migrated; 0 guard findings; uses `orders.payment_id` relation and payment response aliases. |
| `routes/orders-id.js` | 6 | 8 `db.query`, 2 transactions | Migrated; 0 guard findings; uses numeric order status, `order_items.price`, `return_items`, and `withTransaction`. |
| `routes/orderStatus.js` | 5 | 0 `db.query` | Migrated; 0 guard findings; exposes static numeric status catalog from the PostgreSQL contract. |

Recommended next order:

1. `routes/orders.js`: largest order flow and remaining commerce risk.

## 9. Sprint 2 Recommendation

Sprint 2 started with `routes/couponcodes.js`, then cleaned `routes/payments.js`, `routes/orderStatus.js`, and `routes/orders-id.js`. Continue with `routes/orders.js`.

Reason: coupon has a contained table set (`couponcode`, `user_has_coupon`, `notification_types`, `notifications`, `user_notifications`) and exercises the transaction helper before the larger order/payment flow.
