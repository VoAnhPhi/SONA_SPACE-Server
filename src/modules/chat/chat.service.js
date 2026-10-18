"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

const DEFAULT_CONTEXT =
  "Ban la tro ly AI than thien, tra loi ngan gon va huu ich cho khach truy cap website.";

/** The system prompt the chatbot starts from. */
function getContext() {
  return guard({ error: "Loi server" }, async () => {
    const { rows } = await db.query(`
      SELECT content
      FROM chatbot_context
      WHERE is_active = 1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `);

    return { context: rows[0]?.content || DEFAULT_CONTEXT };
  });
}

function updateContext(body) {
  return guard({ error: "Loi server" }, async () => {
    const { context } = body;
    if (!context || !String(context).trim()) {
      throw new HttpError(400, { error: "Vui long nhap noi dung" });
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

    return {
      message: "Cap nhat thanh cong.",
      context: normalized,
    };
  });
}

module.exports = { getContext, updateContext };
