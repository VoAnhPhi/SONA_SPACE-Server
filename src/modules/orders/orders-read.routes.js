"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin, optionalAuth } = require("../../shared/middleware/auth");
const db = require("../../config/database");
const asyncHandler = require("../../shared/http/async-handler");
const { getOrderDetail } = require("./order-detail.service");
const { ORDER_STATUS_KEY_TO_CODE, toLegacyOrderStatus } = require("./order-status.constants");

/**
 * @route   GET /api/orders/count
 * @desc    Lấy số lượng đơn hàng theo trạng thái (chỉ admin)
 * @access  Private (Admin)
 */

router.get("/complete/:orderHash", optionalAuth, async (req, res) => {
  const { orderHash } = req.params;
  console.log(" Truy vấn đơn hàng:", orderHash);

  try {
    const { rows } = await db.query(
      `
      SELECT 
        o.order_id,
        o.order_hash,
        o.created_at,
        o.order_final_total AS order_total_final,
        (
          SELECT SUM(oi.quantity)
          FROM order_items oi
          WHERE oi.order_id = o.order_id
        ) AS total_quantity
      FROM orders o
      WHERE o.order_hash = $1
    `,
      [orderHash]
    );
    const order = rows[0];

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    return res.status(200).json({
      success: true,
      order: {
        order_id: order.order_id,
        order_hash: order.order_hash,
        created_at: order.created_at,
        order_total_final: order.order_total_final,
        total_quantity: order.total_quantity || 0,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy thông tin đơn hàng:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
});


router.get("/hash/:orderHash", optionalAuth, async (req, res) => {
  const { orderHash } = req.params;

  try {
    const { rows: orderRows } = await db.query(
      `
      SELECT   
        o.order_id,
        o.order_hash,
        o.created_at,
        o.order_status,
        o.order_total,
        o.order_final_total AS order_total_final,
        o.order_shipping_fee AS shipping_fee,
        o.order_discount,
        o.user_id,
        o.order_name AS order_name_new,
        o.order_email AS order_email_new,
        o.order_address AS order_address_new,
        o.order_phone AS order_number2,
        NULL::TEXT AS order_address_old,
        NULL::TEXT AS order_number1,
        u.user_name AS order_name_old,
        u.user_gmail AS order_email_old,
        cc.couponcode_code AS coupon_code,
        COALESCE(cc.couponcode_amount, cc.couponcode_percent::DECIMAL) AS coupon_value,
        p.payment_status AS payment_status
        
      FROM orders o
      LEFT JOIN "user" u ON o.user_id = u.user_id
      LEFT JOIN couponcode cc ON o.couponcode_id = cc.couponcode_id
      LEFT JOIN payments p ON o.payment_id = p.payment_id
      WHERE o.order_hash = $1
    `,
      [orderHash]
    );
    const order = orderRows[0];

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    // Lấy thông tin hủy/trả đơn hàng từ bảng order_returns nếu đơn hàng có trạng thái CANCELLED hoặc RETURN
    let returnInfo = null;
    const currentStatus = toLegacyOrderStatus(order.order_status);
    if (currentStatus === "CANCELLED" || currentStatus === "RETURN") {
      const { rows: orderReturns } = await db.query(
        `
        SELECT 
          return_id,
          return_reason AS reason,
          return_refund_method AS return_type,
          return_total AS total_refund,
          return_status,
          created_at as return_created_at,
          updated_at as return_updated_at
        FROM order_returns 
        WHERE order_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [order.order_id]
      );

      if (orderReturns.length > 0) {
        returnInfo = orderReturns[0];
      }
    }

    const { rows: items } = await db.query(
      `
      SELECT 
        oi.order_item_id AS id,
        oi.quantity,
        vp.variant_id,
        COALESCE(vp.variant_product_price, 0) AS price,
        COALESCE(vp.variant_product_price_sale, vp.variant_product_price, 0) AS price_sale,
        vp.variant_product_list_image AS image,
        c.color_name,
        c.color_code AS color_hex,
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_image AS product_image,
        cat.category_name AS category,
        (
          SELECT COUNT(*)
          FROM comment cmt
          JOIN order_items oi_cmt ON cmt.order_item_id = oi_cmt.order_item_id
          JOIN variant_product vp_cmt ON oi_cmt.variant_id = vp_cmt.variant_id
          WHERE vp_cmt.product_id = p.product_id
        ) AS comment_count,
        (
          SELECT AVG(cmt.comment_rating)
          FROM comment cmt
          JOIN order_items oi_cmt ON cmt.order_item_id = oi_cmt.order_item_id
          JOIN variant_product vp_cmt ON oi_cmt.variant_id = vp_cmt.variant_id
          WHERE vp_cmt.product_id = p.product_id
        ) AS average_rating,
        CASE WHEN oi.comment_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_comment
      FROM order_items oi
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      WHERE oi.order_id = $1
    `,
      [order.order_id]
    );

    const statusStepMap = {
      // Quy trình đặt hàng thành công
      PENDING: 1,
      APPROVED: 2,
      CONFIRMED: 2, // Tương đương với APPROVED
      SHIPPING: 3,
      COMPLETED: 4,
      SUCCESS: 4, // Tương đương với COMPLETED

      // Quy trình hủy đơn hàng (từ bảng order_returns)
      CANCEL_REQUESTED: 1, // Khách hàng yêu cầu hủy
      CANCEL_PENDING: 2, // Đang chờ xử lý hủy
      CANCEL_CONFIRMED: 3, // Xác nhận hủy
      CANCELLED: 4, // Đã hủy hoàn tất

      // Quy trình trả hàng
      RETURN: 4, // Đã trả hàng hoàn tất

      // Quy trình từ chối/thất bại
      REJECTED: 4, // Đơn hàng bị từ chối - trạng thái cuối
      FAILED: 1, // Đơn hàng thất bại
    };

    // Xác định loại quy trình và step dựa trên trạng thái
    let processType = "normal"; // Quy trình bình thường
    let actualStatus = currentStatus;
    let statusStep = statusStepMap[currentStatus] || 1;

    // Kiểm tra xem đơn hàng có trong bảng order_returns không
    if (
      (currentStatus === "CANCELLED" || currentStatus === "RETURN") &&
      returnInfo
    ) {
      if (currentStatus === "CANCELLED") {
        processType = "cancellation";
      } else if (currentStatus === "RETURN") {
        processType = "return";
      }
      actualStatus = String(returnInfo.return_status);
      statusStep =
        statusStepMap[String(returnInfo.return_status)] ||
        statusStepMap[currentStatus] ||
        4;
    } else if (["REJECTED", "FAILED"].includes(currentStatus)) {
      processType = "failed";
    }

    const cleanPrice = (value) => {
      if (!value) return 0;
      return Number(value) || 0;
    };

    const firstImageUrl = (value) => {
      if (Array.isArray(value)) {
        return value.find((image) => String(image || '').trim()) || '/images/default.jpg';
      }

      return String(value || '')
        .split(',')
        .map((image) => image.trim())
        .find(Boolean) || '/images/default.jpg';
    };

    // Ưu tiên thông tin mới nếu có, fallback về thông tin cũ
    const recipientName =
      order.order_name_new?.trim() ||
      order.order_name_old?.trim() ||
      "Khách hàng";
    const recipientEmail =
      order.order_email_new?.trim() || order.order_email_old?.trim() || "";
    const recipientPhone =
      order.order_number2?.trim() || order.order_number1?.trim() || "";
    const recipientAddress =
      order.order_address_new?.trim() || order.order_address_old?.trim() || "";

    const orderData = {
      id: order.order_id,
      order_hash: order.order_hash,
      date: order.created_at,
      status: currentStatus,
      statusStep,
      processType, // Thêm thông tin loại quy trình
      couponCode: order.coupon_code || "",
      couponValue: order.coupon_value || "",
      recipientName,
      recipientEmail,
      recipientPhone,
      address: recipientAddress,
      order_name_old: order.order_name_old || "",
      order_name_new: order.order_name_new || "",
      order_email_old: order.order_email_old || "",
      order_email_new: order.order_email_new || "",
      order_address_old: order.order_address_old || "",
      order_address_new: order.order_address_new || "",
      order_number1: order.order_number1 || "",
      order_number2: order.order_number2 || "",
      paymentStatus: order.payment_status,
      shippingStatus: order.shipping_status || "pending",
      subtotal: order.order_total,
      shippingFee: Number(order.shipping_fee) || 0,
      discount: Number(order.order_discount) || 0,
      total: order.order_total_final,

      products: items.map((item) => ({
        id: item.id,
        name: item.product_name,
        image: firstImageUrl(item.image || item.product_image),
        price: item.price_sale
          ? cleanPrice(item.price_sale)
          : cleanPrice(item.price),
        quantity: item.quantity,
        slug: item.product_slug,
        color: {
          name: item.color_name,
          hex: item.color_hex,
        },
        category: item.category,
        rating: {
          count: item.comment_count,
          average: item.average_rating,
        },
        has_comment: item.has_comment,
      })),
    };

    // Thêm thông tin return nếu có
    if (returnInfo) {
      orderData.returnInfo = {
        return_id: returnInfo.return_id,
        reason: returnInfo.reason,
        return_type: returnInfo.return_type,
        total_refund: returnInfo.total_refund,
        return_status: returnInfo.return_status,
        return_created_at: returnInfo.return_created_at,
        return_updated_at: returnInfo.return_updated_at,
      };
    }

    return res.status(200).json({
      success: true,
      order: orderData,
    });
  } catch (error) {
    console.error(" Lỗi khi truy vấn đơn hàng:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ", error: error.message });
  }
});


// GET /api/orders/admin
router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const { rows: orders } = await db.query(`
      SELECT 
        o.order_id,
        o.order_hash,
        o.created_at,
        o.order_status,
        o.order_final_total AS order_total_final,
        o.order_name AS order_name_new,
        NULL::TEXT AS order_name_old,
        u.user_name,
        p.payment_method as payment_method,
        p.payment_status as payment_status_from_payment,
        p.payment_transaction_id AS payment_transaction_id,
        COUNT(oi.order_item_id) AS item_count,
        -- Thêm thông tin return từ bảng order_returns
        or_latest.return_status,
        or_latest.return_reason,
        or_latest.return_type,
        or_latest.total_refund,
        or_latest.return_created_at,
        or_latest.return_updated_at
      FROM orders o
      LEFT JOIN "user" u ON o.user_id = u.user_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
      LEFT JOIN payments p ON o.payment_id = p.payment_id
      LEFT JOIN (
        -- Lấy thông tin return mới nhất cho mỗi order
        SELECT 
          order_id,
          return_status,
          return_reason,
          return_refund_method as return_type,
          return_total as total_refund,
          created_at as return_created_at,
          updated_at as return_updated_at
        FROM order_returns 
        WHERE return_id IN (
          SELECT MAX(return_id) 
          FROM order_returns 
          GROUP BY order_id
        )
      ) or_latest ON o.order_id = or_latest.order_id
      GROUP BY
        o.order_id,
        u.user_name,
        p.payment_method,
        p.payment_status,
        p.payment_transaction_id,
        or_latest.return_status,
        or_latest.return_reason,
        or_latest.return_type,
        or_latest.total_refund,
        or_latest.return_created_at,
        or_latest.return_updated_at
      ORDER BY o.created_at DESC
    `);

    // Process orders to include payment array and return info
    const processedOrders = orders.map((order) => {
      // Create payment array if payment data exists
      if (order.payment_method || order.payment_status_from_payment) {
        order.payment = [
          {
            method: order.payment_method || "N/A",
            status:
              order.payment_status_from_payment || "PENDING",
            transaction_code: order.payment_transaction_id || null,
            paid_at: null,
          },
        ];
      }

      order.current_status = toLegacyOrderStatus(order.order_status);
      order.shipping_status =
        order.current_status === "SHIPPING" ? "shipping" : "pending";

      // Add return info if exists
      if (order.return_status) {
        order.returnInfo = {
          return_status: order.return_status,
          reason: order.return_reason,
          return_type: order.return_type,
          total_refund: order.total_refund,
          return_created_at: order.return_created_at,
          return_updated_at: order.return_updated_at,
        };
      }

      // Remove the extra fields used for processing
      delete order.payment_status_from_payment;
      delete order.payment_transaction_id;
      delete order.order_status;
      delete order.return_status;
      delete order.return_reason;
      delete order.return_type;
      delete order.total_refund;
      delete order.return_created_at;
      delete order.return_updated_at;

      return order;
    });

    res.json({ success: true, orders: processedOrders });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
});


router.get("/count", verifyToken, isAdmin, async (req, res) => {
  try {
    // Lấy số lượng đơn hàng theo trạng thái
    const { rows: result } = await db.query(`
      SELECT order_status, COUNT(*)::int as count
      FROM orders
      GROUP BY order_status
    `);

    // Lấy danh sách các trạng thái có thể có
    const statuses = [
      { status: "PENDING", code: 0, name: "Chờ xác nhận" },
      { status: "CONFIRMED", code: 1, name: "Đã xác nhận" },
      { status: "SHIPPING", code: 2, name: "Đang giao" },
      { status: "DELIVERED", code: 3, name: "Đã giao hàng" },
      { status: "SUCCESS", code: 4, name: "Giao hàng thành công" },
      { status: "CANCELLED", code: -1, name: "Đã hủy" },
    ];

    // Tạo đối tượng thống kê
    const statistics = statuses.map((status) => {
      const count = result.find((r) => Number(r.order_status) === status.code);
      return {
        status: status.status,
        status_name: status.name,
        count: count ? count.count : 0,
      };
    });

    res.json(statistics);
  } catch (error) {
    console.error("Error counting orders by status:", error);
    res.status(500).json({ error: "Failed to count orders" });
  }
});


/**
 * @route   GET /api/orders
 * @desc    Lấy danh sách tất cả đơn hàng (admin only)
 * @access  Private (Admin)
 */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    console.log("Đang truy cập GET /api/orders");
    console.log("User info:", req.user);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status; // Changed from status_id to status
    const search = req.query.search;

    console.log("Query params:", { page, limit, offset, status, search });

    // Xây dựng điều kiện tìm kiếm
    let conditions = [];
    let params = [];
    let paramIndex = 1;

    // Lọc theo trạng thái
    if (status) {
      const normalizedStatus = String(status).toUpperCase();
      const statusCode = ORDER_STATUS_KEY_TO_CODE[normalizedStatus];
      if (statusCode !== undefined) {
        conditions.push(`o.order_status = $${paramIndex++}`);
        params.push(statusCode);
      }
    }

    if (search) {
      conditions.push(
        `(o.order_hash ILIKE $${paramIndex++} OR u.user_gmail ILIKE $${paramIndex++} OR u.user_name ILIKE $${paramIndex++})`
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    console.log("Where clause:", whereClause);
    console.log("Params:", params);

    // Đếm tổng số đơn hàng
    console.log("Executing count query...");
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM orders o
      LEFT JOIN "user" u ON o.user_id = u.user_id
      ${whereClause}
    `;
    console.log("Count query:", countQuery);

    try {
      const { rows: countResult } = await db.query(countQuery, params);
      console.log("Count result:", countResult);

      const totalOrders = Number(countResult[0].total || 0);
      const totalPages = Math.ceil(totalOrders / limit);

      // Lấy danh sách đơn hàng với phân trang
      console.log("Executing orders query...");
      const ordersQuery = `
        SELECT 
          o.*,
          u.user_gmail as user_email,
          u.user_name as user_name
        FROM orders o
        LEFT JOIN "user" u ON o.user_id = u.user_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      console.log("Orders query:", ordersQuery);
      console.log("Orders params:", [...params, limit, offset]);

      const { rows: orders } = await db.query(ordersQuery, [
        ...params,
        limit,
        offset,
      ]);
      console.log(`Found ${orders.length} orders`);

      res.json({
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          totalOrders,
          ordersPerPage: limit,
        },
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      throw dbError;
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch orders", details: error.message });
  }
});

router.get("/:id", verifyToken, asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);

  if (Number.isNaN(orderId)) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  res.json(await getOrderDetail(orderId, req.user));
}));


/**
 * @route   GET /api/orders/status/count
 * @desc    Lấy số lượng đơn hàng theo trạng thái (chỉ admin)
 * @access  Private (Admin)
 */
router.get("/status/count", verifyToken, isAdmin, async (req, res) => {
  try {
    const { rows: result } = await db.query(`
      SELECT order_status, COUNT(*)::int as count
      FROM orders
      GROUP BY order_status
    `);

    // Lấy danh sách các trạng thái có thể có
    const statuses = [
      { status: "PENDING", code: 0, name: "Chờ xác nhận" },
      { status: "CONFIRMED", code: 1, name: "Đã xác nhận" },
      { status: "SHIPPING", code: 2, name: "Đang giao" },
      { status: "DELIVERED", code: 3, name: "Đã giao hàng" },
      { status: "SUCCESS", code: 4, name: "Giao hàng thành công" },
      { status: "CANCELLED", code: -1, name: "Đã hủy" },
    ];

    // Tạo đối tượng thống kê
    const statistics = statuses.map((status) => {
      const count = result.find((r) => Number(r.order_status) === status.code);
      return {
        status: status.status,
        status_name: status.name,
        count: count ? count.count : 0,
      };
    });

    res.json(statistics);
  } catch (error) {
    console.error("Error fetching order status counts:", error);
    res.status(500).json({ error: "Failed to fetch order status counts" });
  }
});


/**
 * @route   GET /api/orders/return/count
 * @desc    Count return order requests
 * @access  Private (Admin)
 */
router.get("/return/count", verifyToken, isAdmin, async (req, res) => {
  try {
    const { rows: tableRows } = await db.query(
      "SELECT to_regclass('public.order_returns') AS table_name"
    );
    const hasOrderReturnsTable = Boolean(tableRows[0]?.table_name);

    let count = 0;
    if (hasOrderReturnsTable) {
      const { rows: result } = await db.query(
        "SELECT COUNT(*)::INT AS count FROM order_returns"
      );
      count = Number(result[0]?.count || 0);
    }

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Error counting return orders:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while counting return orders",
      error: error.message,
    });
  }
});

module.exports = router;

module.exports = router;
