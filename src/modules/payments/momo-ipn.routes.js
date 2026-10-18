"use strict";

const router = require("express").Router();
const db = require("../../config/database");
const { resolveCustomerDetails, resolveCouponId } = require("../orders/customer-details");
const axios = require("axios");
const momo = require("./providers/momo");
const { withTransaction } = require("../../shared/db/transaction");
const { sendEmail1 } = require("../../shared/mail/order.mail");
const { createUserNotification } = require("../notifications/notification-dispatch");
const { ORDER_STATUS_KEY_TO_CODE } = require("../orders/order-status.constants");


router.post("/payment/momo", async (req, res) => {
  console.log("Received MoMo IPN:", req.body);
  const {
    orderId,
    amount,
    resultCode,
    requestId,
    transId,
    extraData,
    signature,
    partnerCode,
  } = req.body;

  try {
    if (!signature) {
      return res.status(400).json({ message: "Missing signature information" });
    }

    if (momo.ipnSignature(req.body) !== signature) {
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
          await momo.refund({ partnerCode, orderId, transId, amount });
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
        `${process.env.API_URL}/orders/payment/momo`,
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

module.exports = router;
