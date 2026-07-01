// attachChatbotSocketGemini25.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v4: uuidv4 } = require("uuid");
const db = require("./config/database");
require("dotenv").config();

const MAX_TURNS = Number(process.env.MAX_TURNS || 12);
const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB || 5);
// 1) Tăng tokens để hạn chế bị cụt ý
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_TOKENS || 9048);
// 2) Làm chậm stream để kéo dài typing (0 = tắt)
const STREAM_DELAY_MS = Number(process.env.STREAM_DELAY_MS || 0);
// 3) Ping keepalive để client giữ typing
const KEEPALIVE_MS = Number(process.env.KEEPALIVE_MS || 2000);

module.exports = function attachChatbotSocketGemini25(io) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  async function getSystemPrompt() {
    try {
      const { rows } = await db.query(`
        SELECT content
        FROM chatbot_context
        WHERE is_active = 1
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `);
      return (
        rows?.[0]?.content ||
        "Bạn là trợ lý AI thân thiện, trả lời ngắn gọn, hữu ích cho khách truy cập website."
      );
    } catch {
      return "Bạn là trợ lý AI thân thiện, trả lời ngắn gọn, hữu ích cho khách truy cập website.";
    }
  }

  function trimHistory(history) {
    if (!Array.isArray(history)) return [];
    const maxMsgs = MAX_TURNS * 2;
    return history.length > maxMsgs ? history.slice(-maxMsgs) : history;
  }

  function buildContents(history, userText) {
    const base = Array.isArray(history) ? history : [];
    return [...base, { role: "user", parts: [{ text: userText }] }];
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Heuristic: nhận biết trả lời có thể bị đứt
  function looksTruncated(text) {
    if (!text) return true;
    const t = text.trim();
    const endsPunct = /[.!?…'”’」』]$/.test(t);
    const backticks = (t.match(/```/g) || []).length;
    const unclosedCode = backticks % 2 === 1;
    return !endsPunct || unclosedCode;
  }

  const ns = io.of("/gemini");

  ns.on("connection", async (socket) => {
    socket.data.systemPrompt = await getSystemPrompt();
    socket.data.history = [];

    // ===== TEXT =====
    socket.on("user_message", async (data) => {
      const userText = (data && (data.message || data))?.toString().trim();
      if (!userText) return;

      const id = uuidv4();
      ns.to(socket.id).emit("bot_response_start", { id });

      const keepAlive = setInterval(() => {
        ns.to(socket.id).emit("bot_keepalive", { id });
      }, KEEPALIVE_MS);

      try {
        const contents = buildContents(socket.data.history, userText);

        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: socket.data.systemPrompt,
          generationConfig: {
            temperature: 0.6,
            topP: 0.9,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        });

        let fullText = "";

        // Ưu tiên stream
        const result = await model.generateContentStream({ contents });
        for await (const chunk of result.stream) {
          const chunkText = chunk.text() || "";
          if (!chunkText) continue;
          fullText += chunkText;
          ns.to(socket.id).emit("bot_response_chunk", { id, chunk: chunkText });
          if (STREAM_DELAY_MS) await sleep(STREAM_DELAY_MS);
        }

        // Fallback nếu stream rỗng (lib fail/timeout)
        if (!fullText) {
          const fallback = await model.generateContent({ contents });
          fullText = fallback.response.text() || "";
        }

        // Anti-truncation: cố gắng nối thêm 1 lần nếu thấy có dấu hiệu bị đứt
        if (looksTruncated(fullText)) {
          const cont = await model.generateContent({
            contents: [
              ...contents,
              { role: "model", parts: [{ text: fullText }] },
              {
                role: "user",
                parts: [
                  {
                    text: "Viết tiếp câu trả lời ngay trước đó (không lặp lại).",
                  },
                ],
              },
            ],
          });
          const more = cont.response.text() || "";
          if (more) fullText += (fullText.endsWith(" ") ? "" : " ") + more;
        }

        const finalText = (
          fullText || "Xin chào! Mình có thể giúp gì cho bạn?"
        ).trim();

        // Cập nhật history gọn nhẹ
        socket.data.history.push({ role: "user", parts: [{ text: userText }] });
        socket.data.history.push({
          role: "model",
          parts: [{ text: finalText }],
        });
        socket.data.history = trimHistory(socket.data.history);

        ns.to(socket.id).emit("bot_response", {
          id,
          response: finalText,
          groundingMetadata: null,
        });
        ns.to(socket.id).emit("bot_response_end", { id });
      } catch (e) {
        ns.to(socket.id).emit("error_response", {
          error:
            "Lỗi khi xử lý tin nhắn (Gemini 2.5 Pro): " +
            (e?.message || "Không rõ nguyên nhân"),
        });
        ns.to(socket.id).emit("bot_response_end", { id });
      } finally {
        clearInterval(keepAlive);
      }
    });

    // ===== VISION =====
    socket.on("user_image", async (payload = {}) => {
      const id = uuidv4();
      ns.to(socket.id).emit("bot_response_start", { id });
      const keepAlive = setInterval(() => {
        ns.to(socket.id).emit("bot_keepalive", { id });
      }, KEEPALIVE_MS);

      try {
        const data = payload.data || payload.image;
        const prompt = (payload.prompt || payload.message || "").toString();

        if (data && data.startsWith("data:")) {
          const commaIndex = data.indexOf(",");
          if (commaIndex !== -1) {
            const base64 = data.substring(commaIndex + 1);
            const bytes = Math.floor((base64.length * 3) / 4);
            const mb = bytes / (1024 * 1024);
            if (mb > MAX_IMAGE_MB) {
              ns.to(socket.id).emit("error_response", {
                error: `Ảnh quá lớn (~${mb.toFixed(
                  2
                )}MB). Vui lòng nén < ${MAX_IMAGE_MB}MB.`,
              });
              ns.to(socket.id).emit("bot_response_end", { id });
              clearInterval(keepAlive);
              return;
            }
          }
        } else {
          ns.to(socket.id).emit("error_response", {
            error:
              "Không tìm thấy dữ liệu ảnh hợp lệ. Vui lòng gửi ảnh base64.",
          });
          ns.to(socket.id).emit("bot_response_end", { id });
          clearInterval(keepAlive);
          return;
        }

        const parts = [];
        if (prompt && prompt.trim()) {
          parts.push({ text: prompt.trim() });
        } else {
          parts.push({
            text: "Hãy mô tả chi tiết hình ảnh và gợi ý 2 sản phẩm nội thất phù hợp nhất (tên sản phẩm cụ thể).",
          });
        }

        const commaIndex = data.indexOf(",");
        const meta = data.substring(0, commaIndex);
        const base64 = data.substring(commaIndex + 1);
        const mimeType = meta.split(";")[0].replace("data:", "");
        if (!base64) {
          ns.to(socket.id).emit("error_response", {
            error: "Dữ liệu base64 trống hoặc không hợp lệ.",
          });
          ns.to(socket.id).emit("bot_response_end", { id });
          clearInterval(keepAlive);
          return;
        }

        parts.push({ inlineData: { mimeType, data: base64 } });

        const visionModel = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
        });

        const result = await visionModel.generateContent(parts);
        const reply =
          result.response.text() || "Mình không thấy rõ nội dung hình.";

        ns.to(socket.id).emit("bot_response", { id, response: reply });
        ns.to(socket.id).emit("bot_response_end", { id });
      } catch (error) {
        ns.to(socket.id).emit("error_response", {
          error: "Lỗi khi xử lý hình ảnh (Gemini): " + error.message,
        });
        ns.to(socket.id).emit("bot_response_end", { id });
      } finally {
        clearInterval(keepAlive);
      }
    });
  });
};

