"use strict";

const router = require("express").Router();
const { verifyToken } = require("../../shared/middleware/auth");
const db = require("../../config/database");
const { resolveCustomerDetails, resolveCouponId } = require("./customer-details");
const { withTransaction } = require("../../shared/db/transaction");
const { sendEmail1 } = require("../../shared/mail/order.mail");
const { createUserNotification } = require("../notifications/notification-dispatch");
const momo = require("../payments/providers/momo");
const vnpay = require("../payments/providers/vnpay");
const { ORDER_STATUS_KEY_TO_CODE } = require("./order-status.constants");



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

    const {
      defaultName,
      defaultEmail,
      defaultAddress,
      defaultPhone,
      finalName,
      finalEmail,
      finalAddress,
      finalPhone,
    } = resolveCustomerDetails(userRows[0], { order_name_new, order_email_new, order_address_new, order_number2 });

    const couponcodeId = await resolveCouponId(couponcode_id, coupon_code);

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

      const payUrl = await momo.createPayment({
        orderId: order_id,
        amount,
        extra: {
          order_id,
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
        },
      });

      return res.json({ payUrl });
    }

    if (normalizedMethod === "VNPAY") {
      const paymentUrl = vnpay.buildPaymentUrl({ amount, orderId: order_id });

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

module.exports = router;
