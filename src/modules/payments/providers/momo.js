"use strict";

const crypto = require("crypto");
const axios = require("axios");
const config = require("../../../config/env");

const hmac = (rawSignature) =>
  crypto.createHmac("sha256", config.payments.momo.secretKey).update(rawSignature).digest("hex");

/** Signature MoMo puts on its IPN callback; compare it with the `signature` field received. */
function ipnSignature(fields) {
  const { amount, extraData, message, orderId, orderInfo, orderType, partnerCode, payType, requestId, responseTime, resultCode, transId } = fields;
  const { accessKey } = config.payments.momo;
  return hmac(
    `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`
  );
}

/** Starts a captureWallet payment; `extra` travels back to us base64-encoded in the IPN. */
async function createPayment({ orderId, amount, extra }) {
  const { partnerCode, accessKey, apiBase } = config.payments.momo;
  const requestType = "captureWallet";
  const requestId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const redirectUrl = `${process.env.API_URL}/orders/redirect/momo`;
  const ipnUrl = `${process.env.API_URL}/orders/payment/momo`;
  const orderInfo = "Thanh toán đơn hàng";
  const extraData = Buffer.from(JSON.stringify(extra)).toString("base64");

  const signature = hmac(
    `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`
  );

  const response = await axios.post(
    `${apiBase}/create`,
    {
      partnerCode,
      accessKey,
      requestId,
      amount: amount.toString(),
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang: "vi",
    },
    { headers: { "Content-Type": "application/json" } }
  );

  return response.data.payUrl;
}

/** Asks MoMo to refund a paid transaction, used when stock ran out after the customer paid. */
async function refund({ partnerCode, orderId, transId, amount }) {
  const { accessKey, apiBase } = config.payments.momo;
  const refundData = {
    partnerCode,
    accessKey,
    requestId: Date.now().toString(),
    amount: amount.toString(),
    orderId: `${orderId}_refund`,
    transId,
    lang: "vi",
    description: "Refund because item is out of stock",
  };

  refundData.signature = hmac(
    `accessKey=${refundData.accessKey}&amount=${refundData.amount}&description=${refundData.description}&orderId=${refundData.orderId}&partnerCode=${refundData.partnerCode}&requestId=${refundData.requestId}&transId=${refundData.transId}`
  );

  await axios.post(`${apiBase}/refund`, refundData, { headers: { "Content-Type": "application/json" } });
}

module.exports = { ipnSignature, createPayment, refund };
