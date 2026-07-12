const db = require("../config/database");

const fixture = {
  userId: 3,
  variantId: 270,
  quantity: 1,
  price: 15000000,
  amount: 15030000,
  orderHash: `__qa_order__${Date.now()}`,
};

async function runStep(client, name, query, values = []) {
  try {
    const result = await client.query(query, values);
    console.log(`PASS ${name}`);
    return result;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

async function main() {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const payment = await runStep(
      client,
      "insert payment",
      `INSERT INTO payments (payment_method, payment_amount, payment_status, created_at)
       VALUES ('cod', $1, 'pending', NOW())
       RETURNING payment_id`,
      [fixture.amount]
    );

    const order = await runStep(
      client,
      "insert order",
      `INSERT INTO orders (
         order_hash, user_id, order_total, order_final_total,
         order_shipping_fee, order_discount, order_status,
         order_address, order_phone, order_name, order_email,
         order_payment_method, payment_id, created_at
       ) VALUES ($1, $2, $3, $4, 30000, 0, 0,
                 'QA address', '0900000000', 'QA User', 'qa@sonaspace.test',
                 'cod', $5, NOW())
       RETURNING order_id`,
      [fixture.orderHash, fixture.userId, 15000000, fixture.amount, payment.rows[0].payment_id]
    );

    const stock = await runStep(
      client,
      "decrement variant stock",
      `UPDATE variant_product
       SET variant_product_quantity = variant_product_quantity - $1
       WHERE variant_id = $2 AND variant_product_quantity >= $1
       RETURNING product_id`,
      [fixture.quantity, fixture.variantId]
    );

    if (!stock.rowCount) {
      throw new Error("QA fixture variant has insufficient stock");
    }

    await runStep(
      client,
      "insert order item",
      `INSERT INTO order_items (order_id, variant_id, quantity, price, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [order.rows[0].order_id, fixture.variantId, fixture.quantity, fixture.price]
    );

    await runStep(
      client,
      "write order status log",
      `INSERT INTO order_status_log (order_id, old_status, new_status, changed_by, note, created_at)
       VALUES ($1, NULL, 0, $2, 'QA COD order', NOW())`,
      [order.rows[0].order_id, fixture.userId]
    );

    const adminRows = await runStep(
      client,
      "find admin notification recipient",
      `SELECT user_id FROM "user"
       WHERE user_role::text = 'admin'
       ORDER BY user_id LIMIT 1`
    );

    if (!adminRows.rowCount) {
      throw new Error("QA fixture has no admin user");
    }

    await client.query("ROLLBACK");
    console.log("PASS transaction rollback; no QA order persisted");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("QA order-create transaction failed; changes rolled back");
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

main();
