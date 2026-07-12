const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin, optionalAuth } = require("../middleware/auth");
const crypto = require("crypto");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const { withTransaction } = require("../db/transaction");

const axios = require("axios");
const { sendEmail1 } = require("../services/mailService1");
const { VNPay, ignoreLogger, dateFormat } = require("vnpay");
// Áp dụng middleware xác thực cho tất cả các route
// router.use(verifyToken);
function formatDateVNPay(date) {
  const yyyy = date.getFullYear().toString();
  const MM = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const HH = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}

const ORDER_STATUS_CODE_TO_KEY = {
  "-1": "CANCELLED",
  "0": "PENDING",
  "1": "CONFIRMED",
  "2": "SHIPPING",
  "3": "DELIVERED",
  "4": "SUCCESS",
};

const ORDER_STATUS_KEY_TO_CODE = {
  PENDING: 0,
  CONFIRMED: 1,
  APPROVED: 1,
  SHIPPING: 2,
  DELIVERED: 3,
  COMPLETED: 4,
  SUCCESS: 4,
  CANCELLED: -1,
};

function toLegacyOrderStatus(orderStatusCode) {
  if (orderStatusCode === null || orderStatusCode === undefined) {
    return "PENDING";
  }

  return ORDER_STATUS_CODE_TO_KEY[String(orderStatusCode)] || "PENDING";
}

const RETURN_STATUS_LABEL_TO_CODE = {
  PENDING: 0,
  APPROVED: 1,
  COMPLETED: 2,
  CANCEL_CONFIRMED: 2,
  CANCELLED: 2,
  REJECTED: 3,
};

const RETURN_STATUS_CODE_TO_LABEL = {
  0: "PENDING",
  1: "APPROVED",
  2: "COMPLETED",
  3: "REJECTED",
};

async function createUserNotification(client, payload) {
  const { userId, title, message, link, senderId, typeCodes } = payload;
  if (!userId) return;

  const codes = typeCodes && typeCodes.length ? typeCodes : ["system"];
  const placeholders = codes.map((_, idx) => `$${idx + 1}`).join(", ");
  const { rows: typeRows } = await client.query(
    `SELECT id, type_code
     FROM notification_types
     WHERE type_code IN (${placeholders})
     ORDER BY CASE ${codes
       .map((code, idx) => `WHEN type_code = $${idx + 1} THEN ${idx}`)
       .join(" ")} ELSE 999 END
     LIMIT 1`,
    codes
  );

  if (!typeRows.length) return;

  const { rows: notificationRows } = await client.query(
    `INSERT INTO notifications (type_id, title, message, link, sender_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [typeRows[0].id, title, message, link || null, senderId || null]
  );

  await client.query(
    `INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted)
     VALUES ($1, $2, 0, NULL, 0)`,
    [userId, notificationRows[0].id]
  );
}
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

router.post("/payment/momo", async (req, res) => {
  console.log("Received MoMo IPN:", req.body);
  const {
    orderId,
    amount,
    resultCode,
    requestId,
    orderInfo,
    orderType,
    transId,
    payType,
    extraData,
    signature,
    message,
    partnerCode,
    responseTime,
  } = req.body;

  const accessKey = `${process.env.ACCESSKEY}`;
  const secretKey = `${process.env.SECRETKEY}`;

  try {
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

    if (!signature || !rawSignature) {
      return res.status(400).json({ message: "Missing signature information" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(403).json({ error: "Invalid MoMo signature" });
    }

    if (Number(resultCode) !== 0) {
      return res.status(400).json({ error: "MoMo payment was not successful" });
    }

    const { rows: existingOrders } = await db.query(
      "SELECT order_id, order_hash, payment_id FROM orders WHERE order_hash = $1 LIMIT 1",
      [orderId]
    );

    if (existingOrders.length > 0) {
      const existingOrder = existingOrders[0];
      if (!existingOrder.payment_id) {
        await withTransaction(async (client) => {
          const { rows: paymentRows } = await client.query(
            `INSERT INTO payments (
              payment_method,
              payment_amount,
              payment_status,
              payment_transaction_id,
              payment_info,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING payment_id`,
            [
              "momo",
              Number(amount) || 0,
              "success",
              transId || null,
              JSON.stringify({ source: "momo_ipn_reconcile", requestId: requestId || null }),
            ]
          );

          await client.query(
            "UPDATE orders SET payment_id = $1, order_payment_method = $2, updated_at = NOW() WHERE order_id = $3",
            [paymentRows[0].payment_id, "momo", existingOrder.order_id]
          );

          await client.query(
            `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note, created_at)
             VALUES ($1, NULL, $2, NULL, $3, NOW())`,
            [existingOrder.order_id, ORDER_STATUS_KEY_TO_CODE.PENDING, "MoMo IPN reconciliation"]
          );
        });
      }

      return res.status(200).json({
        message: "Order already exists and payment has been handled.",
      });
    }

    const extra = JSON.parse(Buffer.from(extraData, "base64").toString("utf8"));
    const {
      user_id,
      order_total,
      order_total_final,
      cart_items = [],
      order_name_new,
      order_email_new,
      order_address_new,
      order_number2,
      couponcode_id,
      coupon_code,
      shipping_fee,
      order_discount,
    } = extra;

    const { rows: userRows } = await db.query(
      `SELECT user_address, user_number, user_name, user_gmail
       FROM "user"
       WHERE user_id = $1`,
      [user_id]
    );

    if (!userRows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userInfo = userRows[0];
    const defaultName = userInfo.user_name?.trim() || "";
    const defaultEmail = userInfo.user_gmail?.trim() || "";
    const defaultAddress = userInfo.user_address?.trim() || "";
    const defaultPhone = userInfo.user_number?.trim() || "";

    const finalName =
      order_name_new?.trim() && order_name_new.trim() !== defaultName
        ? order_name_new.trim()
        : defaultName;
    const finalEmail =
      order_email_new?.trim() && order_email_new.trim() !== defaultEmail
        ? order_email_new.trim()
        : defaultEmail;
    const finalAddress =
      order_address_new?.trim() && order_address_new.trim() !== defaultAddress
        ? order_address_new.trim()
        : defaultAddress;
    const finalPhone =
      order_number2?.trim() && order_number2.trim() !== defaultPhone
        ? order_number2.trim()
        : defaultPhone;

    let couponcodeId = couponcode_id || null;
    if (!couponcodeId && coupon_code) {
      const { rows: couponRows } = await db.query(
        "SELECT couponcode_id FROM couponcode WHERE couponcode_code = $1 LIMIT 1",
        [coupon_code]
      );
      if (couponRows.length > 0) {
        couponcodeId = couponRows[0].couponcode_id;
      }
    }

    let createdOrder = null;
    try {
      createdOrder = await withTransaction(async (client) => {
        const { rows: paymentRows } = await client.query(
          `INSERT INTO payments (
            payment_method,
            payment_amount,
            payment_status,
            payment_transaction_id,
            payment_info,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING payment_id`,
          [
            "momo",
            Number(amount) || 0,
            "success",
            transId || null,
            JSON.stringify({ source: "momo_ipn", requestId: requestId || null }),
          ]
        );

        const paymentId = paymentRows[0].payment_id;

        const { rows: orderRows } = await client.query(
          `INSERT INTO orders (
            order_hash,
            user_id,
            order_total,
            order_final_total,
            order_shipping_fee,
            order_discount,
            order_status,
            order_address,
            order_phone,
            order_name,
            order_email,
            order_payment_method,
            payment_id,
            couponcode_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          RETURNING order_id, order_hash`,
          [
            orderId,
            user_id,
            Number(order_total) || 0,
            Number(order_total_final) || Number(amount) || 0,
            Number(shipping_fee) || 0,
            Number(order_discount) || 0,
            ORDER_STATUS_KEY_TO_CODE.PENDING,
            finalAddress || null,
            finalPhone || null,
            finalName || null,
            finalEmail || null,
            "momo",
            paymentId,
            couponcodeId,
          ]
        );

        const created = orderRows[0];
        const usedVariantIds = [];

        for (const item of cart_items) {
          const variantId = Number(item.variant_id);
          const quantity = Number(item.quantity);
          const productPrice = Number(item.price || 0);

          if (!variantId || !quantity || quantity <= 0) {
            continue;
          }

          const { rows: stockRows, rowCount: stockRowCount } = await client.query(
            `UPDATE variant_product
             SET variant_product_quantity = variant_product_quantity - $1
             WHERE variant_id = $2 AND variant_product_quantity >= $1
             RETURNING product_id`,
            [quantity, variantId]
          );

          if (!stockRowCount) {
            const stockError = new Error("OUT_OF_STOCK");
            stockError.code = "OUT_OF_STOCK";
            stockError.item = {
              name: item.name,
              quantity,
              price: productPrice,
              image: item.image || null,
            };
            throw stockError;
          }

          await client.query(
            `INSERT INTO order_items (
              order_id,
              variant_id,
              quantity,
              price,
              created_at
            ) VALUES ($1, $2, $3, $4, NOW())`,
            [created.order_id, variantId, quantity, productPrice]
          );

          const productId = stockRows[0]?.product_id;
          if (productId) {
            await client.query(
              `UPDATE product
               SET product_sold = COALESCE(product_sold, 0) + $1
               WHERE product_id = $2`,
              [quantity, productId]
            );
          }

          usedVariantIds.push(variantId);
        }

        if (usedVariantIds.length > 0) {
          await client.query(
            `DELETE FROM wishlist
             WHERE user_id = $1
               AND variant_id = ANY($2::int[])`,
            [user_id, usedVariantIds]
          );
        }

        await client.query(
          `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note, created_at)
           VALUES ($1, NULL, $2, NULL, $3, NOW())`,
          [created.order_id, ORDER_STATUS_KEY_TO_CODE.PENDING, "Order created from MoMo IPN"]
        );

        const { rows: adminRows } = await client.query(
          `SELECT user_id
           FROM "user"
           WHERE user_role::text = 'admin'
           ORDER BY user_id
           LIMIT 1`
        );

        if (adminRows.length > 0) {
          await createUserNotification(client, {
            userId: adminRows[0].user_id,
            title: "New MoMo order",
            message: `Customer ${finalName || defaultName} placed a new MoMo order (${created.order_hash})`,
            link: `/admin/orders/${created.order_hash}`,
            senderId: user_id,
            typeCodes: ["order", "system"],
          });
        }

        if ((couponcodeId || coupon_code) && user_id) {
          if (couponcodeId) {
            const { rowCount: couponUpdated } = await client.query(
              `UPDATE couponcode
               SET couponcode_used = couponcode_used + 1
               WHERE couponcode_id = $1
                 AND couponcode_used < couponcode_quantity`,
              [couponcodeId]
            );

            if (couponUpdated > 0) {
              await client.query(
                `INSERT INTO user_has_coupon (user_id, couponcode_id, status)
                 VALUES ($1, $2, 1)
                 ON CONFLICT (user_id, couponcode_id)
                 DO UPDATE SET status = EXCLUDED.status`,
                [user_id, couponcodeId]
              );
            }
          }
        }

        return {
          order_id: created.order_id,
          order_hash: created.order_hash,
          customer_name: finalName || defaultName,
          customer_email: finalEmail || defaultEmail,
          customer_phone: finalPhone || defaultPhone,
          customer_address: finalAddress || defaultAddress,
        };
      });
    } catch (error) {
      if (error.code === "OUT_OF_STOCK") {
        try {
          const refundData = {
            partnerCode,
            accessKey,
            requestId: Date.now().toString(),
            amount: amount.toString(),
            orderId: `${orderId}_refund`,
            transId,
            lang: "vi",
            description: "Refund because item is out of stock",
          };

          const rawRefundSignature = `accessKey=${refundData.accessKey}&amount=${refundData.amount}&description=${refundData.description}&orderId=${refundData.orderId}&partnerCode=${refundData.partnerCode}&requestId=${refundData.requestId}&transId=${refundData.transId}`;

          refundData.signature = crypto
            .createHmac("sha256", secretKey)
            .update(rawRefundSignature)
            .digest("hex");

          await axios.post("https://test-payment.momo.vn/v2/gateway/api/refund", refundData, {
            headers: { "Content-Type": "application/json" },
          });
        } catch (refundErr) {
          console.error("MoMo refund error:", refundErr.response?.data || refundErr.message);
        }

        return res.status(200).json({
          success: false,
          resultCode: 1,
          message: `Product '${error.item?.name || "unknown"}' is out of stock. Refund has been requested.`,
        });
      }

      throw error;
    }

    const emailData = {
      name: createdOrder.customer_name,
      email: createdOrder.customer_email,
      phone: createdOrder.customer_phone,
      address: createdOrder.customer_address,
      amount,
      method: "MOMO",
      order_id: createdOrder.order_id,
      order_hash: createdOrder.order_hash,
      created_at: new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      }),
      current_status: "PENDING",
      order_total_final: Number(amount).toLocaleString("vi-VN") + "đ",
      order_discount: order_discount
        ? Number(order_discount).toLocaleString("vi-VN") + "đ"
        : null,
      products: cart_items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: (Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString("vi-VN") + "đ",
        image: item.image,
      })),
    };

    try {
      await sendEmail1(emailData.email, "Xác nhận đơn hàng", emailData);
    } catch (err) {
      console.error("Send email error:", err.message);
    }

    return res.status(200).json({
      success: true,
      resultCode: 0,
      message: "MoMo order has been processed successfully",
    });
  } catch (error) {
    console.error("MoMo IPN error:", error);
    return res.status(500).json({ error: "Server error while processing MoMo IPN" });
  }
});
router.get("/redirect/momo", async (req, res) => {
  const { resultCode, orderId } = req.query;

  if (parseInt(resultCode) === 0) {
    try {
      // Gửi request đến endpoint xử lý thanh toán
      const response = await axios.post(
        `https://fur.timefortea.io.vn/api/orders/payment/momo`,
        req.query, 
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Gữi dữ liệu về payment/momo thành công", response.data);
    } catch (err) {
      console.error("Gửi payment/momo thất bại", err.response?.data || err.message);
    }

    // Redirect sau khi xử lý
    return res.redirect(
      `${process.env.SITE_URL}/dat-hang-thanh-cong/${orderId}`
    );
  }

  return res.redirect(`${process.env.SITE_URL}/`);
});


/**
 * @route   POST /api/orders
 * @desc    Tạo đơn hàng mới
 * @access  Private
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      order_id,
      order_total,
      order_total_final,
      method,
      amount,
      order_address_new,
      order_number2,
      order_name_new,
      order_email_new,
      couponcode_id,
      cart_items = [],
      coupon_code,
      shipping_fee,
      order_discount,
      fromRedirect,
    } = req.body;

    const user_id = req.user.id;
    const normalizedMethod = String(method || "").trim().toUpperCase();

    if (!order_id || !order_total || !normalizedMethod || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (normalizedMethod === "MOMO" && !fromRedirect) {
      return res
        .status(400)
        .json({ error: "Wait for IPN or pass fromRedirect before creating MoMo order" });
    }

    const { rows: userRows } = await db.query(
      `SELECT user_address, user_number, user_name, user_gmail
       FROM "user"
       WHERE user_id = $1`,
      [user_id]
    );

    if (!userRows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userInfo = userRows[0];
    const defaultName = userInfo.user_name?.trim() || "";
    const defaultEmail = userInfo.user_gmail?.trim() || "";
    const defaultAddress = userInfo.user_address?.trim() || "";
    const defaultPhone = userInfo.user_number?.trim() || "";

    const finalName =
      order_name_new?.trim() && order_name_new.trim() !== defaultName
        ? order_name_new.trim()
        : defaultName;
    const finalEmail =
      order_email_new?.trim() && order_email_new.trim() !== defaultEmail
        ? order_email_new.trim()
        : defaultEmail;
    const finalAddress =
      order_address_new?.trim() && order_address_new.trim() !== defaultAddress
        ? order_address_new.trim()
        : defaultAddress;
    const finalPhone =
      order_number2?.trim() && order_number2.trim() !== defaultPhone
        ? order_number2.trim()
        : defaultPhone;

    let couponcodeId = couponcode_id || null;
    if (!couponcodeId && coupon_code) {
      const { rows: couponRows } = await db.query(
        "SELECT couponcode_id FROM couponcode WHERE couponcode_code = $1 LIMIT 1",
        [coupon_code]
      );
      if (couponRows.length > 0) {
        couponcodeId = couponRows[0].couponcode_id;
      }
    }

    if (normalizedMethod === "COD") {
      const { rows: existingOrders } = await db.query(
        "SELECT order_id FROM orders WHERE order_hash = $1 LIMIT 1",
        [order_id]
      );
      if (existingOrders.length > 0) {
        return res.status(400).json({ error: "Order already exists" });
      }

      const createdOrder = await withTransaction(async (client) => {
        const { rows: paymentRows } = await client.query(
          `INSERT INTO payments (
            payment_method,
            payment_amount,
            payment_status,
            created_at
          ) VALUES ($1, $2, $3, NOW())
          RETURNING payment_id`,
          ["cod", Number(amount) || 0, "pending"]
        );

        const paymentId = paymentRows[0].payment_id;

        const { rows: orderRows } = await client.query(
          `INSERT INTO orders (
            order_hash,
            user_id,
            order_total,
            order_final_total,
            order_shipping_fee,
            order_discount,
            order_status,
            order_address,
            order_phone,
            order_name,
            order_email,
            order_payment_method,
            payment_id,
            couponcode_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          RETURNING order_id, order_hash`,
          [
            order_id,
            user_id,
            Number(order_total) || 0,
            Number(order_total_final) || Number(amount) || 0,
            Number(shipping_fee) || 0,
            Number(order_discount) || 0,
            ORDER_STATUS_KEY_TO_CODE.PENDING,
            finalAddress || null,
            finalPhone || null,
            finalName || null,
            finalEmail || null,
            "cod",
            paymentId,
            couponcodeId,
          ]
        );

        const created = orderRows[0];
        const usedVariantIds = [];

        for (const item of cart_items) {
          const variantId = Number(item.variant_id);
          const quantity = Number(item.quantity);
          const productPrice = Number(item.price || 0);

          if (!variantId || !quantity || quantity <= 0) {
            continue;
          }

          const { rows: stockRows, rowCount: stockRowCount } = await client.query(
            `UPDATE variant_product
             SET variant_product_quantity = variant_product_quantity - $1
             WHERE variant_id = $2 AND variant_product_quantity >= $1
             RETURNING product_id`,
            [quantity, variantId]
          );

          if (!stockRowCount) {
            const stockError = new Error(`Insufficient stock for ${item.name || variantId}`);
            stockError.statusCode = 400;
            throw stockError;
          }

          await client.query(
            `INSERT INTO order_items (order_id, variant_id, quantity, price, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [created.order_id, variantId, quantity, productPrice]
          );

          const productId = stockRows[0]?.product_id;
          if (productId) {
            await client.query(
              `UPDATE product
               SET product_sold = COALESCE(product_sold, 0) + $1
               WHERE product_id = $2`,
              [quantity, productId]
            );
          }

          usedVariantIds.push(variantId);
        }

        if (usedVariantIds.length > 0) {
          await client.query(
            `DELETE FROM wishlist
             WHERE user_id = $1
               AND variant_id = ANY($2::int[])`,
            [user_id, usedVariantIds]
          );
        }

        await client.query(
          `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note, created_at)
           VALUES ($1, NULL, $2, $3, $4, NOW())`,
          [created.order_id, ORDER_STATUS_KEY_TO_CODE.PENDING, user_id, "Create COD order"]
        );

        const { rows: adminRows } = await client.query(
          `SELECT user_id
           FROM "user"
           WHERE user_role::text = 'admin'
           ORDER BY user_id
           LIMIT 1`
        );

        if (adminRows.length > 0) {
          await createUserNotification(client, {
            userId: adminRows[0].user_id,
            title: "New COD order",
            message: `Customer ${finalName || defaultName} placed a new COD order (${created.order_hash})`,
            link: `/admin/orders/${created.order_hash}`,
            senderId: user_id,
            typeCodes: ["order", "system"],
          });
        }

        if (couponcodeId) {
          const { rowCount: couponUpdated } = await client.query(
            `UPDATE couponcode
             SET couponcode_used = couponcode_used + 1
             WHERE couponcode_id = $1
               AND couponcode_used < couponcode_quantity`,
            [couponcodeId]
          );

          if (couponUpdated > 0) {
            await client.query(
              `INSERT INTO user_has_coupon (user_id, couponcode_id, status)
               VALUES ($1, $2, 1)
               ON CONFLICT (user_id, couponcode_id)
               DO UPDATE SET status = EXCLUDED.status`,
              [user_id, couponcodeId]
            );
          }
        }

        return {
          order_id: created.order_id,
          order_hash: created.order_hash,
        };
      });

      const emailData = {
        name: finalName || defaultName,
        email: finalEmail || defaultEmail,
        phone: finalPhone || defaultPhone,
        address: finalAddress || defaultAddress,
        amount,
        method: normalizedMethod,
        order_id: createdOrder.order_id,
        order_hash: createdOrder.order_hash,
        created_at: new Date().toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        }),
        current_status: "PENDING",
        order_total_final: Number(amount).toLocaleString("vi-VN") + "đ",
        order_discount: order_discount
          ? Number(order_discount).toLocaleString("vi-VN") + "đ"
          : null,
        products: cart_items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: (Number(item.price || 0)).toLocaleString("vi-VN") + "đ",
          total: (Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString("vi-VN") + "đ",
          image: item.image,
        })),
      };

      try {
        await sendEmail1(emailData.email, "Xác nhận đơn hàng", emailData);
      } catch (err) {
        console.error("Send email error:", err.message);
      }

      return res.status(201).json({
        message: "COD order created",
        redirect: `/dat-hang-thanh-cong/${order_id}`,
        order_hash: order_id,
        order_id: createdOrder.order_id,
      });
    }

    if (normalizedMethod === "MOMO") {
      for (const item of cart_items) {
        const { rows: variantRows } = await db.query(
          `SELECT variant_product_quantity
           FROM variant_product
           WHERE variant_id = $1`,
          [item.variant_id]
        );

        const variant = variantRows[0];
        if (!variant || Number(variant.variant_product_quantity) < Number(item.quantity || 0)) {
          return res.status(400).json({
            error: `Product ${item.name} does not have enough stock`,
          });
        }
      }

      const partnerCode = "MOMO";
      const accessKey = `${process.env.ACCESSKEY}`;
      const secretKey = `${process.env.SECRETKEY}`;
      const requestType = "captureWallet";
      const momoOrderId = req.body.order_id || `SNA-${Date.now()}`;
      const momoRequestId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const redirectUrl = `${process.env.API_URL}/orders/redirect/momo`;
      const ipnUrl = `${process.env.API_URL}/orders/payment/momo`;
      const orderInfo = "Thanh toán đơn hàng";

      const extraData = Buffer.from(
        JSON.stringify({
          order_id: momoOrderId,
          user_id,
          order_total,
          order_total_final,
          order_address_new,
          order_number2,
          order_name_new,
          order_email_new,
          couponcode_id,
          cart_items,
          coupon_code,
          shipping_fee,
          order_discount,
        })
      ).toString("base64");

      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${momoRequestId}&requestType=${requestType}`;

      const momoSignature = crypto
        .createHmac("sha256", secretKey)
        .update(rawSignature)
        .digest("hex");

      const momoBody = {
        partnerCode,
        accessKey,
        requestId: momoRequestId,
        amount: amount.toString(),
        orderId: momoOrderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        signature: momoSignature,
        lang: "vi",
      };

      const momoRes = await axios.post(
        "https://test-payment.momo.vn/v2/gateway/api/create",
        momoBody,
        { headers: { "Content-Type": "application/json" } }
      );

      return res.json({ payUrl: momoRes.data.payUrl });
    }

    if (normalizedMethod === "VNPAY") {
      const transactionCode = `VNP${Date.now()}${Math.floor(
        Math.random() * 1000
      )}`;
      const vnpay = new VNPay({
        tmnCode: "DHF21S3V",
        secureSecret: "NXM2DJWRF8RLC4R5VBK85OJZS1UE9KI6F",
        vnpayHost: "https://sandbox.vnpayment.vn",
        testMode: true,
        hashAlgorithm: "SHA512",
        loggerFn: () => { },
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: amount * 100,
        vnp_IpAddr: "127.0.0.1",
        vnp_TxnRef: transactionCode,
        vnp_OrderInfo: `Thanh toán đơn hàng #${order_id}`,
        vnp_OrderType: "other",
        vnp_ReturnUrl: `${process.env.VITE_API_BASE_URL}/orders/payment/vnpay`,
        vnp_Locale: "vn",
        vnp_CreateDate: formatDateVNPay(new Date()),
        vnp_ExpireDate: formatDateVNPay(tomorrow),
      });

      return res.status(200).json({
        message: "Tạo thanh toán VNPAY",
        payUrl: paymentUrl,
        redirect: "/",
      });
    }

    return res
      .status(400)
      .json({ error: "Unsupported payment method" });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Server error while creating order" });
  }
});
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (Number.isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const { rows: orderRows } = await db.query(
      `
      SELECT
        o.*,
        o.order_final_total AS order_total_final,
        o.order_shipping_fee AS shipping_fee,
        o.order_name AS order_name_new,
        o.order_email AS order_email_new,
        o.order_address AS order_address_new,
        o.order_phone AS order_number2,
        u.user_gmail AS user_email,
        u.user_name AS user_name,
        u.user_number AS user_phone,
        p.payment_method AS payment_method,
        p.payment_status AS payment_status,
        p.payment_transaction_id AS payment_transaction_code,
        p.updated_at AS payment_paid_at
      FROM orders o
      LEFT JOIN "user" u ON o.user_id = u.user_id
      LEFT JOIN payments p ON o.payment_id = p.payment_id
      WHERE o.order_id = $1
      `,
      [orderId]
    );

    if (!orderRows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];

    order.payment = [
      {
        method: order.payment_method,
        status: order.payment_status,
        transaction_code: order.payment_transaction_code,
        paid_at: order.payment_paid_at,
      },
    ];
    delete order.payment_method;
    delete order.payment_status;
    delete order.payment_transaction_code;
    delete order.payment_paid_at;

    if (req.user.role !== "admin" && req.user.id !== order.user_id) {
      return res
        .status(403)
        .json({ error: "You do not have permission to view this order" });
    }

    const { rows: orderItems } = await db.query(
      `
      SELECT
        oi.*,
        oi.price AS product_price,
        p.product_name,
        p.product_image,
        p.product_slug,
        vp.variant_product_price,
        vp.variant_product_price_sale,
        vp.variant_product_list_image,
        vp.color_id AS variant_color_id,
        c.color_name,
        c.color_code AS color_hex,
        cat.category_name AS category,
        (
          SELECT COUNT(*)
          FROM comment cmt
          INNER JOIN order_items oi2 ON cmt.order_item_id = oi2.order_item_id
          INNER JOIN variant_product vp2 ON oi2.variant_id = vp2.variant_id
          WHERE vp2.product_id = p.product_id
        ) AS comment_count,
        (
          SELECT AVG(cmt.comment_rating)
          FROM comment cmt
          INNER JOIN order_items oi2 ON cmt.order_item_id = oi2.order_item_id
          INNER JOIN variant_product vp2 ON oi2.variant_id = vp2.variant_id
          WHERE vp2.product_id = p.product_id
        ) AS average_rating
      FROM order_items oi
      LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
      LEFT JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      WHERE oi.order_id = $1
      `,
      [orderId]
    );
    order.items = orderItems;

    const { rows: statusLogs } = await db.query(
      `
      SELECT osl.*
      FROM order_status_log osl
      WHERE osl.order_id = $1
      ORDER BY osl.created_at ASC
      `,
      [orderId]
    );
    order.status_logs = statusLogs;
    order.current_status = toLegacyOrderStatus(order.order_status);

    return res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch order", details: error.message });
  }
});

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Cập nhật trạng thái đơn hàng
 * @access  Private (Admin)
 */
router.put("/:id/status", verifyToken, isAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  const normalizedStatus = String(req.body.new_status || "")
    .trim()
    .toUpperCase();
  const targetStatusCode = ORDER_STATUS_KEY_TO_CODE[normalizedStatus];

  if (Number.isNaN(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Mã đơn hàng không hợp lệ",
    });
  }

  if (targetStatusCode === undefined) {
    return res
      .status(400)
      .json({ success: false, message: "Trạng thái không hợp lệ" });
  }

  try {
    // Lấy trạng thái hiện tại của đơn + user_id + order_hash
    const { rows: orderRows } = await db.query(
      "SELECT order_status, user_id, order_hash FROM orders WHERE order_id = $1",
      [orderId]
    );
    const order = orderRows[0];

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const fromStatusCode = Number(order.order_status);
    const fromStatus = toLegacyOrderStatus(fromStatusCode);
    const toStatus = normalizedStatus;

    if (fromStatusCode === targetStatusCode) {
      return res.status(200).json({
        success: true,
        message: "Trạng thái không thay đổi",
      });
    }

    // Cập nhật trạng thái đơn hàng
    await db.query(
      "UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2",
      [targetStatusCode, orderId]
    );

    // Ghi log chuyển trạng thái
    await db.query(
      `INSERT INTO order_status_log (
        order_id, old_status, new_status, changed_by, note, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        orderId,
        fromStatusCode,
        targetStatusCode,
        req.user?.id || null,
        `Chuyển trạng thái từ ${fromStatus} ➝ ${toStatus}`,
      ]
    );

    // Gửi thông báo cho user
    const userId = order.user_id;
    const orderHash = order.order_hash;

    if (userId) {
      // Lấy loại thông báo 'order'
      const { rows: typeRows } = await db.query(
        `SELECT id FROM notification_types WHERE type_code = 'order' LIMIT 1`
      );

      if (typeRows.length > 0) {
        const notificationTypeId = typeRows[0].id;

        // Map trạng thái sang tiếng Việt
        const statusMessageMap = {
          PENDING: "Chờ xác nhận",
          CONFIRMED: "Đã xác nhận",
          SHIPPING: "Đang giao hàng",
          SUCCESS: "Giao hàng thành công",
          FAILED: "Giao hàng thất bại",
          CANCELLED: "Đã hủy đơn",
        };

        const readableStatus = statusMessageMap[toStatus] || toStatus;
        const notificationTitle = "Cập nhật trạng thái đơn hàng";
        const notificationMessage = `Đơn hàng ${orderHash} của bạn đã được chuyển sang trạng thái "${readableStatus}".`;
        const orderLink = `chi-tiet-don-hang/${orderHash}`;
        // Ghi vào bảng notifications
        const { rows: notiRows } = await db.query(
          `INSERT INTO notifications (type_id, title, message, link, sender_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id`,
          [
            notificationTypeId,
            notificationTitle,
            notificationMessage,
            orderLink,
            req.user?.id || null,
          ]
        );

        const notificationId = notiRows[0].id;

        // Ghi vào bảng user_notifications
        await db.query(
          `INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted)
           VALUES ($1, $2, 0, NULL, 0)`,
          [userId, notificationId]
        );
      } else {
        console.warn(
          "Loại thông báo 'order' không tồn tại hoặc đã bị vô hiệu hóa."
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Đã chuyển trạng thái đơn hàng sang ${toStatus}`,
      new_status: toStatus,
    });
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật trạng thái",
    });
  }
});

/**
 * @route   PUT /api/orders/:id/return-status
 * @desc    Cập nhật trạng thái hoàn trả đơn hàng
 * @access  Private (Admin)
 */
router.put("/:id/return-status", verifyToken, isAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  const normalizedReturnStatus = String(req.body.return_status || "")
    .trim()
    .toUpperCase();
  const statusCode =
    normalizedReturnStatus === ""
      ? null
      : RETURN_STATUS_LABEL_TO_CODE[normalizedReturnStatus];

  if (Number.isNaN(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Mã đơn hàng không hợp lệ",
    });
  }

  if (normalizedReturnStatus !== "" && statusCode === undefined) {
    return res.status(400).json({
      success: false,
      message: "Trạng thái hoàn trả không hợp lệ",
    });
  }

  try {
    let responseStatusCode = normalizedReturnStatus;

    await withTransaction(async (client) => {
      const { rows: orderRows } = await client.query(
        `SELECT order_id, order_hash, order_status, user_id, order_name, order_email
         FROM orders
         WHERE order_id = $1`,
        [orderId]
      );
      const order = orderRows[0];

      if (!order) {
        const notFound = new Error("Không tìm thấy đơn hàng");
        notFound.statusCode = 404;
        throw notFound;
      }

      const { rows: returnRows } = await client.query(
        `SELECT return_id, return_status, return_reason, return_total
         FROM order_returns
         WHERE order_id = $1
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [orderId]
      );
      const existingReturn = returnRows[0] || null;

      if (normalizedReturnStatus === "") {
        if (existingReturn) {
          await client.query(
            "DELETE FROM return_items WHERE return_id = $1",
            [existingReturn.return_id]
          );
          await client.query(
            "DELETE FROM order_returns WHERE order_id = $1",
            [orderId]
          );
        }

        await client.query(
          `UPDATE orders
           SET order_status = $1, updated_at = NOW()
           WHERE order_id = $2`,
          [ORDER_STATUS_KEY_TO_CODE.SUCCESS, orderId]
        );

        await client.query(
          `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            orderId,
            Number(order.order_status),
            ORDER_STATUS_KEY_TO_CODE.SUCCESS,
            req.user?.id || null,
            "Hủy yêu cầu hoàn trả",
          ]
        );

        responseStatusCode = "";
        return;
      }

      if (existingReturn) {
        await client.query(
          `UPDATE order_returns
           SET return_status = $1, updated_at = NOW()
           WHERE return_id = $2`,
          [statusCode, existingReturn.return_id]
        );
      } else {
        await client.query(
          `INSERT INTO order_returns (
            order_id,
            user_id,
            return_reason,
            return_note,
            return_status,
            return_total,
            return_refund_method,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'refund', NOW())`,
          [
            orderId,
            order.user_id || req.user?.id || null,
            "Được tạo bởi admin",
            "Cập nhật trạng thái hoàn trả từ admin",
            statusCode,
            0,
          ]
        );
      }

      await client.query(
        `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          orderId,
          existingReturn ? Number(existingReturn.return_status) : null,
          statusCode,
          req.user?.id || null,
          `Cập nhật trạng thái hoàn trả: ${normalizedReturnStatus}`,
        ]
      );

      if (normalizedReturnStatus !== "APPROVED") {
        return;
      }

      const { rows: customerRows } = await client.query(
        `SELECT
           o.order_hash,
           o.order_name,
           o.order_email,
           u.user_id,
           u.user_name,
           u.user_gmail AS user_email,
           or_data.return_reason,
           or_data.return_total
         FROM orders o
         LEFT JOIN "user" u ON o.user_id = u.user_id
         LEFT JOIN order_returns or_data ON o.order_id = or_data.order_id
         WHERE o.order_id = $1
         ORDER BY or_data.created_at DESC
         LIMIT 1`,
        [orderId]
      );
      const customerInfo = customerRows[0];

      const customerEmail = customerInfo?.order_email || customerInfo?.user_email;
      const customerName = customerInfo?.order_name || customerInfo?.user_name;
      const userId = customerInfo?.user_id;

      if (!userId || !customerEmail) {
        throw new Error("Không có đủ thông tin khách hàng để xử lý tiếp");
      }

      const emailData = {
        customerName: customerName || "Khách hàng",
        orderHash: customerInfo.order_hash,
        reason: customerInfo.return_reason || "Yêu cầu trả hàng",
        refundAmount: customerInfo.return_total || 0,
        approvalDate: new Date().toLocaleDateString("vi-VN"),
        supportEmail: "sonaspace.furniture@gmail.com",
        supportPhone: "1900-xxxx",
      };

      await sendEmail1(
        customerEmail,
        `[Sona Space] Đã duyệt yêu cầu trả hàng - ${customerInfo.order_hash}`,
        emailData,
        "return-approved"
      );

      const timestamp = Date.now().toString().slice(-6);
      const userIdStr = String(userId).padStart(3, "0");
      const couponCode = `RETURN20_${userIdStr}_${timestamp}`;
      const startDate = new Date();
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 14);

      const { rows: couponRows } = await client.query(
        `INSERT INTO couponcode (
          couponcode_code,
          couponcode_description,
          couponcode_startday,
          couponcode_endday,
          couponcode_percent,
          couponcode_amount,
          couponcode_minimum_order,
          couponcode_maximum_discount,
          couponcode_quantity,
          couponcode_used,
          couponcode_status,
          couponcode_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 1, 0)
        RETURNING couponcode_id`,
        [
          couponCode,
          "Mã giảm giá 20% dành cho khách hàng trả hàng thành công",
          startDate,
          expDate,
          20,
          null,
          100000,
          null,
          1,
        ]
      );

      await client.query(
        `INSERT INTO user_has_coupon (user_id, couponcode_id, status)
         VALUES ($1, $2, 0)
         ON CONFLICT (user_id, couponcode_id) DO UPDATE SET status = EXCLUDED.status`,
        [userId, couponRows[0].couponcode_id]
      );

      await createUserNotification(client, {
        userId,
        title: "Bạn nhận được mã giảm giá trả hàng",
        message: `Mã ${couponCode} giảm 20% đã được thêm vào tài khoản của bạn. Hạn dùng: ${expDate.toLocaleDateString("vi-VN")}`,
        link: "/profile/vouchers",
        senderId: req.user?.id || null,
        typeCodes: ["coupon", "promotion", "system"],
      });

      const { rows: soldRows } = await client.query(
        `SELECT oi.quantity, vp.product_id
         FROM order_items oi
         JOIN variant_product vp ON oi.variant_id = vp.variant_id
         WHERE oi.order_id = $1`,
        [orderId]
      );

      for (const item of soldRows) {
        if (!item.product_id) continue;
        await client.query(
          `UPDATE product
           SET product_sold = GREATEST(product_sold - $1, 0),
               updated_at = NOW()
           WHERE product_id = $2`,
          [item.quantity, item.product_id]
        );
      }
    });

    const statusText =
      responseStatusCode === ""
        ? "Không có hoàn trả"
        : responseStatusCode === "PENDING"
          ? "Đang chờ xử lý"
          : responseStatusCode === "APPROVED"
            ? "Đã duyệt trả hàng"
            : responseStatusCode === "CANCEL_CONFIRMED"
              ? "Xác nhận hủy đơn hàng"
              : responseStatusCode === "CANCELLED"
                ? "Đã hủy hoàn tất"
                : responseStatusCode === "REJECTED"
                  ? "Từ chối trả hàng"
                  : RETURN_STATUS_CODE_TO_LABEL[
                    RETURN_STATUS_LABEL_TO_CODE[responseStatusCode]
                  ] || responseStatusCode;

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái hoàn trả thành: ${statusText}`,
      return_status: responseStatusCode,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    console.error("❌ Lỗi cập nhật trạng thái hoàn trả:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi cập nhật trạng thái hoàn trả",
      error: error.message,
    });
  }
});


/**
 * @route   DELETE /api/orders/:id
 * @desc    Hủy đơn hàng (chỉ admin hoặc chủ đơn hàng mới tạo)
 * @access  Private
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    // Kiểm tra đơn hàng tồn tại
    const { rows: existingOrder } = await db.query(
      `
      SELECT order_id, user_id, order_status, created_at 
      FROM orders WHERE order_id = $1
    `,
      [orderId]
    );

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = existingOrder[0];
    const currentStatus = toLegacyOrderStatus(order.order_status);

    // Kiểm tra quyền hủy đơn hàng
    if (req.user.role !== "admin" && req.user.id !== order.user_id) {
      return res
        .status(403)
        .json({ error: "You do not have permission to cancel this order" });
    }

    // Chỉ cho phép hủy đơn hàng ở trạng thái PENDING hoặc CONFIRMED
    if (
      ![0, 1].includes(Number(order.order_status)) &&
      req.user.role !== "admin"
    ) {
      return res
        .status(400)
        .json({ error: "Cannot cancel order in current status" });
    }

    // Chỉ khách hàng mới được hủy đơn hàng trong vòng 24 giờ sau khi tạo
    if (req.user.role !== "admin") {
      const orderDate = new Date(order.created_at);
      const currentDate = new Date();
      const hoursDiff = (currentDate - orderDate) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return res
          .status(400)
          .json({ error: "Cannot cancel order after 24 hours" });
      }
    }

    await withTransaction(async (client) => {
      // Lấy danh sách sản phẩm trong đơn hàng
      const { rows: orderItems } = await client.query(
        `
        SELECT oi.variant_id, oi.quantity, vp.product_id
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        WHERE oi.order_id = $1
        `,
        [orderId]
      );

      // Khôi phục số lượng tồn kho
      for (const item of orderItems) {
        if (item.variant_id) {
          await client.query(
            "UPDATE variant_product SET variant_product_quantity = COALESCE(variant_product_quantity, 0) + $1 WHERE variant_id = $2",
            [item.quantity, item.variant_id]
          );
        }

        if (item.product_id) {
          await client.query(
            "UPDATE product SET product_stock = COALESCE(product_stock, 0) + $1 WHERE product_id = $2",
            [item.quantity, item.product_id]
          );
        }
      }

      // Cập nhật trạng thái đơn hàng sang "Đã hủy"
      await client.query(
        "UPDATE orders SET order_status = $1, updated_at = NOW() WHERE order_id = $2",
        [-1, orderId]
      );

      // Hoàn tất payment trạng thái hủy nếu có
      await client.query(
        "UPDATE payments SET payment_status = 'cancelled', updated_at = NOW() WHERE payment_id = (SELECT payment_id FROM orders WHERE order_id = $1)",
        [orderId]
      );

      // Thêm vào lịch sử trạng thái
      await client.query(
        `
        INSERT INTO order_status_log (
          order_id, old_status, new_status, changed_by, note, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `,
        [
          orderId,
          Number(order.order_status),
          -1,
          req.user?.id || null,
          `Đơn hàng đã bị hủy (từ ${currentStatus})`,
        ]
      );
    });

    res.json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

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
 * @route   POST /api/orders/send-invoice
 * @desc    Gửi hóa đơn qua email
 * @access  Private
 */
router.post("/send-invoice", verifyToken, async (req, res) => {
  try {
    const orderId = Number(req.body.order_id);
    const email = req.body.email;

    if (Number.isNaN(orderId) || !email) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin đơn hàng hoặc email",
      });
    }

    const { rows: orders } = await db.query(
      `
      SELECT * FROM orders WHERE order_id = $1
    `,
      [orderId]
    );

    if (orders.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy đơn hàng" });
    }

    const order = orders[0];

    const { rows: orderItems } = await db.query(
      `
      SELECT oi.*, oi.price AS product_price, p.product_name, c.color_name AS variant_name
      FROM order_items oi
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      WHERE oi.order_id = $1
    `,
      [orderId]
    );

    const invoiceUrl = `${process.env.SITE_URL || "http://localhost:3501"}/dashboard/orders/invoice/${orderId}`;

    console.log(`Gửi hóa đơn #${orderId} đến email: ${email}`);
    console.log(`URL hóa đơn: ${invoiceUrl}`);

    return res.json({
      success: true,
      message: "Hóa đơn đã được gửi thành công",
      data: {
        order_id: orderId,
        email,
        invoice_url: invoiceUrl,
        total_items: orderItems.length,
        current_status: toLegacyOrderStatus(order.order_status),
      },
    });
  } catch (error) {
    console.error("Error sending invoice:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi gửi hóa đơn",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/orders/:id/send-apology-email
 * @desc    Gửi email xin lỗi cho khách hàng
 * @access  Private (Admin)
 */
router.post(
  "/:id/send-apology-email",
  verifyToken,
  isAdmin,
  async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { reason, message } = req.body;

      if (Number.isNaN(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Mã đơn hàng không hợp lệ",
        });
      }

      const { rows: orders } = await db.query(
        `
      SELECT
        o.*,
        o.order_final_total AS order_total_final,
        u.user_name,
        u.user_gmail,
        u.user_number
      FROM orders o
      LEFT JOIN "user" u ON o.user_id = u.user_id
      WHERE o.order_id = $1
    `,
        [orderId]
      );

      if (orders.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng",
        });
      }

      const order = orders[0];

      if (!order.user_gmail) {
        return res.status(400).json({
          success: false,
          message: "Đơn hàng không có email khách hàng",
        });
      }

      const voucherCode = `SORRY${order.order_id}${Date.now().toString().slice(-4)}`;
      const emailData = {
        customerName: order.user_name || "Quý khách",
        orderId: order.order_id,
        orderHash: order.order_hash,
        orderTotal: new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(order.order_total_final),
        reason: reason || "Sự cố kỹ thuật",
        message:
          message ||
          "Chúng tôi xin lỗi vì sự bất tiện này và sẽ khắc phục sớm nhất có thể.",
        voucherCode,
        discountPercent: 20,
        expiryDate: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000
        ).toLocaleDateString("vi-VN"),
        validDays: 14,
      };

      const emailResult = await sendEmail1(
        order.user_gmail,
        "Xin lỗi về sự cố đơn hàng - Sona Space",
        emailData,
        "apology"
      );

      if (emailResult.success) {
        console.log(
          `✅ Sent apology email for order ${order.order_id} to ${order.user_gmail}`
        );

        return res.json({
          success: true,
          message: "Email xin lỗi đã được gửi thành công",
          data: {
            order_id: order.order_id,
            email: order.user_gmail,
            sent_at: new Date().toISOString(),
            voucherCode: emailData.voucherCode,
            discountPercent: emailData.discountPercent,
            expiryDate: emailData.expiryDate,
          },
        });
      }

      throw new Error(emailResult.error || "Không thể gửi email");
    } catch (error) {
      console.error("❌ Error sending apology email:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi khi gửi email xin lỗi",
        error: error.message,
      });
    }
  }
);

/**
 * @route   PATCH /api/orders/:id
 * @desc    Update specific fields of an order
 * @access  Private (Admin)
 */
router.patch("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    const updateData = { ...(req.body || {}) };

    // Validate that orderId is a number
    if (Number.isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const updatedFields = [];

    await withTransaction(async (client) => {
      const { rows: orderRows } = await client.query(
        "SELECT order_id, payment_id FROM orders WHERE order_id = $1",
        [orderId]
      );
      const order = orderRows[0];

      if (!order) {
        const notFound = new Error("Order not found");
        notFound.statusCode = 404;
        throw notFound;
      }

      const allowedOrderFieldMap = {
        order_name_new: "order_name",
        order_email_new: "order_email",
        order_number2: "order_phone",
        order_address_new: "order_address",
        note: "order_note",
      };

      const filteredData = {};
      for (const [legacyKey, dbColumn] of Object.entries(allowedOrderFieldMap)) {
        if (Object.prototype.hasOwnProperty.call(updateData, legacyKey)) {
          filteredData[dbColumn] = updateData[legacyKey];
          updatedFields.push(legacyKey);
        }
      }

      const setParts = [];
      const setValues = [];
      let idx = 1;
      for (const [column, value] of Object.entries(filteredData)) {
        setParts.push(`${column} = $${idx++}`);
        setValues.push(value);
      }

      const paymentMethodRaw = updateData.payment_method;
      let normalizedPaymentMethod = null;
      if (paymentMethodRaw !== undefined) {
        const paymentMethodMap = {
          COD: "cod",
          MOMO: "momo",
          VNPAY: "vnpay",
          ZALOPAY: "zalopay",
        };
        normalizedPaymentMethod =
          paymentMethodMap[String(paymentMethodRaw).toUpperCase()] || null;

        if (!normalizedPaymentMethod) {
          throw new Error("Invalid payment method");
        }

        setParts.push(`order_payment_method = $${idx++}`);
        setValues.push(normalizedPaymentMethod);
        updatedFields.push("payment_method");
      }

      if (setParts.length > 0) {
        setValues.push(orderId);
        await client.query(
          `UPDATE orders SET ${setParts.join(", ")}, updated_at = NOW() WHERE order_id = $${idx}`,
          setValues
        );
      }

      if (normalizedPaymentMethod) {
        if (order.payment_id) {
          await client.query(
            "UPDATE payments SET payment_method = $1, updated_at = NOW() WHERE payment_id = $2",
            [normalizedPaymentMethod, order.payment_id]
          );
        } else {
          const { rows: paymentRows } = await client.query(
            `INSERT INTO payments (payment_method, payment_status, payment_amount, created_at)
             VALUES ($1, 'pending', 0, NOW())
             RETURNING payment_id`,
            [normalizedPaymentMethod]
          );
          await client.query(
            "UPDATE orders SET payment_id = $1 WHERE order_id = $2",
            [paymentRows[0].payment_id, orderId]
          );
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      updatedFields,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }
    console.error("Error updating order:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating order",
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/orders/return/:orderHash
 * @desc    Process an order return request with images
 * @access  Private
 */
router.post(
  "/return/:orderHash",
  verifyToken,
  upload.array("return_images", 5),
  async (req, res) => {
    try {
      const { orderHash } = req.params;
      const { reason, items, return_type } = req.body;
      const user_id = req.user.id;
      const isAdmin = req.user.role === "admin";
      const uploadedFiles = req.files || [];

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng cung cấp lý do trả hàng",
        });
      }

      // Tìm đơn hàng dựa trên order_hash
      const { rows: orderRows } = await db.query(
        `SELECT o.order_id, o.user_id, o.order_status, o.created_at, o.order_hash,
       o.order_name, o.order_email,
       u.user_name, u.user_gmail as user_email
       FROM orders o
       LEFT JOIN "user" u ON o.user_id = u.user_id
       WHERE o.order_hash = $1`,
        [orderHash]
      );
      const order = orderRows[0];

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy đơn hàng",
        });
      }

      // Kiểm tra quyền truy cập (chỉ admin hoặc chủ đơn hàng)
      if (!isAdmin && user_id !== order.user_id) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền trả lại đơn hàng này",
        });
      }

      // Kiểm tra trạng thái đơn hàng (chỉ cho phép trả hàng khi đơn hàng đã hoàn thành)
      if (Number(order.order_status) !== ORDER_STATUS_KEY_TO_CODE.SUCCESS) {
        return res.status(400).json({
          success: false,
          message: "Chỉ có thể trả lại đơn hàng đã giao thành công",
        });
      }

      // Upload hình ảnh lên Cloudinary
      let uploadedImageUrls = [];
      if (uploadedFiles.length > 0) {
        try {
          const uploadPromises = uploadedFiles.map((file) => {
            return new Promise((resolve, reject) => {
              cloudinary.uploader
                .upload_stream(
                  {
                    folder: "order_returns",
                    public_id: `return_${orderHash}_${Date.now()}_${Math.random()
                      .toString(36)
                      .substr(2, 9)}`,
                    resource_type: "image",
                  },
                  (error, result) => {
                    if (error) {
                      console.error("Cloudinary upload error:", error);
                      reject(error);
                    } else {
                      resolve(result.secure_url);
                    }
                  }
                )
                .end(file.buffer);
            });
          });

          uploadedImageUrls = await Promise.all(uploadPromises);
          console.log(
            "Đã upload thành công:",
            uploadedImageUrls.length,
            "hình ảnh"
          );
        } catch (uploadError) {
          console.error("Lỗi upload hình ảnh:", uploadError);
          return res.status(500).json({
            success: false,
            message: "Lỗi khi upload hình ảnh",
            error: uploadError.message,
          });
        }
      }

      let responseData = null;

      await withTransaction(async (client) => {
        const { rows: orderItems } = await client.query(
          `SELECT oi.order_item_id, oi.variant_id, oi.quantity, oi.price AS product_price,
                  vp.product_id, p.product_name, p.product_image
           FROM order_items oi
           LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
           LEFT JOIN product p ON vp.product_id = p.product_id
           WHERE oi.order_id = $1`,
          [order.order_id]
        );

        let itemsToReturn = orderItems;
        let totalRefundAmount = 0;

        if (items && Array.isArray(items) && items.length > 0) {
          itemsToReturn = orderItems.filter((item) =>
            items.some(
              (returnItem) =>
                returnItem.order_item_id === item.order_item_id &&
                Number(returnItem.quantity) > 0 &&
                Number(returnItem.quantity) <= Number(item.quantity)
            )
          );

          if (!itemsToReturn.length) {
            throw new Error("Không tìm thấy sản phẩm hợp lệ để trả lại");
          }
        }

        for (const item of itemsToReturn) {
          const returnItem = Array.isArray(items)
            ? items.find((i) => i.order_item_id === item.order_item_id)
            : null;
          const returnQuantity = returnItem
            ? Math.min(Number(returnItem.quantity), Number(item.quantity))
            : Number(item.quantity);
          const itemPrice = Number(item.product_price || 0);

          if (returnQuantity <= 0) continue;

          totalRefundAmount += returnQuantity * itemPrice;

          if (item.variant_id) {
            await client.query(
              `UPDATE variant_product
               SET variant_product_quantity = COALESCE(variant_product_quantity, 0) + $1
               WHERE variant_id = $2`,
              [returnQuantity, item.variant_id]
            );
          }

          if (item.product_id) {
            await client.query(
              `UPDATE product
               SET product_stock = COALESCE(product_stock, 0) + $1
               WHERE product_id = $2`,
              [returnQuantity, item.product_id]
            );
          }
        }

        const returnImagesJson =
          uploadedImageUrls.length > 0 ? JSON.stringify(uploadedImageUrls) : null;

        const { rows: returnRows } = await client.query(
          `INSERT INTO order_returns (
            order_id,
            user_id,
            return_reason,
            return_note,
            return_images,
            return_status,
            return_total,
            return_refund_method,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          RETURNING return_id`,
          [
            order.order_id,
            user_id,
            reason,
            `Return type: ${return_type || "refund"}`,
            returnImagesJson,
            RETURN_STATUS_LABEL_TO_CODE.PENDING,
            totalRefundAmount,
            return_type || "refund",
          ]
        );

        const returnId = returnRows[0].return_id;

        for (const item of itemsToReturn) {
          const returnItem = Array.isArray(items)
            ? items.find((i) => i.order_item_id === item.order_item_id)
            : null;
          const returnQuantity = returnItem
            ? Math.min(Number(returnItem.quantity), Number(item.quantity))
            : Number(item.quantity);

          if (returnQuantity <= 0) continue;

          await client.query(
            `INSERT INTO return_items (
              return_id, order_item_id, quantity, price, created_at
            ) VALUES ($1, $2, $3, $4, NOW())`,
            [returnId, item.order_item_id, returnQuantity, Number(item.product_price || 0)]
          );
        }

        await client.query(
          `UPDATE orders
           SET order_note = COALESCE(order_note, '') || $1,
               updated_at = NOW()
           WHERE order_id = $2`,
          [`\nYêu cầu hoàn trả. Lý do: ${reason}`, order.order_id]
        );

        await client.query(
          `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            order.order_id,
            Number(order.order_status),
            Number(order.order_status),
            req.user?.id || null,
            `Yêu cầu hoàn trả được tạo bởi ${isAdmin ? "admin" : "user"}`,
          ]
        );

        if (!isAdmin) {
          const { rows: adminRows } = await client.query(
            `SELECT user_id
             FROM "user"
              WHERE user_role::text = 'admin'
             ORDER BY user_id
             LIMIT 1`
          );

          if (adminRows.length > 0) {
            await createUserNotification(client, {
              userId: adminRows[0].user_id,
              title: "Yêu cầu trả hàng mới",
              message: `Đơn hàng #${order.order_hash} có yêu cầu trả hàng mới với ${uploadedImageUrls.length} hình ảnh`,
              link: `/dashboard/orders/details/${order.order_id}`,
              senderId: req.user?.id || null,
              typeCodes: ["order", "system"],
            });
          }
        }

        responseData = {
          return_id: returnId,
          order_id: order.order_id,
          order_hash: order.order_hash,
          reason,
          return_images: uploadedImageUrls,
          total_refund: totalRefundAmount,
          items: itemsToReturn.map((item) => {
            const returnItem = Array.isArray(items)
              ? items.find((i) => i.order_item_id === item.order_item_id)
              : null;
            return {
              order_item_id: item.order_item_id,
              product_name: item.product_name,
              quantity: returnItem ? Number(returnItem.quantity || 0) : Number(item.quantity || 0),
              price: Number(item.product_price || 0),
            };
          }),
        };
      });

      return res.status(200).json({
        success: true,
        message: "Yêu cầu trả hàng đã được ghi nhận",
        data: responseData,
      });
    } catch (error) {
      console.error("Lỗi khi xử lý yêu cầu trả hàng:", error);

      if (uploadedImageUrls.length > 0) {
        try {
          await Promise.all(
            uploadedImageUrls.map((url) => {
              const publicId = url.split("/").pop().split(".")[0];
              return cloudinary.uploader.destroy(`order_returns/${publicId}`);
            })
          );
        } catch (deleteError) {
          console.error("Lỗi khi xóa hình ảnh sau rollback:", deleteError);
        }
      }

      return res.status(500).json({
        success: false,
        message: "Đã xảy ra lỗi khi xử lý yêu cầu trả hàng",
        error: error.message,
      });
    }
  }
);

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






