"use strict";

const router = require("express").Router();
const { verifyToken } = require("../../shared/middleware/auth");
const db = require("../../config/database");
const upload = require("../../shared/middleware/upload");
const cloudinary = require("../../config/cloudinary");
const { withTransaction } = require("../../shared/db/transaction");
const { createUserNotification } = require("../notifications/notification-dispatch");
const { ORDER_STATUS_KEY_TO_CODE, RETURN_STATUS_LABEL_TO_CODE } = require("./order-status.constants");


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

module.exports = router;
