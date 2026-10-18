"use strict";

const db = require("../../config/database");

/**
 * Contact details printed on an order: what the customer typed at checkout when it differs from
 * the account, otherwise the account's own details. The `default*` fields are the account values.
 */
function resolveCustomerDetails(userRow, { order_name_new, order_email_new, order_address_new, order_number2 }) {
  const defaultName = userRow.user_name?.trim() || "";
  const defaultEmail = userRow.user_gmail?.trim() || "";
  const defaultAddress = userRow.user_address?.trim() || "";
  const defaultPhone = userRow.user_number?.trim() || "";

  const pick = (typed, fallback) => (typed?.trim() && typed.trim() !== fallback ? typed.trim() : fallback);

  return {
    defaultName,
    defaultEmail,
    defaultAddress,
    defaultPhone,
    finalName: pick(order_name_new, defaultName),
    finalEmail: pick(order_email_new, defaultEmail),
    finalAddress: pick(order_address_new, defaultAddress),
    finalPhone: pick(order_number2, defaultPhone),
  };
}

/** Coupon id sent by the client, or the one looked up by its code. */
async function resolveCouponId(couponcodeId, couponCode) {
  if (couponcodeId || !couponCode) return couponcodeId || null;

  const { rows } = await db.query(
    "SELECT couponcode_id FROM couponcode WHERE couponcode_code = $1 LIMIT 1",
    [couponCode]
  );
  return rows.length > 0 ? rows[0].couponcode_id : null;
}

module.exports = { resolveCustomerDetails, resolveCouponId };
