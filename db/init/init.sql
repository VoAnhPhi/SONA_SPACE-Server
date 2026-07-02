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
    category_icon VARCHAR(255),
    category_image VARCHAR(255),
    category_banner VARCHAR(255),
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
    value_type VARCHAR(50) NOT NULL DEFAULT 'text',
    unit VARCHAR(50),
    is_required BOOLEAN DEFAULT FALSE,
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
    page_type VARCHAR(100) NOT NULL DEFAULT 'home',
    status SMALLINT DEFAULT 1,
    category_id INTEGER REFERENCES category(category_id),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
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
    color_priority INTEGER,
    color_slug VARCHAR(255),
    status SMALLINT,
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
    material_priority INTEGER,
    material_status SMALLINT,
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
INSERT INTO category (category_id, category_name, category_description, slug, category_icon, category_image, category_banner, status, category_priority, updated_at, created_at, deleted_at) VALUES
(1, 'Bàn', NULL, 'ban', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250077/table_j8ecl7.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715529/table_zevrpz.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012398/image_73_akjjil.png', 1, 0, '2025-08-08 14:04:29', '2025-05-24 15:36:24', NULL),
(2, 'Ghế', NULL, 'ghe', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250604/chair-dining_czynxb.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715529/gh%E1%BA%BF_hzrc4u.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_76_xmgbfn.png', 1, 5, '2025-08-04 02:50:15', '2025-05-24 15:36:24', NULL),
(3, 'Tủ', NULL, 'tu', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250685/bookshelf_er5rbe.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715528/t%E1%BB%A7_lfkvme.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012398/image_75_ddypfl.png', 1, 3, '2025-08-04 02:51:35', '2025-05-24 15:36:24', NULL),
(4, 'Đèn', NULL, 'den', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250717/lamp_vkbtsa.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715528/%C4%91%C3%A8n_tvylu8.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012506/image_77_ze7psl.jpg', 1, 4, '2025-08-04 02:52:03', '2025-05-24 15:36:24', NULL),
(5, 'Thảm', NULL, 'tham', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250740/carpet_roll_cxvoou.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715529/th%E1%BA%A3m_p0oqxs.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_76_xmgbfn.png', 1, 5, '2025-08-04 02:52:26', '2025-05-24 15:36:24', NULL),
(6, 'Nội Thất Ngoài Trời', NULL, 'noi-that-ngoai-troi', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250782/plant_pcu9s1.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715529/outdoor_b4biv4.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_78_c4jkib.png', 1, 6, '2025-08-04 02:53:08', '2025-05-24 15:36:24', NULL),
(7, 'Sofa', NULL, 'sofa', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250804/armchair_iikhpz.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715528/sofar_hu00oh.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012398/image_72_hnp8kb.png', 1, 7, '2025-08-04 02:53:33', '2025-05-24 15:36:24', NULL),
(8, 'Phụ kiện', NULL, 'phu-kien-noi-that', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250854/picture_frame_a0w36w.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715528/ph%E1%BB%A5_ki%E1%BB%87n_i05kao.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_79_gw4mto.png', 1, 8, '2025-08-04 02:54:23', '2025-05-24 15:36:24', NULL),
(9, 'Giường', NULL, 'giuong', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250894/queen_bed_imxg4d.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715528/gi%C6%B0%E1%BB%9Dng_dlhcvl.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753619005/image_74_zswyv8_vpeiwv.jpg', 1, 6, '2025-08-04 02:55:51', '2025-05-24 15:36:24', NULL),
(56, 'daddy', NULL, 'ban-tra3', '', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753633161/SonaSpace/Category/bouc7hjbaxf8fgmccole.jpg', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753633162/SonaSpace/Category/banner/rdiqne3w193j9bo4dar0.webp', 0, 0, '2025-07-31 00:27:41', '2025-07-27 23:19:23', NULL);
SELECT setval('category_category_id_seq', (SELECT MAX(category_id) FROM category));

-- Colors
INSERT INTO color (color_id, color_name, color_code, color_priority, color_slug, status, created_at, updated_at, deleted_at) VALUES
(1, 'Màu be', '#c3c0b0', 1, 'mau-be', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(2, 'Màu xám', '#939192', 2, 'mau-xam', 1, '2025-08-04 08:23:07', '2025-08-04 09:42:42', NULL),
(6, 'Màu trắng', '#cac7be', 3, 'mau-trang', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(8, 'Màu gỗ', '#5b4f42', 4, 'mau-go', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(9, 'Màu kính ', '#e8e8e8', 5, 'mau-kinh', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(10, 'Màu gốm', '#c0bfbb', 6, 'mau-gom', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(14, 'Màu xanh', '#586878', 7, 'mau-xanh', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(19, 'Màu đen ', '#525254', 8, 'mau-den', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(25, 'Màu nâu', '#bdac8e', 9, 'mau-nau', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(27, 'Màu đồng ', '#e1d4b4', 10, 'mau-dong', 1, '2025-08-04 08:23:07', '2025-08-04 08:25:38', NULL),
(50, 'Xanh navy', '#4d6ea3', 11, 'xanh-navy', 1, '2025-08-04 08:23:07', '2025-08-04 09:43:29', NULL),
(52, 'Màu hồng', '#a17878', 0, 'mau-hong', 1, '2025-08-04 09:58:48', '2025-08-07 11:19:28', '2025-08-07 11:19:28');
SELECT setval('color_color_id_seq', (SELECT MAX(color_id) FROM color));

-- Materials
INSERT INTO materials (material_id, material_name, material_description, slug, material_priority, material_status, created_at, updated_at, deleted_at) VALUES
(1, 'Gỗ tự nhiên', 'Gỗ tự nhiên là loại gỗ được khai thác trực tiếp từ rừng hoặc từ các loại cây trồng lâu năm, không qua quá trình ép công nghiệp. Với vân gỗ độc đáo, độ bền cao và khả năng chống mối mọt tốt, gỗ tự nhiên thường được sử dụng cho các sản phẩm nội thất cao cấp, mang lại vẻ đẹp sang trọng và giá trị sử dụng lâu dài.', 'go_tu_nhien', 1, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(2, 'Gỗ MDF', 'Gỗ MDF (Medium Density Fiberboard) là loại gỗ công nghiệp được tạo thành từ bột gỗ nghiền nhỏ, trộn keo và ép nén ở áp suất cao. MDF có bề mặt nhẵn, dễ sơn phủ, thi công nhanh và giá thành thấp hơn so với gỗ tự nhiên. Tuy không bền bằng gỗ thật nhưng vẫn là lựa chọn phổ biến cho nội thất gia đình và văn phòng.', 'go_mdf', 2, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(3, 'Gỗ công nghiệp', 'Gỗ công nghiệp là tên gọi chung của các loại gỗ được sản xuất từ nguyên liệu gỗ tái chế hoặc gỗ trồng ngắn ngày, qua xử lý ép dán thành tấm. Các loại gỗ công nghiệp phổ biến gồm MDF, MFC, HDF... Ưu điểm là giá rẻ, dễ thi công, thân thiện với môi trường và phù hợp cho sản phẩm sản xuất hàng loạt.', 'go_cong_nghiep', 3, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(4, 'Gỗ sồi', 'Gỗ sồi là loại gỗ nhập khẩu từ châu Âu hoặc Mỹ, nổi bật với màu sắc sáng, vân gỗ đẹp và khả năng chịu lực tốt. Gỗ sồi thường được sử dụng trong sản xuất bàn, ghế, tủ, kệ mang phong cách hiện đại hoặc tân cổ điển. Ngoài ra, gỗ sồi còn chống cong vênh và có độ bền theo thời gian.', 'go_soi', 4, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(5, 'Da thật', 'Da thật được làm từ da động vật như bò, dê, cừu..., trải qua quá trình xử lý thuộc da kỹ thuật cao để đảm bảo độ mềm, độ bền và tính thẩm mỹ. Ưu điểm là bề mặt mịn, thông thoáng, có mùi đặc trưng và càng sử dụng lâu càng bóng đẹp. Da thật thường được dùng cho sofa cao cấp, ghế văn phòng, túi xách thời trang...', 'da_that', 5, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(6, 'Da công nghiệp', 'Da công nghiệp (da PU, da Simili) là vật liệu tổng hợp mô phỏng da thật, được phủ nhựa PVC hoặc polyurethane trên nền vải. Có nhiều màu sắc, dễ vệ sinh, giá thành thấp hơn da thật và bền trong môi trường sử dụng thông thường. Phù hợp làm ghế sofa, bọc đệm, túi xách, giày dép phổ thông.', 'da_cong_nghiep', 6, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(7, 'Vải bố', 'Vải bố là loại vải dệt thô từ sợi cotton hoặc sợi tổng hợp, có độ dày cao và bề mặt sần nhẹ. Vải bố thường được dùng trong sản phẩm nội thất vintage, bohemian hoặc trang trí thủ công vì tạo cảm giác mộc mạc, bền bỉ. Ngoài ra, vải bố cũng thân thiện với môi trường và có khả năng hút ẩm tốt.', 'vai_bo', 7, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(8, 'Vải nỉ', 'Vải nỉ là loại vải dệt từ sợi tổng hợp hoặc tự nhiên, có lớp lông mịn bề mặt giúp giữ nhiệt tốt, tạo cảm giác ấm áp và mềm mại. Thường được dùng cho nội thất như sofa mùa lạnh, chăn mền, trang phục mùa đông và đồ trang trí vì đặc tính êm ái và đa dạng màu sắc.', 'vai_ni', 8, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(9, 'Lông thú tổng hợp', 'Lông thú tổng hợp là chất liệu giả lông động vật, được sản xuất từ sợi tổng hợp như polyester, acrylic. Ưu điểm là mềm, ấm, thân thiện với môi trường và không gây tổn hại đến động vật. Thường dùng trong chăn, áo khoác, gối trang trí hoặc các chi tiết sang trọng cho nội thất.', 'long_thu_tong_hop', 9, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(10, 'Pha lê', 'Pha lê là loại thủy tinh cao cấp có thành phần oxit chì giúp tăng độ trong suốt và độ sáng bóng. Chất liệu này thường được sử dụng cho các sản phẩm đèn trang trí, chân nến, lọ hoa hoặc các chi tiết trang trí tinh xảo, mang lại vẻ đẹp quý phái và sang trọng cho không gian.', 'pha_le', 10, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(11, 'Kim loại sơn tĩnh điện', 'Kim loại sơn tĩnh điện là kim loại (thường là sắt, thép) được phủ một lớp sơn bằng phương pháp tĩnh điện, giúp lớp sơn bám chắc, bền màu và chống gỉ sét hiệu quả. Được dùng rộng rãi trong nội thất hiện đại như bàn ghế, khung giường, kệ tủ, đảm bảo độ bền cao và thẩm mỹ lâu dài.', 'kim_loai_son_tinh_dien', 11, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(12, 'Nhựa ABS', 'Nhựa ABS (Acrylonitrile Butadiene Styrene) là loại nhựa kỹ thuật có độ cứng cao, chịu va đập tốt và bền với thời gian. ABS không mùi, an toàn và có khả năng chống ẩm, thường dùng cho vỏ máy, thiết bị gia dụng, đồ chơi, và đồ nội thất như ghế nhựa cao cấp.', 'nhua_abs', 12, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(13, 'Thủy tinh', 'Thủy tinh là chất liệu trong suốt, dễ tạo hình, bề mặt mịn và sạch sẽ. Được ứng dụng rộng rãi trong đồ dùng nhà bếp, đèn chiếu sáng, mặt bàn, hoặc các chi tiết trang trí nội thất hiện đại. Ưu điểm là không thấm nước, dễ lau chùi và tạo hiệu ứng ánh sáng tốt.', 'thuy_tinh', 13, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(14, 'Vải Canvas', 'Vải Canvas là loại vải dày, được dệt từ sợi cotton hoặc polyester, có độ bền và khả năng chịu lực tốt. Canvas thường được sử dụng cho balo, túi xách, tranh vẽ, ghế lười và các sản phẩm nội thất phong cách trẻ trung. Chất liệu này cũng dễ in ấn và có tuổi thọ cao.', 'vai_canvas', 14, 1, '2025-07-15 14:19:48', '2025-07-18 02:36:10', NULL),
(17, 'cadfdfaczvvzxcvzxc', 'fdà', 'cadfdfaczvvzxcvzxc', NULL, 0, '2025-07-18 19:46:09', '2025-08-21 00:39:59', NULL),
(19, 'àd', 'dfàd', 'ad', NULL, 0, '2025-07-18 19:48:06', '2025-08-21 00:40:41', NULL);
SELECT setval('materials_material_id_seq', (SELECT MAX(material_id) FROM materials));

-- Users (Admin and sample test users - passwords should be hashed in production)
INSERT INTO "user" (user_id, user_name, user_gmail, user_number, user_password, user_image, user_address, user_role, user_gender, user_birth, user_email_active, user_verified_at) VALUES
(1, 'Admin', 'admin@sonaspace.com', '0901234567', '$2a$10$OfstRyqvm1g1OdrnRrEnZ.XML/mX8LEfUa44el//VVwlKs8aJThzm', NULL, 'Sona Space HQ', 'admin', 'male', '1990-01-01', 1, CURRENT_TIMESTAMP),
(2, 'Staff User', 'staff@sonaspace.com', '0902345678', '$2a$10$OfstRyqvm1g1OdrnRrEnZ.XML/mX8LEfUa44el//VVwlKs8aJThzm', NULL, 'Sona Space Office', 'staff', 'female', '1992-05-15', 1, CURRENT_TIMESTAMP),
(3, 'Test User', 'user@sonaspace.com', '0903456789', '$2a$10$un8nzDME5sEUrSS.8a.29.DnSCPKErQyqDr.5O7zDMT4iq5etsaSa', NULL, '123 Test Street', 'user', 'other', '1995-08-20', 1, CURRENT_TIMESTAMP);
SELECT setval('user_user_id_seq', (SELECT MAX(user_id) FROM "user"));

-- Products
INSERT INTO product (product_id, category_id, product_name, product_image, product_slug, product_description, product_priority, product_view, product_sold, product_status, updated_at, created_at, deleted_at, comment_id, variant_materials, variant_height, variant_width, variant_depth, variant_seating_height, variant_maximum_weight_load, product_stock) VALUES
(131, 7, 'Modena 2.5 chỗ', 'https://assets.boconcept.com/7b8aaaaa-69a3-4be2-b17b-ad43017fde9c/1531629_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e4efbc82-d141-41b0-a324-ad43017fdf06/1531630_PNG-Web%2072dpi.png?format=w', 'modena-2-5-cho', 'Hình dạng hữu cơ và đường nét tối giản kết hợp với nhau trong một biểu hiện giản dị, đương đại. Ghế sofa Modena sẽ tạo thêm một cảm giác thoải mái đòi hỏi bạn đến thư giãn trong sự thoải mái tuyệt vời khi ngồi yên. Các chi tiết thiết kế trang nhã nâng cao biểu cảm tổng thể và cùng với sự thoải mái mềm mại, đảm bảo một chiếc ghế sofa sẽ nhanh chóng trở thành món ăn yêu thích của gia đình.', 1, 216, 73, 1, '2025-08-26 11:09:50', '2025-06-14 15:43:20', NULL, 42, 'Gỗ tự nhiên', 85.00, 90.00, 80.00, 45.00, 180.00, NULL),
(132, 7, 'Sofa Amsterdam', 'https://assets.boconcept.com/eca177eb-68e5-4397-ad16-ad44013095ed/734517_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/89dd04e0-6331-425e-81eb-ad4401309526/734518_PNG-Web%2072dpi.png?format=webp', 'sofa-amsterdam', 'Amsterdam là những đường nét sắc nét và những đường cong rộng. Sự thoải mái và sang trọng thấm nhuần từng chi tiết để làm cho Amsterdam trở thành chiếc ghế sofa hoàn hảo cho một tuyên bố mềm mại và hấp dẫn trong phòng khách của bạn.', 2, 163, 24, 1, '2025-08-26 12:32:47', '2025-05-24 15:43:20', NULL, 7, 'Da thật', 120.00, 60.00, 60.00, 50.00, 100.00, 7),
(133, 7, 'Bergamo 5 chỗ', 'https://assets.boconcept.com/10ceb3b3-4974-4511-832e-ad6c002bc777/1701403_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/b6b961cd-0351-4862-b762-ad6c002bc825/1701404_PNG-Web%2072dpi.png?format=we', 'bergamo-5-cho', 'Bergamo của Morten Georgsen là sự sang trọng hữu cơ được tạo ra thoải mái. Bergamo kết hợp một cách trang nhã sự thoải mái phi thường, cá nhân với tính thẩm mỹ thanh lịch. Kết quả là một chiếc ghế sofa hiện đại với sự thoải mái cả ngày.', 3, 116, 49, 1, '2025-08-26 13:10:53', '2025-05-24 15:43:20', NULL, 18, 'Gỗ tự nhiên', 182.00, 72.00, 52.00, 80.00, 210.00, 6),
(134, 1, 'Bàn cà phê chức năng Chiva', 'https://assets.boconcept.com/4e325c32-f021-47a0-a918-ad440002678c/1570721_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/50ea4adb-3240-470a-a9e4-ad440002679b/1570725_PNG-Web%2072dpi.png?format=we', 'ban-ca-phe-chuc-nang-chiva', 'Bàn cà phê hiện đại này có chức năng thuần túy được bao bọc trong thiết kế tuyệt vời. Giấu điều khiển từ xa, tạp chí, bộ sạc và dây cáp ở trung tâm bàn cà phê Chiva, với bộ lưu trữ tích hợp thông minh. Hoặc nâng mặt bàn mỏng lên để tạo chiều cao hoàn hảo cho trà chiều. Các thiết kế chân khác nhau cung cấp các chiều cao và chức năng khác nhau cho phép bạn có được bàn cà phê hoàn hảo cho không gian của mình.', 4, 79, 17, 1, '2025-08-26 03:13:10', '2025-05-24 15:43:20', NULL, 26, NULL, 40.00, 30.00, 20.00, 50.00, 50.00, 11),
(135, 1, 'Bàn cà phê Madrid', 'https://assets.boconcept.com/58b57b69-4966-44af-a855-ad44010800aa/667325_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/3e426655-462c-45d3-9825-ad440108029d/667326_PNG-Web%2072dpi.png?format=webp', 'ban-ca-phe-madrid', 'Các đường nét gọn gàng và hình dạng hữu cơ kết hợp với nhau trong một thiết kế nổi để làm cho bàn cà phê Madrid trở thành một món đồ cảm giác, rực rỡ cho nội thất của bạn. Được thiết kế bởi Morten Georgsen, chiếc bàn cà phê cổ điển nhưng hiện đại này tạo nên sự hiện đại trong mọi không gian.', 5, 89, 20, 1, '2025-08-26 09:05:45', '2025-05-24 15:43:20', NULL, 3, 'Vải cotton', 55.00, 55.00, 6.00, 90.00, 35.00, 5),
(136, 1, 'Bàn làm việc Cupertino', 'https://assets.boconcept.com/0a45a1ee-d336-4357-b7cc-ad6c00144f53/1601485_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/eb54292e-56f5-4824-9ffb-ad6c00144f78/1601488_PNG-Web%2072dpi.png?format=we', 'ban-lam-viec-cupertino', 'Cupertino - mọi thứ bạn cần trong văn phòng tại nhà, được giấu đi ngay lập tức. Bàn Cupertino Executive kết hợp mặt bàn lớn và ngăn kéo rộng rãi với thiết kế nhẹ, cung cấp nhiều không gian cho tất cả các vật dụng cần thiết trong văn phòng của bạn trong khi vẫn giữ được vẻ ngoài tối giản.', 6, 63, 2, 1, '2025-08-26 03:02:39', '2025-05-24 15:43:20', NULL, 45, 'Lông thú tổng hợp', 5.00, 150.00, 150.00, NULL, 20.00, 3),
(137, 2, 'Ghế bành Modena', 'https://assets.boconcept.com/686e92c5-49f9-4b8e-8096-ad43017fa263/1531169_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/f2432a35-035a-4007-af8c-ad43017fa252/1531170_PNG-Web%2072dpi.png?format=we', 'ghe-banh-modena', 'Hình dạng hữu cơ và đường nét tối giản kết hợp với nhau trong một biểu hiện giản dị, đương đại. Ghế Modena sẽ tạo thêm một cảm giác thoải mái yêu cầu bạn đến thư giãn trong sự thoải mái tuyệt vời khi ngồi xuống. Các chi tiết thiết kế trang nhã nâng cao biểu cảm tổng thể và cùng với sự thoải mái mềm mại, đảm bảo một chiếc ghế sẽ nhanh chóng trở thành địa điểm thư giãn yêu thích của bạn.', 7, 144, 12, 1, '2025-08-26 09:16:27', '2025-05-24 15:43:20', NULL, 12, 'Lông tổng hợp', 5.00, 155.00, 155.00, NULL, 21.00, 9),
(138, 2, 'Ghế ăn Hamilton', 'https://assets.boconcept.com/9d86cd53-b349-4d9f-a537-aff500b6703a/2014367_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/78785dc6-663a-4df8-b0bc-aff500b6ada2/2014369_PNG-Web%2072dpi.png?format=we', 'ghe-an-hamilton', 'Cổ điển kết hợp hiện đại trên ghế ăn Hamilton. Được thiết kế bởi Morten Georgsen, hình dạng hữu cơ mang lại sự thoải mái khi kén trong khi vòng eo thon gọn mang lại sự thoải mái khi ngồi linh hoạt. Thưởng thức nhân vật của Hamilton và tạo ra tuyên bố trong phòng ăn của bạn.', 8, 91, 12, 1, '2025-08-25 23:20:48', '2025-05-24 15:43:20', NULL, 31, 'Da công nghiệp', 88.00, 195.00, 88.00, 44.00, 240.00, 4),
(139, 2, 'Ghế ăn Seoul', 'https://assets.boconcept.com/f64e2868-c28e-4aa0-9234-b183018afc32/2750994_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/6ff23065-a422-41e7-b5f2-b1840000123a/2750996_PNG-Web%2072dpi.png?format=we', 'ghe-an-seoul', 'Bàn làm việc gỗ công nghiệp, bền đẹp', 9, 82, 1, 1, '2025-08-26 09:08:26', '2025-05-24 15:43:20', NULL, 21, 'Gỗ tự nhiên', 180.00, 80.00, 40.00, NULL, 100.00, 5),
(140, 3, 'Tủ đựng đồ Fermo', 'https://assets.boconcept.com/1a275588-00df-4bdd-b362-ad6c00246894/1682585_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/9cfd2dd7-26c0-40d2-83e0-ad6c00246724/1682586_PNG-Web%2072dpi.png?format=we', 'tu-dung-do-fermo', 'Hãy để Fermo thực hiện phép thuật của nó. Hãy xem những đường nét gọn gàng và vẻ ngoài tối giản của Fermo mở rộng ra toàn bộ ngôi nhà của bạn, khi sự lộn xộn của bạn được che giấu gọn gàng. Cho dù bạn đang xem trận đấu, nghe nhạc hay hiển thị ảnh kỳ nghỉ của mình, thiết bị TV này sẽ ẩn thiết bị điện tử của bạn một cách liền mạch, vì vậy bạn có thể tập trung vào việc giải trí.', 10, 84, 1, 1, '2025-08-26 04:16:23', '2025-05-24 15:43:20', NULL, 1, 'Gỗ MDF', 182.00, 82.00, 42.00, NULL, 105.00, 0),
(141, 3, 'Tủ quần áo đôi Lugano', 'https://assets.boconcept.com/639b72b0-14c5-4f56-9ca8-ad6c001ad6c1/1640903_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/3e348f71-2d62-44f9-a1de-ad6c001ad735/1640904_PNG-Web%2072dpi.png?format=we', 'tu-quan-ao-doi-lugano', 'Trông bóng bẩy, thanh lịch và độc quyền, Lugano sẽ giải quyết mọi nhu cầu lưu trữ của bạn mà không phải đổ mồ hôi. Thấp, sang trọng và với chức năng tuyệt vời, bộ lưu trữ thời trang này sẽ mang đến vẻ sang trọng cho ngôi nhà của bạn.', 11, 73, 1, 1, '2025-08-24 20:30:22', '2025-05-24 15:43:20', NULL, 33, 'Gỗ sồi', 150.00, 75.00, 70.00, NULL, 200.00, 1),
(142, 3, 'Tủ Calgary có ngăn kéo', 'https://assets.boconcept.com/ad7fed58-48ff-4013-8a92-affe00e407ed/2073421_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/2bd605bf-3174-4711-9279-affe00e34469/2073420_PNG-Web%2072dpi.png?format=we', 'tu-calgary-co-ngan-keo', 'Calgary là một hệ thống lưu trữ đa năng kết hợp tính thẩm mỹ với chức năng. Được thiết kế bởi Morten Georgsen, thiết kế lưu trữ mở đơn giản nhưng tinh tế này có thể được sử dụng như một bàn làm việc, quầy bar mini hoặc nơi trưng bày đồ đạc của bạn. Có sẵn trong một số mô hình cố định có thể được kết hợp hoặc độc lập, bộ lưu trữ có thể tùy chỉnh này có thể được điều chỉnh để đáp ứng nhu cầu của bạn.', 12, 66, 0, 1, '2025-08-17 01:34:26', '2025-05-24 15:43:20', NULL, 29, 'Da thật', 95.00, 60.00, 60.00, 45.00, 220.00, 0),
(143, 4, 'Đèn mặt dây chuyền mái chèo', 'https://assets.boconcept.com/9d96fc45-138d-40ec-9a15-ae43007ef6b3/2014093_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/46ead729-83e7-4e41-b665-ae4e00e0d993/2014094_PNG-Web%2072dpi.png?format=we', 'den-mat-day-chuyen-mai-cheo', 'Tâm điểm của bất kỳ căn phòng nào, mặt dây chuyền Paddle nhẹ nhàng chiếu sáng không gian của bạn cho một cái nhìn ấm cúng, yên tĩnh.', 13, 56, 0, 1, '2025-08-17 00:38:06', '2025-05-24 15:43:20', NULL, 8, 'Gỗ MDF', 120.00, 60.00, 55.00, NULL, 180.00, 0),
(144, 4, 'Đèn sàn Kip
', 'https://assets.boconcept.com/24e28db0-c289-41ab-b24f-ad4400c80abb/562211_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e62b16b0-afc7-4695-b039-ad4400c7f3d7/562153_PNG-Web%2072dpi.png?format=webp', 'den-san-kip', 'Đồng thau cổ mờ với hình tròn đảm bảo vẻ ngoài phong cách và ấm áp cho đèn Kip. Đầu có thể điều chỉnh giúp bạn có thể di chuyển ánh sáng dịu theo bất kỳ hướng nào - hoàn hảo để thắp sáng khu vực đọc sách hoặc một điểm yêu thích khác của bạn.', 14, 55, 1, 1, '2025-08-25 00:11:59', '2025-05-24 15:43:20', NULL, 39, 'Pha lê', 50.00, 50.00, 20.00, NULL, 80.00, 2),
(145, 4, 'Đèn bàn Stockholm', 'https://assets.boconcept.com/eb2cebcb-bec2-472e-83d0-ad44005a042b/36017_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/fefbe5fd-f518-44e9-93a5-ad44005606d0/32051_PNG-Web%2072dpi.png?format=webply', 'den-ban-stockholm', 'Sự đơn giản và tối giản kết hợp trong đèn treo Stockholm. Được thiết kế bằng kính trong suốt và đá tự nhiên, tăng thêm sự ấm áp cho phòng khách hoặc hành lang của bạn.', 15, 43, 0, 1, '2025-08-26 03:15:09', '2025-05-24 15:43:20', NULL, 47, 'Vải Canvas', 55.00, 55.00, 6.00, NULL, 35.00, 1),
(146, 5, 'Thảm rãnh', 'https://assets.boconcept.com/9fff24d4-2811-4b23-83e6-adc50105703b/1711591_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/84104d45-e3cd-4099-9a8b-adc5010570e9/1711595_PNG-Web%2072dpi.png?format=we', 'tham-ranh', 'Các đường cắt hình 3D lượn sóng tạo ra chiều sâu và cấu trúc cho thảm Furrow trong khi sự pha trộn của các màu sắc trong len tái sử dụng mang lại một cuộc sống thú vị trên bề mặt. Kết quả là một cái nhìn khuyến khích bạn khám phá các đường cong tự nhiên và các chuyển tiếp tinh tế.', 16, 49, 1, 1, '2025-08-20 15:24:02', '2025-05-24 15:43:20', NULL, 14, 'Lông thú tổng hợp', 7.00, 160.00, 160.00, NULL, 23.00, 0),
(147, 5, 'Thảm vân sóng', 'https://assets.boconcept.com/f21c4e6e-5d42-4106-8e3e-adc501056dbe/1711578_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/3c60118b-1dae-42e7-8cfa-adc501058cd8/1712213_PNG-Web%2072dpi.png?format=we', 'tham-van-song', 'Tấm thảm Form được dệt panja trong các con hẻm nông thôn của Ấn Độ bởi các nghệ nhân tài năng của Ấn Độ. Kiểu dệt Panja, được đặt theo tên của một dụng cụ giống như móng vuốt được sử dụng để đặt các sợi dọc, thường được sử dụng để sản xuất vải hoặc thảm. Tấm thảm là một thiết kế hiện đại tuyệt vời với màu sắc tinh tế tạo thêm nét hiện đại, sang trọng cho bất kỳ kiểu trang trí nào. Nó được làm bằng len New Zealand chất lượng cao. Nó nổi bật với màu sắc được điều chỉnh, các cạnh được khâu tinh xảo và kiểu dệt mộc mạc. Bạn sẽ yêu thích vẻ ngoài của thảm Form tạo thêm nét tối giản cổ điển cho khu vực sinh hoạt của bạn.', 17, 98, 0, 1, '2025-08-25 23:32:41', '2025-05-24 15:43:20', NULL, 24, 'Da thật', 92.00, 205.00, 92.00, 46.00, 255.00, 0),
(148, 5, 'Thảm đấu trường', 'https://assets.boconcept.com/42e5d319-13d4-447e-ba5a-b14c00bc6af5/2748321_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/1da359dd-6418-483c-95fb-b14c00bd1173/2748322_PNG-Web%2072dpi.png?format=we', 'tham-dau-truong', 'Thêm nét nét cho không gian sống của bạn với tấm thảm Arena. Thiết kế hình tròn hữu cơ được chần thủ công với sự pha trộn giữa chất liệu TENCEL™ và lụa, nổi bật với bảng màu nâu đậm đà thấm nhuần sự sang trọng hiện đại.', 18, 63, 0, 1, '2025-08-20 15:19:05', '2025-05-24 15:43:20', NULL, 6, 'Gỗ tự nhiên', 182.00, 85.00, 45.00, NULL, 110.00, 0),
(149, 6, 'Ghế sofa Cancún Lounge', 'https://assets.boconcept.com/067e9417-3952-42bf-8782-b0cb0094d181/2113820_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e734d5e2-1aaf-40ea-b5a2-b0cb0094ca30/2113818_PNG-Web%2072dpi.png?format=we', 'ghe-sofa-cancun-lounge', 'Sự thoải mái ngoài trời đang chờ đợi với ghế sofa Cancún. Sự bổ sung hoàn hảo cho bất kỳ sân trong, sân thượng hoặc sân vườn nào, chiếc ghế sofa ngoài trời tối giản này sẽ khiến bạn muốn ở bên ngoài suốt mùa hè dài.', 19, 56, 0, 1, '2025-08-17 00:42:31', '2025-05-24 15:43:20', NULL, 49, 'Gỗ MDF', 78.00, 130.00, 65.00, NULL, 160.00, 0),
(150, 6, 'Ghế ăn Cancún', 'https://assets.boconcept.com/c7fed9cd-f3ee-4bcb-b832-b0c200d15ee0/2113686_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/18e29d5a-5ccd-4003-a914-b0c200cfe885/2113688_PNG-Web%2072dpi.png?format=we', 'ghe-an-cancun', 'Dành cả ngày của bạn trong không gian ngoài trời tuyệt vời với ghế ăn Cancún. Lý tưởng cho cà phê sáng sớm và tiệc tối ngẫu hứng, chiếc ghế ngoài trời này phù hợp với mọi khung cảnh ngoài trời.', 20, 81, 0, 1, '2025-08-17 00:42:15', '2025-05-24 15:43:20', NULL, 17, 'Vải nỉ', 105.00, 85.00, 85.00, 47.00, 95.00, 0),
(151, 6, 'Bàn phụ Cancún', 'https://assets.boconcept.com/7c7dc52e-0a4a-461d-989b-b0cb00902e6f/2112077_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/09a77b48-684b-4956-9ade-b0cb008febbd/2112076_PNG-Web%2072dpi.png?format=we', 'ban-phu-cancun', 'Mang đến sự sang trọng và tiện dụng cho bên hồ bơi hoặc sân trong của bạn với bàn cà phê Cancún của Morten Georgsen. Với thiết kế hai tầng thông minh, chiếc bàn tiếp khách này là thứ tuyệt đối bắt buộc cho cuộc sống ngoài trời.', 1, 41, 0, 1, '2025-08-17 00:40:14', '2025-05-24 15:43:20', NULL, 11, 'Gỗ sồi', 155.00, 80.00, 75.00, NULL, 210.00, 0),
(152, 8, 'Bình mưa', 'https://assets.boconcept.com/a9e41ca9-b840-41fd-b8ba-ad4301703a1d/1481633_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/d6101d8f-8c64-462a-81ba-ad43017057c8/1481753_PNG-Web%2072dpi.png?format=we', 'binh-mua', 'Bình tuyên bố này được thổi miệng từ lò nhậu trong khi hiệu ứng thị giác sau đó đạt được bằng quá trình cắt được thực hiện bằng tay. Kết quả là một chiếc bình đẹp mang dấu ấn của nhà sản xuất.', 2, 37, 1, 1, '2025-08-17 00:39:01', '2025-05-24 15:43:20', NULL, 28, 'Da thật', 98.00, 65.00, 65.00, 48.00, 230.00, 1),
(153, 8, 'Bình phao', 'https://assets.boconcept.com/e674bb58-ee5e-48c0-87e9-ad440009629b/1588092_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/aa41ad63-79e2-49e4-8ce3-ad4400096cd5/1588112_PNG-Web%2072dpi.png?format=we', 'binh-phao', 'Cập nhật bộ sưu tập đất nung của bạn với bình Float. Được làm từ đá trầm tích tự nhiên, các vệt tự nhiên và bất thường được tìm thấy trên mỗi bình là dấu vết của thủ công thủ công, có nghĩa là không có hai thiết kế nào giống nhau.', 3, 61, 0, 1, '2025-08-17 01:53:21', '2025-05-24 15:43:20', NULL, 2, 'Gỗ MDF', 125.00, 65.00, 60.00, NULL, 190.00, 0),
(154, 8, 'Bình bong bóng', 'https://assets.boconcept.com/d39fb897-53f4-4b32-973e-ad440009668a/1588090_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/d7311c66-2c1c-4f5a-9336-ad4400096b77/1588110_PNG-Web%2072dpi.png?format=we', 'binh-bong-bong', 'Hình thức và kết cấu kết hợp trong bình Bubble. Các vệt tự nhiên và bất thường được tìm thấy trên mỗi chiếc bình là dấu vết của nghề thủ công của nghệ nhân, có nghĩa là không có hai thiết kế nào giống nhau.', 4, 46, 0, 1, '2025-08-17 00:42:14', '2025-05-24 15:43:20', NULL, 36, 'Pha lê', 55.00, 55.00, 25.00, NULL, 85.00, 0),
(155, 9, 'Giường Lugano storage', 'https://assets.boconcept.com/dac05adc-b7ed-4f56-af86-b0c40022e4b9/2119243_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/ed6b7a93-e4df-4cfe-bac5-b0c40022f4af/2119245_PNG-Web%2072dpi.png?format=we', 'giuong-lugano-storage', 'Hãy để cơ thể bạn chìm xuống và cảm thấy thư giãn tràn ngập bạn. Ngủ như một thiên thần trên chiếc giường Lugano thanh lịch. Giữ vẻ ngoài tối giản với khung gỗ sạch sẽ, chiếc giường hiện đại này sẽ mang lại cảm giác yên tĩnh và thanh bình cho phòng ngủ của bạn. Được trang bị đế để có vẻ ngoài nam tính, nặng nề hơn, chiếc giường này mời bạn thoải mái. Đầu giường chần tạo thêm nét truyền thống và tạo ra một bầu không khí mềm mại, thân thiện. Nâng khung giường lên và để lộ nhiều không gian lưu trữ cho giường phụ, chăn mùa đông dày hoặc thậm chí có thể để giấu quà.', 5, 51, 0, 1, '2025-08-17 00:45:43', '2025-05-24 15:43:20', NULL, 43, 'Vải Canvas', 58.00, 58.00, 7.00, NULL, 38.00, 0),
(156, 9, 'Gường Fusion Day', 'https://assets.boconcept.com/57cdff54-43c7-494c-9ca9-ad440073f01c/365501_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/75c3e95e-7a35-4c5a-8b88-ad440073e901/365492_PNG-Web%2072dpi.png?format=webp', 'guong-funsion-day', 'Chiếc ghế giường Fusion là một món đồ nội thất thiết kế đẹp mắt và mang tính biểu tượng, kết hợp giữa thẩm mỹ Nhật Bản và chức năng Đan Mạch. Những chiếc gối rời có thể được sắp xếp tự do, cho phép bạn thay đổi diện mạo tùy theo nhu cầu sử dụng, trong khi chân ghế thanh mảnh và các đường nét gọn gàng giữ cho phong cách luôn nhẹ nhàng, tinh tế.', 6, 56, 0, 1, '2025-08-17 00:37:33', '2025-05-24 15:43:20', NULL, 5, 'Lông thú tổng hợp', 8.00, 165.00, 165.00, NULL, 24.00, 0),
(157, 9, 'Giường Arlington', 'https://assets.boconcept.com/b4c2cc59-26d1-438e-95b2-ad6c0019aaa3/1637877_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e99dd3e9-7ac8-4534-adce-ad6c0019aad3/1637878_PNG-Web%2072dpi.png?format=we', 'giuong-arlingtn', 'Tựa lưng chắc chắn khi ngồi dựa vào đầu giường và cảm giác êm ái khi nằm xuống khiến giường Arlington trở thành một lựa chọn tuyệt vời cho phòng ngủ. Giống như phần nối dài của một chiếc gối, phần đầu giường mềm mại như mời gọi bạn bước vào một giấc ngủ ngon.








', 7, 91, 0, 1, '2025-08-17 00:39:16', '2025-05-24 15:43:20', NULL, 5, 'Da thật', 94.00, 210.00, 94.00, 47.00, 260.00, 0),
(196, 2, 'dd', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1751359021/SonaSpace/Product/main/piucgrtwui2c4fs97qtk.webp', 'ghe-test', 'jdfkjágh', 25, 1, 0, 0, '2025-08-17 00:41:49', '2025-06-30 23:04:02', NULL, 0, 'vai', 5.00, 5.00, 5.00, 55.00, 5.00, 0),
(208, 2, 'Cửa Gỗ', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1752162548/SonaSpace/Product/main/xgnodoas1ugjixohms85.jpg', 'cua-go', 'abc', 0, 0, 0, 0, '2025-07-21 19:25:32', '2025-07-10 22:49:12', NULL, 0, 'gỗ', 200.00, 50.00, 0.00, 0.00, 5.00, 0),
(220, 2, 'fgsghg', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753643795/SonaSpace/Product/main/bb06wiops5vshxscwzwp.jpg', 'fgsghg', 'ggf', 24, 0, 1, 0, '2025-08-07 15:11:12', '2025-07-28 02:16:39', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 1),
(226, 2, 'Ghế Công Thái học', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754902910/SonaSpace/Product/main/ccqqtoi7uo2m0m7tqtug.png', 'ghe-cong-thai-hoc', 'Mang đến sự kết hợp hoàn hảo giữa công thái học hiện đại và sự gắn kết lãng mạn, ghế công thái học tình yêu được thiết kế dành riêng cho các cặp đôi muốn tận hưởng từng khoảnh khắc bên nhau một cách thoải mái và tốt cho sức khỏe.

Với tựa lưng đôi ôm sát đường cong cơ thể, đệm ngồi rộng rãi và góc ngả linh hoạt, chiếc ghế này hỗ trợ tối ưu cột sống, cổ, vai và hông của cả hai, giúp giảm căng thẳng khi ngồi lâu. Chất liệu da/mesh cao cấp thoáng khí cùng đường may tinh xảo tạo cảm giác êm ái và sang trọng.

Không chỉ là một chiếc ghế, đây còn là không gian chia sẻ: đọc sách cùng nhau, xem phim, trò chuyện, hoặc đơn giản là tựa vào nhau sau một ngày dài. Ghế công thái học tình yêu sẽ biến mọi khoảnh khắc bình thường thành trải nghiệm ấm áp và đầy kết nối.', 26, 7, 3, 0, '2025-08-24 15:30:44', '2025-08-11 16:01:52', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 2);
SELECT setval('product_product_id_seq', (SELECT MAX(product_id) FROM product));

-- Variant Products
INSERT INTO variant_product (variant_id, product_id, color_id, variant_product_quantity, variant_product_price, variant_product_price_sale, variant_product_slug, variant_product_list_image) VALUES
(255, 131, 1, 29, 19000000.00, 18000000.00, 'mau-be', 'https://assets.boconcept.com/7b8aaaaa-69a3-4be2-b17b-ad43017fde9c/1531629_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e4efbc82-d141-41b0-a324-ad43017fdf06/1531630_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/dcab23ce-8636-48e5-a0e3-ad43017fdf22/1531631_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/54f5338c-2a20-411d-bc76-ad43017fdfcd/1531632_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/3c624512-b815-461c-9c9f-ad440017d069/1685815__WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/e4377be5-2a5e-45a6-a087-ae3000967c71?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/839bf0d0-69e2-4a62-b28c-ae3500f427c1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(256, 131, 2, 19, 20000000.00, 19000000.00, 'mau-xam-nhat', 'https://assets.boconcept.com/d3cd0396-2c17-4894-af01-ad43017fce7b/1531505_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/b8a501e1-d905-441a-9979-ad43017fcd66/1531506_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/fceb0777-00d9-44be-a39f-ad43017fcdbb/1531507_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/afe1f4ea-0a41-4221-adec-ad43017fce7f/1531508_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/75c63be1-488f-4a5f-ad19-ae3000d3ea8a/1685770_WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d0c57917-07d2-4f2d-9ca0-ae8500c3c5dc?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/839bf0d0-69e2-4a62-b28c-ae3500f427c1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(257, 132, 19, 59, 25000000.00, 20000000.00, 'mau-den', 'https://assets.boconcept.com/eca177eb-68e5-4397-ad16-ad44013095ed/734517_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/89dd04e0-6331-425e-81eb-ad4401309526/734518_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/45bfac24-f306-4e1d-a6b6-ad44013095ce/734521_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/42bbea34-d992-4315-9302-ad4401309933/734523_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/3a3f6f6b-81d2-4e0c-a4cb-ad440017d73e/1685862__WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/bdaf0f9a-730e-4017-a39c-adc700b1b346?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/1c2bbae3-b398-4c9b-b6b8-af7f00ae535b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(258, 132, 1, 77, 25000000.00, 20000000.00, 'mau-be', 'https://assets.boconcept.com/de40d2e7-e48f-49de-9358-b0c500bd9de2/2123735_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/207cbfcd-6e62-465f-9fa9-b0c500bec889/2123733_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/e53dcca0-2dde-4384-9e0c-b0c500bd8de7/2123734_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/39bcfed2-e10d-4844-9d46-b0c500be6e7d/2123736_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/19ef2381-4b88-4a46-982f-b09a00aa71df/Ravello%203221%20Beige_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=1691&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ea7dfc0f-e6ac-4801-81b6-ad430170858e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/1c2bbae3-b398-4c9b-b6b8-af7f00ae535b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(259, 133, 2, 53, 29000000.00, 25000000.00, 'mau-xam-nhat', 'https://assets.boconcept.com/10ceb3b3-4974-4511-832e-ad6c002bc777/1701403_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/b6b961cd-0351-4862-b762-ad6c002bc825/1701404_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440, https://assets.boconcept.com/315945c7-3f2d-47d0-a5df-ad6c002bc75a/1701405_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/abb0bc5c-c73a-44e5-9b88-ad6c002bc78d/1701406_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880, https://assets.boconcept.com/808d6caa-6077-4c91-8fe4-ad440017d32a/1685835__WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/fb1336ab-4b34-46a9-a23c-ae3000c41c04?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/aae30ec2-f190-49d6-b8a1-afd900805af8?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(260, 133, 6, 26, 29000000.00, 25000000.00, 'mau-trang', 'https://assets.boconcept.com/109e4112-c619-4190-afec-affe0040a116/2105177_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/68fcf66f-fa80-4b06-b6b6-affe00407a7c/2105175_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/13cdb44b-87ab-471c-b9a8-affe0041657f/2105176_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/43aadd9f-3ebf-4411-b92c-affe004160f7/2105178_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/2aa17e41-3c5c-4eba-b047-afa900e0db4f/Tuscany%203200%20White_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=1691&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/fb1336ab-4b34-46a9-a23c-ae3000c41c04?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/2449556b-3bb3-4886-880a-ae6d00c3714d?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=mau-xam-nhat'),
(263, 135, 9, 42, 2000000.00, NULL, 'mau-kinh-trong-suot', 'https://assets.boconcept.com/58b57b69-4966-44af-a855-ad44010800aa/667325_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/3e426655-462c-45d3-9825-ad440108029d/667326_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/214590ef-f6d7-485a-9ea4-ad44010813d4/667409_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/369cb200-8f5b-4ac3-b17e-af7f00ae6f65?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/e3c9cc28-bebb-4037-ae91-af7f0091cae1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/75e8cd19-9e97-4b4e-bdd0-af6400b3bc0d?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ecd35e4e-3f55-42da-a177-ad440017e07a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(264, 135, 10, 68, 35000000.00, NULL, 'mau-gom-tro', 'https://assets.boconcept.com/1ed96204-3ab5-4cfd-bc12-ad440108081e/667353_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e90744cf-7329-4d43-a3d4-ad4401080ba0/667354_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/fee9fddd-bda8-4265-b675-ad44010819d6/667425_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/369cb200-8f5b-4ac3-b17e-af7f00ae6f65?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/e3c9cc28-bebb-4037-ae91-af7f0091cae1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/75e8cd19-9e97-4b4e-bdd0-af6400b3bc0d?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/8ba34dbd-bfc7-41a7-ae91-ad440007e913?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(265, 136, 8, 58, 25000000.00, NULL, 'mau-soi-sam', 'https://assets.boconcept.com/0a45a1ee-d336-4357-b7cc-ad6c00144f53/1601485_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/eb54292e-56f5-4824-9ffb-ad6c00144f78/1601488_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/e4e64bdc-6c88-4abe-8ce3-ad6c00144f1d/1601487_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/257121fa-f76f-4da3-a20f-b17300aaeaca?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/cd531151-f529-4660-9e63-b16200d7855d?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/f874aa77-21c8-45c1-816f-ad44001794eb?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/7c02e7d5-c214-4a8c-b887-ae3500f4228e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(266, 136, 2, 70, 34000000.00, NULL, 'mau-xam-tro', 'https://assets.boconcept.com/590e954f-2f23-4cf6-b051-aeb00081b1f9/2052054_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/eaeff758-6aff-4155-8dc4-aeb00081b7ae/2052055_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/9ae10270-9301-4cf6-ab07-aeb000822dbc/2052056_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/257121fa-f76f-4da3-a20f-b17300aaeaca?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/cd531151-f529-4660-9e63-b16200d7855d?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/f874aa77-21c8-45c1-816f-ad44001794eb?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/7c02e7d5-c214-4a8c-b887-ae3500f4228e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(267, 137, 1, 50, 15000000.00, 0.00, 'mau-be', 'https://assets.boconcept.com/686e92c5-49f9-4b8e-8096-ad43017fa263/1531169_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/f2432a35-035a-4007-af8c-ad43017fa252/1531170_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/75c79824-a951-484f-b2b4-ad43017fa2e3/1531171_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/5551e8f5-0110-4a6c-9014-ad43017fa398/1531172_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/3c624512-b815-461c-9c9f-ad440017d069/1685815__WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/2c4178a4-e938-450b-8a77-ae3000ca2bb3?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/5d9a72a8-2788-4cfb-9608-adc501029cbc?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(268, 137, 14, 63, 18000000.00, 0.00, 'mau-xanh-lam', 'https://assets.boconcept.com/35cdf88a-a0f1-4149-bc0d-b17900ea42c7/2688945_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/7e4f360a-0244-4a5e-916b-b17900e9d717/2688943_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/612a53b5-b52f-4d0f-bb94-b17900ea7a48/2688948_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/dc2f2307-6e63-49bb-b17f-b17900eac56e/2688950_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/4e05d617-89e1-4909-a62c-b12500f973a0/Capri%203233%20Blue%20creased_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=1691&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/2c4178a4-e938-450b-8a77-ae3000ca2bb3?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/14784ead-1029-43de-a9ac-ae8400c51978?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(269, 138, 10, 54, 20000000.00, 0.00, 'mau-xanh-nhat', 'https://assets.boconcept.com/9d86cd53-b349-4d9f-a537-aff500b6703a/2014367_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/78785dc6-663a-4df8-b0bc-aff500b6ada2/2014369_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/3735eb46-aec1-4c77-b174-aff500b6b26d/2014368_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/b1a0b5a8-6458-4c31-b328-aff500b6ba8f/2014370_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/da766697-4a02-4717-83d6-ad440017ce8b/1685809__WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/63a1e3a3-8867-4781-984d-afd90080689c?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/b7ad7c1d-8625-41c9-9c4e-b27200e19fc7?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(270, 138, 25, 64, 15000000.00, NULL, 'mau-xanh-la-cay', 'https://assets.boconcept.com/35478e15-a7ec-4bce-b1a9-aff500f87dd8/2072905_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/c0062da9-be11-410b-92cd-aff500f8c229/2072907_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/c25a270b-7596-49d6-9de7-aff500f8bd95/2072906_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/094d0b70-ea36-4564-9018-aff500f8c95b/2072908_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/96f1e263-83a2-4a77-a669-afa900e0ca1e/Bresso%203153%20Green_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=1691&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/b7ad7c1d-8625-41c9-9c4e-b27200e19fc7?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/f06156a6-9cad-4fef-a487-ae6d00c83f51?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(271, 139, 1, 59, 23000000.00, 20000000.00, 'mau-be', 'https://assets.boconcept.com/f64e2868-c28e-4aa0-9234-b183018afc32/2750994_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/6ff23065-a422-41e7-b5f2-b1840000123a/2750996_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/3488a41a-d077-4f94-999d-b18400000b04/2750995_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/d71a42cc-8455-4dc5-b6ce-b184000057cb/2750997_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/21c462c3-1e68-4fc9-8ef3-b12500f996e7/Capri%203230%20Beige%20creased_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=1691&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/7ec7c020-45e2-4ea5-8aa2-b14b00744f08?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d37263fd-9025-42bd-bd62-b14b00719477?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(272, 139, 2, 70, 28000000.00, NULL, 'mau-xam-bac', 'https://assets.boconcept.com/ac8b6e78-c235-4e46-a990-b1830169e9fe/2750706_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/9456d20a-e802-4102-9a74-b1830169f64d/2750707_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/9456d20a-e802-4102-9a74-b1830169f64d/2750707_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/c60f26fe-2c57-486e-92b2-b183016b5d46/2750709_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/808d6caa-6077-4c91-8fe4-ad440017d32a/1685835__WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/68ebc265-6212-46f3-a766-b14b0074f4a8?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/7ec7c020-45e2-4ea5-8aa2-b14b00744f08?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(273, 140, 19, 60, 23000000.00, 20000000.00, 'mau-den-nhat', 'https://assets.boconcept.com/1a275588-00df-4bdd-b362-ad6c00246894/1682585_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/9cfd2dd7-26c0-40d2-83e0-ad6c00246724/1682586_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/9cfd2dd7-26c0-40d2-83e0-ad6c00246724/1682586_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/0cd13775-a4ea-4cbe-9e4e-ae8500c3bdf8?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/e22cd13a-bf2d-44f2-b352-adc50103efff?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/0a2af1cd-acaa-4453-87e8-ae8500c3c06b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/b4c30c16-5e60-4e72-b49f-ad4400179e87?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(274, 140, 2, 69, 25000000.00, NULL, 'mau-xam-tro-mo', 'https://assets.boconcept.com/e6bbaf59-76f6-45cb-9925-ad6c0024673d/1682583_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/758dee53-0257-4184-a65f-ad6c00246767/1682584_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/758dee53-0257-4184-a65f-ad6c00246767/1682584_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/0cd13775-a4ea-4cbe-9e4e-ae8500c3bdf8?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/e22cd13a-bf2d-44f2-b352-adc50103efff?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/0a2af1cd-acaa-4453-87e8-ae8500c3c06b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/185db7ac-ddbe-4ce4-aa22-adc50103ef28?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(275, 141, 1, 59, 28000000.00, 24000000.00, 'mau-xam-tro-mo', 'https://assets.boconcept.com/639b72b0-14c5-4f56-9ca8-ad6c001ad6c1/1640903_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/3e348f71-2d62-44f9-a1de-ad6c001ad735/1640904_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/299b67d9-c09c-46d0-b23e-b0300090acc1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/bf9acc88-0c56-445b-be15-adc501038eb5?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ac72f968-cf60-4d13-a766-adc501038f8b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/95637587-8922-4a24-94bc-adc5010391a1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/95637587-8922-4a24-94bc-adc5010391a1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(276, 141, 6, 70, 30000000.00, NULL, 'mau-xam-mo', 'https://assets.boconcept.com/8edc90b5-b727-494c-af0e-ad6c001ad749/1640905_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/2c5e0b7d-0ee5-4ea5-8fb0-ad6c001ad727/1640906_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/299b67d9-c09c-46d0-b23e-b0300090acc1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/bf9acc88-0c56-445b-be15-adc501038eb5?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ac72f968-cf60-4d13-a766-adc501038f8b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/95637587-8922-4a24-94bc-adc5010391a1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/95637587-8922-4a24-94bc-adc5010391a1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=
'),
(277, 142, 2, 60, 28000000.00, 24000000.00, 'mau-xam-tro-mo', 'https://assets.boconcept.com/ad7fed58-48ff-4013-8a92-affe00e407ed/2073421_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/2bd605bf-3174-4711-9279-affe00e34469/2073420_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/2bd605bf-3174-4711-9279-affe00e34469/2073420_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/de0f20ae-025c-4ae8-b44f-afd600a6a8df?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/08648cea-b86e-4596-ad3e-afd600937421?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/1a71abee-e8bd-499c-8955-afd900806182?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ad25e0d2-fc64-481c-8224-afd6009379e9?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(278, 142, 8, 70, 30000000.00, NULL, 'mau-soi-sam', 'https://assets.boconcept.com/d3a29a62-8322-4479-a0a9-affe00e533cb/2073429_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/b99678d4-d186-4295-a06c-affe00e45b73/2073428_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/b99678d4-d186-4295-a06c-affe00e45b73/2073428_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/de0f20ae-025c-4ae8-b44f-afd600a6a8df?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/08648cea-b86e-4596-ad3e-afd600937421?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/1a71abee-e8bd-499c-8955-afd900806182?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ad25e0d2-fc64-481c-8224-afd6009379e9?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=
'),
(279, 143, 25, 60, 22000000.00, 0.00, 'mau-nau-nhat', 'https://assets.boconcept.com/9d96fc45-138d-40ec-9a15-ae43007ef6b3/2014093_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/46ead729-83e7-4e41-b665-ae4e00e0d993/2014094_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/8277aefc-5161-4c90-acbe-ae6d00c22995?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/6b7da654-6161-4384-8b4b-ae8900bbe214?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/c62e8cc3-19f8-4cc1-a488-ae2900e9ba9e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/f06156a6-9cad-4fef-a487-ae6d00c83f51?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/019e0479-9eef-4061-8af6-ae8900bc0895?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(280, 143, 19, 70, 30000000.00, NULL, 'mau-den', 'https://assets.boconcept.com/25f300cd-c91b-4276-88a6-ae43007eee74/2014091_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/2598b789-8b8a-43ac-ad88-ae4e00e0dd4c/2014092_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/8277aefc-5161-4c90-acbe-ae6d00c22995?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/6b7da654-6161-4384-8b4b-ae8900bbe214?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/c62e8cc3-19f8-4cc1-a488-ae2900e9ba9e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/f06156a6-9cad-4fef-a487-ae6d00c83f51?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/019e0479-9eef-4061-8af6-ae8900bc0895?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(281, 144, 27, 59, 22000000.00, NULL, 'mau-dong', 'https://assets.boconcept.com/24e28db0-c289-41ab-b24f-ad4400c80abb/562211_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e62b16b0-afc7-4695-b039-ad4400c7f3d7/562153_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/d20c21d4-b17b-4e2e-8854-ad4400c7f309/562152_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/53d81a4c-178e-4dde-b671-aebc0079ff4e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/87534e08-972a-4243-9f34-ae6d00c2ed54?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/4dc9371c-231c-4f06-bedb-ad440011c490?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/7dc87bc6-52b3-4fe3-b1ac-ad440017da9e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,'),
(282, 144, 2, 70, 30000000.00, NULL, 'mau-xam', 'https://assets.boconcept.com/aabb5de4-fb29-4f65-af37-ad4300b2f308/1107003_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/614e9849-6e04-4810-a55e-ad4300b2de10/1106924_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/53d81a4c-178e-4dde-b671-aebc0079ff4e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/87534e08-972a-4243-9f34-ae6d00c2ed54?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/4dc9371c-231c-4f06-bedb-ad440011c490?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/7dc87bc6-52b3-4fe3-b1ac-ad440017da9e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/7dc87bc6-52b3-4fe3-b1ac-ad440017da9e?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(283, 145, 9, 59, 18000000.00, NULL, 'kinh-mau-khoi', 'https://assets.boconcept.com/eb2cebcb-bec2-472e-83d0-ad44005a042b/36017_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/fefbe5fd-f518-44e9-93a5-ad44005606d0/32051_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/9cbf4cef-7db3-41cb-960b-ae2900e9b4c7?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/11be6729-d82a-46be-bad3-ae8500c3cc4a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/972a3e27-2df7-4b70-9c1a-ae8400c52a1c?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d0e16deb-fa6d-400e-b93a-ae2900e9b6cb?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d0e16deb-fa6d-400e-b93a-ae2900e9b6cb?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(284, 145, 1, 70, 18000000.00, NULL, 'kinh-trong-suot-cam-thach', 'https://assets.boconcept.com/0f5e557b-35b4-4e2f-b06f-ae43007fb21d/2014101_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/0e9fae99-9a2d-4759-9478-ae5100ec1a55/2014102_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/9cbf4cef-7db3-41cb-960b-ae2900e9b4c7?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/11be6729-d82a-46be-bad3-ae8500c3cc4a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/972a3e27-2df7-4b70-9c1a-ae8400c52a1c?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d0e16deb-fa6d-400e-b93a-ae2900e9b6cb?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d0e16deb-fa6d-400e-b93a-ae2900e9b6cb?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(285, 146, 25, 59, 16000000.00, NULL, 'mau-nau-go', 'https://assets.boconcept.com/9fff24d4-2811-4b23-83e6-adc50105703b/1711591_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/84104d45-e3cd-4099-9a8b-adc5010570e9/1711595_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/4230e8a2-2893-42bc-865e-adc5010571d8/1711596_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/b736c8d5-a86a-443b-b8aa-ae6d00c286ce?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/5a38e5f8-0ce8-428b-826c-ae8900bbfa14?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/8326cf3c-a778-4d2f-a9d5-b16900c7bcb9?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/0f6a835d-b47b-409e-9ae4-b173008afc97?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(286, 147, 2, 70, 19000000.00, NULL, 'mau-xam-tro', 'https://assets.boconcept.com/f21c4e6e-5d42-4106-8e3e-adc501056dbe/1711578_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/3c60118b-1dae-42e7-8cfa-adc501058cd8/1712213_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/9dd7192e-ee4e-4f64-aed6-adc501058d30/1712214_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/1427cf02-27ce-429a-a80e-af0100b3cde8?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/1ec6aca6-ec38-4461-8454-ad4400179761?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/33fdd2f7-e19d-4124-892c-ae6d00c894d7?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/e121f06e-3edb-4a4f-bcc3-afd90080668f?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(287, 148, 25, 60, 15000000.00, NULL, 'mau-nau-go', 'https://assets.boconcept.com/42e5d319-13d4-447e-ba5a-b14c00bc6af5/2748321_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/1da359dd-6418-483c-95fb-b14c00bd1173/2748322_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/6fcf1547-9dcc-4ca0-a045-b14c00bc88d0/2748323_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/c5ac02e3-aa50-45a3-9166-b173006ca4a9?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/e8c12980-5080-49b6-9645-b16200d92317?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/cebf92f7-2839-4604-a112-b14b00753dd8?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/bc5d6aa2-a629-4e1c-8992-b16200d98d26?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(288, 149, 14, 70, 40000000.00, NULL, 'mau-xanh-son-mai', 'https://assets.boconcept.com/067e9417-3952-42bf-8782-b0cb0094d181/2113820_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e734d5e2-1aaf-40ea-b5a2-b0cb0094ca30/2113818_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/76250a49-c831-4b93-bb5a-b0cb0094c736/2113819_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/09edfa92-63c1-4300-86d2-b0cb00953be4/2113821_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://cdn.media.amplience.net/i/boconcept/6c9a2b11-68f0-47e1-a194-b08c00b2ec2b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/069c7145-ad23-4126-b784-b08c00b1c595?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/6c9a2b11-68f0-47e1-a194-b08c00b2ec2b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(289, 149, 2, 50, 40000000.00, NULL, 'mau-xam-tro-mo', 'https://assets.boconcept.com/04a95489-7afe-415f-9486-b0cb00947dfa/2113816_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/3c34275d-acfc-4f17-aac9-b0cb00945710/2113814_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/2966ee92-9e58-490f-94cd-b0cb00945e70/2113815_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/a74c8ae5-62fe-43fd-aca5-b0cb009488d6/2113817_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://cdn.media.amplience.net/i/boconcept/6c9a2b11-68f0-47e1-a194-b08c00b2ec2b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/069c7145-ad23-4126-b784-b08c00b1c595?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/6c9a2b11-68f0-47e1-a194-b08c00b2ec2b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(290, 150, 2, 50, 19000000.00, NULL, 'mau-xam-tro-mo', 'https://assets.boconcept.com/c7fed9cd-f3ee-4bcb-b832-b0c200d15ee0/2113686_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/18e29d5a-5ccd-4003-a914-b0c200cfe885/2113688_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/301502ef-841c-4cc5-819d-b0c200cf7981/2113687_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/7133170e-8e0f-4e65-b5ca-b0c200cff195/2113689_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://cdn.media.amplience.net/i/boconcept/1de30578-77ac-4cdc-a9f5-b08f00705820?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/4ff39b4d-f886-42c0-8787-b08f0070634d?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ccafb49f-edec-438b-a249-b08c00b2d6e0?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(291, 150, 14, 50, 19000000.00, NULL, 'mau-xanh-son-mai', 'https://assets.boconcept.com/50dde7ba-e0e2-4980-93ef-b0c200d031a9/2113690_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/550e915c-6a80-49e7-b230-b0c200d07d2a/2113692_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/42bbabfe-69d9-429e-ab07-b0c200d03da1/2113691_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/1977527d-4da6-44e5-b060-b0c200d0818c/2113693_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://cdn.media.amplience.net/i/boconcept/1de30578-77ac-4cdc-a9f5-b08f00705820?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/4ff39b4d-f886-42c0-8787-b08f0070634d?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ccafb49f-edec-438b-a249-b08c00b2d6e0?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(292, 151, 10, 80, 22000000.00, NULL, 'mau-xanh-son-mai', 'https://assets.boconcept.com/7c7dc52e-0a4a-461d-989b-b0cb00902e6f/2112077_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/09a77b48-684b-4956-9ade-b0cb008febbd/2112076_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/069c7145-ad23-4126-b784-b08c00b1c595?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/6dcc94b9-5081-4221-8425-b08c00b1c7af?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/73568534-c553-4a2b-b4e7-b08c00b30007?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/eef2cdd9-190c-4858-adb6-b08c00b2e59a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/069c7145-ad23-4126-b784-b08c00b1c595?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(293, 151, 2, 70, 99999999.99, NULL, 'mau-xam-tro', 'https://assets.boconcept.com/a6c260bb-8cb3-4b1e-a22c-b0cb008fe419/2112075_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/1710cdda-5282-4aa5-a0b8-b0cb008fdf79/2112074_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/069c7145-ad23-4126-b784-b08c00b1c595?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/6dcc94b9-5081-4221-8425-b08c00b1c7af?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/73568534-c553-4a2b-b4e7-b08c00b30007?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/eef2cdd9-190c-4858-adb6-b08c00b2e59a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/069c7145-ad23-4126-b784-b08c00b1c595?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(294, 152, 6, 79, 8000000.00, NULL, 'mau-trang-khoi', 'https://assets.boconcept.com/a9e41ca9-b840-41fd-b8ba-ad4301703a1d/1481633_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/d6101d8f-8c64-462a-81ba-ad43017057c8/1481753_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/19355228-0e28-40ee-801c-ae3000ca0aa0?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/db789f1b-47d8-425b-a586-ad4400179723?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/2a183837-6e88-42ff-b2e6-ae3700873cee?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/3bc5a5a5-e86c-4b5e-9164-adc50102a6de?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/35eda38f-71dd-47ee-b8d7-adc50102a7af?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(295, 153, 1, 60, 8000000.00, 7000000.00, 'mau-be', 'https://assets.boconcept.com/e674bb58-ee5e-48c0-87e9-ad440009629b/1588092_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/aa41ad63-79e2-49e4-8ce3-ad4400096cd5/1588112_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/dcc9dd2d-ec26-44d5-8db9-ae6d00c31b73?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/159c2606-9d2d-408b-bcb9-ae8400c537fa?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/590ddd43-987c-45b1-b306-ae70004f7b34?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/fc8820a9-1a52-4aed-99ad-ad440007a5e1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/674725c8-3102-4742-b4da-ad4400179748?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d0c57917-07d2-4f2d-9ca0-ae8500c3c5dc?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(296, 154, 25, 80, 10000000.00, 8500000.00, 'mau-nau-nhat', 'https://assets.boconcept.com/d39fb897-53f4-4b32-973e-ad440009668a/1588090_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/d7311c66-2c1c-4f5a-9336-ad4400096b77/1588110_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/dec279fd-af82-49c0-b77a-ad4400096a76/1588109_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://cdn.media.amplience.net/i/boconcept/03dd7bc5-c5ef-4fd1-a232-ad440017a5b3?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/c6aaf267-1a7b-4a1f-953a-ad440017a5cc?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/21f986ce-fa77-498c-a71e-ad4400179cc1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/b4bdaba5-c950-4e76-859a-ae8900bc0a65?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(297, 155, 2, 50, 50000000.00, NULL, 'mau-xam', 'https://assets.boconcept.com/dac05adc-b7ed-4f56-af86-b0c40022e4b9/2119243_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/ed6b7a93-e4df-4cfe-bac5-b0c40022f4af/2119245_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/9074485d-c03a-46db-9bed-b0c40023cd21/2119246_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/19ef2381-4b88-4a46-982f-b09a00aa71df/Ravello%203221%20Beige_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=4530&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/09814c95-762a-4bfe-a122-b06f00cc18e4?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/299b67d9-c09c-46d0-b23e-b0300090acc1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/650f8d6f-d54f-4bf6-a227-b0300090ad57?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(298, 155, 2, 70, 55000000.00, NULL, 'mau-xam-khoi', 'https://assets.boconcept.com/fc5e3da1-33f8-44c5-8218-b0c400304aa3/2119352_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/7841de92-8620-46a4-bf18-b0c40030567a/2119353_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/8029a1c3-dd71-4257-8042-b0c400309b7b/2119354_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/19ef2381-4b88-4a46-982f-b09a00aa71df/Ravello%203221%20Beige_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=4530&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/09814c95-762a-4bfe-a122-b06f00cc18e4?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/299b67d9-c09c-46d0-b23e-b0300090acc1?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/650f8d6f-d54f-4bf6-a227-b0300090ad57?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(299, 156, 2, 50, 40000000.00, 38000000.00, 'mau-xam-dam', 'https://assets.boconcept.com/57cdff54-43c7-494c-9ca9-ad440073f01c/365501_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/75c3e95e-7a35-4c5a-8b88-ad440073e901/365492_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/62ea1db5-90c5-4f3c-a3f8-ad4400740100/365496_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/da766697-4a02-4717-83d6-ad440017ce8b/1685809__WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d370a709-f17b-4988-a626-af6400b3bf2a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/48dd40da-1135-4d68-a5f5-af8000bb634b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ef9dddb2-00ed-4a53-b78b-af8000bb5fc2?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(300, 156, 14, 70, 45000000.00, NULL, 'mau-xanh-la-cay', 'https://assets.boconcept.com/58bda511-389d-40d2-a864-ae92018aa9bb/2026105_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/d116801f-bcde-4f44-83e5-ae92018aafbe/2026104_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/74df86ef-e2f1-414e-ac1c-ae4a009b1800/Skagen%203165%20Green_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=2265&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d370a709-f17b-4988-a626-af6400b3bf2a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/48dd40da-1135-4d68-a5f5-af8000bb634b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/ef9dddb2-00ed-4a53-b78b-af8000bb5fc2?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/d053ea90-b892-4f5b-808f-ae8400c56b89?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(301, 157, 2, 50, 45000000.00, 0.00, 'mau-xam-dam', 'https://assets.boconcept.com/b4c2cc59-26d1-438e-95b2-ad6c0019aaa3/1637877_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/e99dd3e9-7ac8-4534-adce-ad6c0019aad3/1637878_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/da766697-4a02-4717-83d6-ad440017ce8b/1685809__WEB-Global16%3a9-2500x1400.jpg?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1440&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/1bef13ec-586f-43de-82c5-ae41008b2a3a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/b62c82d2-bd1a-42a3-9994-adeb0081775a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/c6d22e4a-b683-4ce0-94b9-ae6d00c8b60a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/c6d22e4a-b683-4ce0-94b9-ae6d00c8b60a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(302, 157, 25, 70, 45000000.00, NULL, 'mau-nau-dat', 'https://assets.boconcept.com/d058132f-1df2-4c89-b667-aff90109e347/2090652_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/06466ea8-8ecc-4d96-9119-aff9010a334d/2090654_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/24523af0-ad6c-4946-b435-afa900e0f212/Tuscany%203205%20Mustard_WEB-Global16%3a9-2500x1400.jpg?w=3020&fmt=auto&upscale=false&sm=c&qlt=75&h=2265&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/1bef13ec-586f-43de-82c5-ae41008b2a3a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=2880&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/b62c82d2-bd1a-42a3-9994-adeb0081775a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/c6d22e4a-b683-4ce0-94b9-ae6d00c8b60a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/c6d22e4a-b683-4ce0-94b9-ae6d00c8b60a?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(326, 134, 2, 53, 25000000.00, 24000000.00, 'mau-xam-tro', 'https://assets.boconcept.com/4e325c32-f021-47a0-a918-ad440002678c/1570721_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/50ea4adb-3240-470a-a9e4-ad440002679b/1570725_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/5cc2e305-98d9-4119-96a9-ad4400026aae/1570722_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/843ba504-ea42-4cf0-873a-ad4400026782/1570723_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/b94c0e47-7a47-4eb8-b6c8-ad440002674f/1570724_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1075,https://cdn.media.amplience.net/i/boconcept/a26e81d6-e0e1-4370-bd8b-ad44000793f0?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/dcf01607-56d2-4465-bf8b-ad440007946b?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(327, 134, 8, 68, 30000000.00, 0.00, 'mau-soi-sam', 'https://assets.boconcept.com/fb24b2c8-6041-4d72-9f8b-ad4400026958/1570741_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1280&quality=75&height=960,https://assets.boconcept.com/75e268f9-a9b1-48b7-8fce-ad4400026976/1570745_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/283c0bac-b019-4786-bd5d-ad4400026955/1570742_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1440,https://assets.boconcept.com/e5b7aca8-36c9-4f6c-9918-ad44000269d3/1570743_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=2880,https://assets.boconcept.com/f80afcd9-0dfa-472b-a7e8-ad44000269dd/1570744_PNG-Web%2072dpi.png?format=webply&fit=bounds&width=1920&quality=75&height=1075,https://cdn.media.amplience.net/i/boconcept/a26e81d6-e0e1-4370-bd8b-ad44000793f0?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24=,https://cdn.media.amplience.net/i/boconcept/4dc9371c-231c-4f06-bedb-ad440011c490?w=1920&fmt=auto&upscale=false&sm=c&qlt=75&h=1075&%24auto-poi%24='),
(440, 196, 8, 0, 444.00, 0.00, 'mau-go', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1751299441/SonaSpace/Product/variant/ydop8sllxpzdpg9deuuw.webp'),
(466, 196, 9, 0, 2.00, 0.00, 'mau-kinh', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1751401578/SonaSpace/Product/variant/m1zurequ1fouuqijn3bx.webp'),
(491, 208, 1, 12, 12000000.00, NULL, 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1752162550/SonaSpace/Product/variant/hsm6xzaniq0ksqiapkyi.jpg,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1752162551/SonaSpace/Product/variant/fy27lo1sqn0nxrwjrvhx.jpg'),
(514, 220, 1, 0, 55.00, 0.00, 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753643797/SonaSpace/Product/variant/aa6p5wi2c8bfebly3yro.jpg,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753643798/SonaSpace/Product/variant/wwrjkbwwe5rc7c3votny.jpg'),
(524, 226, 50, 0, 19000000.00, 500000.00, 'xanh-navy', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754902911/SonaSpace/Product/variant/rjon2cfaueent2q2eizp.png'),
(525, 226, 1, 3, 3333.00, 3333.00, 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1756024134/SonaSpace/Product/variant/zprg8jnpdyuonrsusvcx.jpg'),
(526, 226, 19, 2, 22.00, 2.00, 'mau-den', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1756024162/SonaSpace/Product/variant/g6h1nmntayvamgdcwqat.jpg');
SELECT setval('variant_product_variant_id_seq', (SELECT MAX(variant_id) FROM variant_product));

-- Rooms
INSERT INTO room (room_id, room_name, slug, status, room_priority, room_image, room_banner, room_description, created_at, updated_at, deleted_at) VALUES
(1, 'Phòng khách', 'phong-khach', 1, 1, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716775/living_hhqpbz.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1751911565/SonaSpace/Rooms/banner/vs1xratameucokme1mjz.jpg', 'Không gian tiếp khách và sinh hoạt chung trong nhà', '2025-05-24 15:53:57', '2025-07-08 01:06:07', NULL),
(2, 'Phòng ăn', 'phong-an', 1, 2, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716775/dining_ebkiza.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750013007/image_73_qafw6q.jpg', 'Không gian dành cho ăn uống và tụ họp gia đình', '2025-05-24 15:53:57', '2025-06-21 03:05:05', NULL),
(3, 'Phòng ngủ', 'phong-ngu', 1, 3, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/bedroom_hzdasv.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750013007/image_74_zswyv8.jpg', 'Không gian nghỉ ngơi và thư giãn', '2025-05-24 15:53:57', '2025-06-21 03:05:05', NULL),
(4, 'Không gian làm việc', 'khong-gian-lam-viec', 1, 0, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/homeoffice_o8rlwk.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750013008/image_75_dbl4ny.jpg', 'Khu vực dành riêng cho công việc và học tập', '2025-05-24 15:53:57', '2025-07-26 18:40:12', NULL),
(6, 'Không gian ngoài trời', 'khong-gian-ngoai-troi', 1, 6, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749716774/ourdoorspace_jszee6.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750013009/image_77_eaxjys.jpg', 'Khu vực ngoài trời như sân vườn, ban công', '2025-05-24 15:53:57', '2025-06-21 03:05:05', NULL),
(21, 'Small Space', 'small-space', 1, 0, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1752417814/SonaSpace/Rooms/wmrdrx1y8l080icoggcs.jpg', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1752417816/SonaSpace/Rooms/banner/jduknw8dopbgjnypbeor.jpg', NULL, '2025-07-13 21:43:38', '2025-07-15 21:50:20', NULL),
(25, 'Không gian làm việc 55', 'khong-gian-lam-viec22', 0, 0, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753896985/SonaSpace/Rooms/sjuageh1zwauv51snlrz.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753896987/SonaSpace/Rooms/banner/pl9jfg12z3zcciduwjua.png', NULL, '2025-07-31 00:36:29', '2025-07-31 00:36:43', NULL);
SELECT setval('room_room_id_seq', (SELECT MAX(room_id) FROM room));

-- Room Products (linking products to rooms)
INSERT INTO room_product (room_product_id, room_id, product_id, created_at, updated_at, deleted_at) VALUES
(3, 1, 133, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(5, 2, 135, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(6, 2, 136, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(8, 3, 138, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(9, 3, 139, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(10, 4, 140, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(11, 4, 141, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(12, 4, 142, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(16, 6, 146, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(17, 6, 147, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(18, 6, 148, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(21, 1, 151, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(22, 1, 152, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(23, 1, 153, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(24, 2, 154, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(25, 2, 155, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(26, 2, 156, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(27, 3, 157, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(43, 3, 133, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(46, 6, 136, '2025-05-24 15:55:16', '2025-05-24 15:55:16', NULL),
(286, 3, 208, '2025-07-10 22:49:12', '2025-07-10 22:49:12', NULL),
(318, 21, 135, '2025-07-15 02:40:00', '2025-07-15 02:40:00', NULL),
(319, 21, 136, '2025-07-15 02:40:00', '2025-07-15 02:40:00', NULL),
(321, 4, 151, '2025-07-15 20:43:31', '2025-07-15 20:43:31', NULL),
(323, 4, 153, '2025-07-15 20:43:31', '2025-07-15 20:43:31', NULL),
(324, 4, 152, '2025-07-15 20:43:46', '2025-07-15 20:43:46', NULL),
(326, 4, 135, '2025-07-15 23:20:03', '2025-07-15 23:20:03', NULL),
(327, 4, 154, '2025-07-15 23:20:03', '2025-07-15 23:20:03', NULL),
(328, 4, 136, '2025-07-15 23:20:03', '2025-07-15 23:20:03', NULL),
(329, 4, 133, '2025-07-16 22:04:58', '2025-07-16 22:04:58', NULL),
(369, 4, 134, '2025-07-28 01:33:57', '2025-07-28 01:33:57', NULL),
(379, 25, 134, '2025-07-31 00:36:40', '2025-07-31 00:36:40', NULL),
(380, 25, 136, '2025-07-31 00:36:40', '2025-07-31 00:36:40', NULL),
(404, 3, 196, '2025-07-31 15:28:36', '2025-07-31 15:28:36', NULL),
(453, 3, 220, '2025-08-07 14:11:48', '2025-08-07 14:11:48', NULL),
(464, 3, 226, '2025-08-24 15:30:44', '2025-08-24 15:30:44', NULL),
(465, 21, 137, '2025-08-25 23:08:53', '2025-08-25 23:08:53', NULL),
(466, 1, 131, '2025-08-25 23:09:13', '2025-08-25 23:09:13', NULL),
(467, 1, 132, '2025-08-25 23:09:58', '2025-08-25 23:09:58', NULL);
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
INSERT INTO attributes (attribute_id, attribute_name, category_id, value_type, unit, is_required, created_at) VALUES
(63, 'Chiều dài', 1, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(64, 'Chiều rộng', 1, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(65, 'Chiều cao', 1, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(66, 'Chất liệu mặt bàn', 1, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(67, 'Loại chân bàn', 1, 'text', '', FALSE, '2025-07-15 14:22:21'),
(68, 'Hình dạng', 1, 'text', '', FALSE, '2025-07-15 14:22:21'),
(69, 'Chiều cao ghế', 2, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(70, 'Chiều rộng ghế', 2, 'text', 'cm', FALSE, '2025-07-15 14:22:21'),
(71, 'Chiều sâu ghế', 2, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(72, 'Tải trọng tối đa', 2, 'number', 'kg', FALSE, '2025-07-15 14:22:21'),
(73, 'Chất liệu khung', 2, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(74, 'Loại đệm', 2, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(75, 'Chiều cao', 3, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(76, 'Chiều rộng', 3, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(77, 'Chiều sâu', 3, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(78, 'Số ngăn kéo', 3, 'number', 'cái', FALSE, '2025-07-15 14:22:21'),
(79, 'Chất liệu', 3, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(80, 'Loại tủ', 3, 'text', '', FALSE, '2025-07-15 14:22:21'),
(81, 'Loại bóng', 4, 'text', '', FALSE, '2025-07-15 14:22:21'),
(82, 'Công suất bóng', 4, 'number', 'W', FALSE, '2025-07-15 14:22:21'),
(83, 'Chiều cao', 4, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(84, 'Đường kính chao đèn', 4, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(85, 'Chất liệu', 4, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(86, 'Kiểu dáng', 4, 'text', '', FALSE, '2025-07-15 14:22:21'),
(87, 'Chiều dài', 5, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(88, 'Chiều rộng', 5, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(89, 'Độ dày', 5, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(90, 'Chất liệu', 5, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(91, 'Kiểu dệt', 5, 'text', '', FALSE, '2025-07-15 14:22:21'),
(92, 'Chất liệu khung', 6, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(93, 'Chất liệu mặt', 6, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(94, 'Chống nước', 6, 'text', '', FALSE, '2025-07-15 14:22:21'),
(95, 'Chịu UV', 6, 'text', '', FALSE, '2025-07-15 14:22:21'),
(96, 'Bảo hành ngoài trời', 6, 'number', 'năm', FALSE, '2025-07-15 14:22:21'),
(97, 'Chiều dài', 7, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(98, 'Chiều sâu', 7, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(99, 'Chiều cao', 7, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(100, 'Chất liệu vải bọc', 7, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(101, 'Loại đệm', 7, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(102, 'Số chỗ ngồi', 7, 'number', 'chỗ', FALSE, '2025-07-15 14:22:21'),
(103, 'Chất liệu', 8, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(104, 'Chiều cao', 8, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(105, 'Đường kính', 8, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(106, 'Màu sắc', 8, 'text', '', FALSE, '2025-07-15 14:22:21'),
(107, 'Phong cách', 8, 'text', '', FALSE, '2025-07-15 14:22:21'),
(108, 'Chiều dài', 9, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(109, 'Chiều rộng', 9, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(110, 'Chiều cao đầu giường', 9, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(111, 'Kích thước đệm', 9, 'number', 'cm', FALSE, '2025-07-15 14:22:21'),
(112, 'Chất liệu khung', 9, 'material_id', '', FALSE, '2025-07-15 14:22:21'),
(113, 'Loại giường', 9, 'text', '', FALSE, '2025-07-15 14:22:21'),
(114, 'Loại mặt bàn', 1, 'text', '', FALSE, '2025-07-27 22:34:28'),
(115, 'ầdf', 56, 'text', NULL, FALSE, '2025-07-28 02:16:39'),
(116, 'gf', 56, 'material_id', NULL, FALSE, '2025-07-28 02:16:39'),
(117, '20', 56, 'text', NULL, FALSE, '2025-07-28 02:54:41'),
(118, 'x', 56, 'text', NULL, FALSE, '2025-07-28 04:05:17'),
(119, 'hjj', 56, 'text', NULL, FALSE, '2025-07-28 14:20:14'),
(120, 'tt', 56, 'text', NULL, FALSE, '2025-07-28 14:20:21'),
(123, 'D?ng c?', 2, 'text', NULL, FALSE, '2025-07-28 00:00:00');
SELECT setval('attributes_attribute_id_seq', (SELECT MAX(attribute_id) FROM attributes));

-- Product Attribute Values (product specifications)
INSERT INTO product_attribute_value (id, product_id, attribute_id, value, material_id) VALUES
(7, 135, 63, '120', NULL),
(8, 135, 64, '70', NULL),
(9, 135, 65, '72', NULL),
(10, 135, 66, NULL, 3),
(11, 135, 67, 'Chân gỗ', NULL),
(12, 135, 68, 'Hình tròn', NULL),
(13, 136, 63, '180', NULL),
(14, 136, 64, '90', NULL),
(15, 136, 65, '75', NULL),
(16, 136, 66, NULL, 13),
(17, 136, 67, 'Chân inox', NULL),
(18, 136, 68, 'Hình oval', NULL),
(25, 138, 69, '48', NULL),
(26, 138, 70, '48', NULL),
(27, 138, 71, '52', NULL),
(28, 138, 72, '100', NULL),
(29, 138, 73, NULL, 11),
(30, 138, 74, NULL, 6),
(31, 139, 69, '42', NULL),
(32, 139, 70, '45', NULL),
(33, 139, 71, '48', NULL),
(34, 139, 72, '110', NULL),
(35, 139, 73, NULL, 12),
(36, 139, 74, 'Không đệm', NULL),
(49, 140, 75, '200', NULL),
(50, 140, 76, '100', NULL),
(51, 140, 77, '50', NULL),
(52, 140, 78, '3', NULL),
(53, 140, 79, NULL, 2),
(54, 140, 80, 'Tủ quần áo', NULL),
(55, 141, 75, '120', NULL),
(56, 141, 76, '80', NULL),
(57, 141, 77, '40', NULL),
(58, 141, 78, '0', NULL),
(59, 141, 79, NULL, 1),
(60, 141, 80, 'Tủ sách', NULL),
(61, 142, 75, '90', NULL),
(62, 142, 76, '60', NULL),
(63, 142, 77, '30', NULL),
(64, 142, 78, '4', NULL),
(65, 142, 79, NULL, 3),
(66, 142, 80, 'Tủ đầu giường', NULL),
(67, 143, 81, 'LED', NULL),
(68, 143, 82, '15', NULL),
(69, 143, 83, '60', NULL),
(70, 143, 84, '30', NULL),
(71, 143, 85, NULL, 11),
(72, 143, 86, 'Hiện đại', NULL),
(73, 144, 81, 'Halogen', NULL),
(74, 144, 82, '50', NULL),
(75, 144, 83, '40', NULL),
(76, 144, 84, '20', NULL),
(77, 144, 85, NULL, 10),
(78, 144, 86, 'Châu Âu', NULL),
(79, 145, 81, 'Sợi đốt', NULL),
(80, 145, 82, '40', NULL),
(81, 145, 83, '35', NULL),
(82, 145, 84, '18', NULL),
(83, 145, 85, 'Gốm sứ', NULL),
(84, 145, 86, 'Vintage', NULL),
(85, 146, 87, '220', NULL),
(86, 146, 88, '160', NULL),
(87, 146, 89, '1.8', NULL),
(88, 146, 90, NULL, 8),
(89, 146, 91, 'Dệt kim', NULL),
(90, 147, 87, '300', NULL),
(91, 147, 88, '200', NULL),
(92, 147, 89, '2.5', NULL),
(93, 147, 90, NULL, 9),
(94, 147, 91, 'Thủ công', NULL),
(95, 148, 87, '150', NULL),
(96, 148, 88, '100', NULL),
(97, 148, 89, '1.0', NULL),
(98, 148, 90, NULL, 14),
(99, 148, 91, 'Dệt vải', NULL),
(100, 149, 92, NULL, 11),
(101, 149, 93, 'Gỗ ngoài trời', NULL),
(102, 149, 94, '1', NULL),
(103, 149, 95, '1', NULL),
(104, 149, 96, '3', NULL),
(105, 150, 92, 'Mây nhựa PE', NULL),
(106, 150, 93, 'Đệm chống thấm', NULL),
(107, 150, 94, '1', NULL),
(108, 150, 95, '1', NULL),
(109, 150, 96, '2', NULL),
(110, 151, 92, NULL, 11),
(111, 151, 93, NULL, 13),
(112, 151, 94, '1', NULL),
(113, 151, 95, '1', NULL),
(114, 151, 96, '5', NULL),
(132, 133, 97, '160', NULL),
(133, 133, 98, '75', NULL),
(134, 133, 99, '70', NULL),
(135, 133, 100, NULL, 8),
(136, 133, 101, 'Bông gòn', NULL),
(137, 133, 102, '2', NULL),
(138, 152, 103, NULL, 10),
(139, 152, 104, '25', NULL),
(140, 152, 105, '12', NULL),
(141, 152, 106, 'Trong suốt', NULL),
(142, 152, 107, 'Đương đại', NULL),
(143, 153, 103, NULL, 1),
(144, 153, 104, '15', NULL),
(145, 153, 105, '10', NULL),
(146, 153, 106, 'Màu gỗ', NULL),
(147, 153, 107, 'Tối giản', NULL),
(148, 154, 103, NULL, 11),
(149, 154, 104, '30', NULL),
(150, 154, 105, '20', NULL),
(151, 154, 106, 'Đen', NULL),
(152, 154, 107, 'Công nghiệp', NULL),
(153, 155, 108, '200', NULL),
(154, 155, 109, '180', NULL),
(155, 155, 110, '120', NULL),
(156, 155, 111, '180x200', NULL),
(157, 155, 112, NULL, 1),
(158, 155, 113, 'Giường đôi', NULL),
(159, 156, 108, '220', NULL),
(160, 156, 109, '200', NULL),
(161, 156, 110, '130', NULL),
(162, 156, 111, '200x220', NULL),
(163, 156, 112, NULL, 3),
(164, 156, 113, 'Giường King size', NULL),
(165, 157, 108, '190', NULL),
(166, 157, 109, '120', NULL),
(167, 157, 110, '100', NULL),
(168, 157, 111, '120x190', NULL),
(169, 157, 112, NULL, 11),
(170, 157, 113, 'Giường đơn', NULL),
(374, 134, 66, NULL, 4),
(375, 134, 65, '75', NULL),
(376, 134, 63, '160', NULL),
(377, 134, 64, '80', NULL),
(378, 134, 68, 'Hình chữ nhật', NULL),
(379, 134, 67, 'Chân kim loại', NULL),
(380, 134, 114, 'Gỗ', NULL),
(461, 196, 73, NULL, 19),
(462, 196, 69, '50', NULL),
(463, 196, 70, '05', NULL),
(464, 196, 71, '5', NULL),
(465, 196, 123, NULL, NULL),
(466, 196, 74, NULL, 17),
(467, 196, 72, '5', NULL),
(759, 220, 73, NULL, NULL),
(760, 220, 69, NULL, NULL),
(761, 220, 70, NULL, NULL),
(762, 220, 71, NULL, NULL),
(763, 220, 123, NULL, NULL),
(764, 220, 74, NULL, NULL),
(765, 220, 72, NULL, NULL),
(807, 226, 73, NULL, 1),
(808, 226, 69, '50', NULL),
(809, 226, 70, '80', NULL),
(810, 226, 71, '50', NULL),
(811, 226, 123, '2222', NULL),
(812, 226, 74, NULL, 5),
(813, 226, 72, '300', NULL),
(814, 137, 73, NULL, 1),
(815, 137, 69, '45', NULL),
(816, 137, 70, '50', NULL),
(817, 137, 71, '55', NULL),
(818, 137, 123, NULL, NULL),
(819, 137, 74, NULL, 7),
(820, 137, 72, '120', NULL),
(821, 131, 100, NULL, 7),
(822, 131, 99, '90', NULL),
(823, 131, 97, '250', NULL),
(824, 131, 98, '100', NULL),
(825, 131, 101, NULL, NULL),
(826, 131, 102, '4', NULL),
(827, 132, 100, NULL, 5),
(828, 132, 99, '80', NULL),
(829, 132, 97, '200', NULL),
(830, 132, 98, '85', NULL),
(831, 132, 101, NULL, NULL),
(832, 132, 102, '3', NULL);
SELECT setval('product_attribute_value_id_seq', (SELECT MAX(id) FROM product_attribute_value));

-- Banners
INSERT INTO banners (
    banner_id,
    banner_title,
    banner_description,
    banner_image,
    banner_link,
    banner_priority,
    page_type,
    status,
    category_id,
    start_date,
    end_date,
    created_at,
    updated_at
) VALUES
(11, 'KHUYỄN MÃI HẤP DẪN CHO THÁNG 8', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012398/image_73_akjjil.png', NULL, 1, 'home', 1, 1, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 13:32:23'),
(12, 'CHÀO MỪNG BẠN ĐẾN VỚI SONA SPACE', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_76_xmgbfn.png', NULL, 1, 'home', 1, 2, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 14:21:26'),
(13, 'DECOR THEO KHÔNG GIAN SỐNG', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012398/image_75_ddypfl.png', NULL, 1, 'san-pham', 1, 3, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 13:34:09'),
(14, 'CHỌN SẢN PHẨM THEO GU', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012506/image_77_ze7psl.jpg', NULL, 1, 'san-pham', 1, 4, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 13:34:35'),
(15, 'KHÔNG GIAN', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_76_xmgbfn.png', NULL, 1, 'khong-gian', 1, 5, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 13:35:45'),
(16, 'KHÔNG GIAN MỞ', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_78_c4jkib.png', NULL, 1, 'khong-gian', 1, 6, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 13:35:59'),
(17, 'ĐĂNG KÝ', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012398/image_72_hnp8kb.png', NULL, 1, 'dang-ky', 1, 7, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 13:36:09'),
(18, 'ĐĂNG NHẬP', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_79_gw4mto.png', NULL, 1, 'dang-nhap', 1, 8, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 13:36:19'),
(19, 'QUẢN LÝ TÀI KHOẢN', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_76_xmgbfn.png', NULL, 1, 'tai-khoan', 1, 9, '2025-06-26 03:37:46', NULL, '2025-06-26 03:37:46', '2025-08-16 13:36:30'),
(26, 'KHÔNG GIAN GIÀNH CHO BẠN', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_76_xmgbfn.png', NULL, 1, 'home', 1, 1, '2025-07-10 00:00:00', '2025-07-31 23:59:59', '2025-07-10 03:18:42', '2025-08-25 00:00:45'),
(27, 'TIN TỨC VỀ NỘI THẤT', NULL, 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1750012399/image_76_xmgbfn.png', NULL, 1, 'tin-tuc', 1, 1, '2025-08-07 19:46:14', NULL, '2025-08-07 19:46:14', '2025-08-16 13:36:56'),
(32, 'QUẢN TRỊ GIỎ HÀNG', NULL, 'banner-1754910683162-957530266.jpg', NULL, 1, 'gio-hang', 1, 6, '2025-08-11 00:00:00', '2025-08-31 00:00:00', '2025-08-11 18:11:23', '2025-08-16 13:34:53');
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
