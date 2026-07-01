# Quy Trinh Thuc Thi Migration va Sua Loi Backend (SONA_SPACE-Server)

- Ap dung cho: migration backend tu MySQL sang PostgreSQL
- Muc tieu: chuyen doi on dinh, co kiem soat rui ro, co rollback ro rang
- Dau vao tham chieu: `docs/bao-cao-migration-backend-mysql-to-postgresql.md`

## 1. Nguyen tac van hanh

1. Chi dung mot contract DB duy nhat: PostgreSQL (`pg`).
2. Khong sua le tung endpoint neu chua chot contract schema cho module do.
3. Moi thay doi phai co smoke test truoc va sau khi sua.
4. Uu tien luong nghiep vu quan trong truoc: auth -> catalog -> order/payment.
5. Moi phase phai co tieu chi pass/fail truoc khi qua phase tiep theo.

## 2. Co cau branch va luong lam viec

1. Tao branch tong: `feature/migration-postgres`.
2. Moi module tao branch con:
- `feature/migration-postgres-auth-users`
- `feature/migration-postgres-catalog`
- `feature/migration-postgres-commerce`
- `feature/migration-postgres-content-crm`
3. Quy dinh merge:
- Merge branch con vao branch tong sau khi dat gate module.
- Chi merge branch tong vao `main` khi dat gate cutover.
4. Cam merge truc tiep vao `main` trong thoi gian migration.

## 3. Quy trinh thuc thi theo phase

## Phase 0 - Chuan bi va dong bo contract (1-2 ngay)

Muc tieu: chot schema PostgreSQL dich va quy tac migration.

Buoc thuc hien:
1. Chot data dictionary:
- Ten bang
- Ten cot
- Kieu du lieu
- Rang buoc
- Quan he FK
2. Chot mapping MySQL cu -> PostgreSQL moi theo tung bang/cot.
3. Chot danh sach endpoint critical:
- Auth dang nhap/dang ky
- Product list/detail
- Tao don/thanh toan
- Don hang cua user
4. Snapshot du lieu:
- Backup MySQL hien tai
- Backup PostgreSQL hien tai

Dieu kien hoan tat Phase 0:
1. Co tai lieu contract schema da duoc team thong nhat.
2. Co file mapping du lieu va mapping ten cot.
3. Co backup co the restore ngay.

## Phase 1 - On dinh DB access layer (2-3 ngay)

Muc tieu: dua code ve cung mot contract truy cap DB.

Buoc thuc hien:
1. Chuan hoa pattern truy van:
- `const { rows } = await db.query(sql, params)`
- Khong dung `[rows] = await db.query(...)`
2. Loai bo API MySQL khong ton tai tren `pg`:
- `db.execute`
- `db.getConnection`
- `insertId`
3. Them helper transaction PostgreSQL:
- `withTransaction(async (client) => { ... })`
4. Tao script scan pattern MySQL con sot:
- `?` placeholder trong SQL
- `DATE_FORMAT`, `IFNULL`, `ON DUPLICATE KEY`, `SHOW TABLES`

Dieu kien hoan tat Phase 1:
1. Khong con `db.execute` trong codebase.
2. Khong con `db.getConnection` theo mysql2.
3. Tat ca truy van moi deu dung contract `pg`.

## Phase 2 - Chuan hoa schema va migration SQL (3-5 ngay)

Muc tieu: schema DB phai khop voi code contract cua tung module.

Buoc thuc hien:
1. Tao migration SQL co thu tu phu thuoc FK.
2. Chuan hoa ten bang/cot theo quy uoc da chot o Phase 0.
3. Chuyen logic status string roi rac sang enum/check khi can.
4. Them index cho query nong:
- `orders`
- `order_items`
- `product`
- `variant_product`
- `wishlist`
- `couponcode`
5. Tao script migrate up/down cho staging.

Dieu kien hoan tat Phase 2:
1. Schema staging khoi tao duoc tu migration SQL.
2. Query test co ban khong con loi cot/bang khong ton tai.
3. Co tai lieu thay doi schema theo tung migration.

## Phase 3 - Migration module P0 (5-8 ngay)

Muc tieu: khoi nghiep vu cot loi hoat dong on dinh tren PostgreSQL.

Thu tu thuc hien khuyen nghi:
1. Commerce core:
- `routes/orders.js`
- `routes/orders-id.js`
- `routes/payments.js`
- `routes/couponcodes.js`
- `routes/orderStatus.js`
2. Catalog core:
- `routes/products.js`
- `routes/variants.js`
- `routes/categories.js`
- `routes/rooms.js`
- `routes/color.js`
- `routes/materials.js`
3. Auth/User:
- `routes/auth.js`
- `routes/users.js`

Quy tac sua trong Phase 3:
1. Doi SQL MySQL -> PostgreSQL:
- `?` -> `$1..$n`
- `IFNULL` -> `COALESCE`
- `DATE_FORMAT` -> `TO_CHAR`
- `ON DUPLICATE KEY UPDATE` -> `ON CONFLICT`
- `LIMIT offset, limit` -> `LIMIT limit OFFSET offset`
2. Chuan hoa ten cot theo schema da chot.
3. Moi endpoint sua xong phai co ket qua test tay va log query pass.

Dieu kien hoan tat Phase 3:
1. Luong auth, catalog, order/payment chay pass end-to-end tren staging.
2. Khong con loi runtime do contract driver (`not iterable`, `db.execute is not a function`, `insertId`).

## Phase 4 - Migration module P1/P2 va don dep legacy (4-6 ngay)

Muc tieu: hoan tat cac module con lai va loai bo di tich MySQL.

Buoc thuc hien:
1. P1:
- `comments`
- `wishlists`
- `contactFormsDesign`
- `news`
- `newsCategories`
- `events`
- `banners`
- `notify`
- `typenotify`
2. P2:
- `dashboard`
- `debug`
- `chat`
3. Don dep:
- Loai bo file model legacy khong dung (`models/categoryModel.js`, `models/productModel.js`)
- Cap nhat `README.md` thanh PostgreSQL-only

Dieu kien hoan tat Phase 4:
1. Khong con pattern MySQL trong code backend.
2. Dashboard khong con query den bang/cot sai.
3. Tai lieu huong dan chay moi da cap nhat.

## Phase 5 - Regression test, cutover, rollback drill (2-3 ngay)

Muc tieu: phat hanh an toan va co duong lui.

Buoc thuc hien:
1. Regression test theo danh sach endpoint critical.
2. Doi soat du lieu:
- So don
- Tong doanh thu
- So voucher dang hieu luc
- Ton kho theo variant
3. Chay rollback drill tren staging:
- Restore snapshot
- Verify app startup
- Verify endpoint critical
4. Len lich cutover production.

Dieu kien hoan tat Phase 5:
1. Regression pass.
2. Rollback drill pass.
3. Team ky xac nhan release.

## 4. Checklist thao tac cho moi module

1. Trich danh sach endpoint trong module.
2. Liet ke SQL hien tai va danh dau:
- SQL syntax MySQL
- Placeholder `?`
- Bang/cot nghi sai schema
3. Sua SQL + mapping cot.
4. Sua contract driver (`rows`, `rowCount`, transaction).
5. Chay smoke test endpoint.
6. Chay happy path + 1-2 case loi.
7. Ghi lai ket qua vao migration tracker.

## 5. Mau migration tracker (goi y)

- Module
- File
- So endpoint
- So query da sua
- Van de schema da xu ly
- Ket qua test
- Trang thai
- Nguoi phu trach
- Ngay cap nhat

## 6. Command van hanh khuyen nghi

1. Khoi dong app dev:
```bash
npm run dev
```
2. Scan nhanh pattern MySQL con sot:
```bash
rg -n "db\.execute|getConnection\(|insertId|DATE_FORMAT|IFNULL|ON DUPLICATE KEY|SHOW TABLES|\?" routes config migrations
```
2b. Run guard script (fail neu con pattern MySQL):
```bash
npm run check:mysql-patterns
```
3. Smoke load app:
```bash
node -e "require('./app'); console.log('APP_OK')"
```
4. Kiem tra ket noi PostgreSQL:
```bash
node -e "const db=require('./config/database'); db.query('SELECT NOW()').then(r=>console.log(r.rows[0])).catch(console.error)"
```
5. Kiem tra helper transaction PostgreSQL:
```bash
node -e "const {withTransaction}=require('./db/transaction'); console.log(typeof withTransaction === 'function' ? 'TX_HELPER_OK' : 'TX_HELPER_MISSING'); process.exit(0)"
```

## 7. Definition of Done cho migration backend

1. Codebase backend khong con phu thuoc MySQL API/syntax.
2. Schema PostgreSQL va code dong nhat theo contract da chot.
3. Endpoint critical pass regression test.
4. Co rollback runbook da duoc test.
5. README va tai lieu van hanh da cap nhat theo PostgreSQL-only.

## 8. Ke hoach thuc thi ngay (de xuat 7 ngay dau)

Ngay 1:
1. Chot contract schema + mapping cot.
2. Dong bang branch va freeze thay doi DB khong theo quy trinh.

Ngay 2:
1. Chuan hoa DB layer (`db.query`, transaction helper).
2. Tao script scan pattern MySQL.

Ngay 3-4:
1. Migration `orders/payments/coupon`.
2. Smoke test end-to-end luong dat hang.

Ngay 5:
1. Migration `products/variants/categories/rooms`.
2. Smoke test luong duyet san pham.

Ngay 6:
1. Migration `auth/users`.
2. Test dang ky/dang nhap/phan quyen.

Ngay 7:
1. Tong hop loi ton dong P0.
2. Chot readiness de vao P1/P2.

---

Cap nhat tiep theo:
- Sau moi ngay, cap nhat migration tracker va danh sach blocker de dieu phoi nguon luc.

## 9. PR Guard Automation

1. Workflow:
- `.github/workflows/mysql-pattern-guard.yml`
2. Trigger:
- `pull_request`
- `workflow_dispatch`
3. Gate command:
- `npm run check:mysql-patterns`
4. Merge rule:
- PR khong duoc merge neu job guard dang fail.

## 10. Quy Tac Chuyen Sprint

1. Khi sprint hien tai da dat du "Definition of Done" va checklist scope da `[x]`, agent phai tu dong chuyen sang sprint tiep theo.
2. Khi chuyen sprint, bat buoc cap nhat:
- `docs/sprints/README.md` (status sprint cu/sprint moi)
- File sprint hien tai (dong sprint + handoff note)
- File sprint moi (goal, baseline, checklist ngay dau)
- `docs/migration-tracker.md` (daily log + next action)
3. Neu sprint chua the dong vi blocker critical, khong duoc tao sprint moi de thay the; phai giu sprint hien tai o `Blocked` hoac `In Progress` va ghi blocker ro rang.

## 11. QA/QC Route Gate (Bo sung)

Ap dung cho moi thay doi route backend, ke ca fix nho.

Tai lieu chuan:

- `docs/qa-qc-route-regression-playbook.md`

Gate toi thieu truoc khi merge:

1. L0 runtime gate:
- `npm run check:mysql-patterns`
- `node -e "require('./app'); console.log('APP_OK'); process.exit(0)"`
- `node -c routes/<file-da-sua>.js`
2. L1 contract gate:
- Kiem tra status code happy path + error path (`400/401/403/404/500`)
- Kiem tra auth/role cho route private/admin
- Kiem tra shape response de khong vo frontend dashboard
3. L2 flow gate:
- Neu co anh huong commerce/catalog/auth, phai chay smoke flow lien quan
4. L3 data gate:
- Neu co mutate data (`POST/PUT/PATCH/DELETE`), phai co evidence doi soat toi thieu

Quy tac docs:

1. Khong tick checklist sprint neu thieu evidence QA/QC.
2. Moi route file trong sprint phai co trang thai trong QA matrix.
3. Neu con blocker QA muc `High` tro len, khong duoc dong sprint.
