# SONA SPACE - Server

Backend API cho nền tảng thương mại điện tử nội thất SONA SPACE. Dự án được xây dựng bằng **Node.js/Express**, **PostgreSQL**, **Socket.IO** và đồng thời render luôn phần admin/dashboard bằng **EJS**.

---

## Mục lục

- [Mô tả](#mô-tả)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt](#cài-đặt)
- [Chạy dự án](#chạy-dự-án)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [API endpoints](#api-endpoints)
- [Docker](#docker)
- [Troubleshooting](#troubleshooting)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Lệnh hữu ích](#lệnh-hữu-ích)

---

## Mô tả

Server cung cấp API và dashboard quản trị cho SONA SPACE với các nhóm tính năng chính:

**Người dùng**
- Xác thực và quản lý tài khoản
- Duyệt sản phẩm, danh mục, không gian, tin tức
- Giỏ hàng, thanh toán, đơn hàng
- Wishlist
- Form liên hệ và form thiết kế
- Chat realtime với AI chatbot

**Admin**
- Quản lý sản phẩm, danh mục, banner, tin tức, sự kiện
- Quản lý đơn hàng, người dùng, coupon, thông báo
- Theo dõi doanh thu và dashboard vận hành

---

## Yêu cầu hệ thống

- **Node.js** v18+ khuyến nghị
- **npm** v8+ hoặc mới hơn
- **Docker Desktop**
- **Docker Compose**
- **Git**

### Ghi chú

- Runtime backend hiện chuẩn hóa trên **PostgreSQL**
- File dump gốc tham chiếu là `db/furnitown.sql`
- File dùng để bootstrap DB local là `db/init/init.sql`

---

## Cài đặt

### Bước 1: vào thư mục server

```bash
cd Sona/SONA_SPACE-Server
```

### Bước 2: cài dependencies

```bash
npm install
```

### Bước 3: kiểm tra file môi trường

Server local dùng:

- `.env` cho backend local
- `.env.db` cho PostgreSQL chạy bằng Docker

Cấu hình local hiện tại cần đồng nhất:

```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres123
PGDATABASE=furnitown
PORT=3501
```

### Bước 4: khởi động database local

Flow local được chuẩn hóa như sau:

- PostgreSQL chạy bằng Docker
- backend chạy local bằng `npm run dev`

Khởi động DB:

```bash
docker compose up -d
```

### Bước 5: chạy backend

```bash
npm run dev
```

Server khởi động tại:

```text
http://localhost:3501
```

---

## Chạy dự án

### Development

1. Bật PostgreSQL:

```bash
docker compose up -d
```

2. Chạy backend:

```bash
npm run dev
```

### Production-like local run

```bash
npm start
```

### Debug mode

```bash
npm run debug
```

---

## Cấu trúc thư mục

```text
SONA_SPACE-Server/
├── bin/
│   └── www                          # Entry point HTTP server + Socket.IO
├── config/
│   ├── cloudinary.js                # Cấu hình Cloudinary
│   └── database.js                  # Kết nối PostgreSQL
├── db/
│   ├── furnitown.sql                # Dump gốc tham chiếu
│   ├── init/
│   │   └── init.sql                 # Bootstrap schema + seed local
│   └── transaction.js               # Helper transaction
├── middleware/
│   ├── auth.js                      # JWT authentication
│   └── upload.js                    # Upload middleware
├── models/
├── public/
│   ├── uploads/
│   ├── fonts/
│   ├── images/
│   ├── javascripts/
│   ├── scss/
│   └── stylesheets/
├── routes/
│   ├── auth.js
│   ├── products.js
│   ├── categories.js
│   ├── orders.js
│   ├── users.js
│   ├── chat.js
│   ├── payments.js
│   ├── wishlists.js
│   ├── comments.js
│   ├── banners.js
│   ├── news.js
│   ├── dashboard.js
│   └── ...
├── services/
├── template/
├── views/
│   ├── dashboard/
│   ├── layouts/
│   └── ...
├── app.js                           # Express app config
├── package.json
├── docker-compose.yml               # Compose mặc định cho local DB
├── docker-compose.dev.yml           # Cấu hình cũ / tham chiếu
├── docker-compose.prod.yml          # Cấu hình production / tham chiếu
└── Dockerfile.dev
```

---

## API Endpoints

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/verify-email`

### Products

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`

### Categories

- `GET /api/categories`
- `GET /api/categories/:slug`
- `POST /api/categories`
- `PUT /api/categories/:slug`
- `DELETE /api/categories/:slug`

### Orders

- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/:id`
- `PUT /api/orders/:id/status`

### Users

- `GET /api/users/profile`
- `PUT /api/users/profile`
- `GET /api/users`
- `PUT /api/users/:id/role`

### Chat

- `POST /api/chat/messages`
- `GET /api/chat/history`

### Wishlist

- `GET /api/wishlists`
- `POST /api/wishlists`
- `DELETE /api/wishlists/:id`

### Payments

- `POST /api/payments/create`
- `POST /api/payments/verify`
- `GET /api/payments/:id/status`

### Dashboard / Admin

- `GET /api/dashboard/revenue`
- `GET /api/dashboard/orders-stats`
- `GET /api/dashboard/users-stats`

---

## Docker

### Flow local hiện tại

Compose mặc định chỉ phục vụ **PostgreSQL local**.

Khởi động DB:

```bash
docker compose up -d
```

Dừng DB:

```bash
docker compose down
```

### Khi nào cần reset dữ liệu seed

`db/init/init.sql` chỉ được Docker Postgres chạy khi volume còn trống.

Nếu bạn đã sửa seed mà không thấy thay đổi, cần xóa volume:

```bash
docker compose down -v
docker compose up -d
```

### Lưu ý quan trọng

- `docker compose down` **không xóa dữ liệu**
- `docker compose down -v` **xóa toàn bộ volume DB**
- `db/furnitown.sql` là file gốc tham chiếu để đối chiếu dữ liệu
- `db/init/init.sql` là file dùng để bootstrap local DB mới

---

## Troubleshooting

### Lỗi kết nối database

Lỗi thường gặp:

```text
ECONNREFUSED 127.0.0.1:5432
```

Kiểm tra:

```bash
docker compose ps
docker compose logs postgres
```

Đồng thời xác nhận `.env` backend trùng với `.env.db`.

### Sửa `init.sql` nhưng dữ liệu không đổi

Nguyên nhân:

- volume PostgreSQL cũ vẫn còn

Cách xử lý:

```bash
docker compose down -v
docker compose up -d
```

### Port `3501` đã bị chiếm

Windows:

```bash
netstat -ano | findstr :3501
taskkill /PID <PID> /F
```

### App boot được nhưng query fail

Kiểm tra:

- DB đã lên chưa
- thông số trong `.env`
- seed có khớp schema hiện tại không

### Ảnh seed hiển thị sai

Ưu tiên kiểm tra:

- URL trong `db/init/init.sql`
- file gốc tham chiếu trong `db/furnitown.sql`
- route mapping ở `routes/categories.js` và `routes/banners.js`

---

## Công nghệ sử dụng

- **Express.js**
- **Node.js**
- **PostgreSQL**
- **JWT**
- **Socket.IO**
- **Nodemailer**
- **Cloudinary**
- **Multer**
- **Google AI SDK**
- **OpenAI**
- **EJS**

---

## Lệnh hữu ích

### Chạy backend dev

```bash
npm run dev
```

### Chạy backend production-like

```bash
npm start
```

### Kiểm tra MySQL pattern còn sót

```bash
npm run check:mysql-patterns
```

### Smoke test app boot

```bash
node -e "require('./app'); console.log('APP_OK'); process.exit(0)"
```

### Reset DB local từ seed

```bash
docker compose down -v
docker compose up -d
```

---

## Ghi chú cuối

- Nếu task liên quan dữ liệu seed, luôn đối chiếu với `db/furnitown.sql`
- Nếu task liên quan route/backend schema, kiểm tra thêm `routes/*.js` và `db/init/init.sql`
- Nếu seed có thay đổi, nhớ reset volume để Docker nạp lại dữ liệu mới
