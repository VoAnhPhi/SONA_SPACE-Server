"use strict";

const db = require("../../config/database");

const FALLBACK_PROMPT =
  "Bạn là trợ lý AI thân thiện, trả lời ngắn gọn, hữu ích cho khách truy cập website.";

/** The newest active prompt the admin saved in "Chat bot", or a short default when none exists. */
async function getSystemPrompt() {
  try {
    const { rows } = await db.query(`
      SELECT content
      FROM chatbot_context
      WHERE is_active = 1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `);
    return rows?.[0]?.content || FALLBACK_PROMPT;
  } catch {
    return FALLBACK_PROMPT;
  }
}

module.exports = { getSystemPrompt };
