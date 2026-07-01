const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

router.get("/public", async (req, res) => {
  try {
    res.json({ message: "Endpoint cong khai hoat dong" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/protected", verifyToken, async (req, res) => {
  try {
    res.json({
      message: "Endpoint duoc bao ve hoat dong",
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    res.json({
      message: "Endpoint danh cho admin hoat dong",
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/query-test", verifyToken, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT COUNT(*)::int AS count FROM orders");
    res.json({
      message: "Truy van co so du lieu hoat dong",
      result: rows[0] || { count: 0 },
    });
  } catch (error) {
    res.status(500).json({ error: "Database query error", details: error.message });
  }
});

router.get("/join-test", verifyToken, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        o.order_id,
        o.order_status,
        CASE o.order_status
          WHEN 0 THEN 'Pending'
          WHEN 1 THEN 'Confirmed'
          WHEN 2 THEN 'Shipping'
          WHEN 3 THEN 'Completed'
          WHEN 4 THEN 'Cancelled'
          ELSE 'Unknown'
        END AS status_name,
        u.user_gmail AS user_email,
        u.user_name
      FROM orders o
      LEFT JOIN "user" u ON o.user_id = u.user_id
      ORDER BY o.created_at DESC
      LIMIT 1
    `);

    res.json({
      message: "Truy van JOIN hoat dong",
      result: rows[0] || null,
    });
  } catch (error) {
    res.status(500).json({ error: "Database join error", details: error.message });
  }
});

module.exports = router;
