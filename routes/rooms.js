const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;
/**
 * @route   GET /api/rooms
 * @desc    Lấy danh sách phòng
 * @access  Public
 */
router.get("/", async (req, res) => {
	try {
		const { rows } = await db.query(`
      SELECT 
        r.*, 
        (SELECT COUNT(*) FROM room_product rp WHERE rp.room_id = r.room_id) as product_count
      FROM room r where r.status = 1
      ORDER BY r.room_name ASC
    `);

		res.json(rows);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch rooms" });
	}
});

/**
 * @route   GET /api/rooms/admin
 * @desc    Lấy danh sách phòng
 * @access  Public
 */
router.get("/admin", verifyToken, isAdmin, async (req, res) => {
	try {
		const { rows } = await db.query(`
      SELECT 
        r.*, 
        (SELECT COUNT(*) FROM room_product rp WHERE rp.room_id = r.room_id) as product_count
      FROM room r
      ORDER BY r.room_name ASC
    `);

		res.json(rows);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch rooms" });
	}
});

/**
 * @route   GET /filter/rooms
 * @desc    Lấy danh sách phòng
 * @access  Public
 */
router.get("/filter/", async (req, res) => {
	const { rows } = await db.query(`
    SELECT room_id, room_name, slug
    FROM room
    WHERE deleted_at IS NULL
  `);
	res.json(rows);
});

router.get("/products", async (req, res) => {
	try {
		const { rows: products } = await db.query(`
      SELECT
        p.product_id,
        p.product_name,
        vp.variant_id,
        vp.color_id,
        vp.variant_product_price AS price,
        vp.variant_product_price_sale AS price_sale,
        vp.variant_product_quantity AS quantity,
        vp.variant_product_slug AS slug,
        vp.variant_product_list_image AS list_image
      FROM product p
      LEFT JOIN (
          SELECT *
          FROM variant_product v1
          WHERE v1.variant_id = (
              SELECT MIN(v2.variant_id)
              FROM variant_product v2
              WHERE v2.product_id = v1.product_id
          )
      ) vp ON vp.product_id = p.product_id
      ORDER BY p.product_id
    `);

		const result = products.map((v) => ({
			product_id: v.product_id,
			product_name: v.product_name,
			variant_id: v.variant_id,
			color_id: v.color_id,
			price: v.price,
			price_sale: v.price_sale,
			quantity: v.quantity,
			slug: v.slug,
			first_image: v.list_image
				? v.list_image
						.split(",")[0]
						.trim()
						.replace(/^['"]+|['"]+$/g, "")
				: null,
		}));

		res.json(result);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch products" });
	}
});

/**
 * @route   GET /api/rooms/:slug
 * @desc    Lấy thông tin một phòng
 * @access  Public
 */
router.get("/:slug", async (req, res) => {
	try {
		const slug = req.params.slug;
		if (!slug) {
			return res.status(400).json({ error: "Invalid room slug" });
		}

		const { rows } = await db.query(
			`
       SELECT 
        r.*,
        COUNT(rp.product_id) as product_count
      FROM room r
      LEFT JOIN room_product rp ON r.room_id = rp.room_id
      WHERE r.slug = $1
      GROUP BY r.room_id
    `,
			[slug],
		);

		if (rows.length === 0) {
			return res.status(404).json({ error: "Room not found" });
		}

		res.json(rows[0]);
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch room" });
	}
});

/**
 * @route   POST /api/rooms
 * @desc    Tạo phòng mới
 * @access  Private (Admin only)
 */
// verifyToken, isAdmin,
router.post("/", async (req, res) => {
	try {
		const { name, description, banner, image, slug, status } = req.body;

		if (!name || !slug) {
			return res.status(400).json({ error: "Room name and slug are required" });
		}

		if (!image) {
			return res.status(400).json({ error: "Không thể upload phòng không có hình ảnh phòng" });
		}

		if (!banner) {
			return res.status(400).json({ error: "Không thể upload phòng không có hình ảnh banner" });
		}

		// Kiểm tra tên phòng đã tồn tại chưa
		const { rows: existingRooms } = await db.query("SELECT room_id FROM room WHERE room_name = $1 AND slug = $2", [name, slug]);

		if (existingRooms.length > 0) {
			return res.status(400).json({ error: "Room name already exists" });
		}

		const { rows: insertResult } = await db.query(
			"INSERT INTO room (room_name, room_description, room_image, room_banner, status, slug, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *",
			[name, description || null, image || null, banner || null, status ?? 0, slug],
		);

		res.status(201).json({
			message: "Room created successfully",
			room: insertResult[0],
		});
	} catch (error) {
		res.status(500).json({ error: "Failed to create room" });
	}
});

/**
 * @route   PUT /api/rooms/:slug
 * @desc    Cập nhật thông tin phòng
 * @access  Private (Admin only)
 */
// verifyToken, isAdmin,
router.put("/:slug", verifyToken, isAdmin, async (req, res) => {
	const slug = req.params.slug;
	if (!slug) return res.status(400).json({ message: "Slug is required" });

	try {
		const { name, image, banner, priority, status } = req.body;

		// 1. Kiểm tra room tồn tại
		const { rows: oldData } = await db.query("SELECT room_id, room_image, room_banner FROM room WHERE slug = $1", [slug]);
		if (!oldData.length) {
			return res.status(404).json({ error: "Room not found" });
		}

		const roomId = oldData[0].room_id;
		const oldImage = oldData[0].room_image;
		const oldBanner = oldData[0].room_banner;

		// 2. Kiểm tra tên mới có trùng không
		if (name) {
			const { rows: duplicateName } = await db.query("SELECT room_id FROM room WHERE room_name = $1 AND slug != $2", [name, slug]);
			if (duplicateName.length > 0) {
				return res.status(400).json({ error: "Room name already exists" });
			}
		}

		// 3. Hàm xóa ảnh cũ nếu cần
		const deleteFromCloudinary = async (url) => {
			if (!url) return;
			const publicId = url
				.split("/")
				.slice(7)
				.join("/")
				.replace(/\.(jpg|jpeg|png|webp)$/i, "");
			await cloudinary.uploader.destroy(publicId);
		};

		if (image && image !== oldImage) {
			await deleteFromCloudinary(oldImage);
		}

		if (banner && banner !== oldBanner) {
			await deleteFromCloudinary(oldBanner);
		}

		// 4. Cập nhật room
		const { rows: updatedRoom } = await db.query(
			`
      UPDATE room 
      SET 
        room_name = COALESCE($1, room_name),
        room_image = COALESCE($2, room_image),
        room_banner = COALESCE($3, room_banner),
        room_priority = COALESCE($4, room_priority),
        status = COALESCE($5, status),
        updated_at = NOW()
      WHERE slug = $6
      RETURNING *
      `,
			[name || null, image || null, banner || null, priority || 0, status ?? 1, slug],
		);

		res.json({
			message: "Room updated successfully",
			room: updatedRoom[0],
		});
	} catch (error) {
		res.status(500).json({ error: "Failed to update room" });
	}
});

/**
 * @route   DELETE /api/rooms/:slug
 * @desc    Xóa phòng
 * @access  Private (Admin only)
 */
// verifyToken, isAdmin,
router.delete("/:slug", verifyToken, isAdmin, async (req, res) => {
	const slug = req.params.slug;
	// Kiểm tra phòng tồn tại
	if (!slug) {
		return res.status(400).json({ error: "Invalid room slug" });
	}
	try {
		const { rows: roomData } = await db.query("SELECT room_id, room_image, room_banner FROM room WHERE slug = $1", [slug]);

		if (!roomData.length) {
			return res.status(404).json({ error: "Room not found" });
		}

		const { room_id, room_image, room_banner } = roomData[0];

		const deleteFromCloudinary = async (url) => {
			if (!url) return;
			const publicId = url
				.split("/")
				.slice(7)
				.join("/")
				.replace(/\.(jpg|jpeg|png|webp)$/i, "");
			await cloudinary.uploader.destroy(publicId);
		};

		// Xóa ảnh phòng từ Cloudinary
		await deleteFromCloudinary(room_image);
		await deleteFromCloudinary(room_banner);

		// Xóa các liên kết với sản phẩm
		await db.query("DELETE FROM room_product WHERE room_id = $1", [room_id]);

		// Xóa phòng
		await db.query("DELETE FROM room WHERE room_id = $1", [room_id]);

		res.json({ message: "Room deleted successfully" });
	} catch (error) {
		res.status(500).json({ error: "Failed to delete room" });
	}
});

/**
 * @route   GET /api/rooms/:id/products
 * @desc    Lấy danh sách sản phẩm trong phòng
 * @access  Public
 */
router.get("/:slug/products", async (req, res) => {
	try {
		const slug = req.params.slug;
		if (!slug) {
			return res.status(400).json({ error: "Invalid room slug" });
		}

		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 8;
		const offset = (page - 1) * limit;

		// Kiểm tra phòng tồn tại và lấy room_id
		const { rows: roomRows } = await db.query("SELECT room_id, room_name FROM room WHERE slug = $1", [slug]);

		if (roomRows.length === 0) {
			return res.status(404).json({ error: "Room not found" });
		}

		const room = roomRows[0];
		const roomId = room.room_id;

		// Đếm tổng sản phẩm trong phòng
		const { rows: countResult } = await db.query(
			`SELECT COUNT(*) as total
       FROM room_product rp
       JOIN product p ON rp.product_id = p.product_id
       WHERE rp.room_id = $1`,
			[roomId],
		);

		const totalProducts = countResult[0].total;
		const totalPages = Math.ceil(totalProducts / limit);

		// Truy vấn danh sách sản phẩm
		const { rows: products } = await db.query(
			`SELECT 
        p.product_id AS id,
        p.product_name AS name,
        p.product_slug AS slug,
        p.product_image AS image,
        p.category_id,
        cat.category_name,
        p.created_at,
        p.updated_at,

        (
          SELECT vp2.variant_product_price
          FROM variant_product vp2
          WHERE vp2.product_id = p.product_id
          ORDER BY vp2.variant_id ASC
          LIMIT 1
        ) AS price,

        (
          SELECT vp2.variant_product_price_sale
          FROM variant_product vp2
          WHERE vp2.product_id = p.product_id
          ORDER BY vp2.variant_id ASC
          LIMIT 1
        ) AS price_sale,

        COALESCE(json_agg(DISTINCT col.color_hex) FILTER (WHERE col.color_hex IS NOT NULL), '[]') AS color_hex

      FROM room_product rp
      JOIN product p ON rp.product_id = p.product_id
      LEFT JOIN variant_product vp ON p.product_id = vp.product_id
      LEFT JOIN color col ON vp.color_id = col.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id

      WHERE rp.room_id = $1
      GROUP BY p.product_id, cat.category_name
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
      `,
			[roomId, limit, offset],
		);

		const transformedProducts = products.map((product) => ({
			id: product.id,
			name: product.name,
			slug: product.slug,
			image: product.image,
			category_id: product.category_id,
			category_name: product.category_name,
			created_at: product.created_at,
			updated_at: product.updated_at,
			price: product.price ?? "0.00", // giữ nguyên định dạng chuỗi
			price_sale: product.price_sale ?? "0.00",
			color_hex: product.color_hex || [],
		}));

		res.json({
			room,
			products: transformedProducts,
			pagination: {
				currentPage: page,
				totalPages,
				totalProducts,
				productsPerPage: limit,
			},
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to fetch room products" });
	}
});

/**
 * @route   POST /api/rooms/:id/products
 * @desc    Thêm sản phẩm vào phòng
 * @access  Private (Admin only)
 * Chưa làm trường hợp nếu sản phẩm đã tồn tại trong phòng thì không thêm vào
 * /admin
 */
router.post("/:slug/products", verifyToken, isAdmin, async (req, res) => {
	try {
		const slug = req.params.slug;
		const { product_ids } = req.body;

		if (!slug) {
			return res.status(400).json({ error: "Invalid room slug" });
		}

		if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
			return res.status(400).json({ error: "Product IDs array is required" });
		}

		// Lấy room_id từ slug
		const { rows: roomRows } = await db.query("SELECT room_id FROM room WHERE slug = $1", [slug]);

		if (roomRows.length === 0) {
			return res.status(404).json({ error: "Room not found" });
		}

		const roomId = roomRows[0].room_id;

		// Thêm từng sản phẩm vào phòng
		const addedProducts = [];
		const existingProducts = [];
		const invalidProducts = [];

		for (const productId of product_ids) {
			// Kiểm tra sản phẩm tồn tại
			const { rows: productRows } = await db.query("SELECT product_id FROM product WHERE product_id = $1", [productId]);
			if (productRows.length === 0) {
				invalidProducts.push(productId);
				continue;
			}

			// Kiểm tra nếu đã tồn tại
			const { rows: existing } = await db.query("SELECT 1 FROM room_product WHERE room_id = $1 AND product_id = $2", [roomId, productId]);

			if (existing.length > 0) {
				existingProducts.push(productId);
				continue;
			}

			// Thêm vào room_product
			await db.query("INSERT INTO room_product (room_id, product_id) VALUES ($1, $2)", [roomId, productId]);

			addedProducts.push(productId);
		}

		if (addedProducts.length === 0) {
			return res.status(400).json({
				error: "No products added. All are invalid or already exist in the room.",
				existing_products: existingProducts,
				invalid_products: invalidProducts,
			});
		}

		res.json({
			message: "Products added to room successfully",
			added_count: addedProducts.length,
			added_products: addedProducts,
			existing_products: existingProducts,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to add products to room" });
	}
});

/**
 * @route   DELETE /api/rooms/:roomId/products/:productId
 * @desc    Xóa sản phẩm khỏi phòng
 * @access  Private (Admin only)
 */
router.delete("/:slug/products/:productId", verifyToken, isAdmin, async (req, res) => {
	try {
		const slug = req.params.slug;
		const productId = Number(req.params.productId);

		if (!slug || isNaN(productId)) {
			return res.status(400).json({ error: "Invalid room slug or product ID" });
		}

		// Lấy room_id từ slug
		const { rows: roomRows } = await db.query("SELECT room_id FROM room WHERE slug = $1", [slug]);

		if (roomRows.length === 0) {
			return res.status(404).json({ error: "Room not found" });
		}

		const roomId = roomRows[0].room_id;

		// Kiểm tra liên kết tồn tại
		const { rows: existing } = await db.query("SELECT * FROM room_product WHERE room_id = $1 AND product_id = $2", [roomId, productId]);

		if (existing.length === 0) {
			return res.status(404).json({ error: "Product not found in room" });
		}

		// Xóa liên kết
		await db.query("DELETE FROM room_product WHERE room_id = $1 AND product_id = $2", [roomId, productId]);

		res.json({ message: "Product removed from room successfully" });
	} catch (error) {
		res.status(500).json({ error: "Failed to remove product from room" });
	}
});

/**
 * @route   GET /api/rooms/by-product/:slug
 * @desc    Lấy danh sách phòng theo sản phẩm
 * @access  Public
 */
router.get("/by-product/:slug", async (req, res) => {
	const slug = req.params.slug;
	if (!slug) return res.status(400).json({ error: "Missing product slug" });
	try {
		const { rows } = await db.query(
			`
      SELECT DISTINCT r.room_id, r.room_name, r.slug
FROM room r
JOIN room_product rp ON r.room_id = rp.room_id
JOIN product p ON rp.product_id = p.product_id
WHERE p.product_slug = $1
    `,
			[slug],
		);
		res.json(rows);
	} catch (err) {
		res.status(500).json({ error: "Failed to fetch rooms by product" });
	}
});

module.exports = router;
