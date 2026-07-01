# Báo Cáo Migration Backend MySQL -> PostgreSQL (SONA_SPACE-Server)

- Thời điểm rà soát: 2026-04-06
- Phạm vi: toàn bộ `SONA_SPACE-Server` (routes, config DB, schema SQL, migrations, docs)
- Mục tiêu: xác định nguyên nhân lỗi backend hiện tại và lập kế hoạch migration toàn bộ backend sang PostgreSQL

## 1. Tóm tắt điều hành

Backend hiện **chưa ở trạng thái migrated hoàn chỉnh**. Hệ thống đang ở trạng thái "mixed" giữa code MySQL cũ và hạ tầng PostgreSQL mới.

Các điểm chính:

- Kết nối PostgreSQL hoạt động (pool `pg` connect OK).
- Rất nhiều route vẫn viết theo contract MySQL (`?`, `db.execute`, `insertId`, `getConnection`, `SHOW TABLES`, `DATE_FORMAT`, `IFNULL`, `ON DUPLICATE KEY`...).
- Nhiều route đã đổi sang style PostgreSQL (`$1`, `{ rows }`) nhưng **schema hiện tại trong `db/init/init.sql` không khớp** với các cột mà code đang truy vấn.
- Kết quả: lỗi runtime xuất hiện rộng trên hầu hết domain lớn (`orders`, `products`, `payments`, `coupon`, `notifications`, `contact forms`, `comments`, `events`, `materials`, `color`, `categories`).

Đánh giá mức độ:

- Mức độ ảnh hưởng: **Critical**
- Rủi ro nếu tiếp tục vá lẻ: **Rất cao**
- Khuyến nghị: đi theo **kế hoạch migration theo module + chuẩn hóa schema contract** thay vì sửa ngẫu nhiên từng endpoint.

## 2. Dữ liệu rà soát kỹ thuật

### 2.1 Tổng quan thống kê code route

- Tổng route files: **31**
- Route có dùng placeholder PostgreSQL (`$1`, `$2`, ...): **7 files**
- Route có dấu hiệu placeholder `?`/MySQL style: **28 files**
- Route dùng `db.execute(...)`: **3 files** (`couponcodes.js`, `events.js`, `typenotify.js`)
- Route dùng transaction kiểu MySQL `db.getConnection()/beginTransaction()`: **4 files** (`comments.js`, `orders-id.js`, `orders.js`, `products.js`)
- Route có destructuring kiểu MySQL `[rows] = await db.query(...)`: **17 files**
- Route có dùng `insertId`: **16 files**

### 2.2 File có khối lượng truy vấn lớn nhất (ưu tiên migration trước)

1. `routes/orders.js`: ~110 DB calls (gồm transaction/phân nhánh lớn)
2. `routes/products.js`: ~77 DB calls
3. `routes/couponcodes.js`: ~43 DB calls
4. `routes/auth.js`: ~35 DB calls
5. `routes/orders-id.js`: ~28 DB calls
6. `routes/comments.js`: ~27 DB calls
7. `routes/users.js`: ~27 DB calls

## 3. Lỗi có thể tái hiện ngay (reproducible)

### 3.1 Contract driver không tương thích (`pg` vs `mysql2`)

Đã chạy smoke script và nhận được:

- `const [rows] = await db.query(...)` -> **`(intermediate value) is not iterable`**
- `db.execute(...)` -> **`db.execute is not a function`**
- `db.getConnection(...)` -> **`db.getConnection is not a function`**

### 3.2 SQL syntax MySQL không chạy trên PostgreSQL

Đã test trực tiếp:

- `DATE_FORMAT(...)` -> function does not exist
- `IFNULL(...)` -> function does not exist
- `ON DUPLICATE KEY UPDATE` -> syntax error
- Query dùng `?` placeholder -> syntax error

### 3.3 Schema mismatch (code kỳ vọng cột khác hoàn toàn `init.sql`)

Đã test trực tiếp nhiều query từ route và đều lỗi cột/bảng:

- `category_icon`, `category_status` không tồn tại
- `couponcode.code` không tồn tại (schema dùng `couponcode_code`)
- `orders.order_total_final`, `current_status` không tồn tại
- bảng `payment` không tồn tại (schema là `payments`)
- `events.id`, `title`, `image_url` không tồn tại (schema `event_id`, `event_title`, `event_image`)
- `color.color_hex` không tồn tại (schema `color_code`)
- `comment.product_id` không tồn tại
- `contact_form_design.name` không tồn tại
- `notifications.created_by` không tồn tại
- `materials.material_priority` không tồn tại
- `chatbot_context.context_text` không tồn tại

## 4. Nhóm vấn đề gốc (Root Causes)

## 4.1 Mismatch layer truy cập DB

- `config/database.js` dùng `pg.Pool` trả về object `{ rows, rowCount, ... }`.
- Code cũ dùng contract `mysql2` (`[rows]`, `[result]`, `insertId`, `affectedRows`).

## 4.2 Mismatch SQL dialect

Các pattern MySQL còn tồn tại rộng:

- Placeholder: `?`
- Hàm: `DATE_FORMAT`, `IFNULL`, `DATE_SUB`, `CURDATE`
- JSON MySQL: `JSON_ARRAYAGG`, `JSON_OBJECT`
- Upsert: `ON DUPLICATE KEY UPDATE`
- Metadata SQL: `SHOW TABLES`, `SHOW COLUMNS`, `DATABASE()`

## 4.3 Mismatch schema contract

`db/init/init.sql` đã là PostgreSQL nhưng tên bảng/cột khác xa SQL trong route.

Ví dụ điển hình:

- `category`: code dùng `category_status`, schema là `status`
- `banners`: code dùng `title/image_url/position/is_active/page_type`, schema là `banner_title/banner_image/banner_priority/status`
- `orders`: code dùng `current_status/order_total_final/shipping_fee/...`, schema dùng `order_status/order_final_total/order_shipping_fee/...`
- `payments`: code kỳ vọng bảng có `order_id/method/status/transaction_code`, schema hiện không có cấu trúc đó
- `couponcode`: code dùng `code/title/value_price/exp_time/...`, schema dùng `couponcode_code/couponcode_percent/couponcode_endday/...`

## 4.4 Legacy artifact chưa dọn

- `migrations/add-user-token-field.js` đã được chuẩn hóa theo PostgreSQL và được giữ lại như một script maintenance riêng
- `models/categoryModel.js`, `models/productModel.js`, `models/chatbotPrompt.js` đã được dọn khỏi source tree trong cleanup cuối
- Một số compatibility routes vẫn được giữ lại có chủ đích cho dashboard/client, nhưng hiện đã gắn deprecation headers để báo hiệu bề mặt cũ
- `README.md` vẫn ghi hỗ trợ song song MySQL/PostgreSQL, không phản ánh đúng trạng thái thực tế

## 5. Ma trận mức độ sẵn sàng migration theo module

| Module | Trạng thái hiện tại | Mức độ lỗi | Ưu tiên |
|---|---|---|---|
| Auth/User core (`auth.js`, `users.js`) | Trộn PG syntax + schema mismatch | Cao | P0 |
| Catalog core (`products.js`, `variants.js`, `categories.js`, `rooms.js`, `color.js`, `materials.js`) | Trộn rất nặng MySQL + schema mismatch | Critical | P0 |
| Commerce core (`orders.js`, `orders-id.js`, `payments.js`, `couponcodes.js`, `orderStatus.js`) | MySQL-heavy + transaction MySQL API + schema mismatch lớn | Critical | P0 |
| Social/CRM (`comments.js`, `wishlists.js`, `wishlists-id.js`, `contactFormsDesign.js`) | MySQL-heavy + cột không khớp | Critical | P1 |
| Content (`news.js`, `newsCategories.js`, `events.js`, `banners.js`, `notify.js`, `typenotify.js`) | mixed + nhiều bảng/cột không khớp | Cao | P1 |
| Dashboard/debug/chat | phụ thuộc dữ liệu từ module trên + query legacy | Cao | P2 |

## 6. Kế hoạch migration toàn bộ backend (đề xuất chi tiết)

## 6.1 Nguyên tắc triển khai

- Chốt **một source-of-truth schema** duy nhất cho PostgreSQL.
- Không vá endpoint rời rạc nếu chưa chốt contract table/column.
- Mỗi module phải có smoke test trước/sau migration.
- Ưu tiên "luồng tiền" trước: auth -> catalog -> order/payment.

## 6.2 Pha 0 - Chuẩn bị (1-2 ngày)

1. Chốt schema đích PostgreSQL (ERD + data dictionary).
2. Đóng băng thay đổi DB tự phát trên branch chính.
3. Tạo bản sao dữ liệu MySQL hiện tại và snapshot PostgreSQL hiện tại.
4. Tạo tài liệu mapping nghiệp vụ: MySQL cũ -> PostgreSQL mới.

Deliverables:

- `docs/db-contract-postgres.md`
- `docs/mysql-to-postgres-column-mapping.md`

## 6.3 Pha 1 - Ổn định layer DB (2-3 ngày)

1. Chuẩn hóa toàn bộ data access theo 1 contract duy nhất:
   - `await db.query(sql, params)` -> luôn trả `{ rows, rowCount }`
2. Loại bỏ `db.execute`, `db.getConnection` kiểu mysql2.
3. Tạo helper transaction chuẩn PostgreSQL:
   - `withTransaction(async (client) => { ... })`
4. Cấm thêm query mới dùng `?` trong PR (lint rule/check script).

Deliverables:

- `config/database.js` + `db/transaction.js` chuẩn PG
- script CI fail nếu còn pattern MySQL

## 6.4 Pha 2 - Chuẩn hóa schema (3-5 ngày)

1. Viết migration SQL theo thứ tự phụ thuộc khóa ngoại.
2. Đồng bộ tên bảng/cột theo contract code hoặc ngược lại (quyết định ở Pha 0).
3. Chuẩn hóa enum/status thay vì string rời rạc.
4. Tạo index đúng cho truy vấn chính (`orders`, `order_items`, `wishlist`, `product`, `couponcode`).

Deliverables:

- `db/migrations/*.sql`
- script migrate up/down + seed test

## 6.5 Pha 3 - Migration module P0 (5-8 ngày)

### 3.1 Commerce core

- `orders.js`, `orders-id.js`, `payments.js`, `couponcodes.js`, `orderStatus.js`
- Chuyển toàn bộ query sang PostgreSQL:
  - `?` -> `$n`
  - `ON DUPLICATE KEY` -> `ON CONFLICT`
  - `DATE_FORMAT` -> `TO_CHAR`
  - `IFNULL` -> `COALESCE`
  - `LIMIT ?, ?` -> `LIMIT $x OFFSET $y`

### 3.2 Catalog core

- `products.js`, `variants.js`, `categories.js`, `rooms.js`, `color.js`, `materials.js`
- Chuẩn hóa field theo schema mới.
- Tách query phức tạp thành repository function để test được.

### 3.3 Auth/User

- `auth.js`, `users.js`
- Sửa các insert/update theo đúng bảng `couponcode`, `notifications`, `otps`, `user_notifications`.

Deliverables P0:

- Các endpoint P0 chạy pass smoke test + integration test cơ bản
- Không còn `db.execute/getConnection/insertId` trong các file P0

## 6.6 Pha 4 - Migration module P1/P2 (4-6 ngày)

1. P1: `comments`, `wishlists`, `contactFormsDesign`, `news`, `newsCategories`, `events`, `banners`, `notify`, `typenotify`
2. P2: `dashboard`, `debug`, `chat`
3. Dọn legacy `models/*` không còn dùng
4. Cập nhật README và runbook deploy PG-only

## 6.7 Pha 5 - Kiểm thử, cutover và rollback (2-3 ngày)

1. Kiểm thử hồi quy endpoint critical (auth/order/payment).
2. Kiểm thử dữ liệu: đối soát tổng đơn, doanh thu, coupon, tồn kho.
3. Cutover theo môi trường staging -> production.
4. Rollback plan:
   - snapshot DB
   - backup release trước
   - toggle feature flag đọc/ghi module mới

## 7. Checklist kỹ thuật bắt buộc trước khi hoàn tất migration

- Không còn `db.execute(...)`
- Không còn `db.getConnection(...)` kiểu mysql2
- Không còn destructuring `[rows] = await db.query(...)`
- Không còn SQL MySQL-specific (`DATE_FORMAT`, `IFNULL`, `ON DUPLICATE KEY`, `SHOW TABLES`, `CURDATE`, `DATE_SUB`)
- Không còn truy vấn bảng/cột không tồn tại trong schema PostgreSQL đích
- 100% endpoint trọng yếu có integration tests

## 8. Ước lượng tổng quan

- Pha 0-2: 6-10 ngày
- Pha 3: 5-8 ngày
- Pha 4: 4-6 ngày
- Pha 5: 2-3 ngày

Tổng ước lượng: **17-27 ngày làm việc** (1 team backend nhỏ, xử lý tuần tự theo module).

## 9. Khuyến nghị hành động ngay (24-48h)

1. Chốt schema contract PostgreSQL trước khi sửa code tiếp.
2. Khóa việc thêm query kiểu MySQL mới vào codebase.
3. Ưu tiên sửa module P0 theo thứ tự:
   - `orders/payments/coupon`
   - `products/variants`
   - `auth/users`
4. Tạo bộ smoke test API tối thiểu cho các route quan trọng để đo tiến độ migration thực tế.

---

## Phụ lục A - Ví dụ mapping cú pháp MySQL -> PostgreSQL

- `?` -> `$1, $2, ...`
- `IFNULL(a, b)` -> `COALESCE(a, b)`
- `DATE_FORMAT(ts, '%Y-%m')` -> `TO_CHAR(ts, 'YYYY-MM')`
- `ON DUPLICATE KEY UPDATE` -> `ON CONFLICT (...) DO UPDATE`
- `NOW() - INTERVAL 1 DAY` -> `NOW() - INTERVAL '1 day'`
- `LIMIT offset, limit` -> `LIMIT limit OFFSET offset`

## Phụ lục B - Các file cần ưu tiên refactor theo độ phức tạp

1. `routes/orders.js`
2. `routes/products.js`
3. `routes/couponcodes.js`
4. `routes/auth.js`
5. `routes/orders-id.js`
6. `routes/comments.js`
7. `routes/users.js`
