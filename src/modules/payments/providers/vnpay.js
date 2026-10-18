"use strict";

const { VNPay } = require("vnpay");
const config = require("../../../config/env");

function formatDateVNPay(date) {
  const yyyy = date.getFullYear().toString();
  const MM = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  const HH = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${yyyy}${MM}${dd}${HH}${mm}${ss}`;
}

/** Builds the VNPay checkout URL for an order; the payment expires after one day. */
function buildPaymentUrl({ amount, orderId }) {
  const { tmnCode, secureSecret, host } = config.payments.vnpay;
  if (!tmnCode || !secureSecret) {
    throw new Error("VNPAY_TMN_CODE and VNPAY_SECURE_SECRET are not configured");
  }

  const transactionCode = `VNP${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const vnpay = new VNPay({
    tmnCode,
    secureSecret,
    vnpayHost: host,
    testMode: true,
    hashAlgorithm: "SHA512",
    loggerFn: () => { },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return vnpay.buildPaymentUrl({
    vnp_Amount: amount * 100,
    vnp_IpAddr: "127.0.0.1",
    vnp_TxnRef: transactionCode,
    vnp_OrderInfo: `Thanh toán đơn hàng #${orderId}`,
    vnp_OrderType: "other",
    vnp_ReturnUrl: `${process.env.VITE_API_BASE_URL}/orders/payment/vnpay`,
    vnp_Locale: "vn",
    vnp_CreateDate: formatDateVNPay(new Date()),
    vnp_ExpireDate: formatDateVNPay(tomorrow),
  });
}

module.exports = { buildPaymentUrl };
