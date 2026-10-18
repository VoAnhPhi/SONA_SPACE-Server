"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const db = require("../../config/database");
const { withTransaction } = require("../../shared/db/transaction");
const { sendEmail1 } = require("../../shared/mail/order.mail");
const { createUserNotification } = require("../notifications/notification-dispatch");
const { ORDER_STATUS_KEY_TO_CODE, toLegacyOrderStatus, RETURN_STATUS_LABEL_TO_CODE, RETURN_STATUS_CODE_TO_LABEL } = require("./order-status.constants");


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

module.exports = router;
