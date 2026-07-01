# SONA SPACE - Server

Backend API cho nền tảng thương mại điện tử nội thất SONA SPACE. Được xây dựng dengan **Node.js/Express**, **PostgreSQL**, **Socket.io** cho real-time communication.

---

## 📋 Mục lục

- [Mô tả](#-mô-tả)
- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt](#-cài-đặt)
- [Chạy dự án](#-chạy-dự-án)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [API Endpoints](#-api-endpoints)
- [Docker](#-docker)
- [Troubleshooting](#-troubleshooting)

---

## 📖 Mô tả

Server cung cấp API đầy đủ cho ứng dụng SONA SPACE với các tính năng:

**Người dùng:**
- Xác thực & quản lý tài khoản
- Duyệt sản phẩm, danh mục, theo bộ lọc
- Quản lý giỏ hàng, đặt hàng, lịch sử mua
- Chat real-time với AI chatbot (Gemini, OpenAI)
- Quản lý wishlist
- Nhận thông báo hệ thống

**Admin:**
- Quản lý sản phẩm & danh mục
- Quản lý đơn hàng & trạng thái
- Quản lý người dùng
- Thống kê doanh thu
- Gửi thông báo hệ thống
- Quản lý coupon/voucher

---

## 💻 Yêu cầu hệ thống

- **Node.js** v16+ (khuyến nghị v18+)
- **npm** v8+ hoặc **yarn**
- **PostgreSQL** v12+ (khuyến nghị v16 khi chạy bằng Docker Compose)
- **Git**

### Tuỳ chọn:
- **Docker** & **Docker Compose** (khuyến nghị)
- **PM2** (quản lý process)

---

## 🛠️ Cài đặt

### Bước 1: Clone dự án

```bash
git clone <repository-url>
cd Sona/SONA_SPACE-Server
```

### Bước 2: Cài đặt dependencies

```bash
npm install
```

### Bước 3: Cấu hình Database

#### Tùy chọn A: Sử dụng Docker Compose (khuyến nghị)

```bash
# Chạy PostgreSQL
docker-compose -f docker-compose.dev.yml up -d

# ⚠️ Nếu bạn muốn reset DB
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d

# Database sẽ khởi động tự động
```

#### Tùy chọn B: Cài đặt cục bộ

**PostgreSQL:**
```bash
createuser postgres --superuser
createdb furnitown
psql -U postgres -d furnitown -f db/init/init.sql
```

MySQL hiện chỉ còn là legacy migration source. Runtime backend và `db/init/init.sql` dùng PostgreSQL.

### Bước 4: Cấu hình biến môi trường

Tạo file `.env` trong thư mục gốc server (copy từ `.env.example` nếu có hoặc tạo thủ công).

## 🚀 Chạy dự án

### Chế độ Development

```bash
npm run dev
```

Server khởi động tại: **http://localhost:3501**

### Chế độ Production

```bash
npm start
```

### Debug Mode

```bash
npm run debug
```

Mở DevTools tại: **chrome://inspect**

## 📁 Cấu trúc thư mục

```
SONA_SPACE-Server/
├── bin/
│   └── www                          # Server entry point
├── config/
│   ├── cloudinary.js                # Cấu hình Cloudinary (upload ảnh)
│   └── database.js                  # Cấu hình kết nối database
├── db/
│   └── init/
│       └── init.sql                 # Script khởi tạo database
├── middleware/
│   ├── auth.js                      # JWT authentication
│   └── upload.js                    # File upload middleware
├── models/
│   ├── categoryModel.js
│   ├── productModel.js
│   └── chatbotPrompt.js
├── routes/
│   ├── auth.js                      # Đăng ký, đăng nhập
│   ├── products.js                  # Quản lý sản phẩm
│   ├── categories.js                # Danh mục sản phẩm
│   ├── orders.js                    # Quản lý đơn hàng
│   ├── users.js                     # Quản lý người dùng
│   ├── chat.js                      # Chat dengan AI
│   ├── payments.js                  # Thanh toán
│   ├── wishlists.js                 # Danh sách yêu thích
│   ├── comments.js                  # Bình luận sản phẩm
│   ├── banners.js                   # Quản lý banner
│   ├── news.js                      # Quản lý tin tức
│   ├── dashboard.js                 # Thống kê admin
│   └── ...                          # Các route khác
├── services/
│   ├── mailService.js               # Gửi email
│   ├── mailOtp.js                   # OTP email
│   ├── apiService.js                # Call API bên ngoài
│   └── ...
├── template/
│   ├── emailVerification.ejs         # Template xác thực email
│   ├── otpEmail.ejs                 # Template OTP
│   ├── order.ejs                    # Template đơn hàng
│   └── ...                          # Email templates khác
├── views/
│   ├── dashboard/                   # Dashboard admin views
│   ├── layouts/                     # Layout EJS
│   └── ...
├── public/                          # Static files (CSS, JS, uploads)
│   ├── uploads/
│   ├── fonts/
│   ├── images/
│   ├── javascripts/
│   ├── scss/
│   └── stylesheets/
├── app.js                           # Express configuration
├── package.json
├── nodemon.json                     # Nodemon settings
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── Dockerfile.dev
```

---

## 🔗 API Endpoints

### 🔐 Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Làm mới token
- `POST /api/auth/forgot-password` - Quên mật khẩu
- `POST /api/auth/verify-email` - Xác thực email

### 📦 Products
- `GET /api/products` - Lấy danh sách sản phẩm (có pagination, filter)
- `GET /api/products/:id` - Lấy chi tiết sản phẩm
- `POST /api/products` - Tạo sản phẩm (admin)
- `PUT /api/products/:id` - Cập nhật sản phẩm (admin)
- `DELETE /api/products/:id` - Xóa sản phẩm (admin)
- `GET /api/products/:id/comments` - Lấy bình luận

### 🏷️ Categories
- `GET /api/categories` - Lấy danh sách danh mục
- `POST /api/categories` - Tạo danh mục (admin)
- `PUT /api/categories/:id` - Cập nhật danh mục (admin)
- `DELETE /api/categories/:id` - Xóa danh mục (admin)

### 🛒 Orders
- `GET /api/orders` - Lấy đơn hàng của user
- `POST /api/orders` - Tạo đơn hàng
- `GET /api/orders/:id` - Lấy chi tiết đơn hàng
- `PUT /api/orders/:id/status` - Cập nhật trạng thái (admin)
- `GET /api/orders/:id/invoices` - Xuất hóa đơn

### 👤 Users
- `GET /api/users/profile` - Lấy thông tin cá nhân
- `PUT /api/users/profile` - Cập nhật thông tin
- `GET /api/users` - Lấy danh sách user (admin)
- `PUT /api/users/:id/role` - Thay đổi quyền (admin)

### 💬 Chat
- `POST /api/chat/messages` - Gửi tin nhắn hỏi đáp
- `GET /api/chat/history` - Lấy lịch sử chat

### 💝 Wishlist
- `GET /api/wishlists` - Lấy danh sách yêu thích
- `POST /api/wishlists` - Thêm vào wishlist
- `DELETE /api/wishlists/:id` - Xóa khỏi wishlist

### 💳 Payments
- `POST /api/payments/create` - Tạo thanh toán
- `POST /api/payments/verify` - Xác thực thanh toán
- `GET /api/payments/:id/status` - Kiểm tra trạng thái

### 📊 Dashboard (Admin)
- `GET /api/dashboard/revenue` - Doanh thu
- `GET /api/dashboard/orders-stats` - Thống kê đơn hàng
- `GET /api/dashboard/users-stats` - Thống kê người dùng

---

## 🐳 Docker

### Build & Run với Docker Compose (Development)

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Build & Run với Docker Compose (Production)

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Build Docker Image

```bash
docker build -f Dockerfile.dev -t sona-space-server:dev .
```

### Kiểm tra Logs

```bash
docker-compose logs -f app
```

### Stop Containers

```bash
docker-compose down
```

---

## 🔧 Troubleshooting

### Lỗi kết nối Database

**Lỗi:** `ECONNREFUSED 127.0.0.1:5432`

**Giải pháp:**
1. Kiểm tra PostgreSQL đang chạy: `pg_isready -h localhost`
2. Kiểm tra cấu hình database trong `.env`
3. Nếu dùng Docker, chạy: `docker-compose -f docker-compose.dev.yml up -d`
4. Kiểm tra credentials trong `config/database.js`

### Lỗi CORS

**Lỗi:** `CORS policy: Access to XMLHttpRequest blocked`

**Giải pháp:**
- Kiểm tra CORS configuration trong `app.js`
- Đảm bảo frontend URL được thêm vào whitelist

### Port đã bị chiếm

**Lỗi:** `EADDRINUSE: address already in use :::3501`

**Giải pháp:**
```bash
# Windows
netstat -ano | findstr :3501
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3501
kill -9 <PID>
```

### Module not found

**Giải pháp:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Nodemailer không gửi được email

**Giải pháp:**
1. Kiểm tra cấu hình email trong `services/mailService.js`
2. Kiểm tra credentials trong `.env`
3. Cho phép "Less secure apps" nếu dùng Gmail
4. Kiểm tra logs để xem lỗi chi tiết

## 📚 Công nghệ sử dụng

- **Express.js** - Framework web
- **Node.js** - Runtime environment
- **PostgreSQL** - Database
- **JWT** - Token-based authentication
- **Socket.io** - Real-time bidirectional communication
- **Nodemailer** - Email service
- **Cloudinary** - Image hosting & CDN
- **Multer** - File upload handler
- **Google AI SDK** - Gemini chatbot
- **OpenAI** - Alternative AI chatbot
- **EJS** - Template engine
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Rate Limiter** - API rate limiting

---

## 📖 Lệnh hữu ích

### Chạy Database Migrations

```bash
node migrations/add-user-token-field.js
```

### Kiểm tra Lỗi ESLint

```bash
npm run lint
```

### Chạy Tests (nếu có)

```bash
npm test
```

### Xem Logs Real-time

```bash
npm run dev 2>&1 | tee server.log
```

## 🤝 Đóng góp

Để đóng góp vào dự án:

1. Fork repository
2. Tạo branch feature: `git checkout -b feature/YourFeature`
3. Commit changes: `git commit -m 'Add YourFeature'`
4. Push to branch: `git push origin feature/YourFeature`
5. Mở Pull Request

---

## 📝 License

Dự án này được cấp phép dưới MIT License.

---

## 📧 Liên hệ & Hỗ trợ

Nếu bạn gặp vấn đề:

1. Kiểm tra lại cấu hình database
2. Xóa `node_modules` và chạy `npm install` lại
3. Kiểm tra logs trong terminal
4. Tạo issue trên GitHub repository
5. Liên hệ team support

---

**Happy Coding! 🚀**
