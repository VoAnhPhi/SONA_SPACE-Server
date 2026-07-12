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
(9, 'Giường', NULL, 'giuong', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1754250894/queen_bed_imxg4d.png', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1749715528/bed_dlhcvl.webp', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1753619005/image_74_zswyv8_vpeiwv.jpg', 1, 6, '2025-08-04 02:55:51', '2025-05-24 15:36:24', NULL),
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
(131, 7, 'Modena 2.5 chỗ', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359694/SonaSpace/Product/modena-2-5-cho/main/product-131-01-bc19eb984c.webp', 'modena-2-5-cho', 'Hình dạng hữu cơ và đường nét tối giản kết hợp với nhau trong một biểu hiện giản dị, đương đại. Ghế sofa Modena sẽ tạo thêm một cảm giác thoải mái đòi hỏi bạn đến thư giãn trong sự thoải mái tuyệt vời khi ngồi yên. Các chi tiết thiết kế trang nhã nâng cao biểu cảm tổng thể và cùng với sự thoải mái mềm mại, đảm bảo một chiếc ghế sofa sẽ nhanh chóng trở thành món ăn yêu thích của gia đình.', 1, 216, 73, 1, '2026-07-06 17:50:16', '2025-06-14 15:43:20', NULL, 42, 'Gỗ tự nhiên', '85.00', '90.00', '80.00', '45.00', '180.00', NULL),
(132, 7, 'Sofa Amsterdam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359714/SonaSpace/Product/sofa-amsterdam/main/product-132-01-990667828e.webp', 'sofa-amsterdam', 'Amsterdam là những đường nét sắc nét và những đường cong rộng. Sự thoải mái và sang trọng thấm nhuần từng chi tiết để làm cho Amsterdam trở thành chiếc ghế sofa hoàn hảo cho một tuyên bố mềm mại và hấp dẫn trong phòng khách của bạn.', 2, 163, 24, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 7, 'Da thật', '120.00', '60.00', '60.00', '50.00', '100.00', 7),
(133, 7, 'Bergamo 5 chỗ', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359732/SonaSpace/Product/bergamo-5-cho/main/product-133-01-633f63a1bb.webp', 'bergamo-5-cho', 'Bergamo của Morten Georgsen là sự sang trọng hữu cơ được tạo ra thoải mái. Bergamo kết hợp một cách trang nhã sự thoải mái phi thường, cá nhân với tính thẩm mỹ thanh lịch. Kết quả là một chiếc ghế sofa hiện đại với sự thoải mái cả ngày.', 3, 116, 49, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 18, 'Gỗ tự nhiên', '182.00', '72.00', '52.00', '80.00', '210.00', 6),
(134, 1, 'Bàn cà phê chức năng Chiva', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359750/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/main/product-134-01-4f20aeb3f6.webp', 'ban-ca-phe-chuc-nang-chiva', 'Bàn cà phê hiện đại này có chức năng thuần túy được bao bọc trong thiết kế tuyệt vời. Giấu điều khiển từ xa, tạp chí, bộ sạc và dây cáp ở trung tâm bàn cà phê Chiva, với bộ lưu trữ tích hợp thông minh. Hoặc nâng mặt bàn mỏng lên để tạo chiều cao hoàn hảo cho trà chiều. Các thiết kế chân khác nhau cung cấp các chiều cao và chức năng khác nhau cho phép bạn có được bàn cà phê hoàn hảo cho không gian của mình.', 4, 79, 17, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 26, NULL, '40.00', '30.00', '20.00', '50.00', '50.00', 11),
(135, 1, 'Bàn cà phê Madrid', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359767/SonaSpace/Product/ban-ca-phe-madrid/main/product-135-01-cbf2b39650.webp', 'ban-ca-phe-madrid', 'Các đường nét gọn gàng và hình dạng hữu cơ kết hợp với nhau trong một thiết kế nổi để làm cho bàn cà phê Madrid trở thành một món đồ cảm giác, rực rỡ cho nội thất của bạn. Được thiết kế bởi Morten Georgsen, chiếc bàn cà phê cổ điển nhưng hiện đại này tạo nên sự hiện đại trong mọi không gian.', 5, 89, 20, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 3, 'Vải cotton', '55.00', '55.00', '6.00', '90.00', '35.00', 5),
(136, 1, 'Bàn làm việc Cupertino', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359785/SonaSpace/Product/ban-lam-viec-cupertino/main/product-136-01-1484e8f761.webp', 'ban-lam-viec-cupertino', 'Cupertino - mọi thứ bạn cần trong văn phòng tại nhà, được giấu đi ngay lập tức. Bàn Cupertino Executive kết hợp mặt bàn lớn và ngăn kéo rộng rãi với thiết kế nhẹ, cung cấp nhiều không gian cho tất cả các vật dụng cần thiết trong văn phòng của bạn trong khi vẫn giữ được vẻ ngoài tối giản.', 6, 63, 2, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 45, 'Lông thú tổng hợp', '5.00', '150.00', '150.00', NULL, '20.00', 3),
(137, 2, 'Ghế bành Modena', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359802/SonaSpace/Product/ghe-banh-modena/main/product-137-01-b0279718e1.webp', 'ghe-banh-modena', 'Hình dạng hữu cơ và đường nét tối giản kết hợp với nhau trong một biểu hiện giản dị, đương đại. Ghế Modena sẽ tạo thêm một cảm giác thoải mái yêu cầu bạn đến thư giãn trong sự thoải mái tuyệt vời khi ngồi xuống. Các chi tiết thiết kế trang nhã nâng cao biểu cảm tổng thể và cùng với sự thoải mái mềm mại, đảm bảo một chiếc ghế sẽ nhanh chóng trở thành địa điểm thư giãn yêu thích của bạn.', 7, 144, 12, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 12, 'Lông tổng hợp', '5.00', '155.00', '155.00', NULL, '21.00', 9),
(138, 2, 'Ghế ăn Hamilton', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359821/SonaSpace/Product/ghe-an-hamilton/main/product-138-01-f30cee4570.webp', 'ghe-an-hamilton', 'Cổ điển kết hợp hiện đại trên ghế ăn Hamilton. Được thiết kế bởi Morten Georgsen, hình dạng hữu cơ mang lại sự thoải mái khi kén trong khi vòng eo thon gọn mang lại sự thoải mái khi ngồi linh hoạt. Thưởng thức nhân vật của Hamilton và tạo ra tuyên bố trong phòng ăn của bạn.', 8, 91, 12, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 31, 'Da công nghiệp', '88.00', '195.00', '88.00', '44.00', '240.00', 4),
(139, 2, 'Ghế ăn Seoul', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359838/SonaSpace/Product/ghe-an-seoul/main/product-139-01-f6e7f90b5a.webp', 'ghe-an-seoul', 'Bàn làm việc gỗ công nghiệp, bền đẹp', 9, 82, 1, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 21, 'Gỗ tự nhiên', '180.00', '80.00', '40.00', NULL, '100.00', 5),
(140, 3, 'Tủ đựng đồ Fermo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359856/SonaSpace/Product/tu-dung-do-fermo/main/product-140-01-582a26ee14.webp', 'tu-dung-do-fermo', 'Hãy để Fermo thực hiện phép thuật của nó. Hãy xem những đường nét gọn gàng và vẻ ngoài tối giản của Fermo mở rộng ra toàn bộ ngôi nhà của bạn, khi sự lộn xộn của bạn được che giấu gọn gàng. Cho dù bạn đang xem trận đấu, nghe nhạc hay hiển thị ảnh kỳ nghỉ của mình, thiết bị TV này sẽ ẩn thiết bị điện tử của bạn một cách liền mạch, vì vậy bạn có thể tập trung vào việc giải trí.', 10, 84, 1, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 1, 'Gỗ MDF', '182.00', '82.00', '42.00', NULL, '105.00', 0),
(141, 3, 'Tủ quần áo đôi Lugano', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359876/SonaSpace/Product/tu-quan-ao-doi-lugano/main/product-141-01-c54b903a27.webp', 'tu-quan-ao-doi-lugano', 'Trông bóng bẩy, thanh lịch và độc quyền, Lugano sẽ giải quyết mọi nhu cầu lưu trữ của bạn mà không phải đổ mồ hôi. Thấp, sang trọng và với chức năng tuyệt vời, bộ lưu trữ thời trang này sẽ mang đến vẻ sang trọng cho ngôi nhà của bạn.', 11, 73, 1, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 33, 'Gỗ sồi', '150.00', '75.00', '70.00', NULL, '200.00', 1),
(142, 3, 'Tủ Calgary có ngăn kéo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359896/SonaSpace/Product/tu-calgary-co-ngan-keo/main/product-142-01-cb444e180f.webp', 'tu-calgary-co-ngan-keo', 'Calgary là một hệ thống lưu trữ đa năng kết hợp tính thẩm mỹ với chức năng. Được thiết kế bởi Morten Georgsen, thiết kế lưu trữ mở đơn giản nhưng tinh tế này có thể được sử dụng như một bàn làm việc, quầy bar mini hoặc nơi trưng bày đồ đạc của bạn. Có sẵn trong một số mô hình cố định có thể được kết hợp hoặc độc lập, bộ lưu trữ có thể tùy chỉnh này có thể được điều chỉnh để đáp ứng nhu cầu của bạn.', 12, 66, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 29, 'Da thật', '95.00', '60.00', '60.00', '45.00', '220.00', 0),
(143, 4, 'Đèn mặt dây chuyền mái chèo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359914/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/main/product-143-01-b5cf69c84c.webp', 'den-mat-day-chuyen-mai-cheo', 'Tâm điểm của bất kỳ căn phòng nào, mặt dây chuyền Paddle nhẹ nhàng chiếu sáng không gian của bạn cho một cái nhìn ấm cúng, yên tĩnh.', 13, 56, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 8, 'Gỗ MDF', '120.00', '60.00', '55.00', NULL, '180.00', 0),
(144, 4, 'Đèn sàn Kip
', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359933/SonaSpace/Product/den-san-kip/main/product-144-01-11590aeb51.webp', 'den-san-kip', 'Đồng thau cổ mờ với hình tròn đảm bảo vẻ ngoài phong cách và ấm áp cho đèn Kip. Đầu có thể điều chỉnh giúp bạn có thể di chuyển ánh sáng dịu theo bất kỳ hướng nào - hoàn hảo để thắp sáng khu vực đọc sách hoặc một điểm yêu thích khác của bạn.', 14, 55, 1, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 39, 'Pha lê', '50.00', '50.00', '20.00', NULL, '80.00', 2),
(145, 4, 'Đèn bàn Stockholm', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359952/SonaSpace/Product/den-ban-stockholm/main/product-145-01-6daf589ee1.webp', 'den-ban-stockholm', 'Sự đơn giản và tối giản kết hợp trong đèn treo Stockholm. Được thiết kế bằng kính trong suốt và đá tự nhiên, tăng thêm sự ấm áp cho phòng khách hoặc hành lang của bạn.', 15, 43, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 47, 'Vải Canvas', '55.00', '55.00', '6.00', NULL, '35.00', 1),
(146, 5, 'Thảm rãnh', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359970/SonaSpace/Product/tham-ranh/main/product-146-01-6f65d323e5.webp', 'tham-ranh', 'Các đường cắt hình 3D lượn sóng tạo ra chiều sâu và cấu trúc cho thảm Furrow trong khi sự pha trộn của các màu sắc trong len tái sử dụng mang lại một cuộc sống thú vị trên bề mặt. Kết quả là một cái nhìn khuyến khích bạn khám phá các đường cong tự nhiên và các chuyển tiếp tinh tế.', 16, 49, 1, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 14, 'Lông thú tổng hợp', '7.00', '160.00', '160.00', NULL, '23.00', 0),
(147, 5, 'Thảm vân sóng', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359981/SonaSpace/Product/tham-van-song/main/product-147-01-846a62b574.webp', 'tham-van-song', 'Tấm thảm Form được dệt panja trong các con hẻm nông thôn của Ấn Độ bởi các nghệ nhân tài năng của Ấn Độ. Kiểu dệt Panja, được đặt theo tên của một dụng cụ giống như móng vuốt được sử dụng để đặt các sợi dọc, thường được sử dụng để sản xuất vải hoặc thảm. Tấm thảm là một thiết kế hiện đại tuyệt vời với màu sắc tinh tế tạo thêm nét hiện đại, sang trọng cho bất kỳ kiểu trang trí nào. Nó được làm bằng len New Zealand chất lượng cao. Nó nổi bật với màu sắc được điều chỉnh, các cạnh được khâu tinh xảo và kiểu dệt mộc mạc. Bạn sẽ yêu thích vẻ ngoài của thảm Form tạo thêm nét tối giản cổ điển cho khu vực sinh hoạt của bạn.', 17, 98, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 24, 'Da thật', '92.00', '205.00', '92.00', '46.00', '255.00', 0),
(148, 5, 'Thảm đấu trường', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359992/SonaSpace/Product/tham-dau-truong/main/product-148-01-c6e3c19795.webp', 'tham-dau-truong', 'Thêm nét nét cho không gian sống của bạn với tấm thảm Arena. Thiết kế hình tròn hữu cơ được chần thủ công với sự pha trộn giữa chất liệu TENCEL™ và lụa, nổi bật với bảng màu nâu đậm đà thấm nhuần sự sang trọng hiện đại.', 18, 63, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 6, 'Gỗ tự nhiên', '182.00', '85.00', '45.00', NULL, '110.00', 0),
(149, 6, 'Ghế sofa Cancún Lounge', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360003/SonaSpace/Product/ghe-sofa-cancun-lounge/main/product-149-01-a1a1937ac4.webp', 'ghe-sofa-cancun-lounge', 'Sự thoải mái ngoài trời đang chờ đợi với ghế sofa Cancún. Sự bổ sung hoàn hảo cho bất kỳ sân trong, sân thượng hoặc sân vườn nào, chiếc ghế sofa ngoài trời tối giản này sẽ khiến bạn muốn ở bên ngoài suốt mùa hè dài.', 19, 56, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 49, 'Gỗ MDF', '78.00', '130.00', '65.00', NULL, '160.00', 0),
(150, 6, 'Ghế ăn Cancún', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360021/SonaSpace/Product/ghe-an-cancun/main/product-150-01-cee3034416.webp', 'ghe-an-cancun', 'Dành cả ngày của bạn trong không gian ngoài trời tuyệt vời với ghế ăn Cancún. Lý tưởng cho cà phê sáng sớm và tiệc tối ngẫu hứng, chiếc ghế ngoài trời này phù hợp với mọi khung cảnh ngoài trời.', 20, 81, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 17, 'Vải nỉ', '105.00', '85.00', '85.00', '47.00', '95.00', 0),
(151, 6, 'Bàn phụ Cancún', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360038/SonaSpace/Product/ban-phu-cancun/main/product-151-01-44d130618e.webp', 'ban-phu-cancun', 'Mang đến sự sang trọng và tiện dụng cho bên hồ bơi hoặc sân trong của bạn với bàn cà phê Cancún của Morten Georgsen. Với thiết kế hai tầng thông minh, chiếc bàn tiếp khách này là thứ tuyệt đối bắt buộc cho cuộc sống ngoài trời.', 1, 41, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 11, 'Gỗ sồi', '155.00', '80.00', '75.00', NULL, '210.00', 0),
(152, 8, 'Bình mưa', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360057/SonaSpace/Product/binh-mua/main/product-152-01-b1a16f8b59.webp', 'binh-mua', 'Bình tuyên bố này được thổi miệng từ lò nhậu trong khi hiệu ứng thị giác sau đó đạt được bằng quá trình cắt được thực hiện bằng tay. Kết quả là một chiếc bình đẹp mang dấu ấn của nhà sản xuất.', 2, 37, 1, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 28, 'Da thật', '98.00', '65.00', '65.00', '48.00', '230.00', 1),
(153, 8, 'Bình phao', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360067/SonaSpace/Product/binh-phao/main/product-153-01-fdd4ebfb1e.webp', 'binh-phao', 'Cập nhật bộ sưu tập đất nung của bạn với bình Float. Được làm từ đá trầm tích tự nhiên, các vệt tự nhiên và bất thường được tìm thấy trên mỗi bình là dấu vết của thủ công thủ công, có nghĩa là không có hai thiết kế nào giống nhau.', 3, 61, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 2, 'Gỗ MDF', '125.00', '65.00', '60.00', NULL, '190.00', 0),
(154, 8, 'Bình bong bóng', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360078/SonaSpace/Product/binh-bong-bong/main/product-154-01-e9aabe2b89.webp', 'binh-bong-bong', 'Hình thức và kết cấu kết hợp trong bình Bubble. Các vệt tự nhiên và bất thường được tìm thấy trên mỗi chiếc bình là dấu vết của nghề thủ công của nghệ nhân, có nghĩa là không có hai thiết kế nào giống nhau.', 4, 46, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 36, 'Pha lê', '55.00', '55.00', '25.00', NULL, '85.00', 0),
(155, 9, 'Giường Lugano storage', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360090/SonaSpace/Product/giuong-lugano-storage/main/product-155-01-98b2fb6ab2.webp', 'giuong-lugano-storage', 'Hãy để cơ thể bạn chìm xuống và cảm thấy thư giãn tràn ngập bạn. Ngủ như một thiên thần trên chiếc giường Lugano thanh lịch. Giữ vẻ ngoài tối giản với khung gỗ sạch sẽ, chiếc giường hiện đại này sẽ mang lại cảm giác yên tĩnh và thanh bình cho phòng ngủ của bạn. Được trang bị đế để có vẻ ngoài nam tính, nặng nề hơn, chiếc giường này mời bạn thoải mái. Đầu giường chần tạo thêm nét truyền thống và tạo ra một bầu không khí mềm mại, thân thiện. Nâng khung giường lên và để lộ nhiều không gian lưu trữ cho giường phụ, chăn mùa đông dày hoặc thậm chí có thể để giấu quà.', 5, 51, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 43, 'Vải Canvas', '58.00', '58.00', '7.00', NULL, '38.00', 0),
(156, 9, 'Gường Fusion Day', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360107/SonaSpace/Product/guong-funsion-day/main/product-156-01-e5b6c4ae46.webp', 'guong-funsion-day', 'Chiếc ghế giường Fusion là một món đồ nội thất thiết kế đẹp mắt và mang tính biểu tượng, kết hợp giữa thẩm mỹ Nhật Bản và chức năng Đan Mạch. Những chiếc gối rời có thể được sắp xếp tự do, cho phép bạn thay đổi diện mạo tùy theo nhu cầu sử dụng, trong khi chân ghế thanh mảnh và các đường nét gọn gàng giữ cho phong cách luôn nhẹ nhàng, tinh tế.', 6, 56, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 5, 'Lông thú tổng hợp', '8.00', '165.00', '165.00', NULL, '24.00', 0),
(157, 9, 'Giường Arlington', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360126/SonaSpace/Product/giuong-arlingtn/main/product-157-01-0297f7a73e.webp', 'giuong-arlingtn', 'Tựa lưng chắc chắn khi ngồi dựa vào đầu giường và cảm giác êm ái khi nằm xuống khiến giường Arlington trở thành một lựa chọn tuyệt vời cho phòng ngủ. Giống như phần nối dài của một chiếc gối, phần đầu giường mềm mại như mời gọi bạn bước vào một giấc ngủ ngon.








', 7, 91, 0, 1, '2026-07-06 17:50:16', '2025-05-24 15:43:20', NULL, 5, 'Da thật', '94.00', '210.00', '94.00', '47.00', '260.00', 0),
(196, 2, 'dd', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358267/SonaSpace/Product/ghe-test/main/product-196-01-fafac0b116.webp', 'ghe-test', 'jdfkjágh', 25, 1, 0, 0, '2026-07-06 17:25:50', '2025-06-30 23:04:02', NULL, 0, 'vai', '5.00', '5.00', '5.00', '55.00', '5.00', 0),
(208, 2, 'Cửa Gỗ', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358271/SonaSpace/Product/cua-go/main/product-208-01-4e2531c78a.jpg', 'cua-go', 'abc', 0, 0, 0, 0, '2026-07-06 17:25:50', '2025-07-10 22:49:12', NULL, 0, 'gỗ', '200.00', '50.00', '0.00', '0.00', '5.00', 0),
(220, 2, 'fgsghg', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358275/SonaSpace/Product/fgsghg/main/product-220-01-7994bbdf11.jpg', 'fgsghg', 'ggf', 24, 0, 1, 0, '2026-07-06 17:25:50', '2025-07-28 02:16:39', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 1),
(226, 2, 'Ghế Công Thái học', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358278/SonaSpace/Product/ghe-cong-thai-hoc/main/product-226-01-6735ce0165.png', 'ghe-cong-thai-hoc', 'Mang đến sự kết hợp hoàn hảo giữa công thái học hiện đại và sự gắn kết lãng mạn, ghế công thái học tình yêu được thiết kế dành riêng cho các cặp đôi muốn tận hưởng từng khoảnh khắc bên nhau một cách thoải mái và tốt cho sức khỏe.

Với tựa lưng đôi ôm sát đường cong cơ thể, đệm ngồi rộng rãi và góc ngả linh hoạt, chiếc ghế này hỗ trợ tối ưu cột sống, cổ, vai và hông của cả hai, giúp giảm căng thẳng khi ngồi lâu. Chất liệu da/mesh cao cấp thoáng khí cùng đường may tinh xảo tạo cảm giác êm ái và sang trọng.

Không chỉ là một chiếc ghế, đây còn là không gian chia sẻ: đọc sách cùng nhau, xem phim, trò chuyện, hoặc đơn giản là tựa vào nhau sau một ngày dài. Ghế công thái học tình yêu sẽ biến mọi khoảnh khắc bình thường thành trải nghiệm ấm áp và đầy kết nối.', 26, 7, 3, 0, '2026-07-06 17:25:50', '2025-08-11 16:01:52', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 2);
SELECT setval('product_product_id_seq', (SELECT MAX(product_id) FROM product));

-- Variant Products
INSERT INTO variant_product (variant_id, product_id, color_id, variant_product_quantity, variant_product_price, variant_product_price_sale, variant_product_slug, variant_product_list_image) VALUES
(255, 131, 1, 29, '19000000.00', '18000000.00', 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359697/SonaSpace/Product/modena-2-5-cho/variants/mau-be/variant-255-01-bc19eb984c.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359699/SonaSpace/Product/modena-2-5-cho/variants/mau-be/variant-255-02-4d6175ea19.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359700/SonaSpace/Product/modena-2-5-cho/variants/mau-be/variant-255-03-07ac82dae7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359701/SonaSpace/Product/modena-2-5-cho/variants/mau-be/variant-255-04-0052ef143d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359702/SonaSpace/Product/modena-2-5-cho/variants/mau-be/variant-255-05-6c758a6bb9.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358069/SonaSpace/Product/modena-2-5-cho/variants/mau-be/variant-255-06-0234268def.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358071/SonaSpace/Product/modena-2-5-cho/variants/mau-be/variant-255-07-de12c67e22.webp'),
(256, 131, 2, 19, '20000000.00', '19000000.00', 'mau-xam-nhat', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359705/SonaSpace/Product/modena-2-5-cho/variants/mau-xam-nhat/variant-256-01-b130cb38d1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359707/SonaSpace/Product/modena-2-5-cho/variants/mau-xam-nhat/variant-256-02-66e1e7f196.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359708/SonaSpace/Product/modena-2-5-cho/variants/mau-xam-nhat/variant-256-03-4da5ef4618.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359709/SonaSpace/Product/modena-2-5-cho/variants/mau-xam-nhat/variant-256-04-0bbdc54322.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359710/SonaSpace/Product/modena-2-5-cho/variants/mau-xam-nhat/variant-256-05-2ca0265521.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358072/SonaSpace/Product/modena-2-5-cho/variants/mau-xam-nhat/variant-256-06-18cebebe63.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358073/SonaSpace/Product/modena-2-5-cho/variants/mau-xam-nhat/variant-256-07-de12c67e22.webp'),
(257, 132, 19, 59, '25000000.00', '20000000.00', 'mau-den', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359716/SonaSpace/Product/sofa-amsterdam/variants/mau-den/variant-257-01-990667828e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359717/SonaSpace/Product/sofa-amsterdam/variants/mau-den/variant-257-02-275b0859d9.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359718/SonaSpace/Product/sofa-amsterdam/variants/mau-den/variant-257-03-cecfa72928.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359719/SonaSpace/Product/sofa-amsterdam/variants/mau-den/variant-257-04-6246ef0714.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359720/SonaSpace/Product/sofa-amsterdam/variants/mau-den/variant-257-05-5ff9bfbbc2.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358075/SonaSpace/Product/sofa-amsterdam/variants/mau-den/variant-257-06-6a4066ea55.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358076/SonaSpace/Product/sofa-amsterdam/variants/mau-den/variant-257-07-764c5ed90e.webp'),
(258, 132, 1, 77, '25000000.00', '20000000.00', 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359723/SonaSpace/Product/sofa-amsterdam/variants/mau-be/variant-258-01-8624ad7c6f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359725/SonaSpace/Product/sofa-amsterdam/variants/mau-be/variant-258-02-a4ba49b2a3.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359726/SonaSpace/Product/sofa-amsterdam/variants/mau-be/variant-258-03-66a7ec68c5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359727/SonaSpace/Product/sofa-amsterdam/variants/mau-be/variant-258-04-e36e9cd617.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359728/SonaSpace/Product/sofa-amsterdam/variants/mau-be/variant-258-05-f8ecc66430.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358078/SonaSpace/Product/sofa-amsterdam/variants/mau-be/variant-258-06-0e7be15a0a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358079/SonaSpace/Product/sofa-amsterdam/variants/mau-be/variant-258-07-764c5ed90e.webp'),
(259, 133, 2, 53, '29000000.00', '25000000.00', 'mau-xam-nhat', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359734/SonaSpace/Product/bergamo-5-cho/variants/mau-xam-nhat/variant-259-01-633f63a1bb.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359735/SonaSpace/Product/bergamo-5-cho/variants/mau-xam-nhat/variant-259-02-d6210984d5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359736/SonaSpace/Product/bergamo-5-cho/variants/mau-xam-nhat/variant-259-03-c6307b1f16.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359737/SonaSpace/Product/bergamo-5-cho/variants/mau-xam-nhat/variant-259-04-0d16942c07.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359738/SonaSpace/Product/bergamo-5-cho/variants/mau-xam-nhat/variant-259-05-f040ce2c54.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358080/SonaSpace/Product/bergamo-5-cho/variants/mau-xam-nhat/variant-259-06-934ab379aa.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358081/SonaSpace/Product/bergamo-5-cho/variants/mau-xam-nhat/variant-259-07-468bee1570.webp'),
(260, 133, 6, 26, '29000000.00', '25000000.00', 'mau-trang', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359742/SonaSpace/Product/bergamo-5-cho/variants/mau-trang/variant-260-01-2017c1025e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359743/SonaSpace/Product/bergamo-5-cho/variants/mau-trang/variant-260-02-04c7826f91.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359744/SonaSpace/Product/bergamo-5-cho/variants/mau-trang/variant-260-03-ef4408cf05.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359745/SonaSpace/Product/bergamo-5-cho/variants/mau-trang/variant-260-04-46b95b1186.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359746/SonaSpace/Product/bergamo-5-cho/variants/mau-trang/variant-260-05-8c6db9d1c0.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358082/SonaSpace/Product/bergamo-5-cho/variants/mau-trang/variant-260-06-934ab379aa.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358084/SonaSpace/Product/bergamo-5-cho/variants/mau-trang/variant-260-07-49fa786243.webp'),
(263, 135, 9, 42, '2000000.00', NULL, 'mau-kinh-trong-suot', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359769/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-kinh-trong-suot/variant-263-01-cbf2b39650.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359770/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-kinh-trong-suot/variant-263-02-614e6f7b11.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359772/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-kinh-trong-suot/variant-263-03-7e90a2bab7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358091/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-kinh-trong-suot/variant-263-04-d3a21fa97d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358092/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-kinh-trong-suot/variant-263-05-3cd5b78ded.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358094/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-kinh-trong-suot/variant-263-06-d5949cc92e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358095/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-kinh-trong-suot/variant-263-07-239d58f591.webp'),
(264, 135, 10, 68, '35000000.00', NULL, 'mau-gom-tro', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359777/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-gom-tro/variant-264-01-b97ac95053.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359778/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-gom-tro/variant-264-02-5255593e0f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359779/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-gom-tro/variant-264-03-df369e8a7a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358096/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-gom-tro/variant-264-04-d3a21fa97d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358098/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-gom-tro/variant-264-05-3cd5b78ded.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358099/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-gom-tro/variant-264-06-d5949cc92e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358100/SonaSpace/Product/ban-ca-phe-madrid/variants/mau-gom-tro/variant-264-07-c755b7bad4.webp'),
(265, 136, 8, 58, '25000000.00', NULL, 'mau-soi-sam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359787/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-soi-sam/variant-265-01-1484e8f761.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359788/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-soi-sam/variant-265-02-ed4ab36120.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359789/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-soi-sam/variant-265-03-268f3cab54.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358101/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-soi-sam/variant-265-04-1c48bc8b39.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358102/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-soi-sam/variant-265-05-2271d053db.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358103/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-soi-sam/variant-265-06-2fc6186b29.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358104/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-soi-sam/variant-265-07-b4368e7b36.webp'),
(266, 136, 2, 70, '34000000.00', NULL, 'mau-xam-tro', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359794/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-xam-tro/variant-266-01-7a8f1596a2.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359795/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-xam-tro/variant-266-02-b3895a92dd.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359796/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-xam-tro/variant-266-03-a6c233221c.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358105/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-xam-tro/variant-266-04-1c48bc8b39.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358107/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-xam-tro/variant-266-05-2271d053db.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358108/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-xam-tro/variant-266-06-2fc6186b29.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358109/SonaSpace/Product/ban-lam-viec-cupertino/variants/mau-xam-tro/variant-266-07-b4368e7b36.webp'),
(267, 137, 1, 50, '15000000.00', '0.00', 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359804/SonaSpace/Product/ghe-banh-modena/variants/mau-be/variant-267-01-b0279718e1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359805/SonaSpace/Product/ghe-banh-modena/variants/mau-be/variant-267-02-3c263c85ad.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359807/SonaSpace/Product/ghe-banh-modena/variants/mau-be/variant-267-03-13a0bd5fec.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359808/SonaSpace/Product/ghe-banh-modena/variants/mau-be/variant-267-04-1a686dc1bd.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359810/SonaSpace/Product/ghe-banh-modena/variants/mau-be/variant-267-05-6c758a6bb9.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358110/SonaSpace/Product/ghe-banh-modena/variants/mau-be/variant-267-06-c9218c705c.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358111/SonaSpace/Product/ghe-banh-modena/variants/mau-be/variant-267-07-917eb65f7e.webp'),
(268, 137, 14, 63, '18000000.00', '0.00', 'mau-xanh-lam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359813/SonaSpace/Product/ghe-banh-modena/variants/mau-xanh-lam/variant-268-01-f9f1dd79a5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359814/SonaSpace/Product/ghe-banh-modena/variants/mau-xanh-lam/variant-268-02-e70649bd64.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359815/SonaSpace/Product/ghe-banh-modena/variants/mau-xanh-lam/variant-268-03-f59b9169eb.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359816/SonaSpace/Product/ghe-banh-modena/variants/mau-xanh-lam/variant-268-04-3591ab4080.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359818/SonaSpace/Product/ghe-banh-modena/variants/mau-xanh-lam/variant-268-05-44b00ccd3f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358112/SonaSpace/Product/ghe-banh-modena/variants/mau-xanh-lam/variant-268-06-c9218c705c.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358113/SonaSpace/Product/ghe-banh-modena/variants/mau-xanh-lam/variant-268-07-04cfead331.webp'),
(269, 138, 10, 54, '20000000.00', '0.00', 'mau-xanh-nhat', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359823/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-nhat/variant-269-01-f30cee4570.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359824/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-nhat/variant-269-02-7ea8b6acb6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359825/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-nhat/variant-269-03-e96d526ca5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359826/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-nhat/variant-269-04-3f072f9c93.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359827/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-nhat/variant-269-05-358e51ee3f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358114/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-nhat/variant-269-06-bf257e8f81.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358116/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-nhat/variant-269-07-1c60e855f7.webp'),
(270, 138, 25, 64, '15000000.00', NULL, 'mau-xanh-la-cay', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359831/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-la-cay/variant-270-01-febd358275.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359832/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-la-cay/variant-270-02-8664da3de6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359833/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-la-cay/variant-270-03-81fe100f15.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359834/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-la-cay/variant-270-04-12c49c9ca4.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358117/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-la-cay/variant-270-06-1c60e855f7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358118/SonaSpace/Product/ghe-an-hamilton/variants/mau-xanh-la-cay/variant-270-07-13fe1eefb1.webp'),
(271, 139, 1, 59, '23000000.00', '20000000.00', 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359840/SonaSpace/Product/ghe-an-seoul/variants/mau-be/variant-271-01-f6e7f90b5a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359841/SonaSpace/Product/ghe-an-seoul/variants/mau-be/variant-271-02-ff7ad4b624.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359842/SonaSpace/Product/ghe-an-seoul/variants/mau-be/variant-271-03-813e28dfa7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359843/SonaSpace/Product/ghe-an-seoul/variants/mau-be/variant-271-04-b3088e0eb6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359844/SonaSpace/Product/ghe-an-seoul/variants/mau-be/variant-271-05-8ffb0ac41b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358120/SonaSpace/Product/ghe-an-seoul/variants/mau-be/variant-271-06-e3ec24c466.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358121/SonaSpace/Product/ghe-an-seoul/variants/mau-be/variant-271-07-191ff25972.webp'),
(272, 139, 2, 70, '28000000.00', NULL, 'mau-xam-bac', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359847/SonaSpace/Product/ghe-an-seoul/variants/mau-xam-bac/variant-272-01-b8b30b748a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359849/SonaSpace/Product/ghe-an-seoul/variants/mau-xam-bac/variant-272-02-ebce76334a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359850/SonaSpace/Product/ghe-an-seoul/variants/mau-xam-bac/variant-272-03-ebce76334a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359851/SonaSpace/Product/ghe-an-seoul/variants/mau-xam-bac/variant-272-04-623018a054.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359852/SonaSpace/Product/ghe-an-seoul/variants/mau-xam-bac/variant-272-05-f040ce2c54.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358122/SonaSpace/Product/ghe-an-seoul/variants/mau-xam-bac/variant-272-06-587ccdb518.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358123/SonaSpace/Product/ghe-an-seoul/variants/mau-xam-bac/variant-272-07-e3ec24c466.webp'),
(273, 140, 19, 60, '23000000.00', '20000000.00', 'mau-den-nhat', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359858/SonaSpace/Product/tu-dung-do-fermo/variants/mau-den-nhat/variant-273-01-582a26ee14.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359860/SonaSpace/Product/tu-dung-do-fermo/variants/mau-den-nhat/variant-273-02-430226d890.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359861/SonaSpace/Product/tu-dung-do-fermo/variants/mau-den-nhat/variant-273-03-430226d890.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358125/SonaSpace/Product/tu-dung-do-fermo/variants/mau-den-nhat/variant-273-04-5738ffca29.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358126/SonaSpace/Product/tu-dung-do-fermo/variants/mau-den-nhat/variant-273-05-07ea0e54fa.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358128/SonaSpace/Product/tu-dung-do-fermo/variants/mau-den-nhat/variant-273-06-c1ea60b5f1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358129/SonaSpace/Product/tu-dung-do-fermo/variants/mau-den-nhat/variant-273-07-1198a63a2d.webp'),
(274, 140, 2, 69, '25000000.00', NULL, 'mau-xam-tro-mo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359868/SonaSpace/Product/tu-dung-do-fermo/variants/mau-xam-tro-mo/variant-274-01-d510eac49d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359869/SonaSpace/Product/tu-dung-do-fermo/variants/mau-xam-tro-mo/variant-274-02-85010a9141.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359870/SonaSpace/Product/tu-dung-do-fermo/variants/mau-xam-tro-mo/variant-274-03-85010a9141.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358130/SonaSpace/Product/tu-dung-do-fermo/variants/mau-xam-tro-mo/variant-274-04-5738ffca29.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358131/SonaSpace/Product/tu-dung-do-fermo/variants/mau-xam-tro-mo/variant-274-05-07ea0e54fa.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358132/SonaSpace/Product/tu-dung-do-fermo/variants/mau-xam-tro-mo/variant-274-06-c1ea60b5f1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358134/SonaSpace/Product/tu-dung-do-fermo/variants/mau-xam-tro-mo/variant-274-07-ab0678d3bd.webp'),
(275, 141, 1, 59, '28000000.00', '24000000.00', 'mau-xam-tro-mo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359879/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-tro-mo/variant-275-01-c54b903a27.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359880/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-tro-mo/variant-275-02-c413b6297c.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358135/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-tro-mo/variant-275-03-569a079745.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358136/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-tro-mo/variant-275-04-283d0104e5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358137/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-tro-mo/variant-275-05-bfe990ef6e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358138/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-tro-mo/variant-275-06-23ed1a9559.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358139/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-tro-mo/variant-275-07-23ed1a9559.webp'),
(276, 141, 6, 70, '30000000.00', NULL, 'mau-xam-mo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359888/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-mo/variant-276-01-7181edfbe6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359889/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-mo/variant-276-02-b08c7be058.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358140/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-mo/variant-276-03-569a079745.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358141/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-mo/variant-276-04-283d0104e5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358143/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-mo/variant-276-05-bfe990ef6e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358143/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-mo/variant-276-06-23ed1a9559.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358144/SonaSpace/Product/tu-quan-ao-doi-lugano/variants/mau-xam-mo/variant-276-07-23ed1a9559.webp'),
(277, 142, 2, 60, '28000000.00', '24000000.00', 'mau-xam-tro-mo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359898/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-xam-tro-mo/variant-277-01-cb444e180f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359899/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-xam-tro-mo/variant-277-02-3ccdfb9fe7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359901/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-xam-tro-mo/variant-277-03-3ccdfb9fe7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358146/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-xam-tro-mo/variant-277-04-bb3bef7f48.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358147/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-xam-tro-mo/variant-277-05-2e9af22f83.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358148/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-xam-tro-mo/variant-277-06-f2d6fafc57.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358149/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-xam-tro-mo/variant-277-07-ef60de845a.webp'),
(278, 142, 8, 70, '30000000.00', NULL, 'mau-soi-sam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359906/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-soi-sam/variant-278-01-c410171fc4.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359908/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-soi-sam/variant-278-02-86a3d68197.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359909/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-soi-sam/variant-278-03-86a3d68197.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358150/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-soi-sam/variant-278-04-bb3bef7f48.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358151/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-soi-sam/variant-278-05-2e9af22f83.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358152/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-soi-sam/variant-278-06-f2d6fafc57.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358153/SonaSpace/Product/tu-calgary-co-ngan-keo/variants/mau-soi-sam/variant-278-07-ef60de845a.webp'),
(279, 143, 25, 60, '22000000.00', '0.00', 'mau-nau-nhat', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359918/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-nau-nhat/variant-279-01-b5cf69c84c.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359919/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-nau-nhat/variant-279-02-01f04194a8.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358155/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-nau-nhat/variant-279-03-6804e627ef.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358156/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-nau-nhat/variant-279-04-b0b6e86825.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358157/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-nau-nhat/variant-279-05-2ec7e6525b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358158/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-nau-nhat/variant-279-06-13fe1eefb1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358159/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-nau-nhat/variant-279-07-4c417f7dd6.webp'),
(280, 143, 19, 70, '30000000.00', NULL, 'mau-den', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359925/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-den/variant-280-01-4f5f111dfc.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359926/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-den/variant-280-02-d3b214dcc4.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358161/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-den/variant-280-03-6804e627ef.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358162/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-den/variant-280-04-b0b6e86825.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358163/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-den/variant-280-05-2ec7e6525b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358164/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-den/variant-280-06-13fe1eefb1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358165/SonaSpace/Product/den-mat-day-chuyen-mai-cheo/variants/mau-den/variant-280-07-4c417f7dd6.webp'),
(281, 144, 27, 59, '22000000.00', NULL, 'mau-dong', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359936/SonaSpace/Product/den-san-kip/variants/mau-dong/variant-281-01-11590aeb51.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359937/SonaSpace/Product/den-san-kip/variants/mau-dong/variant-281-02-0babc833b2.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359938/SonaSpace/Product/den-san-kip/variants/mau-dong/variant-281-03-925e587a8f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358166/SonaSpace/Product/den-san-kip/variants/mau-dong/variant-281-04-13cd077956.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358168/SonaSpace/Product/den-san-kip/variants/mau-dong/variant-281-05-c4e8c1f07e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358169/SonaSpace/Product/den-san-kip/variants/mau-dong/variant-281-06-dd82648d71.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358170/SonaSpace/Product/den-san-kip/variants/mau-dong/variant-281-07-b8b00445c3.webp'),
(282, 144, 2, 70, '30000000.00', NULL, 'mau-xam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359944/SonaSpace/Product/den-san-kip/variants/mau-xam/variant-282-01-6cdd200cd8.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359945/SonaSpace/Product/den-san-kip/variants/mau-xam/variant-282-02-6e3366186c.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358171/SonaSpace/Product/den-san-kip/variants/mau-xam/variant-282-03-65e859f261.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358172/SonaSpace/Product/den-san-kip/variants/mau-xam/variant-282-04-ebbb21bfa9.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358173/SonaSpace/Product/den-san-kip/variants/mau-xam/variant-282-05-dd82648d71.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358174/SonaSpace/Product/den-san-kip/variants/mau-xam/variant-282-06-b8b00445c3.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358176/SonaSpace/Product/den-san-kip/variants/mau-xam/variant-282-07-b8b00445c3.webp'),
(283, 145, 9, 59, '18000000.00', NULL, 'kinh-mau-khoi', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359954/SonaSpace/Product/den-ban-stockholm/variants/kinh-mau-khoi/variant-283-01-6daf589ee1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359956/SonaSpace/Product/den-ban-stockholm/variants/kinh-mau-khoi/variant-283-02-fdefe7de6b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358177/SonaSpace/Product/den-ban-stockholm/variants/kinh-mau-khoi/variant-283-03-4472eb3e13.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358178/SonaSpace/Product/den-ban-stockholm/variants/kinh-mau-khoi/variant-283-04-410a7ea096.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358179/SonaSpace/Product/den-ban-stockholm/variants/kinh-mau-khoi/variant-283-05-da0f207d11.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358180/SonaSpace/Product/den-ban-stockholm/variants/kinh-mau-khoi/variant-283-06-1aa7108659.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358181/SonaSpace/Product/den-ban-stockholm/variants/kinh-mau-khoi/variant-283-07-1aa7108659.webp'),
(284, 145, 1, 70, '18000000.00', NULL, 'kinh-trong-suot-cam-thach', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359962/SonaSpace/Product/den-ban-stockholm/variants/kinh-trong-suot-cam-thach/variant-284-01-9c9cb730a1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359963/SonaSpace/Product/den-ban-stockholm/variants/kinh-trong-suot-cam-thach/variant-284-02-695d3e0bb2.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358182/SonaSpace/Product/den-ban-stockholm/variants/kinh-trong-suot-cam-thach/variant-284-03-4472eb3e13.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358183/SonaSpace/Product/den-ban-stockholm/variants/kinh-trong-suot-cam-thach/variant-284-04-410a7ea096.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358184/SonaSpace/Product/den-ban-stockholm/variants/kinh-trong-suot-cam-thach/variant-284-05-da0f207d11.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358186/SonaSpace/Product/den-ban-stockholm/variants/kinh-trong-suot-cam-thach/variant-284-06-1aa7108659.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358187/SonaSpace/Product/den-ban-stockholm/variants/kinh-trong-suot-cam-thach/variant-284-07-1aa7108659.webp'),
(285, 146, 25, 59, '16000000.00', NULL, 'mau-nau-go', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359973/SonaSpace/Product/tham-ranh/variants/mau-nau-go/variant-285-01-6f65d323e5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359974/SonaSpace/Product/tham-ranh/variants/mau-nau-go/variant-285-02-22936ada8b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359975/SonaSpace/Product/tham-ranh/variants/mau-nau-go/variant-285-03-b342d999e3.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358188/SonaSpace/Product/tham-ranh/variants/mau-nau-go/variant-285-04-4c64afc71d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358189/SonaSpace/Product/tham-ranh/variants/mau-nau-go/variant-285-05-fd90cf56d1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358190/SonaSpace/Product/tham-ranh/variants/mau-nau-go/variant-285-06-48c6397212.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358191/SonaSpace/Product/tham-ranh/variants/mau-nau-go/variant-285-07-12ba2be71e.webp'),
(286, 147, 2, 70, '19000000.00', NULL, 'mau-xam-tro', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359984/SonaSpace/Product/tham-van-song/variants/mau-xam-tro/variant-286-01-846a62b574.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359985/SonaSpace/Product/tham-van-song/variants/mau-xam-tro/variant-286-02-211b7266c6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359986/SonaSpace/Product/tham-van-song/variants/mau-xam-tro/variant-286-03-377d2a7c81.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358192/SonaSpace/Product/tham-van-song/variants/mau-xam-tro/variant-286-04-be21cfdf43.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358194/SonaSpace/Product/tham-van-song/variants/mau-xam-tro/variant-286-05-94d1eafd35.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358195/SonaSpace/Product/tham-van-song/variants/mau-xam-tro/variant-286-06-6fda37f414.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358196/SonaSpace/Product/tham-van-song/variants/mau-xam-tro/variant-286-07-7d1843218b.webp'),
(287, 148, 25, 60, '15000000.00', NULL, 'mau-nau-go', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359995/SonaSpace/Product/tham-dau-truong/variants/mau-nau-go/variant-287-01-c6e3c19795.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359996/SonaSpace/Product/tham-dau-truong/variants/mau-nau-go/variant-287-02-dcb242fc41.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359997/SonaSpace/Product/tham-dau-truong/variants/mau-nau-go/variant-287-03-10702e92d8.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358197/SonaSpace/Product/tham-dau-truong/variants/mau-nau-go/variant-287-04-ec3f16d546.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358199/SonaSpace/Product/tham-dau-truong/variants/mau-nau-go/variant-287-05-5c3f337755.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358200/SonaSpace/Product/tham-dau-truong/variants/mau-nau-go/variant-287-06-cf7b75936e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358201/SonaSpace/Product/tham-dau-truong/variants/mau-nau-go/variant-287-07-c8a77b25d8.webp'),
(288, 149, 14, 70, '40000000.00', NULL, 'mau-xanh-son-mai', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360005/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xanh-son-mai/variant-288-01-a1a1937ac4.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360006/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xanh-son-mai/variant-288-02-ec2af16513.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360007/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xanh-son-mai/variant-288-03-5effeef819.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360008/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xanh-son-mai/variant-288-04-38d928c3c5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358202/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xanh-son-mai/variant-288-05-40d9c454ec.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358203/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xanh-son-mai/variant-288-06-442c06f540.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358204/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xanh-son-mai/variant-288-07-40d9c454ec.webp'),
(289, 149, 2, 50, '40000000.00', NULL, 'mau-xam-tro-mo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360013/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xam-tro-mo/variant-289-01-dfabe94f88.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360014/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xam-tro-mo/variant-289-02-556e2cc184.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360015/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xam-tro-mo/variant-289-03-f41569ee16.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360016/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xam-tro-mo/variant-289-04-018fc9d153.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358205/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xam-tro-mo/variant-289-05-40d9c454ec.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358206/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xam-tro-mo/variant-289-06-442c06f540.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358207/SonaSpace/Product/ghe-sofa-cancun-lounge/variants/mau-xam-tro-mo/variant-289-07-40d9c454ec.webp'),
(290, 150, 2, 50, '19000000.00', NULL, 'mau-xam-tro-mo', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360023/SonaSpace/Product/ghe-an-cancun/variants/mau-xam-tro-mo/variant-290-01-cee3034416.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360024/SonaSpace/Product/ghe-an-cancun/variants/mau-xam-tro-mo/variant-290-02-7485bb0ff1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360025/SonaSpace/Product/ghe-an-cancun/variants/mau-xam-tro-mo/variant-290-03-ac5682e8d0.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360026/SonaSpace/Product/ghe-an-cancun/variants/mau-xam-tro-mo/variant-290-04-9ddb33c9ec.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358208/SonaSpace/Product/ghe-an-cancun/variants/mau-xam-tro-mo/variant-290-05-d10791db9b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358209/SonaSpace/Product/ghe-an-cancun/variants/mau-xam-tro-mo/variant-290-06-446bbd44c6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358210/SonaSpace/Product/ghe-an-cancun/variants/mau-xam-tro-mo/variant-290-07-1abc3095ab.webp'),
(291, 150, 14, 50, '19000000.00', NULL, 'mau-xanh-son-mai', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360031/SonaSpace/Product/ghe-an-cancun/variants/mau-xanh-son-mai/variant-291-01-a64b42456e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360032/SonaSpace/Product/ghe-an-cancun/variants/mau-xanh-son-mai/variant-291-02-6dd1a4ff9f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360033/SonaSpace/Product/ghe-an-cancun/variants/mau-xanh-son-mai/variant-291-03-19f3816cb2.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360034/SonaSpace/Product/ghe-an-cancun/variants/mau-xanh-son-mai/variant-291-04-f0e8a7a295.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358211/SonaSpace/Product/ghe-an-cancun/variants/mau-xanh-son-mai/variant-291-05-d10791db9b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358212/SonaSpace/Product/ghe-an-cancun/variants/mau-xanh-son-mai/variant-291-06-446bbd44c6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358214/SonaSpace/Product/ghe-an-cancun/variants/mau-xanh-son-mai/variant-291-07-1abc3095ab.webp'),
(292, 151, 10, 80, '22000000.00', NULL, 'mau-xanh-son-mai', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360040/SonaSpace/Product/ban-phu-cancun/variants/mau-xanh-son-mai/variant-292-01-44d130618e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360042/SonaSpace/Product/ban-phu-cancun/variants/mau-xanh-son-mai/variant-292-02-78e3bbe4a5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358215/SonaSpace/Product/ban-phu-cancun/variants/mau-xanh-son-mai/variant-292-03-442c06f540.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358216/SonaSpace/Product/ban-phu-cancun/variants/mau-xanh-son-mai/variant-292-04-a9eeb52370.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358217/SonaSpace/Product/ban-phu-cancun/variants/mau-xanh-son-mai/variant-292-05-145df901d1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358218/SonaSpace/Product/ban-phu-cancun/variants/mau-xanh-son-mai/variant-292-06-6a2cc00c28.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358220/SonaSpace/Product/ban-phu-cancun/variants/mau-xanh-son-mai/variant-292-07-442c06f540.webp'),
(293, 151, 2, 70, '99999999.99', NULL, 'mau-xam-tro', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360049/SonaSpace/Product/ban-phu-cancun/variants/mau-xam-tro/variant-293-01-1cc00d20cd.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360050/SonaSpace/Product/ban-phu-cancun/variants/mau-xam-tro/variant-293-02-c1c6d45889.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358221/SonaSpace/Product/ban-phu-cancun/variants/mau-xam-tro/variant-293-03-442c06f540.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358222/SonaSpace/Product/ban-phu-cancun/variants/mau-xam-tro/variant-293-04-a9eeb52370.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358223/SonaSpace/Product/ban-phu-cancun/variants/mau-xam-tro/variant-293-05-145df901d1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358224/SonaSpace/Product/ban-phu-cancun/variants/mau-xam-tro/variant-293-06-6a2cc00c28.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358225/SonaSpace/Product/ban-phu-cancun/variants/mau-xam-tro/variant-293-07-442c06f540.webp'),
(294, 152, 6, 79, '8000000.00', NULL, 'mau-trang-khoi', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360059/SonaSpace/Product/binh-mua/variants/mau-trang-khoi/variant-294-01-b1a16f8b59.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360060/SonaSpace/Product/binh-mua/variants/mau-trang-khoi/variant-294-02-544e59d0e7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358227/SonaSpace/Product/binh-mua/variants/mau-trang-khoi/variant-294-03-ec44ddf85c.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358228/SonaSpace/Product/binh-mua/variants/mau-trang-khoi/variant-294-04-5236398170.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358229/SonaSpace/Product/binh-mua/variants/mau-trang-khoi/variant-294-05-4a22884a1f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358230/SonaSpace/Product/binh-mua/variants/mau-trang-khoi/variant-294-06-ec0f1cd82a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358231/SonaSpace/Product/binh-mua/variants/mau-trang-khoi/variant-294-07-a3782a6ef4.webp'),
(295, 153, 1, 60, '8000000.00', '7000000.00', 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360070/SonaSpace/Product/binh-phao/variants/mau-be/variant-295-01-fdd4ebfb1e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360071/SonaSpace/Product/binh-phao/variants/mau-be/variant-295-02-9bfdc36132.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358232/SonaSpace/Product/binh-phao/variants/mau-be/variant-295-03-b466f3f6f1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358233/SonaSpace/Product/binh-phao/variants/mau-be/variant-295-04-13c02e0bf4.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358235/SonaSpace/Product/binh-phao/variants/mau-be/variant-295-05-17433fdb66.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358235/SonaSpace/Product/binh-phao/variants/mau-be/variant-295-06-db6c1e21e9.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358236/SonaSpace/Product/binh-phao/variants/mau-be/variant-295-07-3cd5fdf2fa.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358238/SonaSpace/Product/binh-phao/variants/mau-be/variant-295-08-18cebebe63.webp'),
(296, 154, 25, 80, '10000000.00', '8500000.00', 'mau-nau-nhat', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360082/SonaSpace/Product/binh-bong-bong/variants/mau-nau-nhat/variant-296-01-e9aabe2b89.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360083/SonaSpace/Product/binh-bong-bong/variants/mau-nau-nhat/variant-296-02-22f927b5a7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360084/SonaSpace/Product/binh-bong-bong/variants/mau-nau-nhat/variant-296-03-bdd26b7533.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358239/SonaSpace/Product/binh-bong-bong/variants/mau-nau-nhat/variant-296-04-42ebbcec93.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358240/SonaSpace/Product/binh-bong-bong/variants/mau-nau-nhat/variant-296-05-feae6971ba.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358241/SonaSpace/Product/binh-bong-bong/variants/mau-nau-nhat/variant-296-06-7801192407.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358243/SonaSpace/Product/binh-bong-bong/variants/mau-nau-nhat/variant-296-07-0ad453dbf6.webp'),
(297, 155, 2, 50, '50000000.00', NULL, 'mau-xam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360093/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam/variant-297-01-98b2fb6ab2.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360094/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam/variant-297-02-f6876d3965.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360095/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam/variant-297-03-c3675d24a6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360096/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam/variant-297-04-03f78b1e5f.jpg,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358244/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam/variant-297-05-dd5d7ffba7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358245/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam/variant-297-06-4cb0e27c9b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358246/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam/variant-297-07-b6b2fb4f44.webp'),
(298, 155, 2, 70, '55000000.00', NULL, 'mau-xam-khoi', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360100/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam-khoi/variant-298-01-7c19d780fe.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360101/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam-khoi/variant-298-02-151e08426a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360102/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam-khoi/variant-298-03-4e8e08f7ab.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360103/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam-khoi/variant-298-04-03f78b1e5f.jpg,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358247/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam-khoi/variant-298-05-dd5d7ffba7.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358248/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam-khoi/variant-298-06-4cb0e27c9b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358249/SonaSpace/Product/giuong-lugano-storage/variants/mau-xam-khoi/variant-298-07-b6b2fb4f44.webp'),
(299, 156, 2, 50, '40000000.00', '38000000.00', 'mau-xam-dam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360109/SonaSpace/Product/guong-funsion-day/variants/mau-xam-dam/variant-299-01-e5b6c4ae46.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360110/SonaSpace/Product/guong-funsion-day/variants/mau-xam-dam/variant-299-02-fc3d165e5f.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360111/SonaSpace/Product/guong-funsion-day/variants/mau-xam-dam/variant-299-03-f120d59898.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360112/SonaSpace/Product/guong-funsion-day/variants/mau-xam-dam/variant-299-04-ef81143894.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358250/SonaSpace/Product/guong-funsion-day/variants/mau-xam-dam/variant-299-05-5d392f40f0.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358252/SonaSpace/Product/guong-funsion-day/variants/mau-xam-dam/variant-299-06-43e3963e4a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358253/SonaSpace/Product/guong-funsion-day/variants/mau-xam-dam/variant-299-07-38a2e79c1e.webp'),
(300, 156, 14, 70, '45000000.00', NULL, 'mau-xanh-la-cay', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360117/SonaSpace/Product/guong-funsion-day/variants/mau-xanh-la-cay/variant-300-01-e9c754c08d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360118/SonaSpace/Product/guong-funsion-day/variants/mau-xanh-la-cay/variant-300-02-7d1f05145b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360120/SonaSpace/Product/guong-funsion-day/variants/mau-xanh-la-cay/variant-300-03-4f45f260d8.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358254/SonaSpace/Product/guong-funsion-day/variants/mau-xanh-la-cay/variant-300-04-ed03e377e1.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358255/SonaSpace/Product/guong-funsion-day/variants/mau-xanh-la-cay/variant-300-05-43e3963e4a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358256/SonaSpace/Product/guong-funsion-day/variants/mau-xanh-la-cay/variant-300-06-38a2e79c1e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358257/SonaSpace/Product/guong-funsion-day/variants/mau-xanh-la-cay/variant-300-07-53c637d51b.webp'),
(301, 157, 2, 50, '45000000.00', '0.00', 'mau-xam-dam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360128/SonaSpace/Product/giuong-arlingtn/variants/mau-xam-dam/variant-301-01-0297f7a73e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360129/SonaSpace/Product/giuong-arlingtn/variants/mau-xam-dam/variant-301-02-aede158534.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360130/SonaSpace/Product/giuong-arlingtn/variants/mau-xam-dam/variant-301-03-57836152d9.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358258/SonaSpace/Product/giuong-arlingtn/variants/mau-xam-dam/variant-301-04-9c7f401229.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358259/SonaSpace/Product/giuong-arlingtn/variants/mau-xam-dam/variant-301-05-79e5ad5c5e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358260/SonaSpace/Product/giuong-arlingtn/variants/mau-xam-dam/variant-301-06-bdd71b0d3a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358261/SonaSpace/Product/giuong-arlingtn/variants/mau-xam-dam/variant-301-07-bdd71b0d3a.webp'),
(302, 157, 25, 70, '45000000.00', NULL, 'mau-nau-dat', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360135/SonaSpace/Product/giuong-arlingtn/variants/mau-nau-dat/variant-302-01-9318aac2c5.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360137/SonaSpace/Product/giuong-arlingtn/variants/mau-nau-dat/variant-302-02-b06206e197.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783360138/SonaSpace/Product/giuong-arlingtn/variants/mau-nau-dat/variant-302-03-cbd3b8ba4d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358263/SonaSpace/Product/giuong-arlingtn/variants/mau-nau-dat/variant-302-04-9c7f401229.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358264/SonaSpace/Product/giuong-arlingtn/variants/mau-nau-dat/variant-302-05-79e5ad5c5e.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358265/SonaSpace/Product/giuong-arlingtn/variants/mau-nau-dat/variant-302-06-bdd71b0d3a.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358266/SonaSpace/Product/giuong-arlingtn/variants/mau-nau-dat/variant-302-07-bdd71b0d3a.webp'),
(326, 134, 2, 53, '25000000.00', '24000000.00', 'mau-xam-tro', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359752/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-xam-tro/variant-326-01-4f20aeb3f6.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359753/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-xam-tro/variant-326-02-c6faa8b84d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359754/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-xam-tro/variant-326-03-306b47391d.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359755/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-xam-tro/variant-326-04-975b52d1bd.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359756/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-xam-tro/variant-326-05-b89f800a27.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358085/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-xam-tro/variant-326-06-7d72337aa9.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358086/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-xam-tro/variant-326-07-ad16eb599e.webp'),
(327, 134, 8, 68, '30000000.00', '0.00', 'mau-soi-sam', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359760/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-soi-sam/variant-327-01-7bacdd8aa8.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359761/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-soi-sam/variant-327-02-59d992550b.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359762/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-soi-sam/variant-327-03-f11ad6aa43.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359763/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-soi-sam/variant-327-04-fd8bd60bae.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783359764/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-soi-sam/variant-327-05-269a257d06.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358088/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-soi-sam/variant-327-06-7d72337aa9.webp,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358089/SonaSpace/Product/ban-ca-phe-chuc-nang-chiva/variants/mau-soi-sam/variant-327-07-dd82648d71.webp'),
(440, 196, 8, 0, '444.00', '0.00', 'mau-go', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358269/SonaSpace/Product/ghe-test/variants/mau-go/variant-440-01-fb3ee283e4.webp'),
(466, 196, 9, 0, '2.00', '0.00', 'mau-kinh', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358270/SonaSpace/Product/ghe-test/variants/mau-kinh/variant-466-01-3e25e25056.webp'),
(491, 208, 1, 12, '12000000.00', NULL, 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358272/SonaSpace/Product/cua-go/variants/mau-be/variant-491-01-3cc984c661.jpg,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358274/SonaSpace/Product/cua-go/variants/mau-be/variant-491-02-6df0bc84f4.jpg'),
(514, 220, 1, 0, '55.00', '0.00', 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358276/SonaSpace/Product/fgsghg/variants/mau-be/variant-514-01-28b0d2d8c1.jpg,https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358277/SonaSpace/Product/fgsghg/variants/mau-be/variant-514-02-61b5cf0d8b.jpg'),
(524, 226, 50, 0, '19000000.00', '500000.00', 'xanh-navy', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358279/SonaSpace/Product/ghe-cong-thai-hoc/variants/xanh-navy/variant-524-01-7552919147.png'),
(525, 226, 1, 3, '3333.00', '3333.00', 'mau-be', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358280/SonaSpace/Product/ghe-cong-thai-hoc/variants/mau-be/variant-525-01-022fa4a9d2.jpg'),
(526, 226, 19, 2, '22.00', '2.00', 'mau-den', 'https://res.cloudinary.com/dmgrdgvcf/image/upload/v1783358281/SonaSpace/Product/ghe-cong-thai-hoc/variants/mau-den/variant-526-01-6144fd1711.jpg');
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
