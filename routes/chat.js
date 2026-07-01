const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");

const DEFAULT_CONTEXT =
  "Ban la tro ly AI than thien, tra loi ngan gon va huu ich cho khach truy cap website.";

router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT content
      FROM chatbot_context
      WHERE is_active = 1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `);

    const context = rows[0]?.content || DEFAULT_CONTEXT;
    return res.json({ context });
  } catch (error) {
    return res.status(500).json({ error: "Loi server" });
  }
});

router.put("/context", verifyToken, isAdmin, async (req, res) => {
  try {
    const { context } = req.body;
    if (!context || !String(context).trim()) {
      return res.status(400).json({ error: "Vui long nhap noi dung" });
    }

    const normalized = String(context).trim();

    const { rowCount } = await db.query(
      "UPDATE chatbot_context SET content = $1, updated_at = NOW() WHERE id = 1",
      [normalized]
    );

    if (rowCount === 0) {
      await db.query(
        "INSERT INTO chatbot_context (id, title, content, type, is_active, created_at, updated_at) VALUES (1, $1, $2, $3, 1, NOW(), NOW())",
        ["Default context", normalized, "system"]
      );
    }

    return res.status(201).json({
      message: "Cap nhat thanh cong.",
      context: normalized,
    });
  } catch (error) {
    return res.status(500).json({ error: "Loi server" });
  }
});

module.exports = router;
