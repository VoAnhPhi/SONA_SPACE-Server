const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { withTransaction } = require("../db/transaction");
const { verifyToken } = require("../middleware/auth");

const ORDER_STATUS = {
  CANCELLED: -1,
  PENDING: 0,
  CONFIRMED: 1,
  SHIPPING: 2,
  DELIVERED: 3,
  COMPLETED: 4,
};

const STATUS_META = {
  [-1]: { name: "CANCELLED", step: 4, processType: "cancellation" },
  0: { name: "PENDING", step: 1, processType: "normal" },
  1: { name: "CONFIRMED", step: 2, processType: "normal" },
  2: { name: "SHIPPING", step: 3, processType: "normal" },
  3: { name: "DELIVERED", step: 4, processType: "normal" },
  4: { name: "COMPLETED", step: 4, processType: "normal" },
};

const RETURN_STATUS_LABELS = {
  0: "PENDING",
  1: "APPROVED",
  2: "COMPLETED",
  3: "REJECTED",
};

function isPrivilegedUser(req) {
  const role = req.user?.role?.toLowerCase();
  return role === "admin" || role === "staff" || req.user?.isAdmin;
}

function getStatusMeta(status) {
  return STATUS_META[Number(status)] || STATUS_META[ORDER_STATUS.PENDING];
}

function canCustomerCancel(order) {
  return [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED].includes(Number(order.order_status));
}

function ensurePositiveId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`Invalid ${label}`);
    error.status = 400;
    throw error;
  }
  return id;
}

function buildIdPlaceholders(ids) {
  return ids.map((_, index) => `$${index + 1}`).join(", ");
}

function firstImageUrl(value) {
  if (Array.isArray(value)) {
    return value.find((image) => String(image || '').trim()) || '/images/default.jpg';
  }

  return String(value || '')
    .split(',')
    .map((image) => image.trim())
    .find(Boolean) || '/images/default.jpg';
}

function formatOrder(order, itemsMap, returnsMap) {
  const statusMeta = getStatusMeta(order.order_status);
  const returnInfo = returnsMap.get(order.order_id) || null;
  const returnStatusLabel = returnInfo
    ? RETURN_STATUS_LABELS[returnInfo.return_status] || String(returnInfo.return_status)
    : null;

  const result = {
    id: order.order_id,
    order_hash: order.order_hash,
    date: order.created_at || order.order_date,
    order_status: order.order_status,
    current_status: statusMeta.name,
    status: statusMeta.name,
    statusStep: statusMeta.step,
    processType: returnInfo ? "return" : statusMeta.processType,
    recipientName: order.order_name || "Customer",
    recipientPhone: order.order_phone,
    address: order.order_address,
    subtotal: order.order_total,
    shippingFee: Number(order.order_shipping_fee) || 0,
    discount: Number(order.order_discount) || 0,
    total: order.order_final_total,
    products: itemsMap.get(order.order_id) || [],
  };

  if (returnInfo) {
    result.returnInfo = {
      return_id: returnInfo.return_id,
      reason: returnInfo.return_reason,
      note: returnInfo.return_note,
      total_refund: returnInfo.return_total,
      return_status: returnStatusLabel,
      return_status_id: returnInfo.return_status,
      return_created_at: returnInfo.created_at,
      return_updated_at: returnInfo.updated_at,
    };
  }

  return result;
}

async function createOrderNotification(client, { userId, title, message, senderId, link }) {
  const { rows: types } = await client.query(
    "SELECT id FROM notification_types WHERE type_code = $1 OR type_code = $2 ORDER BY CASE WHEN type_code = $1 THEN 0 ELSE 1 END LIMIT 1",
    ["order", "system"]
  );

  if (types.length === 0) return;

  const { rows: notifications } = await client.query(
    `INSERT INTO notifications (type_id, title, message, link, sender_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [types[0].id, title, message, link || null, senderId || null]
  );

  await client.query(
    "INSERT INTO user_notifications (user_id, notification_id, is_read, read_at, is_deleted) VALUES ($1, $2, 0, NULL, 0)",
    [userId, notifications[0].id]
  );
}

router.get("/:userId", async (req, res) => {
  try {
    const userId = ensurePositiveId(req.params.userId, "user ID");

    const { rows: orders } = await db.query(
      `
      SELECT
        order_id,
        order_hash,
        order_date,
        created_at,
        order_status,
        order_address,
        order_phone,
        order_name,
        order_total,
        order_final_total,
        order_shipping_fee,
        order_discount
      FROM orders
      WHERE user_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `,
      [userId]
    );

    if (orders.length === 0) {
      return res.json({
        message: "No orders found",
        orders: [],
      });
    }

    const orderIds = orders.map((order) => order.order_id);
    const placeholders = buildIdPlaceholders(orderIds);

    const { rows: orderReturns } = await db.query(
      `
      SELECT
        return_id,
        order_id,
        return_reason,
        return_note,
        return_status,
        return_total,
        created_at,
        updated_at
      FROM order_returns
      WHERE order_id IN (${placeholders})
      ORDER BY created_at DESC
    `,
      orderIds
    );

    const returnsMap = new Map();
    for (const returnInfo of orderReturns) {
      if (!returnsMap.has(returnInfo.order_id)) {
        returnsMap.set(returnInfo.order_id, returnInfo);
      }
    }

    const { rows: items } = await db.query(
      `
      SELECT
        oi.order_id,
        oi.order_item_id AS id,
        oi.quantity,
        oi.price,
        vp.variant_id,
        vp.variant_product_price,
        vp.variant_product_price_sale,
        vp.variant_product_list_image AS image,
        c.color_name,
        c.color_code AS color_hex,
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_image,
        cat.category_name AS category,
        COUNT(cm.comment_id)::int AS comment_count,
        AVG(cm.comment_rating) AS average_rating
      FROM order_items oi
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      LEFT JOIN comment cm ON cm.order_item_id = oi.order_item_id AND cm.deleted_at IS NULL
      WHERE oi.order_id IN (${placeholders})
      GROUP BY
        oi.order_id,
        oi.order_item_id,
        oi.quantity,
        oi.price,
        vp.variant_id,
        vp.variant_product_price,
        vp.variant_product_price_sale,
        vp.variant_product_list_image,
        c.color_name,
        c.color_code,
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_image,
        cat.category_name
      ORDER BY oi.order_id, oi.order_item_id
    `,
      orderIds
    );

    const itemsMap = new Map();
    for (const item of items) {
      if (!itemsMap.has(item.order_id)) {
        itemsMap.set(item.order_id, []);
      }

      itemsMap.get(item.order_id).push({
        id: item.id,
        name: item.product_name,
        slug: item.product_slug,
        image: firstImageUrl(item.image || item.product_image),
        price: Number(item.price),
        quantity: item.quantity,
        color: {
          name: item.color_name,
          hex: item.color_hex,
        },
        category: item.category,
        rating: {
          count: item.comment_count,
          average: item.average_rating ? Number(item.average_rating) : 0,
        },
      });
    }

    const fullOrders = orders.map((order) => formatOrder(order, itemsMap, returnsMap));

    return res.json({
      user_id: userId,
      order_count: fullOrders.length,
      orders: fullOrders,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "Failed to fetch orders",
      details: error.status ? undefined : error.message,
    });
  }
});

router.put("/cancel-item/:orderId/:itemId", verifyToken, async (req, res) => {
  try {
    const orderId = ensurePositiveId(req.params.orderId, "order ID");
    const itemId = ensurePositiveId(req.params.itemId, "item ID");
    const userId = req.user.id;
    const isAdmin = isPrivilegedUser(req);
    const { reason } = req.body;

    const itemQuery = [
      `
      SELECT
        o.order_id,
        o.user_id,
        o.order_status,
        o.created_at,
        o.order_hash,
        o.order_total,
        o.order_final_total,
        u.user_name,
        u.user_gmail AS user_email,
        oi.order_item_id,
        oi.variant_id,
        oi.quantity,
        oi.price,
        p.product_name,
        p.product_id,
        ri.return_item_id
      FROM orders o
      LEFT JOIN "user" u ON o.user_id = u.user_id
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN return_items ri ON ri.order_item_id = oi.order_item_id
      WHERE o.order_id = $1
        AND oi.order_item_id = $2
        AND o.deleted_at IS NULL
      `,
    ];
    const itemParams = [orderId, itemId];
    if (!isAdmin) {
      itemQuery.push("AND o.user_id = $3");
      itemParams.push(userId);
    }

    const { rows } = await db.query(itemQuery.join("\n"), itemParams);

    const orderItem = rows[0];
    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item was not found or you do not have permission to cancel it",
      });
    }

    if (orderItem.return_item_id) {
      return res.status(400).json({
        success: false,
        message: "Order item is already in a return or cancellation record",
      });
    }

    if (Number(orderItem.order_status) === ORDER_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    if (!isAdmin) {
      if (!canCustomerCancel(orderItem)) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel item while order status is ${getStatusMeta(orderItem.order_status).name}`,
        });
      }

      const hoursDiff = (Date.now() - new Date(orderItem.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 72) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel item after 72 hours. This order was created ${hoursDiff.toFixed(1)} hours ago.`,
        });
      }
    }

    const result = await withTransaction(async (client) => {
      const itemTotal = Number(orderItem.price) * Number(orderItem.quantity);
      const returnReason =
        reason ||
        (isAdmin
          ? `Item "${orderItem.product_name}" was cancelled by staff`
          : `Item "${orderItem.product_name}" was cancelled by customer`);

      await client.query(
        `UPDATE variant_product
         SET variant_product_quantity = variant_product_quantity + $1
         WHERE variant_id = $2`,
        [orderItem.quantity, orderItem.variant_id]
      );

      await client.query(
        `UPDATE product
         SET product_sold = GREATEST(product_sold - $1, 0),
             updated_at = NOW()
         WHERE product_id = $2`,
        [orderItem.quantity, orderItem.product_id]
      );

      const { rows: returnRows } = await client.query(
        `INSERT INTO order_returns (
          order_id,
          user_id,
          return_reason,
          return_note,
          return_status,
          return_total,
          return_refund_method
        )
        VALUES ($1, $2, $3, $4, 0, $5, 'refund')
        RETURNING return_id`,
        [orderId, orderItem.user_id, returnReason, "Item cancellation", itemTotal]
      );

      await client.query(
        `INSERT INTO return_items (return_id, order_item_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [returnRows[0].return_id, itemId, orderItem.quantity, orderItem.price]
      );

      await client.query(
        `UPDATE orders
         SET order_total = GREATEST(COALESCE(order_total, 0) - $1, 0),
             order_final_total = GREATEST(COALESCE(order_final_total, 0) - $1, 0),
             order_note = COALESCE(order_note, '') || $2,
             updated_at = NOW()
         WHERE order_id = $3`,
        [
          itemTotal,
          `\nCancelled item: ${orderItem.product_name} (${orderItem.quantity} x ${Number(orderItem.price).toLocaleString("vi-VN")}) - Reason: ${reason || "No reason provided"}`,
          orderId,
        ]
      );

      const { rows: remainingRows } = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM order_items oi
         WHERE oi.order_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM return_items ri WHERE ri.order_item_id = oi.order_item_id
           )`,
        [orderId]
      );

      const remainingCount = remainingRows[0].count;
      let orderStatusMessage = "";

      if (remainingCount === 0) {
        await client.query(
          `UPDATE orders
           SET order_status = $1,
               order_note = COALESCE(order_note, '') || $2,
               updated_at = NOW()
           WHERE order_id = $3`,
          [
            ORDER_STATUS.CANCELLED,
            "\nOrder was cancelled because all items were cancelled.",
            orderId,
          ]
        );

        await client.query(
          `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            orderId,
            orderItem.order_status,
            ORDER_STATUS.CANCELLED,
            userId,
            "Order cancelled after all items were cancelled",
          ]
        );
        orderStatusMessage = " Order was fully cancelled because no active items remain.";
      }

      if (isAdmin && orderItem.user_id) {
        await createOrderNotification(client, {
          userId: orderItem.user_id,
          title: "Order item cancelled",
          message: `Item "${orderItem.product_name}" in order #${orderItem.order_hash} was cancelled by staff.${reason ? ` Reason: ${reason}` : ""}`,
          senderId: userId,
          link: `/orders/${orderId}`,
        });
      }

      return {
        itemTotal,
        remainingCount,
        orderStatusMessage,
      };
    });

    return res.status(200).json({
      success: true,
      message: `Cancelled item "${orderItem.product_name}" successfully.${result.orderStatusMessage}`,
      data: {
        order_id: orderId,
        order_hash: orderItem.order_hash,
        cancelled_item: {
          item_id: itemId,
          product_name: orderItem.product_name,
          quantity: orderItem.quantity,
          refund_amount: result.itemTotal,
        },
        remaining_items: result.remainingCount,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to cancel order item",
      error: error.status ? undefined : error.message,
    });
  }
});

router.put("/cancel", verifyToken, (req, res) => {
  return res.status(400).json({
    success: false,
    message: "Missing order ID. Provide the order ID in the path.",
  });
});

router.put("/cancel/:orderId", verifyToken, async (req, res) => {
  try {
    const orderId = ensurePositiveId(req.params.orderId, "order ID");
    const userId = req.user.id;
    const isAdmin = isPrivilegedUser(req);
    const { reason } = req.body;

    const orderQuery = [
      `
      SELECT
        o.order_id,
        o.user_id,
        o.order_status,
        o.created_at,
        o.order_hash,
        o.order_final_total,
        u.user_name,
        u.user_gmail AS user_email
      FROM orders o
      LEFT JOIN "user" u ON o.user_id = u.user_id
      WHERE o.order_id = $1
        AND o.deleted_at IS NULL
      `,
    ];
    const orderParams = [orderId];
    if (!isAdmin) {
      orderQuery.push("AND o.user_id = $2");
      orderParams.push(userId);
    }

    const { rows: orders } = await db.query(orderQuery.join("\n"), orderParams);

    const order = orders[0];
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order was not found or you do not have permission to cancel it",
      });
    }

    if (Number(order.order_status) === ORDER_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });
    }

    if (!isAdmin) {
      if (!canCustomerCancel(order)) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel order while status is ${getStatusMeta(order.order_status).name}`,
        });
      }

      const hoursDiff = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 72) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel order after 72 hours. This order was created ${hoursDiff.toFixed(1)} hours ago.`,
        });
      }
    }

    await withTransaction(async (client) => {
      const { rows: orderItems } = await client.query(
        `SELECT
           oi.order_item_id,
           oi.variant_id,
           oi.quantity,
           oi.price,
           vp.product_id
         FROM order_items oi
         JOIN variant_product vp ON oi.variant_id = vp.variant_id
         WHERE oi.order_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM return_items ri WHERE ri.order_item_id = oi.order_item_id
           )
         FOR UPDATE OF oi`,
        [orderId]
      );

      for (const item of orderItems) {
        if (item.variant_id) {
          await client.query(
            `UPDATE variant_product
             SET variant_product_quantity = variant_product_quantity + $1
             WHERE variant_id = $2`,
            [item.quantity, item.variant_id]
          );
        }

        if (item.product_id) {
          await client.query(
            `UPDATE product
             SET product_sold = GREATEST(product_sold - $1, 0),
                 updated_at = NOW()
             WHERE product_id = $2`,
            [item.quantity, item.product_id]
          );
        }
      }

      await client.query(
        `UPDATE orders
         SET order_status = $1,
             order_note = COALESCE(order_note, '') || $2,
             updated_at = NOW()
         WHERE order_id = $3`,
        [
          ORDER_STATUS.CANCELLED,
          reason ? `\nCancellation reason: ${reason}` : `\nCancelled by ${isAdmin ? "staff" : "customer"}`,
          orderId,
        ]
      );

      const returnReason =
        reason || (isAdmin ? "Order was cancelled by staff" : "Order was cancelled by customer");

      await client.query(
        `INSERT INTO order_returns (
          order_id,
          user_id,
          return_reason,
          return_note,
          return_status,
          return_total,
          return_refund_method
        )
        VALUES ($1, $2, $3, $4, 0, 0.00, 'cancel')`,
        [orderId, order.user_id, returnReason, "Full order cancellation"]
      );

      await client.query(
        `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          orderId,
          order.order_status,
          ORDER_STATUS.CANCELLED,
          userId,
          `Order cancelled by ${isAdmin ? "staff" : "customer"}`,
        ]
      );

      if (isAdmin && order.user_id) {
        await createOrderNotification(client, {
          userId: order.user_id,
          title: "Order cancelled",
          message: `Order #${order.order_hash} was cancelled by staff.${reason ? ` Reason: ${reason}` : ""}`,
          senderId: userId,
          link: `/orders/${orderId}`,
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order_id: orderId,
      order_hash: order.order_hash,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to cancel order",
      error: error.status ? undefined : error.message,
    });
  }
});

router.get("/items/:orderId", verifyToken, async (req, res) => {
  try {
    const orderId = ensurePositiveId(req.params.orderId, "order ID");
    const userId = req.user.id;
    const isAdmin = isPrivilegedUser(req);

    const orderQuery = [
      `
      SELECT order_id, order_hash, order_status
      FROM orders
      WHERE order_id = $1
        AND deleted_at IS NULL
      `,
    ];
    const orderParams = [orderId];
    if (!isAdmin) {
      orderQuery.push("AND user_id = $2");
      orderParams.push(userId);
    }

    const { rows: orders } = await db.query(orderQuery.join("\n"), orderParams);

    const order = orders[0];
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order was not found or you do not have permission to access it",
      });
    }

    const { rows: items } = await db.query(
      `
      SELECT
        oi.order_item_id,
        oi.quantity,
        oi.price,
        oi.created_at,
        oi.updated_at,
        vp.variant_id,
        vp.variant_product_price AS variant_price,
        vp.variant_product_price_sale AS variant_price_sale,
        vp.variant_product_list_image AS variant_image,
        c.color_name,
        c.color_code AS color_hex,
        p.product_id,
        p.product_name,
        p.product_slug,
        p.product_image,
        cat.category_name AS category,
        CASE WHEN ri.return_item_id IS NULL THEN 'NORMAL' ELSE 'RETURN_REQUESTED' END AS item_status
      FROM order_items oi
      JOIN variant_product vp ON oi.variant_id = vp.variant_id
      JOIN product p ON vp.product_id = p.product_id
      LEFT JOIN color c ON vp.color_id = c.color_id
      LEFT JOIN category cat ON p.category_id = cat.category_id
      LEFT JOIN return_items ri ON ri.order_item_id = oi.order_item_id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC
    `,
      [orderId]
    );

    const formattedItems = items.map((item) => ({
      item_id: item.order_item_id,
      variant_id: item.variant_id,
      product: {
        id: item.product_id,
        name: item.product_name,
        slug: item.product_slug,
        image: firstImageUrl(item.variant_image || item.product_image),
        category: item.category,
      },
      color: {
        name: item.color_name,
        hex: item.color_hex,
      },
      quantity: item.quantity,
      price: Number(item.price),
      item_total: Number(item.price) * Number(item.quantity),
      status: item.item_status,
      can_cancel: item.item_status === "NORMAL" && canCustomerCancel(order),
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    const activeItems = formattedItems.filter((item) => item.status === "NORMAL");
    const totalValue = activeItems.reduce((sum, item) => sum + item.item_total, 0);

    return res.status(200).json({
      success: true,
      data: {
        order: {
          id: order.order_id,
          hash: order.order_hash,
          order_status: order.order_status,
          status: getStatusMeta(order.order_status).name,
        },
        items: formattedItems,
        summary: {
          total_items: formattedItems.length,
          active_items: activeItems.length,
          cancelled_items: formattedItems.filter((item) => item.status !== "NORMAL").length,
          total_value: totalValue,
        },
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to fetch order items",
      error: error.status ? undefined : error.message,
    });
  }
});

module.exports = router;
