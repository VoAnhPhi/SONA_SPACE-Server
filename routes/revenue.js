const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

require("dayjs/locale/vi");
const dayjs = require("dayjs");
const isSameOrBefore = require("dayjs/plugin/isSameOrBefore");
dayjs.extend(isSameOrBefore);

const ORDER_STATUS_COMPLETED = 4;
const ORDER_STATUS_SHIPPING = 2;

function getTimeConfig(type, limit) {
  if (type === "month") {
    return {
      format: "YYYY-MM",
      sqlFormat: "YYYY-MM",
      unit: "month",
      limit: Number(limit) || 12,
    };
  }

  if (type === "year") {
    return {
      format: "YYYY",
      sqlFormat: "YYYY",
      unit: "year",
      limit: Number(limit) || 5,
    };
  }

  return {
    format: "YYYY-MM-DD",
    sqlFormat: "YYYY-MM-DD",
    unit: "day",
    limit: Number(limit) || 7,
  };
}

function buildDateList({ type, from, to, limit }) {
  const config = getTimeConfig(type, limit);
  const dateList = [];

  if (from && to) {
    let start = dayjs(from);
    const end = dayjs(to);

    while (start.isSameOrBefore(end, config.unit)) {
      dateList.push(start.format(config.format));
      start = start.add(1, config.unit);
    }

    return { config, dateList };
  }

  const today = dayjs();
  for (let i = config.limit - 1; i >= 0; i -= 1) {
    dateList.push(today.subtract(i, config.unit).format(config.format));
  }

  return { config, dateList };
}

router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const { type = "day", from, to, limit } = req.query;
    const { config, dateList } = buildDateList({ type, from, to, limit });

    const { rows: orders } = await db.query(
      `
      SELECT
        to_char(created_at, $1) AS date,
        SUM(order_final_total)::numeric AS revenue
      FROM orders
      WHERE order_status = $2
        AND to_char(created_at, $1) = ANY($3::text[])
      GROUP BY to_char(created_at, $1)
      `,
      [config.sqlFormat, ORDER_STATUS_COMPLETED, dateList]
    );

    const resultMap = {};
    for (const date of dateList) {
      resultMap[date] = { date, orderRevenue: 0, designRevenue: 0 };
    }

    for (const row of orders) {
      if (resultMap[row.date]) {
        resultMap[row.date].orderRevenue = Number(row.revenue) || 0;
      }
    }

    const result = dateList.map((date) => resultMap[date]);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/user", verifyToken, isAdmin, async (req, res) => {
  try {
    const { type = "day", from, to, limit } = req.query;
    const { config, dateList } = buildDateList({ type, from, to, limit });

    const { rows: userCounts } = await db.query(
      `
      SELECT
        to_char(created_at, $1) AS date,
        COUNT(*)::int AS total
      FROM "user"
      WHERE to_char(created_at, $1) = ANY($2::text[])
      GROUP BY to_char(created_at, $1)
      `,
      [config.sqlFormat, dateList]
    );

    const resultMap = {};
    for (const date of dateList) {
      resultMap[date] = { date, userCount: 0 };
    }

    for (const row of userCounts) {
      if (resultMap[row.date]) {
        resultMap[row.date].userCount = Number(row.total) || 0;
      }
    }

    const result = dateList.map((date) => resultMap[date]);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", verifyToken, isAdmin, async (req, res) => {
  const currentMonth = dayjs().locale("vi").format("MMMM");
  const fullMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);

  const { rows: totalOrderRows } = await db.query(
    "SELECT COUNT(*)::int AS total_order FROM orders"
  );
  const { rows: completedOrderRows } = await db.query(
    "SELECT COUNT(*)::int AS completed_order FROM orders WHERE order_status = $1",
    [ORDER_STATUS_COMPLETED]
  );
  const { rows: shippingOrderRows } = await db.query(
    "SELECT COUNT(*)::int AS shipping_order FROM orders WHERE order_status = $1",
    [ORDER_STATUS_SHIPPING]
  );
  const { rows: revenueThisMonthRows } = await db.query(
    `
    SELECT COALESCE(SUM(order_final_total), 0)::numeric AS revenue_this_month
    FROM orders
    WHERE order_status = $1
      AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `,
    [ORDER_STATUS_COMPLETED]
  );
  const { rows: revenueTotalRows } = await db.query(
    `
    SELECT COALESCE(SUM(order_final_total), 0)::numeric AS revenue_total
    FROM orders
    WHERE order_status = $1
    `,
    [ORDER_STATUS_COMPLETED]
  );

  const totalOrder = Number(totalOrderRows[0]?.total_order || 0);
  const completedOrder = Number(completedOrderRows[0]?.completed_order || 0);
  const shippingOrder = Number(shippingOrderRows[0]?.shipping_order || 0);

  const revenueThisMonth = Number(revenueThisMonthRows[0]?.revenue_this_month || 0);
  const revenueTotal = Number(revenueTotalRows[0]?.revenue_total || 0);

  const designRevenueThisMonth = 0;
  const designRevenueTotal = 0;

  return res.json({
    totalOrder,
    completedOrder,
    shippingOrder,
    revenueThisMonth: {
      total: revenueThisMonth + designRevenueThisMonth,
      design: designRevenueThisMonth,
    },
    revenueTotal: {
      total: revenueTotal + designRevenueTotal,
      design: designRevenueTotal,
    },
    monthName: fullMonth,
  });
});

module.exports = router;
