// MoMo characterization (T2). Calls POST /api/orders with method MOMO and captures the request the
// server would send to MoMo (axios.post is mocked, nothing leaves the machine, no DB rows are written).
// Verifies target URL, body fields, decoded extraData and the HMAC signature, so moving the MoMo code
// into a provider module must keep the outgoing request identical.
//
// Run: npm run qa:momo-payload
process.env.ACCESSKEY = "qa-access-key";
process.env.SECRETKEY = "qa-secret-key";
process.env.API_URL = "https://api.example.test/api";

const crypto = require("crypto");
const http = require("http");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const app = require("../app");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET;

const FIXED_NOW = 1700000000000;
const FIXED_RANDOM = 0.123;

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` -> ${detail}`}`);
  if (!ok) failures.push(name);
}

async function main() {
  const { rows: users } = await db.query(
    `SELECT user_id, user_role FROM "user" WHERE deleted_at IS NULL AND user_role = 'user' ORDER BY user_id LIMIT 1`
  );
  const { rows: variants } = await db.query(
    `SELECT variant_id FROM variant_product WHERE variant_product_quantity >= 1 ORDER BY variant_id LIMIT 1`
  );
  if (!users[0] || !variants[0]) throw new Error("Missing user or in-stock variant fixture");

  const token = jwt.sign({ id: users[0].user_id, role: users[0].user_role }, JWT_SECRET, { expiresIn: "1h" });

  const captured = [];
  const originalPost = axios.post;
  axios.post = async (url, body, config) => {
    captured.push({ url, body, config });
    return { data: { payUrl: "https://pay.example.test/momo-checkout" } };
  };

  const realNow = Date.now;
  const realRandom = Math.random;
  Date.now = () => FIXED_NOW;
  Math.random = () => FIXED_RANDOM;

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const requestBody = {
    order_id: "SNA-QA-MOMO-1",
    order_total: 1000000,
    order_total_final: 1000000,
    method: "MOMO",
    amount: 1000000,
    fromRedirect: true,
    shipping_fee: 0,
    order_discount: 0,
    cart_items: [{ variant_id: variants[0].variant_id, quantity: 1, name: "QA item", price: 1000000 }],
  };

  const response = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(requestBody),
  });
  const json = await response.json().catch(() => null);

  const withoutRedirect = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...requestBody, fromRedirect: false }),
  });

  Date.now = realNow;
  Math.random = realRandom;
  axios.post = originalPost;
  server.close();

  check("response is 200 with payUrl", response.status === 200 && json?.payUrl === "https://pay.example.test/momo-checkout", `${response.status} ${JSON.stringify(json)}`);
  check("MOMO without fromRedirect is rejected with 400", withoutRedirect.status === 400, String(withoutRedirect.status));
  check("exactly one outgoing MoMo call", captured.length === 1, String(captured.length));

  const call = captured[0];
  if (call) {
    const body = call.body;
    check("target URL", call.url === "https://test-payment.momo.vn/v2/gateway/api/create", call.url);
    check("content-type header", call.config?.headers?.["Content-Type"] === "application/json", JSON.stringify(call.config));

    const expectedRequestId = `${FIXED_NOW}-${Math.floor(FIXED_RANDOM * 1000)}`;
    const expectedFields = {
      partnerCode: "MOMO",
      accessKey: "qa-access-key",
      requestId: expectedRequestId,
      amount: "1000000",
      orderId: "SNA-QA-MOMO-1",
      orderInfo: "Thanh toán đơn hàng",
      redirectUrl: "https://api.example.test/api/orders/redirect/momo",
      ipnUrl: "https://api.example.test/api/orders/payment/momo",
      requestType: "captureWallet",
      lang: "vi",
    };
    for (const [key, value] of Object.entries(expectedFields)) {
      check(`body.${key}`, body[key] === value, `${JSON.stringify(body[key])} != ${JSON.stringify(value)}`);
    }
    check("body keys", JSON.stringify(Object.keys(body).sort()) === JSON.stringify([...Object.keys(expectedFields), "extraData", "signature"].sort()), Object.keys(body).join(","));

    let extra = null;
    try {
      extra = JSON.parse(Buffer.from(body.extraData, "base64").toString("utf8"));
    } catch (error) {
      extra = null;
    }
    check("extraData decodes to JSON", Boolean(extra), body.extraData);
    if (extra) {
      check("extraData.user_id", extra.user_id === users[0].user_id, String(extra.user_id));
      check("extraData.order_id", extra.order_id === "SNA-QA-MOMO-1", String(extra.order_id));
      check("extraData.cart_items", Array.isArray(extra.cart_items) && extra.cart_items.length === 1, JSON.stringify(extra.cart_items));
      check(
        "extraData keys",
        JSON.stringify(Object.keys(extra).sort()) ===
          JSON.stringify(
            [
              "order_id", "user_id", "order_total", "order_total_final", "order_address_new", "order_number2",
              "order_name_new", "order_email_new", "couponcode_id", "cart_items", "coupon_code", "shipping_fee", "order_discount",
            ]
              .filter((key) => key in extra)
              .sort()
          ),
        Object.keys(extra).join(",")
      );
    }

    const raw =
      `accessKey=${body.accessKey}&amount=${body.amount}&extraData=${body.extraData}&ipnUrl=${body.ipnUrl}` +
      `&orderId=${body.orderId}&orderInfo=${body.orderInfo}&partnerCode=${body.partnerCode}` +
      `&redirectUrl=${body.redirectUrl}&requestId=${body.requestId}&requestType=${body.requestType}`;
    const expectedSignature = crypto.createHmac("sha256", "qa-secret-key").update(raw).digest("hex");
    check("signature is HMAC-SHA256 of the documented raw string", body.signature === expectedSignature, `${body.signature} != ${expectedSignature}`);
  }

  console.log(`MoMo payload: ${failures.length ? `${failures.length} FAILED` : "all checks passed"}`);
  await db.end?.();
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
