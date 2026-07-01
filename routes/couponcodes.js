const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { withTransaction } = require("../db/transaction");
const { verifyToken, isAdmin } = require("../middleware/auth");

const couponSelect = (alias = "c") => `
  ${alias}.couponcode_id,
  ${alias}.couponcode_code AS code,
  ${alias}.couponcode_code AS title,
  ${alias}.couponcode_description AS description,
  ${alias}.couponcode_startday AS start_time,
  ${alias}.couponcode_startday AS "validFrom",
  ${alias}.couponcode_endday AS exp_time,
  ${alias}.couponcode_endday AS "validUntil",
  ${alias}.couponcode_minimum_order AS min_order,
  ${alias}.couponcode_minimum_order AS "minOrder",
  ${alias}.couponcode_maximum_discount AS maximum_discount,
  ${alias}.couponcode_quantity,
  ${alias}.couponcode_used,
  GREATEST(COALESCE(${alias}.couponcode_quantity, 0) - COALESCE(${alias}.couponcode_used, 0), 0) AS used,
  ${alias}.couponcode_status AS status,
  ${alias}.couponcode_status AS "couponStatus",
  ${alias}.couponcode_type,
  CASE
    WHEN ${alias}.couponcode_type = 1 OR ${alias}.couponcode_amount IS NOT NULL THEN 'fixed'
    ELSE 'percentage'
  END AS discount_type,
  COALESCE(${alias}.couponcode_percent::numeric, ${alias}.couponcode_amount, ${alias}.couponcode_maximum_discount, 0) AS value_price,
  false AS "isFlashSale",
  NULL::text AS combinations,
  ${alias}.created_at,
  ${alias}.updated_at
`;

function couponSelectWithIdAlias(alias = "c") {
  return `
    ${couponSelect(alias)},
    ${alias}.couponcode_id AS id,
    COALESCE(${alias}.couponcode_percent::numeric, ${alias}.couponcode_amount, ${alias}.couponcode_maximum_discount, 0) AS discount
  `;
}

function normalizeDiscount(discountType, valuePrice) {
  const value = Number(valuePrice);
  const normalizedType = discountType === "fixed" || Number(discountType) === 1 ? 1 : 0;

  return {
    couponcode_type: normalizedType,
    couponcode_percent: normalizedType === 0 ? value : null,
    couponcode_amount: normalizedType === 1 ? value : null,
  };
}

function addUpdate(updates, values, column, value) {
  values.push(value);
  updates.push(`${column} = $${values.length}`);
}

async function getAffectedUserIds(client, userIds) {
  if (userIds === "new_users" || userIds === "new_users_30d") {
    const { rows } = await client.query(`
      SELECT user_id
      FROM "user"
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL
    `);
    return rows.map((row) => row.user_id);
  }

  if (userIds === "all") {
    const { rows } = await client.query(`
      SELECT user_id
      FROM "user"
      WHERE deleted_at IS NULL
    `);
    return rows.map((row) => row.user_id);
  }

  if (Array.isArray(userIds)) {
    return userIds
      .map((userId) => Number(userId))
      .filter((userId) => Number.isInteger(userId) && userId > 0);
  }

  return [];
}

async function insertRows(client, tableName, columns, rows) {
  if (rows.length === 0) return;

  const values = [];
  const placeholders = rows
    .map((row) => {
      const rowPlaceholders = row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${rowPlaceholders.join(", ")})`;
    })
    .join(", ");

  await client.query(
    `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    values
  );
}

async function getCouponNotificationTypeId(client) {
  const { rows } = await client.query(`
    SELECT id
    FROM notification_types
    WHERE type_code IN ('coupon', 'promotion', 'system')
    ORDER BY CASE type_code
      WHEN 'coupon' THEN 1
      WHEN 'promotion' THEN 2
      ELSE 3
    END
    LIMIT 1
  `);

  return rows[0]?.id || null;
}

async function fetchCouponById(client, couponId) {
  const { rows } = await client.query(
    `
    SELECT ${couponSelect("c")}
    FROM couponcode c
    WHERE c.couponcode_id = $1
      AND c.deleted_at IS NULL
  `,
    [couponId]
  );

  return rows[0] || null;
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}d`;
}

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { rows: coupons } = await db.query(`
      SELECT ${couponSelect("c")}
      FROM couponcode c
      WHERE c.deleted_at IS NULL
      ORDER BY c.couponcode_id DESC
    `);

    res.json(coupons);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch coupon codes" });
  }
});

router.get("/notification", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(
      `
      SELECT
        un.id AS user_notification_id,
        un.notification_id,
        n.title,
        n.link,
        n.message,
        n.created_at,
        un.is_read,
        un.read_at
      FROM user_notifications un
      JOIN notifications n ON un.notification_id = n.id
      WHERE un.user_id = $1 AND un.is_deleted = 0
      ORDER BY n.created_at DESC
    `,
      [userId]
    );

    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.patch("/notification/read/:id", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const notificationId = Number(req.params.id);

  if (isNaN(notificationId)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  try {
    const { rows } = await db.query(
      "SELECT id FROM user_notifications WHERE user_id = $1 AND notification_id = $2",
      [userId, notificationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await db.query(
      "UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE user_id = $1 AND notification_id = $2",
      [userId, notificationId]
    );

    res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
});

router.get("/user-has-coupon", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(
      `
      SELECT
        uhc.user_id,
        uhc.couponcode_id,
        uhc.status,
        ${couponSelect("c")}
      FROM user_has_coupon uhc
      JOIN couponcode c ON uhc.couponcode_id = c.couponcode_id
      WHERE uhc.user_id = $1
        AND uhc.status = 0
        AND c.couponcode_status != 0
        AND (c.couponcode_endday IS NULL OR c.couponcode_endday >= CURRENT_DATE)
        AND c.deleted_at IS NULL
      ORDER BY c.couponcode_endday ASC NULLS LAST
    `,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user coupons" });
  }
});

router.get("/codes", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(
      `
      SELECT
        ${couponSelect("c")},
        CASE WHEN uhc.user_id IS NOT NULL THEN 1 ELSE 0 END AS "userUsedStatus"
      FROM couponcode c
      LEFT JOIN user_has_coupon uhc
        ON c.couponcode_id = uhc.couponcode_id AND uhc.user_id = $1
      WHERE
        (c.couponcode_endday IS NULL OR c.couponcode_endday >= CURRENT_DATE)
        AND c.couponcode_status != 0
        AND c.deleted_at IS NULL
        AND (
          NOT EXISTS (
            SELECT 1 FROM user_has_coupon ch
            WHERE ch.couponcode_id = c.couponcode_id
          )
          OR EXISTS (
            SELECT 1 FROM user_has_coupon ch
            WHERE ch.couponcode_id = c.couponcode_id AND ch.user_id = $2
          )
        )
      ORDER BY c.couponcode_endday ASC NULLS LAST
    `,
      [userId, userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

router.get("/admin", verifyToken, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ${couponSelectWithIdAlias("c")}
      FROM couponcode c
      WHERE (c.couponcode_endday IS NULL OR c.couponcode_endday >= CURRENT_DATE)
        AND c.deleted_at IS NULL
      ORDER BY c.couponcode_id DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch public coupons" });
  }
});

router.get("/userCoupon", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(
      `
      SELECT
        ${couponSelect("c")},
        1 AS "userUsedStatus"
      FROM couponcode c
      INNER JOIN user_has_coupon uhc
        ON c.couponcode_id = uhc.couponcode_id
      WHERE
        uhc.user_id = $1
        AND c.couponcode_status != 0
        AND (c.couponcode_endday IS NULL OR c.couponcode_endday >= CURRENT_DATE)
        AND c.deleted_at IS NULL
      ORDER BY c.couponcode_endday ASC NULLS LAST
    `,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user vouchers" });
  }
});

router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid coupon ID" });

    const { rows } = await db.query(
      `
      SELECT ${couponSelect("c")}
      FROM couponcode c
      WHERE c.couponcode_id = $1
        AND c.deleted_at IS NULL
    `,
      [id]
    );

    if (!rows.length) return res.status(404).json({ error: "Coupon code not found" });

    const coupon = rows[0];

    const { rows: newUserRows } = await db.query(
      `
      SELECT uhc.user_id
      FROM user_has_coupon uhc
      JOIN "user" u ON uhc.user_id = u.user_id
      WHERE uhc.couponcode_id = $1
        AND u.created_at >= NOW() - INTERVAL '30 days'
        AND u.deleted_at IS NULL
    `,
      [id]
    );

    const { rows: allUserRows } = await db.query(
      "SELECT user_id FROM user_has_coupon WHERE couponcode_id = $1",
      [id]
    );
    const allUserIds = allUserRows.map((row) => row.user_id);

    let user_ids = null;
    if (allUserIds.length === 0) {
      user_ids = null;
    } else if (newUserRows.length === allUserIds.length) {
      user_ids = "new_users";
    } else {
      user_ids = allUserIds;
    }

    res.json({ ...coupon, user_ids });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch coupon code" });
  }
});

router.post("/mark-all-read", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rowCount } = await db.query(
      "UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE user_id = $1 AND is_read = 0",
      [userId]
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
      updatedRows: rowCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      value_price,
      start_time,
      exp_time,
      min_order,
      used,
      discount_type,
      status,
      user_ids,
    } = req.body;

    if (!code) return res.status(400).json({ error: "Coupon code is required" });
    if (!value_price) return res.status(400).json({ error: "Discount value is required" });
    if (!exp_time) return res.status(400).json({ error: "Expiration date is required" });
    if (!discount_type) return res.status(400).json({ error: "Discount type is required" });
    if (status === undefined) return res.status(400).json({ error: "Status is required" });
    if (!/^[A-Z0-9_]{3,20}$/.test(code)) {
      return res.status(400).json({ error: "Invalid coupon code format" });
    }

    if (used !== undefined && (isNaN(used) || Number(used) <= 0)) {
      return res.status(400).json({ error: "Invalid usage quantity" });
    }

    if (isNaN(value_price) || Number(value_price) <= 0) {
      return res.status(400).json({ error: "Invalid discount value" });
    }

    if (discount_type === "percentage" && (Number(value_price) < 1 || Number(value_price) > 100)) {
      return res.status(400).json({ error: "Percentage discount must be between 1 and 100" });
    }

    if (discount_type === "fixed" && Number(value_price) < 1) {
      return res.status(400).json({ error: "Fixed discount must be greater than 0" });
    }

    if (min_order !== null && min_order !== undefined && (isNaN(min_order) || Number(min_order) < 0)) {
      return res.status(400).json({ error: "Invalid minimum order value" });
    }

    const startDate = start_time ? new Date(start_time) : new Date();
    const endDate = new Date(exp_time);
    if (endDate <= startDate) {
      return res.status(400).json({ error: "Expiration date must be after start date" });
    }

    const newCoupon = await withTransaction(async (client) => {
      const { rows: existingCoupons } = await client.query(
        "SELECT couponcode_id FROM couponcode WHERE couponcode_code = $1 AND deleted_at IS NULL",
        [code]
      );
      if (existingCoupons.length > 0) {
        const error = new Error("Coupon code already exists");
        error.status = 400;
        throw error;
      }

      const discount = normalizeDiscount(discount_type, value_price);
      const { rows: createdCoupons } = await client.query(
        `
        INSERT INTO couponcode (
          couponcode_code,
          couponcode_description,
          couponcode_startday,
          couponcode_endday,
          couponcode_percent,
          couponcode_amount,
          couponcode_minimum_order,
          couponcode_quantity,
          couponcode_status,
          couponcode_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING couponcode_id
      `,
        [
          code,
          description || title || null,
          startDate,
          endDate,
          discount.couponcode_percent,
          discount.couponcode_amount,
          min_order || 0,
          used || 1,
          Number(status),
          discount.couponcode_type,
        ]
      );

      const couponId = createdCoupons[0].couponcode_id;
      const affectedUsers = await getAffectedUserIds(client, user_ids);

      let notificationId = null;
      if (affectedUsers.length > 0) {
        await insertRows(
          client,
          "user_has_coupon",
          ["user_id", "couponcode_id", "status"],
          affectedUsers.map((userId) => [userId, couponId, 0])
        );

        const notificationTypeId = await getCouponNotificationTypeId(client);
        if (notificationTypeId) {
          const discountValue =
            discount.couponcode_type === 0 ? `${value_price}%` : formatCurrency(value_price);
          const minOrderValue = min_order ? formatCurrency(min_order) : formatCurrency(0);
          const notificationTitle = "New coupon available";
          const notificationMessage = `Coupon ${code} gives ${discountValue} for orders from ${minOrderValue}. Valid until ${endDate.toLocaleDateString("vi-VN")}.`;

          const { rows: notifications } = await client.query(
            `
            INSERT INTO notifications (type_id, title, message, sender_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `,
            [notificationTypeId, notificationTitle, notificationMessage, req.user.id]
          );
          notificationId = notifications[0].id;

          await insertRows(
            client,
            "user_notifications",
            ["user_id", "notification_id", "is_read", "read_at", "is_deleted"],
            affectedUsers.map((userId) => [userId, notificationId, 0, null, 0])
          );
        }
      }

      return fetchCouponById(client, couponId);
    });

    res.status(201).json({ message: "Coupon created successfully", coupon: newCoupon });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to create coupon" });
  }
});

router.put("/:id/status", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (isNaN(id)) return res.status(400).json({ error: "Invalid coupon ID" });
    if (![0, 1].includes(Number(status))) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { rowCount } = await db.query(
      "UPDATE couponcode SET couponcode_status = $1 WHERE couponcode_id = $2 AND deleted_at IS NULL",
      [Number(status), id]
    );

    if (rowCount === 0) return res.status(404).json({ error: "Coupon not found" });

    res.json({ message: "Coupon status updated successfully", newStatus: Number(status) });
  } catch (error) {
    res.status(500).json({ error: "Failed to update coupon status" });
  }
});

router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid coupon ID" });

    const {
      code,
      title,
      description,
      value_price,
      start_time,
      exp_time,
      min_order,
      used,
      discount_type,
      status,
      user_ids,
    } = req.body;

    const updatedCoupon = await withTransaction(async (client) => {
      const existingCoupon = await fetchCouponById(client, id);
      if (!existingCoupon) {
        const error = new Error("Coupon not found");
        error.status = 404;
        throw error;
      }

      const updates = [];
      const values = [];

      if (code !== undefined) {
        const { rows: duplicate } = await client.query(
          "SELECT couponcode_id FROM couponcode WHERE couponcode_code = $1 AND couponcode_id != $2 AND deleted_at IS NULL",
          [code, id]
        );
        if (duplicate.length > 0) {
          const error = new Error("Coupon code already exists");
          error.status = 400;
          throw error;
        }
        addUpdate(updates, values, "couponcode_code", code);
      }

      if (description !== undefined || title !== undefined) {
        addUpdate(updates, values, "couponcode_description", description ?? title);
      }

      if (value_price !== undefined || discount_type !== undefined) {
        const nextType = discount_type || existingCoupon.discount_type;
        const nextValue = value_price !== undefined ? value_price : existingCoupon.value_price;
        if (isNaN(nextValue) || Number(nextValue) <= 0) {
          const error = new Error("Invalid discount value");
          error.status = 400;
          throw error;
        }
        const discount = normalizeDiscount(nextType, nextValue);
        addUpdate(updates, values, "couponcode_type", discount.couponcode_type);
        addUpdate(updates, values, "couponcode_percent", discount.couponcode_percent);
        addUpdate(updates, values, "couponcode_amount", discount.couponcode_amount);
      }

      if (start_time !== undefined) {
        addUpdate(updates, values, "couponcode_startday", new Date(start_time));
      }

      if (exp_time !== undefined) {
        const endDate = new Date(exp_time);
        const startDate = start_time ? new Date(start_time) : new Date(existingCoupon.start_time);
        if (startDate && endDate <= startDate) {
          const error = new Error("Expiration date must be after start date");
          error.status = 400;
          throw error;
        }
        addUpdate(updates, values, "couponcode_endday", endDate);
      }

      if (min_order !== undefined) addUpdate(updates, values, "couponcode_minimum_order", min_order);
      if (used !== undefined) addUpdate(updates, values, "couponcode_quantity", Number(used));
      if (status !== undefined) addUpdate(updates, values, "couponcode_status", Number(status));

      if (updates.length > 0) {
        values.push(id);
        await client.query(
          `UPDATE couponcode SET ${updates.join(", ")} WHERE couponcode_id = $${values.length}`,
          values
        );
      }

      if (user_ids !== undefined) {
        await client.query("DELETE FROM user_has_coupon WHERE couponcode_id = $1", [id]);
        const affectedUsers = await getAffectedUserIds(client, user_ids);
        await insertRows(
          client,
          "user_has_coupon",
          ["user_id", "couponcode_id", "status"],
          affectedUsers.map((userId) => [userId, id, 0])
        );
      }

      return fetchCouponById(client, id);
    });

    res.json({ message: "Coupon updated successfully", coupon: updatedCoupon });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to update coupon" });
  }
});

router.delete("/notification/:id", verifyToken, async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const { rowCount } = await db.query(
      `
      UPDATE user_notifications
      SET is_deleted = 1
      WHERE notification_id = $1 AND user_id = $2
    `,
      [notificationId, userId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ message: "Notification deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid coupon ID" });

    await withTransaction(async (client) => {
      const existingCoupon = await fetchCouponById(client, id);
      if (!existingCoupon) {
        const error = new Error("Coupon not found");
        error.status = 404;
        throw error;
      }

      await client.query("DELETE FROM user_has_coupon WHERE couponcode_id = $1", [id]);
      await client.query("DELETE FROM couponcode WHERE couponcode_id = $1", [id]);
    });

    res.json({ message: "Coupon deleted successfully" });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to delete coupon" });
  }
});

router.post("/validate", verifyToken, async (req, res) => {
  try {
    const { code, cart_total } = req.body;
    const cartTotal = Number(cart_total);

    if (!code) return res.status(400).json({ error: "Coupon code is required" });
    if (isNaN(cartTotal) || cartTotal < 0) {
      return res.status(400).json({ error: "Invalid cart total" });
    }

    const { rows: coupons } = await db.query(
      `
      SELECT ${couponSelect("c")}
      FROM couponcode c
      WHERE c.couponcode_code = $1
        AND c.deleted_at IS NULL
    `,
      [code]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ error: "Coupon code not found" });
    }

    const coupon = coupons[0];
    const now = new Date();
    const startTime = coupon.start_time ? new Date(coupon.start_time) : null;
    const expTime = coupon.exp_time ? new Date(coupon.exp_time) : null;

    if (Number(coupon.status) === 0) {
      return res.status(400).json({ error: "Coupon is inactive" });
    }

    if (Number(coupon.used) <= 0) {
      return res.status(400).json({ error: "Coupon usage limit reached" });
    }

    const { rows: allowedUsers } = await db.query(
      "SELECT status FROM user_has_coupon WHERE couponcode_id = $1",
      [coupon.couponcode_id]
    );

    const isGlobal = allowedUsers.length === 0;
    if (!isGlobal) {
      const { rows: userAllowed } = await db.query(
        "SELECT status FROM user_has_coupon WHERE couponcode_id = $1 AND user_id = $2",
        [coupon.couponcode_id, req.user.id]
      );

      if (userAllowed.length === 0) {
        return res.status(403).json({ error: "You do not have this coupon" });
      }

      if (Number(userAllowed[0].status) === 1) {
        return res.status(400).json({ error: "You already used this coupon" });
      }
    }

    if (startTime && startTime > now) {
      return res.status(400).json({ error: "Coupon is not active yet" });
    }

    if (expTime && expTime < now) {
      return res.status(400).json({ error: "Coupon expired" });
    }

    if (coupon.min_order !== null && cartTotal < Number(coupon.min_order)) {
      return res.status(400).json({
        error: "Cart total does not meet minimum order requirement",
        min_purchase: coupon.min_order,
      });
    }

    let discountAmount = 0;
    const value = Number(coupon.value_price);
    if (coupon.discount_type === "percentage") {
      discountAmount = Math.round((cartTotal * value) / 100);
      if (coupon.maximum_discount !== null) {
        discountAmount = Math.min(discountAmount, Number(coupon.maximum_discount));
      }
    } else if (coupon.discount_type === "fixed") {
      discountAmount = Math.min(cartTotal, value);
    }

    res.json({
      valid: true,
      coupon: {
        couponcode_id: coupon.couponcode_id,
        code: coupon.code,
        title: coupon.title,
        value_price: coupon.value_price,
        discount_type: coupon.discount_type,
        discount_amount: discountAmount,
        exp_time: coupon.exp_time,
        description: coupon.description,
        is_flash_sale: false,
        combinations: null,
        min_order: coupon.min_order,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to validate coupon" });
  }
});

module.exports = router;
