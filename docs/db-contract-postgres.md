# PostgreSQL DB Contract

- Project: `SONA_SPACE-Server`
- Source of truth: `db/init/init.sql`
- Prepared for: Sprint 1 PostgreSQL Migration Foundation
- Last updated: 2026-05-01

## 1. Contract Rules

- Runtime database is PostgreSQL through `pg.Pool` in `config/database.js`.
- Query API is `await db.query(sql, params)` and returns `{ rows, rowCount }`.
- SQL placeholders must use `$1`, `$2`, ...; never `?`.
- Write queries that need inserted IDs must use `RETURNING`.
- Update/delete checks must use `rowCount`, not `affectedRows`.
- Transactions must use `withTransaction` from `db/transaction.js`.
- `db/init/init.sql` is the schema source of truth until a later migration file supersedes it.

## 2. DB Access Examples

```js
const { rows } = await db.query(
  'SELECT user_id, user_gmail FROM "user" WHERE user_id = $1',
  [userId]
);
```

```js
const { rows } = await db.query(
  `INSERT INTO couponcode (couponcode_code, couponcode_description)
   VALUES ($1, $2)
   RETURNING couponcode_id`,
  [code, description]
);
```

```js
const { rowCount } = await db.query(
  'UPDATE "user" SET user_disabled_at = NOW() WHERE user_id = $1',
  [userId]
);
```

```js
const { withTransaction } = require("../db/transaction");

await withTransaction(async (client) => {
  const { rows } = await client.query(
    'INSERT INTO payments (payment_method, payment_amount) VALUES ($1, $2) RETURNING payment_id',
    [method, amount]
  );

  await client.query(
    "UPDATE orders SET payment_id = $1 WHERE order_id = $2",
    [rows[0].payment_id, orderId]
  );
});
```

## 3. Core Tables

### Auth/User

| Table | Primary key | Important columns | Notes |
|---|---|---|---|
| `"user"` | `user_id` | `user_name`, `user_gmail`, `user_number`, `user_password`, `user_role`, `user_gender`, `user_token`, `remember_token`, `user_email_active`, `user_verified_at`, `user_disabled_at`, `deleted_at` | Quoted because `user` is reserved-like in SQL contexts. |
| `otps` | `id` | `user_id`, `otp_code`, `otp_type`, `expires_at`, `is_used` | `user_id` references `"user"`. |

### Coupon and Notifications

| Table | Primary key | Important columns | Notes |
|---|---|---|---|
| `couponcode` | `couponcode_id` | `couponcode_code`, `couponcode_description`, `couponcode_startday`, `couponcode_endday`, `couponcode_percent`, `couponcode_amount`, `couponcode_minimum_order`, `couponcode_maximum_discount`, `couponcode_quantity`, `couponcode_used`, `couponcode_status`, `couponcode_type` | Route code still has legacy aliases like `code`, `title`, `value_price`, `exp_time`. |
| `user_has_coupon` | `user_has_coupon_id` | `user_id`, `couponcode_id`, `status` | Unique pair: `(user_id, couponcode_id)`. |
| `notification_types` | `id` | `type_code`, `type_name`, `description`, `icon` | Seed uses `order`, `promotion`, `system`; coupon route currently expects `coupon`. |
| `notifications` | `id` | `type_id`, `title`, `message`, `link`, `sender_id` | Uses `sender_id`, not `created_by`. |
| `user_notifications` | `id` | `user_id`, `notification_id`, `is_read`, `read_at`, `is_deleted` | `is_read` and `is_deleted` are `SMALLINT`. |

### Catalog

| Table | Primary key | Important columns | Notes |
|---|---|---|---|
| `category` | `category_id` | `category_name`, `category_description`, `slug`, `category_image`, `status`, `category_priority` | Status column is `status`, not `category_status`. |
| `product` | `product_id` | `category_id`, `product_name`, `product_image`, `product_slug`, `product_description`, `product_priority`, `product_view`, `product_sold`, `product_status`, `product_stock` | Price is not on `product`; variant price lives on `variant_product`. |
| `variant_product` | `variant_id` | `product_id`, `color_id`, `variant_product_quantity`, `variant_product_price`, `variant_product_price_sale`, `variant_product_slug`, `variant_product_list_image` | Order and wishlist rows reference `variant_id`. |
| `color` | `color_id` | `color_name`, `color_code` | Legacy code may expect `color_hex`. |
| `materials` | `material_id` | `material_name`, `material_description`, `slug` | No `material_priority` in current schema. |

### Commerce

| Table | Primary key | Important columns | Notes |
|---|---|---|---|
| `orders` | `order_id` | `user_id`, `order_code`, `order_hash`, `order_status`, `order_total`, `order_discount`, `order_shipping_fee`, `order_final_total`, `order_payment_method`, `payment_id`, `couponcode_id` | Current schema uses numeric `order_status`; legacy string statuses map to the Sprint 2 numeric contract. |
| `payments` | `payment_id` | `payment_method`, `payment_status`, `payment_amount`, `payment_transaction_id`, `payment_info` | `orders.payment_id` references this table. There is no `payments.order_id` column in current schema. |
| `order_items` | `order_item_id` | `order_id`, `variant_id`, `quantity`, `price`, `comment_id` | Product is reached through `variant_product.product_id`. |
| `comment` | `comment_id` | `user_id`, `order_item_id`, `comment_content`, `comment_rating`, `comment_image`, `comment_status` | There is no `comment.product_id`. |
| `wishlist` | `wishlist_id` | `user_id`, `variant_id`, `quantity`, `status` | There is no `wishlist.product_id`. |

## 4. Sprint 1 Schema Decisions

| Decision | Status | Notes |
|---|---|---|
| `db/init/init.sql` is the current source of truth | Accepted | All Sprint 1 code/doc updates use this schema. |
| New DB code must use `pg` result shape | Accepted | `{ rows, rowCount }` only. |
| Transaction helper location | Accepted | `db/transaction.js`. |
| Coupon route should be Sprint 2 first module | Accepted | It has smaller scope than full order flow and unblocks voucher/notification mapping. |
| Coupon legacy response aliases | Accepted | `title` is exposed as `couponcode_code`, `isFlashSale` is `false`, and `combinations` is `null` until schema adds those fields. |
| Coupon notification type | Accepted | Prefer `coupon`, fall back to seeded `promotion`, then `system`. |
| `orders.order_status` numeric mapping | Accepted | `-1=cancelled`, `0=pending`, `1=confirmed`, `2=shipping`, `3=delivered`, `4=completed/success`. |
| `payments` ownership relation | Accepted | Keep current schema: `orders.payment_id -> payments.payment_id`; migrate route code to this relation unless a later schema migration is approved. |
| Order status catalog route | Accepted | `routes/orderStatus.js` exposes the numeric map as static metadata; there is no `order_status` table in the current schema. |

## 5. Open Schema Questions

| ID | Area | Question | Owner | Sprint target |
|---|---|---|---|---|
| S1-Q001 | Commerce | Final mapping for numeric `orders.order_status` values | TBD | Closed in Sprint 2 |
| S1-Q002 | Payments | Keep `orders.payment_id` or add `payments.order_id` for one-to-many payment history | TBD | Closed in Sprint 2 |
| S1-Q003 | Coupon | Should code contract expose legacy response aliases (`code`, `title`, `value_price`) or native `couponcode_*` columns | TBD | Closed in Sprint 2 |
| S1-Q004 | Notifications | Add coupon notification type seed or map coupon events to `promotion` | TBD | Closed in Sprint 2 |
