-- PostgreSQL Database: furnitown
-- Docker-ready initialization script for Sona Space furniture e-commerce
-- Generated for clean Docker deployment - contains schema + catalog seed data only

SET client_encoding = 'UTF8';
BEGIN;

-- ============================================================
-- DROP ALL TABLES (in reverse dependency order)
-- ============================================================
DROP TABLE IF EXISTS wishlist CASCADE;
DROP TABLE IF EXISTS variant_product CASCADE;
DROP TABLE IF EXISTS user_notifications CASCADE;
DROP TABLE IF EXISTS user_has_coupon CASCADE;
DROP TABLE IF EXISTS room_product CASCADE;
DROP TABLE IF EXISTS room CASCADE;
DROP TABLE IF EXISTS return_items CASCADE;
DROP TABLE IF EXISTS product_attribute_value CASCADE;
DROP TABLE IF EXISTS order_status_log CASCADE;
DROP TABLE IF EXISTS order_returns CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS otps CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_types CASCADE;
DROP TABLE IF EXISTS news CASCADE;
DROP TABLE IF EXISTS news_category CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS couponcode CASCADE;
DROP TABLE IF EXISTS contact_form_design_details CASCADE;
DROP TABLE IF EXISTS contact_form_design CASCADE;
DROP TABLE IF EXISTS comment CASCADE;
DROP TABLE IF EXISTS color CASCADE;
DROP TABLE IF EXISTS chatbot_context CASCADE;
DROP TABLE IF EXISTS category CASCADE;
DROP TABLE IF EXISTS banners CASCADE;
DROP TABLE IF EXISTS attributes CASCADE;
DROP TABLE IF EXISTS product CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_gender CASCADE;
DROP TYPE IF EXISTS order_payment_method CASCADE;

-- ============================================================
-- CREATE ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('admin', 'user', 'staff');
CREATE TYPE user_gender AS ENUM ('male', 'female', 'other');
CREATE TYPE order_payment_method AS ENUM ('cod', 'momo', 'vnpay', 'zalopay');

-- ============================================================
-- CREATE TABLES
-- ============================================================

-- Table: category
CREATE TABLE category (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(255) NOT NULL,
    category_description TEXT,
    slug VARCHAR(255) UNIQUE,
    category_image VARCHAR(255),
    status SMALLINT DEFAULT 1,
    category_priority SMALLINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: user
CREATE TABLE "user" (
    user_id SERIAL PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    user_gmail VARCHAR(255),
    user_number VARCHAR(20),
    user_password VARCHAR(255) NOT NULL,
    user_image VARCHAR(255),
    user_address TEXT,
    user_role user_role DEFAULT 'user',
    user_gender user_gender DEFAULT 'other',
    user_birth DATE,
    user_token VARCHAR(255),
    remember_token VARCHAR(255),
    user_email_active SMALLINT DEFAULT 0,
    user_verified_at TIMESTAMP,
    user_disabled_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: attributes
CREATE TABLE attributes (
    attribute_id SERIAL PRIMARY KEY,
    attribute_name VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES category(category_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: banners
CREATE TABLE banners (
    banner_id SERIAL PRIMARY KEY,
    banner_title VARCHAR(255),
    banner_description TEXT,
    banner_image VARCHAR(255),
    banner_link VARCHAR(255),
    banner_priority INTEGER DEFAULT 0,
    status SMALLINT DEFAULT 1,
    category_id INTEGER REFERENCES category(category_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: chatbot_context
CREATE TABLE chatbot_context (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    type VARCHAR(50),
    is_active SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: color
CREATE TABLE color (
    color_id SERIAL PRIMARY KEY,
    color_name VARCHAR(100),
    color_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: contact_form_design
CREATE TABLE contact_form_design (
    contact_form_design_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(user_id),
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    room_type VARCHAR(255),
    room_type_details VARCHAR(255),
    room_width DECIMAL(10,2),
    room_length DECIMAL(10,2),
    room_height DECIMAL(10,2),
    design_style VARCHAR(255),
    color_scheme VARCHAR(255),
    note TEXT,
    status SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: contact_form_design_details
CREATE TABLE contact_form_design_details (
    contact_form_design_detail_id SERIAL PRIMARY KEY,
    contact_form_design_id INTEGER REFERENCES contact_form_design(contact_form_design_id),
    product_type VARCHAR(255),
    material VARCHAR(255),
    color VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: couponcode
CREATE TABLE couponcode (
    couponcode_id SERIAL PRIMARY KEY,
    couponcode_code VARCHAR(50) UNIQUE NOT NULL,
    couponcode_description TEXT,
    couponcode_startday DATE,
    couponcode_endday DATE,
    couponcode_percent INTEGER,
    couponcode_amount DECIMAL(12,2),
    couponcode_minimum_order DECIMAL(12,2) DEFAULT 0,
    couponcode_maximum_discount DECIMAL(12,2),
    couponcode_quantity INTEGER DEFAULT 0,
    couponcode_used INTEGER DEFAULT 0,
    couponcode_status SMALLINT DEFAULT 1,
    couponcode_type SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: events
CREATE TABLE events (
    event_id SERIAL PRIMARY KEY,
    event_title VARCHAR(255),
    event_description TEXT,
    event_image VARCHAR(255),
    event_start TIMESTAMP,
    event_end TIMESTAMP,
    event_status SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: materials
CREATE TABLE materials (
    material_id SERIAL PRIMARY KEY,
    material_name VARCHAR(255),
    material_description TEXT,
    slug VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: news_category
CREATE TABLE news_category (
    news_category_id SERIAL PRIMARY KEY,
    news_category_name VARCHAR(255),
    news_category_slug VARCHAR(255) UNIQUE,
    news_category_description TEXT,
    news_category_status SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: news
CREATE TABLE news (
    news_id SERIAL PRIMARY KEY,
    news_category_id INTEGER REFERENCES news_category(news_category_id),
    news_title VARCHAR(255),
    news_slug VARCHAR(255) UNIQUE,
    news_content TEXT,
    news_image VARCHAR(255),
    news_author VARCHAR(255),
    news_view INTEGER DEFAULT 0,
    news_status SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: notification_types
CREATE TABLE notification_types (
    id SERIAL PRIMARY KEY,
    type_code VARCHAR(50) UNIQUE,
    type_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    type_id INTEGER REFERENCES notification_types(id),
    title VARCHAR(255),
    message TEXT,
    link VARCHAR(255),
    sender_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: otps
CREATE TABLE otps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(user_id),
    otp_code VARCHAR(10) NOT NULL,
    otp_type VARCHAR(50),
    expires_at TIMESTAMP,
    is_used SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: payments
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_amount DECIMAL(12,2),
    payment_transaction_id VARCHAR(255),
    payment_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: orders
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(user_id),
    order_code VARCHAR(50) UNIQUE,
    order_hash VARCHAR(255) UNIQUE,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_status SMALLINT DEFAULT 0,
    order_total DECIMAL(12,2),
    order_discount DECIMAL(12,2) DEFAULT 0,
    order_shipping_fee DECIMAL(12,2) DEFAULT 0,
    order_final_total DECIMAL(12,2),
    order_address TEXT,
    order_phone VARCHAR(20),
    order_name VARCHAR(255),
    order_email VARCHAR(255),
    order_note TEXT,
    order_payment_method order_payment_method DEFAULT 'cod',
    payment_id INTEGER REFERENCES payments(payment_id),
    couponcode_id INTEGER REFERENCES couponcode(couponcode_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: product
CREATE TABLE product (
    product_id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES category(category_id),
    product_name VARCHAR(255) NOT NULL,
    product_image TEXT,
    product_slug VARCHAR(255) NOT NULL,
    product_description TEXT,
    product_priority INTEGER DEFAULT 0,
    product_view INTEGER DEFAULT 0,
    product_sold INTEGER DEFAULT 0,
    product_status SMALLINT DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    comment_id INTEGER NOT NULL DEFAULT 0,
    variant_materials VARCHAR(255),
    variant_height DECIMAL(10,2),
    variant_width DECIMAL(10,2),
    variant_depth DECIMAL(10,2),
    variant_seating_height DECIMAL(10,2),
    variant_maximum_weight_load DECIMAL(10,2),
    product_stock INTEGER DEFAULT 0
);

-- Table: variant_product
CREATE TABLE variant_product (
    variant_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES product(product_id),
    color_id INTEGER NOT NULL REFERENCES color(color_id),
    variant_product_quantity INTEGER,
    variant_product_price DECIMAL(10,2),
    variant_product_price_sale DECIMAL(10,2),
    variant_product_slug VARCHAR(255),
    variant_product_list_image TEXT
);

-- Table: order_items
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    variant_id INTEGER NOT NULL REFERENCES variant_product(variant_id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(12,2) NOT NULL,
    comment_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: comment
CREATE TABLE comment (
    comment_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(user_id),
    order_item_id INTEGER REFERENCES order_items(order_item_id),
    comment_content TEXT,
    comment_rating SMALLINT,
    comment_image TEXT,
    comment_status SMALLINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: order_returns
CREATE TABLE order_returns (
    return_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id),
    user_id INTEGER REFERENCES "user"(user_id),
    return_reason TEXT,
    return_note TEXT,
    return_images TEXT,
    return_status SMALLINT DEFAULT 0,
    return_total DECIMAL(12,2),
    return_refund_method VARCHAR(50),
    return_refund_info TEXT,
    processed_by INTEGER,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: order_status_log
CREATE TABLE order_status_log (
    order_status_log_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    old_status SMALLINT,
    new_status SMALLINT,
    changed_by INTEGER,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: product_attribute_value
CREATE TABLE product_attribute_value (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES product(product_id),
    attribute_id INTEGER NOT NULL REFERENCES attributes(attribute_id),
    value VARCHAR(255),
    material_id INTEGER REFERENCES materials(material_id)
);

-- Table: return_items
CREATE TABLE return_items (
    return_item_id SERIAL PRIMARY KEY,
    return_id INTEGER NOT NULL REFERENCES order_returns(return_id),
    order_item_id INTEGER NOT NULL REFERENCES order_items(order_item_id),
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: room
CREATE TABLE room (
    room_id SERIAL PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 0,
    room_priority SMALLINT,
    room_image VARCHAR(255) NOT NULL,
    room_banner VARCHAR(255) NOT NULL,
    room_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: room_product
CREATE TABLE room_product (
    room_product_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES room(room_id),
    product_id INTEGER NOT NULL REFERENCES product(product_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Table: user_has_coupon
CREATE TABLE user_has_coupon (
    user_has_coupon_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(user_id),
    couponcode_id INTEGER NOT NULL REFERENCES couponcode(couponcode_id),
    status SMALLINT DEFAULT 0,
    UNIQUE(user_id, couponcode_id)
);

-- Table: user_notifications
CREATE TABLE user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(user_id),
    notification_id INTEGER REFERENCES notifications(id),
    is_read SMALLINT DEFAULT 0,
    read_at TIMESTAMP,
    is_deleted SMALLINT DEFAULT 0
);

-- Table: wishlist
CREATE TABLE wishlist (
    wishlist_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(user_id),
    status SMALLINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    variant_id INTEGER NOT NULL REFERENCES variant_product(variant_id),
    quantity INTEGER DEFAULT 1
);

-- ============================================================
-- CREATE TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_category_updated_at BEFORE UPDATE ON category FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attributes_updated_at BEFORE UPDATE ON attributes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chatbot_context_updated_at BEFORE UPDATE ON chatbot_context FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_color_updated_at BEFORE UPDATE ON color FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_form_design_updated_at BEFORE UPDATE ON contact_form_design FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_form_design_details_updated_at BEFORE UPDATE ON contact_form_design_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_couponcode_updated_at BEFORE UPDATE ON couponcode FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_news_category_updated_at BEFORE UPDATE ON news_category FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_types_updated_at BEFORE UPDATE ON notification_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_otps_updated_at BEFORE UPDATE ON otps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_updated_at BEFORE UPDATE ON product FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comment_updated_at BEFORE UPDATE ON comment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_returns_updated_at BEFORE UPDATE ON order_returns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_return_items_updated_at BEFORE UPDATE ON return_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_room_updated_at BEFORE UPDATE ON room FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_room_product_updated_at BEFORE UPDATE ON room_product FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wishlist_updated_at BEFORE UPDATE ON wishlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INSERT SEED DATA (Catalog/Content Tables Only)
-- ============================================================

-- Categories
INSERT INTO category (category_id, category_name, category_description, slug, category_image, status, category_priority) VALUES
(1, 'Bàn', 'Các loại bàn nội thất', 'ban', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/table_hcnvul.webp', 1, 1),
(2, 'Ghế', 'Các loại ghế ngồi', 'ghe', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/chair_etwwne.webp', 1, 2),
(3, 'Tủ', 'Các loại tủ lưu trữ', 'tu', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716775/storage_q2y1k7.webp', 1, 3),
(4, 'Đèn', 'Các loại đèn chiếu sáng', 'den', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/lighting_kghsld.webp', 1, 4),
(5, 'Thảm', 'Các loại thảm trang trí', 'tham', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/rug_jcvfsv.webp', 1, 5),
(6, 'Ngoài trời', 'Nội thất ngoài trời', 'ngoai-troi', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/outdoor_q1hcna.webp', 1, 6),
(7, 'Sofa', 'Các loại sofa', 'sofa', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/sofa_i18zy7.webp', 1, 7),
(8, 'Decor', 'Đồ trang trí nội thất', 'decor', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/accessories_w0bhs6.webp', 1, 8),
(9, 'Giường', 'Các loại giường ngủ', 'giuong', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/beds_ggcupm.webp', 1, 9);
SELECT setval('category_category_id_seq', (SELECT MAX(category_id) FROM category));

-- Colors
INSERT INTO color (color_id, color_name, color_code) VALUES
(1, 'Màu be', '#d4b896'),
(2, 'Màu xám nhạt', '#b0b0b0'),
(6, 'Màu trắng', '#ffffff'),
(8, 'Màu sồi sẫm', '#5c4033'),
(9, 'Màu kính trong suốt', 'transparent'),
(10, 'Màu gốm trơ', '#c4a77d'),
(14, 'Màu xanh lam', '#0077b6'),
(19, 'Màu đen', '#000000'),
(25, 'Màu xanh lá cây', '#228b22'),
(27, 'Màu đồng', '#b87333'),
(50, 'Xanh Navy', '#000080');
SELECT setval('color_color_id_seq', (SELECT MAX(color_id) FROM color));

-- Materials
INSERT INTO materials (material_id, material_name, material_description, slug) VALUES
(1, 'Gỗ sồi', 'Chất liệu gỗ sồi tự nhiên', 'go-soi'),
(2, 'Gỗ óc chó', 'Chất liệu gỗ óc chó cao cấp', 'go-oc-cho'),
(3, 'Gỗ thông', 'Chất liệu gỗ thông tự nhiên', 'go-thong'),
(4, 'Gỗ MDF', 'Ván MDF chất lượng cao', 'go-mdf'),
(5, 'Da bò', 'Da bò thật cao cấp', 'da-bo'),
(6, 'Da tổng hợp', 'Da tổng hợp chất lượng', 'da-tong-hop'),
(7, 'Vải nỉ', 'Vải nỉ mềm mại', 'vai-ni'),
(8, 'Vải bố', 'Vải bố chắc chắn', 'vai-bo'),
(9, 'Len', 'Len tự nhiên', 'len'),
(10, 'Thủy tinh', 'Thủy tinh trong suốt', 'thuy-tinh'),
(11, 'Kim loại', 'Kim loại sơn tĩnh điện', 'kim-loai'),
(12, 'Nhựa', 'Nhựa cao cấp', 'nhua'),
(13, 'Inox', 'Inox chống gỉ', 'inox'),
(14, 'Cotton', 'Vải cotton 100%', 'cotton');
SELECT setval('materials_material_id_seq', (SELECT MAX(material_id) FROM materials));

-- Users (Admin and sample test users - passwords should be hashed in production)
INSERT INTO "user" (user_id, user_name, user_gmail, user_number, user_password, user_image, user_address, user_role, user_gender, user_birth, user_email_active, user_verified_at) VALUES
(1, 'Admin', 'admin@sonaspace.com', '0901234567', '$2a$10$un8nzDME5sEUrSS.8a.29.DnSCPKErQyqDr.5O7zDMT4iq5etsaSa', NULL, 'Sona Space HQ', 'admin', 'male', '1990-01-01', 1, CURRENT_TIMESTAMP),
(2, 'Staff User', 'staff@sonaspace.com', '0902345678', '$2a$10$un8nzDME5sEUrSS.8a.29.DnSCPKErQyqDr.5O7zDMT4iq5etsaSa', NULL, 'Sona Space Office', 'staff', 'female', '1992-05-15', 1, CURRENT_TIMESTAMP),
(3, 'Test User', 'user@sonaspace.com', '0903456789', '$2a$10$un8nzDME5sEUrSS.8a.29.DnSCPKErQyqDr.5O7zDMT4iq5etsaSa', NULL, '123 Test Street', 'user', 'other', '1995-08-20', 1, CURRENT_TIMESTAMP);
SELECT setval('user_user_id_seq', (SELECT MAX(user_id) FROM "user"));

-- Products
INSERT INTO product (product_id, category_id, product_name, product_image, product_slug, product_description, product_priority, product_view, product_sold, product_status, comment_id, variant_materials, variant_height, variant_width, variant_depth, variant_seating_height, variant_maximum_weight_load, product_stock) VALUES
(131, 7, 'Modena 2.5 chỗ', 'https://assets.boconcept.com/7b8aaaaa-69a3-4be2-b17b-ad43017fde9c/1531629_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'modena-2-5-cho', 'Hình dạng hữu cơ và đường nét tối giản kết hợp với nhau trong một biểu hiện giản dị, đương đại. Ghế sofa Modena sẽ tạo thêm một cảm giác thoải mái.', 1, 216, 73, 1, 0, 'Gỗ tự nhiên', 85.00, 90.00, 80.00, 45.00, 180.00, 48),
(132, 7, 'Sofa Amsterdam', 'https://assets.boconcept.com/eca177eb-68e5-4397-ad16-ad44013095ed/734517_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'sofa-amsterdam', 'Amsterdam là những đường nét sắc nét và những đường cong rộng. Sự thoải mái và sang trọng thấm nhuần từng chi tiết.', 2, 163, 24, 1, 0, 'Da thật', 120.00, 60.00, 60.00, 50.00, 100.00, 136),
(133, 7, 'Bergamo 5 chỗ', 'https://assets.boconcept.com/10ceb3b3-4974-4511-832e-ad6c002bc777/1701403_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'bergamo-5-cho', 'Bergamo của Morten Georgsen là sự sang trọng hữu cơ được tạo ra thoải mái.', 3, 116, 49, 1, 0, 'Gỗ tự nhiên', 182.00, 72.00, 52.00, 80.00, 210.00, 79),
(134, 1, 'Bàn cà phê chức năng Chiva', 'https://assets.boconcept.com/4e325c32-f021-47a0-a918-ad440002678c/1570721_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ban-ca-phe-chuc-nang-chiva', 'Bàn cà phê hiện đại này có chức năng thuần túy được bao bọc trong thiết kế tuyệt vời.', 4, 79, 17, 1, 0, NULL, 40.00, 30.00, 20.00, 50.00, 50.00, 121),
(135, 1, 'Bàn cà phê Madrid', 'https://assets.boconcept.com/58b57b69-4966-44af-a855-ad44010800aa/667325_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ban-ca-phe-madrid', 'Các đường nét gọn gàng và hình dạng hữu cơ kết hợp với nhau trong một thiết kế nổi.', 5, 89, 20, 1, 0, 'Vải cotton', 55.00, 55.00, 6.00, 90.00, 35.00, 110),
(136, 1, 'Bàn làm việc Cupertino', 'https://assets.boconcept.com/0a45a1ee-d336-4357-b7cc-ad6c00144f53/1601485_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ban-lam-viec-cupertino', 'Cupertino - mọi thứ bạn cần trong văn phòng tại nhà, được giấu đi ngay lập tức.', 6, 63, 2, 1, 0, 'Lông thú tổng hợp', 5.00, 150.00, 150.00, NULL, 20.00, 128),
(137, 2, 'Ghế bành Modena', 'https://assets.boconcept.com/686e92c5-49f9-4b8e-8096-ad43017fa263/1531169_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ghe-banh-modena', 'Hình dạng hữu cơ và đường nét tối giản kết hợp với nhau trong một biểu hiện giản dị, đương đại.', 7, 144, 12, 1, 0, 'Lông tổng hợp', 5.00, 155.00, 155.00, NULL, 21.00, 113),
(138, 2, 'Ghế ăn Hamilton', 'https://assets.boconcept.com/9d86cd53-b349-4d9f-a537-aff500b6703a/2014367_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ghe-an-hamilton', 'Cổ điển kết hợp hiện đại trên ghế ăn Hamilton.', 8, 91, 12, 1, 0, 'Da công nghiệp', 88.00, 195.00, 88.00, 44.00, 240.00, 118),
(139, 2, 'Ghế ăn Seoul', 'https://assets.boconcept.com/f64e2868-c28e-4aa0-9234-b183018afc32/2750994_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ghe-an-seoul', 'Bàn làm việc gỗ công nghiệp, bền đẹp', 9, 82, 1, 1, 0, 'Gỗ tự nhiên', 180.00, 80.00, 40.00, NULL, 100.00, 129),
(140, 3, 'Tủ đựng đồ Fermo', 'https://assets.boconcept.com/1a275588-00df-4bdd-b362-ad6c00246894/1682585_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'tu-dung-do-fermo', 'Hãy để Fermo thực hiện phép thuật của nó.', 10, 84, 1, 1, 0, 'Gỗ MDF', 182.00, 82.00, 42.00, NULL, 105.00, 129),
(141, 3, 'Tủ quần áo đôi Lugano', 'https://assets.boconcept.com/639b72b0-14c5-4f56-9ca8-ad6c001ad6c1/1640903_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'tu-quan-ao-doi-lugano', 'Trông bóng bẩy, thanh lịch và độc quyền.', 11, 73, 1, 1, 0, 'Gỗ sồi', 150.00, 75.00, 70.00, NULL, 200.00, 129),
(142, 3, 'Tủ Calgary có ngăn kéo', 'https://assets.boconcept.com/ad7fed58-48ff-4013-8a92-affe00e407ed/2073421_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'tu-calgary-co-ngan-keo', 'Calgary là một hệ thống lưu trữ đa năng.', 12, 66, 0, 1, 0, 'Da thật', 95.00, 60.00, 60.00, 45.00, 220.00, 130),
(143, 4, 'Đèn mặt dây chuyền mái chèo', 'https://assets.boconcept.com/9d96fc45-138d-40ec-9a15-ae43007ef6b3/2014093_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'den-mat-day-chuyen-mai-cheo', 'Tâm điểm của bất kỳ căn phòng nào.', 13, 56, 0, 1, 0, 'Gỗ MDF', 120.00, 60.00, 55.00, NULL, 180.00, 130),
(144, 4, 'Đèn sàn Kip', 'https://assets.boconcept.com/24e28db0-c289-41ab-b24f-ad4400c80abb/562211_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'den-san-kip', 'Đồng thau cổ mờ với hình tròn đảm bảo vẻ ngoài phong cách.', 14, 55, 1, 1, 0, 'Pha lê', 50.00, 50.00, 20.00, NULL, 80.00, 129),
(145, 4, 'Đèn bàn Stockholm', 'https://assets.boconcept.com/eb2cebcb-bec2-472e-83d0-ad44005a042b/36017_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'den-ban-stockholm', 'Sự đơn giản và tối giản kết hợp trong đèn treo Stockholm.', 15, 43, 0, 1, 0, 'Vải Canvas', 55.00, 55.00, 6.00, NULL, 35.00, 129),
(146, 5, 'Thảm rãnh', 'https://assets.boconcept.com/9fff24d4-2811-4b23-83e6-adc50105703b/1711591_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'tham-ranh', 'Các đường cắt hình 3D lượn sóng tạo ra chiều sâu và cấu trúc.', 16, 49, 1, 1, 0, 'Lông thú tổng hợp', 7.00, 160.00, 160.00, NULL, 23.00, 59),
(147, 5, 'Thảm vân sóng', 'https://assets.boconcept.com/f21c4e6e-5d42-4106-8e3e-adc501056dbe/1711578_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'tham-van-song', 'Tấm thảm Form được dệt panja trong các con hẻm nông thôn của Ấn Độ.', 17, 98, 0, 1, 0, 'Da thật', 92.00, 205.00, 92.00, 46.00, 255.00, 70),
(148, 5, 'Thảm đấu trường', 'https://assets.boconcept.com/42e5d319-13d4-447e-ba5a-b14c00bc6af5/2748321_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'tham-dau-truong', 'Thêm nét nét cho không gian sống của bạn.', 18, 63, 0, 1, 0, 'Gỗ tự nhiên', 182.00, 85.00, 45.00, NULL, 110.00, 60),
(149, 6, 'Ghế sofa Cancún Lounge', 'https://assets.boconcept.com/067e9417-3952-42bf-8782-b0cb0094d181/2113820_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ghe-sofa-cancun-lounge', 'Sự thoải mái ngoài trời đang chờ đợi.', 19, 56, 0, 1, 0, 'Gỗ MDF', 78.00, 130.00, 65.00, NULL, 160.00, 120),
(150, 6, 'Ghế ăn Cancún', 'https://assets.boconcept.com/c7fed9cd-f3ee-4bcb-b832-b0c200d15ee0/2113686_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ghe-an-cancun', 'Dành cả ngày của bạn trong không gian ngoài trời.', 20, 81, 0, 1, 0, 'Vải nỉ', 105.00, 85.00, 85.00, 47.00, 95.00, 100),
(151, 6, 'Bàn phụ Cancún', 'https://assets.boconcept.com/7c7dc52e-0a4a-461d-989b-b0cb00902e6f/2112077_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'ban-phu-cancun', 'Mang đến sự sang trọng và tiện dụng.', 1, 41, 0, 1, 0, 'Gỗ sồi', 155.00, 80.00, 75.00, NULL, 210.00, 150),
(152, 8, 'Bình mưa', 'https://assets.boconcept.com/a9e41ca9-b840-41fd-b8ba-ad4301703a1d/1481633_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'binh-mua', 'Bình tuyên bố này được thổi miệng từ lò nhậu.', 2, 37, 1, 1, 0, 'Da thật', 98.00, 65.00, 65.00, 48.00, 230.00, 79),
(153, 8, 'Bình phao', 'https://assets.boconcept.com/e674bb58-ee5e-48c0-87e9-ad440009629b/1588092_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'binh-phao', 'Cập nhật bộ sưu tập đất nung của bạn.', 3, 61, 0, 1, 0, 'Gỗ MDF', 125.00, 65.00, 60.00, NULL, 190.00, 60),
(154, 8, 'Bình bong bóng', 'https://assets.boconcept.com/d39fb897-53f4-4b32-973e-ad440009668a/1588090_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'binh-bong-bong', 'Hình thức và kết cấu kết hợp trong bình Bubble.', 4, 46, 0, 1, 0, 'Pha lê', 55.00, 55.00, 25.00, NULL, 85.00, 80),
(155, 9, 'Giường Lugano storage', 'https://assets.boconcept.com/dac05adc-b7ed-4f56-af86-b0c40022e4b9/2119243_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'giuong-lugano-storage', 'Hãy để cơ thể bạn chìm xuống và cảm thấy thư giãn.', 5, 51, 0, 1, 0, 'Vải Canvas', 58.00, 58.00, 7.00, NULL, 38.00, 120),
(156, 9, 'Giường Fusion Day', 'https://assets.boconcept.com/57cdff54-43c7-494c-9ca9-ad440073f01c/365501_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'guong-funsion-day', 'Chiếc ghế giường Fusion là một món đồ nội thất thiết kế đẹp mắt.', 6, 56, 0, 1, 0, 'Lông thú tổng hợp', 8.00, 165.00, 165.00, NULL, 24.00, 120),
(157, 9, 'Giường Arlington', 'https://assets.boconcept.com/b4c2cc59-26d1-438e-95b2-ad6c0019aaa3/1637877_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960', 'giuong-arlingtn', 'Tựa lưng chắc chắn khi ngồi dựa vào đầu giường.', 7, 91, 0, 1, 0, 'Da thật', 94.00, 210.00, 94.00, 47.00, 260.00, 120);
SELECT setval('product_product_id_seq', (SELECT MAX(product_id) FROM product));

-- Variant Products
INSERT INTO variant_product (variant_id, product_id, color_id, variant_product_quantity, variant_product_price, variant_product_price_sale, variant_product_slug, variant_product_list_image) VALUES
(255, 131, 1, 29, 19000000.00, 18000000.00, 'mau-be', 'https://assets.boconcept.com/7b8aaaaa-69a3-4be2-b17b-ad43017fde9c/1531629_PNG-Web%2072dpi.png'),
(256, 131, 2, 19, 20000000.00, 19000000.00, 'mau-xam-nhat', 'https://assets.boconcept.com/d3cd0396-2c17-4894-af01-ad43017fce7b/1531505_PNG-Web%2072dpi.png'),
(257, 132, 19, 59, 25000000.00, 20000000.00, 'mau-den', 'https://assets.boconcept.com/eca177eb-68e5-4397-ad16-ad44013095ed/734517_PNG-Web%2072dpi.png'),
(258, 132, 1, 77, 25000000.00, 20000000.00, 'mau-be', 'https://assets.boconcept.com/de40d2e7-e48f-49de-9358-b0c500bd9de2/2123735_PNG-Web%2072dpi.png'),
(259, 133, 2, 53, 29000000.00, 25000000.00, 'mau-xam-nhat', 'https://assets.boconcept.com/10ceb3b3-4974-4511-832e-ad6c002bc777/1701403_PNG-Web%2072dpi.png'),
(260, 133, 6, 26, 29000000.00, 25000000.00, 'mau-trang', 'https://assets.boconcept.com/109e4112-c619-4190-afec-affe0040a116/2105177_PNG-Web%2072dpi.png'),
(263, 135, 9, 42, 2000000.00, NULL, 'mau-kinh-trong-suot', 'https://assets.boconcept.com/58b57b69-4966-44af-a855-ad44010800aa/667325_PNG-Web%2072dpi.png'),
(264, 135, 10, 68, 35000000.00, NULL, 'mau-gom-tro', 'https://assets.boconcept.com/1ed96204-3ab5-4cfd-bc12-ad440108081e/667353_PNG-Web%2072dpi.png'),
(265, 136, 8, 58, 25000000.00, NULL, 'mau-soi-sam', 'https://assets.boconcept.com/0a45a1ee-d336-4357-b7cc-ad6c00144f53/1601485_PNG-Web%2072dpi.png'),
(266, 136, 2, 70, 34000000.00, NULL, 'mau-xam-tro', 'https://assets.boconcept.com/590e954f-2f23-4cf6-b051-aeb00081b1f9/2052054_PNG-Web%2072dpi.png'),
(267, 137, 1, 50, 15000000.00, 0.00, 'mau-be', 'https://assets.boconcept.com/686e92c5-49f9-4b8e-8096-ad43017fa263/1531169_PNG-Web%2072dpi.png'),
(268, 137, 14, 63, 18000000.00, 0.00, 'mau-xanh-lam', 'https://assets.boconcept.com/35cdf88a-a0f1-4149-bc0d-b17900ea42c7/2688945_PNG-Web%2072dpi.png'),
(269, 138, 10, 54, 20000000.00, 0.00, 'mau-xanh-nhat', 'https://assets.boconcept.com/9d86cd53-b349-4d9f-a537-aff500b6703a/2014367_PNG-Web%2072dpi.png'),
(270, 138, 25, 64, 15000000.00, NULL, 'mau-xanh-la-cay', 'https://assets.boconcept.com/35478e15-a7ec-4bce-b1a9-aff500f87dd8/2072905_PNG-Web%2072dpi.png'),
(271, 139, 1, 59, 23000000.00, 20000000.00, 'mau-be', 'https://assets.boconcept.com/f64e2868-c28e-4aa0-9234-b183018afc32/2750994_PNG-Web%2072dpi.png'),
(272, 139, 2, 70, 28000000.00, NULL, 'mau-xam-bac', 'https://assets.boconcept.com/ac8b6e78-c235-4e46-a990-b1830169e9fe/2750706_PNG-Web%2072dpi.png'),
(273, 140, 19, 60, 23000000.00, 20000000.00, 'mau-den-nhat', 'https://assets.boconcept.com/1a275588-00df-4bdd-b362-ad6c00246894/1682585_PNG-Web%2072dpi.png'),
(274, 140, 2, 69, 25000000.00, NULL, 'mau-xam-tro-mo', 'https://assets.boconcept.com/e6bbaf59-76f6-45cb-9925-ad6c0024673d/1682583_PNG-Web%2072dpi.png'),
(275, 141, 1, 59, 28000000.00, 24000000.00, 'mau-xam-tro-mo', 'https://assets.boconcept.com/639b72b0-14c5-4f56-9ca8-ad6c001ad6c1/1640903_PNG-Web%2072dpi.png'),
(276, 141, 6, 70, 30000000.00, NULL, 'mau-xam-mo', 'https://assets.boconcept.com/8edc90b5-b727-494c-af0e-ad6c001ad749/1640905_PNG-Web%2072dpi.png'),
(277, 142, 2, 60, 28000000.00, 24000000.00, 'mau-xam-tro-mo', 'https://assets.boconcept.com/ad7fed58-48ff-4013-8a92-affe00e407ed/2073421_PNG-Web%2072dpi.png'),
(278, 142, 8, 70, 30000000.00, NULL, 'mau-soi-sam', 'https://assets.boconcept.com/d3a29a62-8322-4479-a0a9-affe00e533cb/2073429_PNG-Web%2072dpi.png'),
(279, 143, 25, 60, 22000000.00, 0.00, 'mau-nau-nhat', 'https://assets.boconcept.com/9d96fc45-138d-40ec-9a15-ae43007ef6b3/2014093_PNG-Web%2072dpi.png'),
(280, 143, 19, 70, 30000000.00, NULL, 'mau-den', 'https://assets.boconcept.com/25f300cd-c91b-4276-88a6-ae43007eee74/2014091_PNG-Web%2072dpi.png'),
(281, 144, 27, 59, 22000000.00, NULL, 'mau-dong', 'https://assets.boconcept.com/24e28db0-c289-41ab-b24f-ad4400c80abb/562211_PNG-Web%2072dpi.png'),
(282, 144, 2, 70, 30000000.00, NULL, 'mau-xam', 'https://assets.boconcept.com/aabb5de4-fb29-4f65-af37-ad4300b2f308/1107003_PNG-Web%2072dpi.png'),
(283, 145, 9, 59, 18000000.00, NULL, 'kinh-mau-khoi', 'https://assets.boconcept.com/eb2cebcb-bec2-472e-83d0-ad44005a042b/36017_PNG-Web%2072dpi.png'),
(284, 145, 1, 70, 18000000.00, NULL, 'kinh-trong-suot-cam-thach', 'https://assets.boconcept.com/0f5e557b-35b4-4e2f-b06f-ae43007fb21d/2014101_PNG-Web%2072dpi.png'),
(285, 146, 25, 59, 16000000.00, NULL, 'mau-nau-go', 'https://assets.boconcept.com/9fff24d4-2811-4b23-83e6-adc50105703b/1711591_PNG-Web%2072dpi.png'),
(286, 147, 2, 70, 19000000.00, NULL, 'mau-xam-tro', 'https://assets.boconcept.com/f21c4e6e-5d42-4106-8e3e-adc501056dbe/1711578_PNG-Web%2072dpi.png'),
(287, 148, 25, 60, 15000000.00, NULL, 'mau-nau-go', 'https://assets.boconcept.com/42e5d319-13d4-447e-ba5a-b14c00bc6af5/2748321_PNG-Web%2072dpi.png'),
(288, 149, 14, 70, 40000000.00, NULL, 'mau-xanh-son-mai', 'https://assets.boconcept.com/067e9417-3952-42bf-8782-b0cb0094d181/2113820_PNG-Web%2072dpi.png'),
(289, 149, 2, 50, 40000000.00, NULL, 'mau-xam-tro-mo', 'https://assets.boconcept.com/04a95489-7afe-415f-9486-b0cb00947dfa/2113816_PNG-Web%2072dpi.png'),
(290, 150, 2, 50, 19000000.00, NULL, 'mau-xam-tro-mo', 'https://assets.boconcept.com/c7fed9cd-f3ee-4bcb-b832-b0c200d15ee0/2113686_PNG-Web%2072dpi.png'),
(291, 150, 14, 50, 19000000.00, NULL, 'mau-xanh-son-mai', 'https://assets.boconcept.com/50dde7ba-e0e2-4980-93ef-b0c200d031a9/2113690_PNG-Web%2072dpi.png'),
(292, 151, 10, 80, 22000000.00, NULL, 'mau-xanh-son-mai', 'https://assets.boconcept.com/7c7dc52e-0a4a-461d-989b-b0cb00902e6f/2112077_PNG-Web%2072dpi.png'),
(293, 151, 2, 70, 99999999.99, NULL, 'mau-xam-tro', 'https://assets.boconcept.com/a6c260bb-8cb3-4b1e-a22c-b0cb008fe419/2112075_PNG-Web%2072dpi.png'),
(294, 152, 6, 79, 8000000.00, NULL, 'mau-trang-khoi', 'https://assets.boconcept.com/a9e41ca9-b840-41fd-b8ba-ad4301703a1d/1481633_PNG-Web%2072dpi.png'),
(295, 153, 1, 60, 8000000.00, 7000000.00, 'mau-be', 'https://assets.boconcept.com/e674bb58-ee5e-48c0-87e9-ad440009629b/1588092_PNG-Web%2072dpi.png'),
(296, 154, 25, 80, 10000000.00, 8500000.00, 'mau-nau-nhat', 'https://assets.boconcept.com/d39fb897-53f4-4b32-973e-ad440009668a/1588090_PNG-Web%2072dpi.png'),
(297, 155, 2, 50, 50000000.00, NULL, 'mau-xam', 'https://assets.boconcept.com/dac05adc-b7ed-4f56-af86-b0c40022e4b9/2119243_PNG-Web%2072dpi.png'),
(298, 155, 2, 70, 55000000.00, NULL, 'mau-xam-khoi', 'https://assets.boconcept.com/fc5e3da1-33f8-44c5-8218-b0c400304aa3/2119352_PNG-Web%2072dpi.png'),
(299, 156, 2, 50, 40000000.00, 38000000.00, 'mau-xam-dam', 'https://assets.boconcept.com/57cdff54-43c7-494c-9ca9-ad440073f01c/365501_PNG-Web%2072dpi.png'),
(300, 156, 14, 70, 45000000.00, NULL, 'mau-xanh-la-cay', 'https://assets.boconcept.com/58bda511-389d-40d2-a864-ae92018aa9bb/2026105_PNG-Web%2072dpi.png'),
(301, 157, 2, 50, 45000000.00, 0.00, 'mau-xam-dam', 'https://assets.boconcept.com/b4c2cc59-26d1-438e-95b2-ad6c0019aaa3/1637877_PNG-Web%2072dpi.png'),
(302, 157, 25, 70, 45000000.00, NULL, 'mau-nau-dat', 'https://assets.boconcept.com/d058132f-1df2-4c89-b667-aff90109e347/2090652_PNG-Web%2072dpi.png'),
(326, 134, 2, 53, 25000000.00, 24000000.00, 'mau-xam-tro', 'https://assets.boconcept.com/4e325c32-f021-47a0-a918-ad440002678c/1570721_PNG-Web%2072dpi.png'),
(327, 134, 8, 68, 30000000.00, 0.00, 'mau-soi-sam', 'https://assets.boconcept.com/fb24b2c8-6041-4d72-9f8b-ad4400026958/1570741_PNG-Web%2072dpi.png');
SELECT setval('variant_product_variant_id_seq', (SELECT MAX(variant_id) FROM variant_product));

-- Rooms
INSERT INTO room (room_id, room_name, slug, status, room_priority, room_image, room_banner, room_description) VALUES
(1, 'Phòng khách', 'phong-khach', 1, 1, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716775/living_hhqpbz.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1751911565/SonaSpace/Rooms/banner/vs1xratameucokme1mjz.jpg', 'Không gian tiếp khách và sinh hoạt chung trong nhà'),
(2, 'Phòng ăn', 'phong-an', 1, 2, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716775/dining_ebkiza.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750013007/image_73_qafw6q.jpg', 'Không gian dành cho ăn uống và tụ họp gia đình'),
(3, 'Phòng ngủ', 'phong-ngu', 1, 3, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/bedroom_hzdasv.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750013007/image_74_zswyv8.jpg', 'Không gian nghỉ ngơi và thư giãn'),
(4, 'Không gian làm việc', 'khong-gian-lam-viec', 1, 4, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/homeoffice_o8rlwk.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750013008/image_75_dbl4ny.jpg', 'Khu vực dành riêng cho công việc và học tập'),
(6, 'Không gian ngoài trời', 'khong-gian-ngoai-troi', 1, 6, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/ourdoorspace_jszee6.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750013009/image_77_eaxjys.jpg', 'Khu vực ngoài trời như sân vườn, ban công');
SELECT setval('room_room_id_seq', (SELECT MAX(room_id) FROM room));

-- Room Products (linking products to rooms)
INSERT INTO room_product (room_product_id, room_id, product_id) VALUES
(1, 1, 131),
(2, 1, 132),
(3, 1, 133),
(4, 1, 151),
(5, 1, 152),
(6, 1, 153),
(7, 2, 135),
(8, 2, 136),
(9, 2, 154),
(10, 2, 155),
(11, 2, 156),
(12, 3, 138),
(13, 3, 139),
(14, 3, 157),
(15, 3, 133),
(16, 4, 140),
(17, 4, 141),
(18, 4, 142),
(19, 4, 151),
(20, 4, 152),
(21, 4, 153),
(22, 4, 135),
(23, 4, 154),
(24, 4, 136),
(25, 4, 133),
(26, 4, 134),
(27, 6, 146),
(28, 6, 147),
(29, 6, 148),
(30, 6, 136);
SELECT setval('room_product_room_product_id_seq', (SELECT MAX(room_product_id) FROM room_product));

-- Coupons
INSERT INTO couponcode (couponcode_id, couponcode_code, couponcode_description, couponcode_startday, couponcode_endday, couponcode_percent, couponcode_minimum_order, couponcode_maximum_discount, couponcode_quantity, couponcode_used, couponcode_status, couponcode_type) VALUES
(1, 'WELCOME10', 'Giảm 10% cho đơn hàng đầu tiên', '2025-01-01', '2025-12-31', 10, 500000, 1000000, 1000, 0, 1, 0),
(2, 'SUMMER20', 'Giảm 20% mùa hè', '2025-06-01', '2025-08-31', 20, 1000000, 2000000, 500, 0, 1, 0),
(3, 'SONASPACE50', 'Giảm 50K toàn bộ sản phẩm', '2025-01-01', '2025-12-31', NULL, 200000, NULL, 100, 0, 1, 1);
SELECT setval('couponcode_couponcode_id_seq', (SELECT MAX(couponcode_id) FROM couponcode));

-- Notification Types
INSERT INTO notification_types (id, type_code, type_name, description) VALUES
(1, 'order', 'Đơn hàng', 'Thông báo liên quan đến đơn hàng'),
(2, 'promotion', 'Khuyến mãi', 'Thông báo khuyến mãi'),
(3, 'system', 'Hệ thống', 'Thông báo hệ thống');
SELECT setval('notification_types_id_seq', (SELECT MAX(id) FROM notification_types));

-- Attributes (for product specifications)
INSERT INTO attributes (attribute_id, attribute_name, category_id) VALUES
(63, 'Chiều dài (cm)', 1),
(64, 'Chiều rộng (cm)', 1),
(65, 'Chiều cao (cm)', 1),
(66, 'Chất liệu mặt bàn', 1),
(67, 'Chất liệu chân', 1),
(68, 'Hình dáng', 1),
(69, 'Chiều cao ghế (cm)', 2),
(70, 'Chiều rộng ghế (cm)', 2),
(71, 'Chiều sâu ngồi (cm)', 2),
(72, 'Tải trọng tối đa (kg)', 2),
(73, 'Chất liệu khung', 2),
(74, 'Chất liệu đệm', 2),
(75, 'Chiều cao (cm)', 3),
(76, 'Chiều rộng (cm)', 3),
(77, 'Chiều sâu (cm)', 3),
(78, 'Số ngăn kéo', 3),
(79, 'Chất liệu', 3),
(80, 'Loại tủ', 3),
(81, 'Loại bóng đèn', 4),
(82, 'Công suất (W)', 4),
(83, 'Chiều cao (cm)', 4),
(84, 'Đường kính (cm)', 4),
(85, 'Chất liệu', 4),
(86, 'Phong cách', 4),
(87, 'Chiều dài (cm)', 5),
(88, 'Chiều rộng (cm)', 5),
(89, 'Độ dày (cm)', 5),
(90, 'Chất liệu', 5),
(91, 'Kiểu dệt', 5),
(92, 'Chất liệu khung', 6),
(93, 'Chất liệu đệm', 6),
(94, 'Chống nước', 6),
(95, 'Chống UV', 6),
(96, 'Số chỗ ngồi', 6),
(97, 'Chiều dài (cm)', 7),
(98, 'Chiều cao lưng (cm)', 7),
(99, 'Chiều sâu ngồi (cm)', 7),
(100, 'Chất liệu bọc', 7),
(101, 'Loại đệm', 7),
(102, 'Số chỗ ngồi', 7),
(103, 'Chất liệu', 8),
(104, 'Chiều cao (cm)', 8),
(105, 'Đường kính (cm)', 8),
(106, 'Màu sắc', 8),
(107, 'Phong cách', 8),
(108, 'Chiều dài (cm)', 9),
(109, 'Chiều rộng (cm)', 9),
(110, 'Chiều cao đầu giường (cm)', 9),
(111, 'Kích thước nệm', 9),
(112, 'Chất liệu khung', 9),
(113, 'Loại giường', 9),
(114, 'Chất liệu mặt bàn', 1),
(123, 'Dụng cụ', 2);
SELECT setval('attributes_attribute_id_seq', (SELECT MAX(attribute_id) FROM attributes));

-- Banners
INSERT INTO banners (banner_id, banner_title, banner_description, banner_image, banner_link, banner_priority, status, category_id) VALUES
(1, 'SONA SPACE - Nội thất cao cấp', 'Khám phá bộ sưu tập nội thất hiện đại', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/banner1.webp', '/collections', 1, 1, NULL),
(2, 'Khuyến mãi mùa hè', 'Giảm đến 30% toàn bộ sản phẩm', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/banner2.webp', '/promotions', 2, 1, NULL),
(3, 'Sofa cao cấp', 'Thoải mái tột đỉnh cùng sofa BoConcept', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/banner_sofa.webp', '/categories/sofa', 3, 1, 7);
SELECT setval('banners_banner_id_seq', (SELECT MAX(banner_id) FROM banners));

-- News Category
INSERT INTO news_category (news_category_id, news_category_name, news_category_slug, news_category_description, news_category_status) VALUES
(1, 'Thiết kế nội thất', 'thiet-ke-noi-that', 'Tin tức về thiết kế nội thất', 1),
(2, 'Xu hướng', 'xu-huong', 'Xu hướng mới trong ngành nội thất', 1),
(3, 'Mẹo hay', 'meo-hay', 'Mẹo hay cho không gian sống', 1);
SELECT setval('news_category_news_category_id_seq', (SELECT MAX(news_category_id) FROM news_category));

-- Events
INSERT INTO events (event_id, event_title, event_description, event_image, event_start, event_end, event_status) VALUES
(1, 'Khai trương showroom mới', 'Sona Space khai trương showroom mới tại Quận 7', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/event1.webp', '2025-09-01 09:00:00', '2025-09-30 22:00:00', 1),
(2, 'Sale mùa thu', 'Giảm giá đến 40% nhân dịp mùa thu', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/event2.webp', '2025-10-01 00:00:00', '2025-10-31 23:59:59', 1);
SELECT setval('events_event_id_seq', (SELECT MAX(event_id) FROM events));

-- ============================================================
-- CREATE INDEXES
-- ============================================================
CREATE INDEX idx_product_category ON product(category_id);
CREATE INDEX idx_product_slug ON product(product_slug);
CREATE INDEX idx_variant_product_id ON variant_product(product_id);
CREATE INDEX idx_variant_color_id ON variant_product(color_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);
CREATE INDEX idx_wishlist_user ON wishlist(user_id);
CREATE INDEX idx_wishlist_variant ON wishlist(variant_id);
CREATE INDEX idx_comment_user ON comment(user_id);
CREATE INDEX idx_comment_order_item ON comment(order_item_id);
CREATE INDEX idx_user_gmail ON "user"(user_gmail);
CREATE INDEX idx_news_category ON news(news_category_id);
CREATE INDEX idx_room_product_room ON room_product(room_id);
CREATE INDEX idx_room_product_product ON room_product(product_id);
CREATE INDEX idx_product_attribute_product ON product_attribute_value(product_id);
CREATE INDEX idx_product_attribute_attribute ON product_attribute_value(attribute_id);

COMMIT;
