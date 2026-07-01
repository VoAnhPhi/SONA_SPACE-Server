const express = require("express");
const router = express.Router();
const db = require("../config/database");

const LIMIT_ALL_PRODUCT = 8;
const LIMIT_HOT_PRODUCT = 8;
const LIMIT_PRODUCT_BYID = 8;

// Get all products
router.get("/", async (req, res) => {
  try {
    const sql = `
      SELECT *
      FROM san_pham
      WHERE an_hien = 1
      ORDER BY ngay ASC
      LIMIT ${LIMIT_ALL_PRODUCT}
    `;
    const { rows } = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching products:", err);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Get hot products
router.get("/hot", async (req, res) => {
  try {
    const sql = `
      SELECT *
      FROM san_pham
      WHERE an_hien = 1 AND hot = 1
      ORDER BY ngay DESC
      LIMIT ${LIMIT_HOT_PRODUCT}
    `;
    const { rows } = await db.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching hot products:", err);
    return res.status(500).json({ error: "Failed to fetch hot products" });
  }
});

// Get products by category id
router.get("/:id", async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const sql = `
      SELECT *
      FROM san_pham
      WHERE id_loai = $1 AND an_hien = 1
      ORDER BY ngay ASC
      LIMIT ${LIMIT_PRODUCT_BYID}
    `;
    const { rows } = await db.query(sql, [id]);

    if (!rows.length) {
      return res.status(404).json({ error: "No products found for this category" });
    }

    return res.json(rows);
  } catch (err) {
    console.error("Error fetching products by ID:", err);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

module.exports = router;
