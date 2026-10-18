"use strict";

const router = require("express").Router();
const db = require("../../config/database");
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const guard = require("../../shared/http/guard");

// Smoke endpoints for auth and database wiring. Mounted outside production only (modules/index.js).
router.get("/public", (req, res) => {
  res.json({ message: "Endpoint cong khai hoat dong" });
});

router.get("/protected", verifyToken, (req, res) => {
  res.json({
    message: "Endpoint duoc bao ve hoat dong",
    user: req.user,
  });
});

router.get("/admin", verifyToken, isAdmin, (req, res) => {
  res.json({
    message: "Endpoint danh cho admin hoat dong",
    user: req.user,
  });
});

router.get("/query-test", verifyToken, asyncHandler(async (req, res) => {
  const failure = (error) => ({ error: "Database query error", details: error.message });
  res.json(
    await guard(failure, async () => {
      const { rows } = await db.query("SELECT COUNT(*)::int AS count FROM orders");
      return {
        message: "Truy van co so du lieu hoat dong",
        result: rows[0] || { count: 0 },
      };
    })
  );
}));

router.get("/join-test", verifyToken, asyncHandler(async (req, res) => {
  const failure = (error) => ({ error: "Database join error", details: error.message });
  res.json(
    await guard(failure, async () => {
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

      return {
        message: "Truy van JOIN hoat dong",
        result: rows[0] || null,
      };
    })
  );
}));

module.exports = router;
