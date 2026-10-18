"use strict";

const db = require("../config/database");
const { getOrderDetail } = require("../modules/orders/order-detail.service");

// The pages used to read the order over HTTP, so dates arrived as ISO strings; the JSON round trip
// keeps the templates seeing exactly that shape.
async function loadOrder(orderId, user, purpose) {
  try {
    return JSON.parse(JSON.stringify(await getOrderDetail(Number(orderId), user)));
  } catch (loadError) {
    console.log(`Order service failed${purpose}, falling back to direct DB query:`, loadError.message);
    return null;
  }
}

async function detail(req, res) {
  try {
    const orderId = req.params.id;
    let order = await loadOrder(orderId, req.user, "");

    // If the order could not be loaded, read it directly from the database
    if (!order) {
      const { rows: orderRows } = await db.query(
        `SELECT o.*, u.user_name as customer_name, u.user_gmail as customer_email, u.user_number as customer_phone
         FROM orders o 
         LEFT JOIN "user" u ON o.user_id = u.user_id 
         WHERE o.order_id = $1`,
        [orderId]
      );
      
      if (orderRows.length === 0) {
        return res.status(404).render("error", {
          message: "Không tìm thấy đơn hàng",
          error: { status: 404 },
          layout: "layouts/dashboard",
        });
      }
      
      order = orderRows[0];
    }

    // If items are missing, fetch them directly from the database
    if (!order.items || order.items.length === 0) {
      const { rows: items } = await db.query(
        `
        SELECT oi.*, p.product_name, p.product_image, c.color_code AS color_hex
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        LEFT JOIN color c ON vp.color_id = c.color_id
        WHERE oi.order_id = $1
      `,
        [orderId]
      );
      order.items = items;
    }

    // Fetch payment method from payments table if not available in order
    if (!order.payment || !order.payment.length) {
      try {
          const { rows: paymentRows } = await db.query(
          `
          SELECT
            p.payment_method AS method,
            p.payment_status AS status,
            p.payment_transaction_id AS transaction_code,
            p.payment_paid_at AS paid_at
          FROM orders o
          LEFT JOIN payments p ON o.payment_id = p.payment_id
          WHERE o.order_id = $1
          ORDER BY p.created_at DESC
          LIMIT 1
          `,
          [orderId]
        );
        const paymentInfo = paymentRows[0] || null;

        if (paymentInfo) {
          order.payment = [paymentInfo];
        } else {
          order.payment = [
            {
              method: "N/A",
              status: "PENDING",
              transaction_code: null,
              paid_at: null,
            },
          ];
        }
      } catch (error) {
        order.payment = [
          {
            method: "N/A",
            status: "PENDING",
            transaction_code: null,
            paid_at: null,
          },
        ];
      }
    }

    // Define available payment methods for dropdown
    const paymentMethods = ["COD", "BANK_TRANSFER", "VNPAY", "MOMO", "ZALOPAY"];

    // Process status logs to group by status type
    const statusLogs = order.status_logs || [];

    // Group status logs by type
    const paymentStatusLogs = statusLogs.filter(
      (log) =>
        log.to_status === "PENDING" ||
        log.to_status === "PROCESSING" ||
        log.to_status === "SUCCESS" ||
        log.to_status === "FAILED" ||
        log.to_status === "CANCELLED"
    );

    const orderStatusLogs = statusLogs.filter(
      (log) =>
        log.to_status === "PENDING" ||
        log.to_status === "CONFIRMED" ||
        log.to_status === "SHIPPING" ||
        log.to_status === "SUCCESS" ||
        log.to_status === "FAILED" ||
        log.to_status === "CANCELLED"
    );

    const shippingStatusLogs = statusLogs.filter(
      (log) =>
        log.to_status === "pending" ||
        log.to_status === "picking_up" ||
        log.to_status === "picked_up" ||
        log.to_status === "in_transit" ||
        log.to_status === "delivered" ||
        log.to_status === "delivery_failed" ||
        log.to_status === "returning" ||
        log.to_status === "returned" ||
        log.to_status === "canceled"
    );

    // Get the most recent log for each status type
    const latestPaymentLog =
      paymentStatusLogs.length > 0
        ? paymentStatusLogs[paymentStatusLogs.length - 1]
        : null;

    const latestOrderLog =
      orderStatusLogs.length > 0
        ? orderStatusLogs[orderStatusLogs.length - 1]
        : null;

    const latestShippingLog =
      shippingStatusLogs.length > 0
        ? shippingStatusLogs[shippingStatusLogs.length - 1]
        : null;

    // Helper functions for template
    const helpers = {
      mapPaymentStatus: (status) => {
        switch (status) {
          case "PENDING":
            return "Chờ thanh toán";
          case "SUCCESS":
            return "Đã thanh toán";
          case "FAILED":
            return "Thanh toán thất bại";
          case "REFUNDED":
            return "Đã hủy";
          default:
            return status || "Chờ thanh toán";
        }
      },
      mapStatus: (status) => {
        switch (status) {
          case "PENDING":
            return "Chờ xác nhận";
          case "CONFIRMED":
            return "Đã xác nhận";
          case "SHIPPING":
            return "Đang giao";
          case "SUCCESS":
            return "Giao hàng thành công";
          case "FAILED":
            return "Thất bại";
          case "CANCELLED":
            return "Đã hủy";
          case "RETURN":
            return "Đang hoàn trả";
          default:
            return status || "Chờ xác nhận";
        }
      },
      mapShippingStatus: (status) => {
        switch (status) {
          case "pending":
            return "Chờ lấy hàng";
          case "picking_up":
            return "Đang đi lấy hàng";
          case "picked_up":
            return "Đã lấy hàng";
          case "in_transit":
            return "Đang vận chuyển";
          case "delivered":
            return "Đã giao hàng";
          case "delivery_failed":
            return "Giao hàng thất bại";
          case "returning":
            return "Đang hoàn trả";
          case "returned":
            return "Đã hoàn trả";
          case "canceled":
            return "Đã hủy";
          default:
            return status || "Chờ lấy hàng";
        }
      },
      mapShippingStatusClass: (status) => {
        switch (status) {
          case "pending":
            return "badge-secondary";
          case "picking_up":
            return "badge-info";
          case "picked_up":
            return "badge-primary";
          case "in_transit":
            return "badge-primary";
          case "delivered":
            return "badge-success";
          case "delivery_failed":
            return "badge-danger";
          case "returning":
            return "badge-warning";
          case "returned":
            return "badge-warning";
          case "canceled":
            return "badge-dark";
          default:
            return "badge-secondary";
        }
      },
      mapShippingStatusIcon: (status) => {
        switch (status) {
          case "pending":
            return "fa-clock";
          case "picking_up":
            return "fa-people-carry";
          case "picked_up":
            return "fa-box";
          case "in_transit":
            return "fa-truck";
          case "delivered":
            return "fa-check-circle";
          case "delivery_failed":
            return "fa-times-circle";
          case "returning":
            return "fa-undo";
          case "returned":
            return "fa-box-open";
          case "canceled":
            return "fa-ban";
          default:
            return "fa-clock";
        }
      },
      formatPrice: (price) => {
        if (!price) return "0";
        try {
          return parseFloat(price).toLocaleString("vi-VN");
        } catch (error) {
          return "0";
        }
      },
      formatDateTime: (dateTimeStr) => {
        if (!dateTimeStr) return "";
        try {
          const date = new Date(dateTimeStr);
          return date.toLocaleString("vi-VN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        } catch (error) {
          return dateTimeStr;
        }
      },
    };
    res.render("dashboard/orders/order-detail", {
      title: `Chi tiết đơn hàng #${orderId}`,
      layout: "layouts/dashboard",
      orderId,
      order,
      paymentMethods,
      statusLogs: {
        payment: paymentStatusLogs,
        order: orderStatusLogs,
        shipping: shippingStatusLogs,
        latestPayment: latestPaymentLog,
        latestOrder: latestOrderLog,
        latestShipping: latestShippingLog,
      },
      mapPaymentStatus: helpers.mapPaymentStatus,
      mapStatus: helpers.mapStatus,
      mapShippingStatus: helpers.mapShippingStatus,
      mapShippingStatusClass: helpers.mapShippingStatusClass,
      mapShippingStatusIcon: helpers.mapShippingStatusIcon,
      formatPrice: helpers.formatPrice,
      formatDateTime: helpers.formatDateTime,
    });
  } catch (error) {
    console.error("Error in /orders/detail/:id:", error);
    res.status(500).render("error", {
      message: "Không thể tải thông tin đơn hàng",
      error: { 
        status: 500, 
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        message: error.message 
      },
      layout: "layouts/dashboard",
    });
  }
}

async function invoice(req, res) {
  try {
    const orderId = req.params.id;
    let order = await loadOrder(orderId, req.user, " for invoice");

    // If the order could not be loaded, read it directly from the database
    if (!order) {
      const { rows: orderRows } = await db.query(
        `SELECT o.*, u.user_name as customer_name, u.user_gmail as customer_email, u.user_number as customer_phone
         FROM orders o 
         LEFT JOIN "user" u ON o.user_id = u.user_id 
         WHERE o.order_id = $1`,
        [orderId]
      );
      
      if (orderRows.length === 0) {
        return res.status(404).render("error", {
          message: "Không tìm thấy đơn hàng",
          error: { status: 404 },
          layout: "layouts/dashboard",
        });
      }
      
      order = orderRows[0];
    }

    // If items are missing, fetch them directly from the database
    if (!order.items || order.items.length === 0) {
      const { rows: items } = await db.query(
        `
        SELECT oi.*, p.product_name, vp.variant_product_price, vp.variant_product_price_sale
        FROM order_items oi
        LEFT JOIN variant_product vp ON oi.variant_id = vp.variant_id
        LEFT JOIN product p ON vp.product_id = p.product_id
        WHERE oi.order_id = $1
      `,
        [orderId]
      );
      order.items = items;
    }

    // Calculate totals if not already provided
    if (!order.subtotal) {
      const subtotal = order.items.reduce((sum, item) => {
        const price = item.price_sale || item.price || item.product_price || 0;
        return sum + price * item.quantity;
      }, 0);

      order.subtotal = subtotal;
      order.shipping_fee = order.shipping_fee || order.shippingFee || 0;
      order.discount = order.discount || order.order_discount || 0;
      order.tax = order.tax || subtotal * 0.08; // Giả sử thuế VAT 8%
      order.total_amount =
        order.total_amount ||
        order.order_total_final ||
        order.total ||
        subtotal + order.shipping_fee + order.tax - order.discount;
    }

    // Prepare customer information
    order.customer_name =
      order.recipientName ||
      order.order_name_new ||
      order.order_name_old ||
      order.user_name;
    order.customer_email =
      order.recipientEmail ||
      order.order_email_new ||
      order.order_email_old ||
      order.user_email;
    order.customer_phone =
      order.recipientPhone ||
      order.order_number2 ||
      order.order_number1 ||
      order.user_phone;
    order.shipping_address =
      order.address || order.order_address_new || order.order_address_old;

    // Helper functions for template
    const mapPaymentStatus = (status) => {
      switch (status) {
        case "PENDING":
          return "Chờ thanh toán";
        case "PROCESSING":
          return "Đang xử lý";
        case "SUCCESS":
          return "Đã thanh toán";
        case "FAILED":
          return "Thanh toán thất bại";
        case "CANCELLED":
          return "Đã hủy";
        default:
          return status || "Chờ thanh toán";
      }
    };

    const mapShippingStatus = (status) => {
      switch (status) {
        case "pending":
          return "Chờ lấy hàng";
        case "picking_up":
          return "Đang đi lấy hàng";
        case "picked_up":
          return "Đã lấy hàng";
        case "in_transit":
          return "Đang vận chuyển";
        case "delivered":
          return "Đã giao hàng";
        case "delivery_failed":
          return "Giao hàng thất bại";
        case "returning":
          return "Đang hoàn trả";
        case "returned":
          return "Đã hoàn trả";
        case "canceled":
          return "Đã hủy";
        default:
          return status || "Chờ lấy hàng";
      }
    };

    res.render("dashboard/orders/order-invoice", {
      title: "Order Invoice",
      layout: false, // Không sử dụng layout để in hóa đơn dễ dàng
      orderId: orderId,
      order: order,
      mapPaymentStatus,
      mapShippingStatus,
    });
  } catch (error) {
    res.status(500).send("Đã xảy ra lỗi khi tải hóa đơn: " + error.message);
  }
}

module.exports = { detail, invoice };
