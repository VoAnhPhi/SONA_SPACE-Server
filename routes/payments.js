const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { withTransaction } = require("../db/transaction");
const { verifyToken, isAdmin } = require("../middleware/auth");

const paymentSelect = `
  p.payment_id,
  p.payment_method,
  p.payment_method AS method,
  p.payment_status,
  p.payment_status AS status,
  p.payment_amount,
  p.payment_amount AS amount,
  p.payment_transaction_id,
  p.payment_transaction_id AS transaction_id,
  p.payment_info,
  p.payment_info AS payment_details,
  p.created_at,
  p.updated_at,
  o.order_id,
  o.order_hash,
  o.order_total,
  o.order_final_total,
  o.user_id,
  u.user_name,
  u.user_gmail AS user_email
`;

function isPrivilegedUser(req) {
  const role = req.user?.role?.toLowerCase();
  return req.user?.isAdmin || role === "admin" || role === "staff";
}

function canAccessPayment(req, payment) {
  return isPrivilegedUser(req) || req.user.id === payment.user_id;
}

function normalizePaymentInfo(paymentDetails) {
  if (paymentDetails === undefined) return undefined;
  if (paymentDetails === null) return null;
  return typeof paymentDetails === "string" ? paymentDetails : JSON.stringify(paymentDetails);
}

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const { rows: countResult } = await db.query(
      "SELECT COUNT(*)::int AS total FROM payments WHERE deleted_at IS NULL"
    );
    const totalPayments = countResult[0].total;
    const totalPages = Math.ceil(totalPayments / limit);

    const { rows: payments } = await db.query(
      `
      SELECT ${paymentSelect}
      FROM payments p
      LEFT JOIN orders o ON o.payment_id = p.payment_id
      LEFT JOIN "user" u ON o.user_id = u.user_id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `,
      [limit, offset]
    );

    res.json({
      payments,
      pagination: {
        currentPage: page,
        totalPages,
        totalPayments,
        paymentsPerPage: limit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

router.get("/order/:orderId", verifyToken, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const { rows: orders } = await db.query(
      'SELECT * FROM orders WHERE order_id = $1 AND deleted_at IS NULL',
      [orderId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];
    if (!isPrivilegedUser(req) && req.user.id !== order.user_id) {
      return res.status(403).json({ error: "Unauthorized access to order payment information" });
    }

    const { rows: payments } = await db.query(
      `
      SELECT ${paymentSelect}
      FROM payments p
      LEFT JOIN orders o ON o.payment_id = p.payment_id
      LEFT JOIN "user" u ON o.user_id = u.user_id
      WHERE o.order_id = $1
        AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
    `,
      [orderId]
    );

    res.json({
      order_id: orderId,
      order_hash: order.order_hash,
      payments,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order payments" });
  }
});

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }

    const { rows: payments } = await db.query(
      `
      SELECT ${paymentSelect}
      FROM payments p
      LEFT JOIN orders o ON o.payment_id = p.payment_id
      LEFT JOIN "user" u ON o.user_id = u.user_id
      WHERE p.payment_id = $1
        AND p.deleted_at IS NULL
    `,
      [id]
    );

    if (payments.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = payments[0];
    if (!canAccessPayment(req, payment)) {
      return res.status(403).json({ error: "Unauthorized access to payment information" });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      order_id,
      amount,
      payment_method,
      transaction_id,
      payment_status,
      payment_details,
    } = req.body;

    if (!order_id || !amount || !payment_method) {
      return res.status(400).json({ error: "Order ID, amount and payment method are required" });
    }

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    const newPayment = await withTransaction(async (client) => {
      const { rows: orders } = await client.query(
        "SELECT * FROM orders WHERE order_id = $1 AND deleted_at IS NULL FOR UPDATE",
        [order_id]
      );
      if (orders.length === 0) {
        const error = new Error("Order not found");
        error.status = 404;
        throw error;
      }

      const order = orders[0];
      if (!isPrivilegedUser(req) && req.user.id !== order.user_id) {
        const error = new Error("Unauthorized access to create payment for this order");
        error.status = 403;
        throw error;
      }

      const orderTotal = Number(order.order_final_total || order.order_total || 0);
      if (payment_status === "completed" && orderTotal > 0 && paymentAmount > orderTotal) {
        const error = new Error("Payment amount exceeds order total");
        error.status = 400;
        error.details = { orderTotal, paymentAmount };
        throw error;
      }

      const { rows: insertedPayments } = await client.query(
        `
        INSERT INTO payments (
          payment_method,
          payment_status,
          payment_amount,
          payment_transaction_id,
          payment_info
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING payment_id
      `,
        [
          payment_method,
          payment_status || "pending",
          paymentAmount,
          transaction_id || null,
          normalizePaymentInfo(payment_details) || null,
        ]
      );

      const paymentId = insertedPayments[0].payment_id;
      await client.query(
        "UPDATE orders SET payment_id = $1, updated_at = NOW() WHERE order_id = $2",
        [paymentId, order_id]
      );

      const { rows: payments } = await client.query(
        `
        SELECT ${paymentSelect}
        FROM payments p
        LEFT JOIN orders o ON o.payment_id = p.payment_id
        LEFT JOIN "user" u ON o.user_id = u.user_id
        WHERE p.payment_id = $1
      `,
        [paymentId]
      );

      return payments[0];
    });

    return res.status(201).json({
      message: "Payment created successfully",
      payment: newPayment,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "Failed to create payment",
      ...(error.details ? error.details : {}),
    });
  }
});

router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }

    const { transaction_id, payment_status, payment_details, amount, payment_method } = req.body;

    const updates = [];
    const values = [];

    const addUpdate = (column, value) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (transaction_id !== undefined) addUpdate("payment_transaction_id", transaction_id);
    if (payment_status !== undefined) addUpdate("payment_status", payment_status);
    if (payment_details !== undefined) addUpdate("payment_info", normalizePaymentInfo(payment_details));
    if (amount !== undefined) {
      const paymentAmount = Number(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }
      addUpdate("payment_amount", paymentAmount);
    }
    if (payment_method !== undefined) addUpdate("payment_method", payment_method);

    if (updates.length === 0) {
      return res.status(400).json({ error: "No update data provided" });
    }

    values.push(id);
    const { rowCount } = await db.query(
      `
      UPDATE payments
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE payment_id = $${values.length}
        AND deleted_at IS NULL
    `,
      values
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const { rows: updatedPayment } = await db.query(
      `
      SELECT ${paymentSelect}
      FROM payments p
      LEFT JOIN orders o ON o.payment_id = p.payment_id
      LEFT JOIN "user" u ON o.user_id = u.user_id
      WHERE p.payment_id = $1
    `,
      [id]
    );

    res.json({
      message: "Payment updated successfully",
      payment: updatedPayment[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update payment" });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid payment ID" });
    }

    await withTransaction(async (client) => {
      const { rows: payments } = await client.query(
        "SELECT payment_id FROM payments WHERE payment_id = $1 AND deleted_at IS NULL FOR UPDATE",
        [id]
      );
      if (payments.length === 0) {
        const error = new Error("Payment not found");
        error.status = 404;
        throw error;
      }

      await client.query("UPDATE orders SET payment_id = NULL, updated_at = NOW() WHERE payment_id = $1", [id]);
      await client.query("DELETE FROM payments WHERE payment_id = $1", [id]);
    });

    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.status ? error.message : "Failed to delete payment",
    });
  }
});

module.exports = router;
