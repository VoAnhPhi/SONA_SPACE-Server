"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { toLegacyOrderStatus } = require("./order-status.constants");

/**
 * One order with its payment, line items and status history. A customer may only read their own
 * order; staff read any. Shared by GET /api/orders/:id and the admin order pages.
 */
function getOrderDetail(orderId, requester) {
  return guard(
    (error) => ({ error: "Failed to fetch order", details: error.message }),
    async () => {
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
        throw new HttpError(404, { error: "Order not found" });
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

      if (requester.role !== "admin" && requester.id !== order.user_id) {
        throw new HttpError(403, { error: "You do not have permission to view this order" });
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

      return order;
    }
  );
}

module.exports = { getOrderDetail };
