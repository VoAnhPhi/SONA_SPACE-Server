"use strict";

const ORDER_STATUS_CODE_TO_KEY = {
  "-1": "CANCELLED",
  "0": "PENDING",
  "1": "CONFIRMED",
  "2": "SHIPPING",
  "3": "DELIVERED",
  "4": "SUCCESS",
};

const ORDER_STATUS_KEY_TO_CODE = {
  PENDING: 0,
  CONFIRMED: 1,
  APPROVED: 1,
  SHIPPING: 2,
  DELIVERED: 3,
  COMPLETED: 4,
  SUCCESS: 4,
  CANCELLED: -1,
};

function toLegacyOrderStatus(orderStatusCode) {
  if (orderStatusCode === null || orderStatusCode === undefined) {
    return "PENDING";
  }

  return ORDER_STATUS_CODE_TO_KEY[String(orderStatusCode)] || "PENDING";
}

const RETURN_STATUS_LABEL_TO_CODE = {
  PENDING: 0,
  APPROVED: 1,
  COMPLETED: 2,
  CANCEL_CONFIRMED: 2,
  CANCELLED: 2,
  REJECTED: 3,
};

const RETURN_STATUS_CODE_TO_LABEL = {
  0: "PENDING",
  1: "APPROVED",
  2: "COMPLETED",
  3: "REJECTED",
};

module.exports = {
  ORDER_STATUS_CODE_TO_KEY,
  ORDER_STATUS_KEY_TO_CODE,
  toLegacyOrderStatus,
  RETURN_STATUS_LABEL_TO_CODE,
  RETURN_STATUS_CODE_TO_LABEL,
};
