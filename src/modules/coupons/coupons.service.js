"use strict";

const db = require("../../config/database");
const { withTransaction } = require("../../shared/db/transaction");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

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

/** Resolve the audience of a coupon: "all", "new_users" (joined in the last 30 days) or explicit ids. */
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

function requireCouponId(rawId) {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid coupon ID" });
  return id;
}

function listAll() {
  return guard("Failed to fetch coupon codes", async () => {
    const { rows: coupons } = await db.query(`
      SELECT ${couponSelect("c")}
      FROM couponcode c
      WHERE c.deleted_at IS NULL
      ORDER BY c.couponcode_id DESC
    `);

    return coupons;
  });
}

/** Coupons the user was given and has not used yet. */
function listUserCoupons(userId) {
  return guard("Failed to fetch user coupons", async () => {
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

    return rows;
  });
}

/** Coupons the user can use: public ones plus the ones assigned to them. */
function listAvailableForUser(userId) {
  return guard("Failed to fetch coupons", async () => {
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

    return rows;
  });
}

/** Unexpired coupons, whatever the audience. Named "admin" for historical reasons; any signed-in user may call it. */
function listUnexpired() {
  return guard("Failed to fetch public coupons", async () => {
    const { rows } = await db.query(`
      SELECT ${couponSelectWithIdAlias("c")}
      FROM couponcode c
      WHERE (c.couponcode_endday IS NULL OR c.couponcode_endday >= CURRENT_DATE)
        AND c.deleted_at IS NULL
      ORDER BY c.couponcode_id DESC
    `);

    return rows;
  });
}

/** Coupons assigned to this user (used or not). */
function listAssignedToUser(userId) {
  return guard("Failed to fetch user vouchers", async () => {
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

    return rows;
  });
}

/** One coupon with its audience: null (everyone), "new_users" or the explicit user ids. */
function getById(rawId) {
  return guard("Failed to fetch coupon code", async () => {
    const id = requireCouponId(rawId);

    const { rows } = await db.query(
      `
      SELECT ${couponSelect("c")}
      FROM couponcode c
      WHERE c.couponcode_id = $1
        AND c.deleted_at IS NULL
    `,
      [id]
    );

    if (!rows.length) throw new HttpError(404, { error: "Coupon code not found" });

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

    return { ...coupon, user_ids };
  });
}

/** Creates a coupon, assigns it to its audience and notifies them, all in one transaction. */
function create(body, admin) {
  return guard("Failed to create coupon", async () => {
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
    } = body;

    if (!code) throw new HttpError(400, { error: "Coupon code is required" });
    if (!value_price) throw new HttpError(400, { error: "Discount value is required" });
    if (!exp_time) throw new HttpError(400, { error: "Expiration date is required" });
    if (!discount_type) throw new HttpError(400, { error: "Discount type is required" });
    if (status === undefined) throw new HttpError(400, { error: "Status is required" });
    if (!/^[A-Z0-9_]{3,20}$/.test(code)) {
      throw new HttpError(400, { error: "Invalid coupon code format" });
    }

    if (used !== undefined && (isNaN(used) || Number(used) <= 0)) {
      throw new HttpError(400, { error: "Invalid usage quantity" });
    }

    if (isNaN(value_price) || Number(value_price) <= 0) {
      throw new HttpError(400, { error: "Invalid discount value" });
    }

    if (discount_type === "percentage" && (Number(value_price) < 1 || Number(value_price) > 100)) {
      throw new HttpError(400, { error: "Percentage discount must be between 1 and 100" });
    }

    if (discount_type === "fixed" && Number(value_price) < 1) {
      throw new HttpError(400, { error: "Fixed discount must be greater than 0" });
    }

    if (min_order !== null && min_order !== undefined && (isNaN(min_order) || Number(min_order) < 0)) {
      throw new HttpError(400, { error: "Invalid minimum order value" });
    }

    const startDate = start_time ? new Date(start_time) : new Date();
    const endDate = new Date(exp_time);
    if (endDate <= startDate) {
      throw new HttpError(400, { error: "Expiration date must be after start date" });
    }

    const newCoupon = await withTransaction(async (client) => {
      const { rows: existingCoupons } = await client.query(
        "SELECT couponcode_id FROM couponcode WHERE couponcode_code = $1 AND deleted_at IS NULL",
        [code]
      );
      if (existingCoupons.length > 0) {
        throw new HttpError(400, { error: "Coupon code already exists" });
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
            [notificationTypeId, notificationTitle, notificationMessage, admin.id]
          );
          const notificationId = notifications[0].id;

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

    return { message: "Coupon created successfully", coupon: newCoupon };
  });
}

function updateStatus(rawId, body) {
  return guard("Failed to update coupon status", async () => {
    const id = Number(rawId);
    const { status } = body;

    if (isNaN(id)) throw new HttpError(400, { error: "Invalid coupon ID" });
    if (![0, 1].includes(Number(status))) {
      throw new HttpError(400, { error: "Invalid status" });
    }

    const { rowCount } = await db.query(
      "UPDATE couponcode SET couponcode_status = $1 WHERE couponcode_id = $2 AND deleted_at IS NULL",
      [Number(status), id]
    );

    if (rowCount === 0) throw new HttpError(404, { error: "Coupon not found" });

    return { message: "Coupon status updated successfully", newStatus: Number(status) };
  });
}

function update(rawId, body) {
  return guard("Failed to update coupon", async () => {
    const id = requireCouponId(rawId);

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
    } = body;

    const updatedCoupon = await withTransaction(async (client) => {
      const existingCoupon = await fetchCouponById(client, id);
      if (!existingCoupon) {
        throw new HttpError(404, { error: "Coupon not found" });
      }

      const updates = [];
      const values = [];

      if (code !== undefined) {
        const { rows: duplicate } = await client.query(
          "SELECT couponcode_id FROM couponcode WHERE couponcode_code = $1 AND couponcode_id != $2 AND deleted_at IS NULL",
          [code, id]
        );
        if (duplicate.length > 0) {
          throw new HttpError(400, { error: "Coupon code already exists" });
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
          throw new HttpError(400, { error: "Invalid discount value" });
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
          throw new HttpError(400, { error: "Expiration date must be after start date" });
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

    return { message: "Coupon updated successfully", coupon: updatedCoupon };
  });
}

function remove(rawId) {
  return guard("Failed to delete coupon", async () => {
    const id = requireCouponId(rawId);

    await withTransaction(async (client) => {
      const existingCoupon = await fetchCouponById(client, id);
      if (!existingCoupon) {
        throw new HttpError(404, { error: "Coupon not found" });
      }

      await client.query("DELETE FROM user_has_coupon WHERE couponcode_id = $1", [id]);
      await client.query("DELETE FROM couponcode WHERE couponcode_id = $1", [id]);
    });

    return { message: "Coupon deleted successfully" };
  });
}

/** Checks a code against the cart and the user, and computes the discount. */
function validate(body, user) {
  return guard("Failed to validate coupon", async () => {
    const { code, cart_total } = body;
    const cartTotal = Number(cart_total);

    if (!code) throw new HttpError(400, { error: "Coupon code is required" });
    if (isNaN(cartTotal) || cartTotal < 0) {
      throw new HttpError(400, { error: "Invalid cart total" });
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
      throw new HttpError(404, { error: "Coupon code not found" });
    }

    const coupon = coupons[0];
    const now = new Date();
    const startTime = coupon.start_time ? new Date(coupon.start_time) : null;
    const expTime = coupon.exp_time ? new Date(coupon.exp_time) : null;

    if (Number(coupon.status) === 0) {
      throw new HttpError(400, { error: "Coupon is inactive" });
    }

    if (Number(coupon.used) <= 0) {
      throw new HttpError(400, { error: "Coupon usage limit reached" });
    }

    const { rows: allowedUsers } = await db.query(
      "SELECT status FROM user_has_coupon WHERE couponcode_id = $1",
      [coupon.couponcode_id]
    );

    const isGlobal = allowedUsers.length === 0;
    if (!isGlobal) {
      const { rows: userAllowed } = await db.query(
        "SELECT status FROM user_has_coupon WHERE couponcode_id = $1 AND user_id = $2",
        [coupon.couponcode_id, user.id]
      );

      if (userAllowed.length === 0) {
        throw new HttpError(403, { error: "You do not have this coupon" });
      }

      if (Number(userAllowed[0].status) === 1) {
        throw new HttpError(400, { error: "You already used this coupon" });
      }
    }

    if (startTime && startTime > now) {
      throw new HttpError(400, { error: "Coupon is not active yet" });
    }

    if (expTime && expTime < now) {
      throw new HttpError(400, { error: "Coupon expired" });
    }

    if (coupon.min_order !== null && cartTotal < Number(coupon.min_order)) {
      throw new HttpError(400, {
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

    return {
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
    };
  });
}

module.exports = {
  listAll,
  listUserCoupons,
  listAvailableForUser,
  listUnexpired,
  listAssignedToUser,
  getById,
  create,
  updateStatus,
  update,
  remove,
  validate,
};
