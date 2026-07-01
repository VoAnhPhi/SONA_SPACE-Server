const express = require("express");
const router = express.Router();
const { verifyToken, isAdmin } = require("../middleware/auth");

const ORDER_STATUSES = [
  {
    order_status_id: -1,
    id: -1,
    order_status_name: "cancelled",
    name: "cancelled",
    label: "Cancelled",
    order_status_color: "#ef4444",
    color: "#ef4444",
    description: "Order was cancelled before completion",
  },
  {
    order_status_id: 0,
    id: 0,
    order_status_name: "pending",
    name: "pending",
    label: "Pending",
    order_status_color: "#f59e0b",
    color: "#f59e0b",
    description: "Order has been created and is waiting for confirmation",
  },
  {
    order_status_id: 1,
    id: 1,
    order_status_name: "confirmed",
    name: "confirmed",
    label: "Confirmed",
    order_status_color: "#3b82f6",
    color: "#3b82f6",
    description: "Order has been confirmed by the store",
  },
  {
    order_status_id: 2,
    id: 2,
    order_status_name: "shipping",
    name: "shipping",
    label: "Shipping",
    order_status_color: "#8b5cf6",
    color: "#8b5cf6",
    description: "Order is being shipped to the customer",
  },
  {
    order_status_id: 3,
    id: 3,
    order_status_name: "delivered",
    name: "delivered",
    label: "Delivered",
    order_status_color: "#14b8a6",
    color: "#14b8a6",
    description: "Order has been delivered to the customer",
  },
  {
    order_status_id: 4,
    id: 4,
    order_status_name: "completed",
    name: "completed",
    label: "Completed",
    order_status_color: "#22c55e",
    color: "#22c55e",
    description: "Order has been completed successfully",
  },
];

function findStatus(statusId) {
  return ORDER_STATUSES.find((status) => status.order_status_id === statusId);
}

function staticCatalogResponse(res) {
  return res.status(410).json({
    error: "Order status catalog is static in the PostgreSQL schema",
    message: "Update orders.order_status through order routes and keep numeric mappings in docs/db-contract-postgres.md.",
    statuses: ORDER_STATUSES,
  });
}

router.get("/", async (req, res) => {
  res.json(ORDER_STATUSES);
});

router.get("/:id", async (req, res) => {
  const statusId = Number(req.params.id);
  if (isNaN(statusId)) {
    return res.status(400).json({ error: "Invalid status ID" });
  }

  const status = findStatus(statusId);
  if (!status) {
    return res.status(404).json({ error: "Order status not found" });
  }

  return res.json(status);
});

router.post("/", verifyToken, isAdmin, async (req, res) => staticCatalogResponse(res));

router.put("/:id", verifyToken, isAdmin, async (req, res) => staticCatalogResponse(res));

router.delete("/:id", verifyToken, isAdmin, async (req, res) => staticCatalogResponse(res));

module.exports = router;
