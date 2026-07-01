// SOCKET.IO dùng cho chat bot (multimodal: text + image)
const OpenAI = require("openai").default; // CommonJS default export
const db = require("./config/database");

const MAX_TURNS = 6; // số lượt hội thoại gần nhất giữ lại
const MAX_IMAGE_SIZE_MB = 5;

module.exports = function attachChatbotSocket(io) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Lưu lịch sử theo socket
  const chatHistories = Object.create(null);

  // ---- helper: build message content cho vision ----
  function buildVisionContent({ text, imageUrl, dataUrl }) {
    const parts = [];
    
    console.log("Building vision content with:", {
      hasText: !!text,
      hasImageUrl: !!imageUrl,
      hasDataUrl: !!dataUrl,
      textLength: text ? text.length : 0
    });
    
    if (text && String(text).trim()) {
      parts.push({ type: "text", text: text.trim() });
    }
    
    const url = imageUrl || dataUrl;
    if (url) {
      parts.push({
        type: "image_url",
        image_url: { url }, // có thể là https://... hoặc data:image/png;base64,...
      });
      console.log("Added image URL to content, URL length:", url.length);
    }
    
    console.log("Vision content parts:", parts.length);
    return parts;
  }

  // ---- helper: push history & crop ----
  function pushHistory(socketId, role, content) {
    chatHistories[socketId] = chatHistories[socketId] || [];
    chatHistories[socketId].push({ role, content });
    // chỉ giữ MAX_TURNS gần nhất (không tính system)
    const keep = chatHistories[socketId].slice(-MAX_TURNS);
    chatHistories[socketId] = keep;
  }

  // ---- get system prompt từ DB ----
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

  // ---- main socket handler ----
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    chatHistories[socket.id] = [];

    // Debug event to test connection
    socket.on("test_connection", () => {
      console.log("Test connection from:", socket.id);
      socket.emit("connection_ok", "Server connected successfully");
    });

    // Text-only
    socket.on("user_message", async (msg) => {
      try {
        const systemPrompt = await getSystemPrompt();

        // đẩy vào history (text-only)
        pushHistory(socket.id, "user", msg);

        const messages = [
          { role: "system", content: systemPrompt },
          ...chatHistories[socket.id],
        ];

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 512,
          temperature: 0.6,
        });

        const reply =
          completion.choices?.[0]?.message?.content ??
          "Mình chưa nhận được nội dung hợp lệ.";
        pushHistory(socket.id, "assistant", reply);
        socket.emit("bot_reply", reply);
      } catch (error) {
        console.error("Error in user_message:", error);
        socket.emit("bot_reply", "Lỗi khi xử lý tin nhắn.");
      }
    });

    // Image + optional prompt
    // payload: { filename?: string, data?: string (dataURL), url?: string, prompt?: string }
    socket.on("user_image", async (payload = {}) => {
      try {
        console.log("Received user_image event with payload:", {
          hasData: !!payload.data,
          hasUrl: !!payload.url,
          hasPrompt: !!payload.prompt,
          dataType: payload.data ? typeof payload.data : 'undefined',
          dataLength: payload.data ? payload.data.length : 0
        });

        const { data, url, prompt } = payload;

        // Validate input
        if (!data && !url) {
          console.log("No image data or URL provided");
          socket.emit("bot_reply", "Không tìm thấy hình ảnh. Vui lòng thử lại.");
          return;
        }

        // Kiểm tra dung lượng dataURL (nếu có) để tránh quá lớn
        if (data && data.startsWith("data:")) {
          // ước lượng bytes của base64
          const base64 = data.split(",")?.[1] || "";
          const bytes = Math.floor((base64.length * 3) / 4);
          const mb = bytes / (1024 * 1024);
          console.log(`Image size: ${mb.toFixed(2)}MB`);
          if (mb > MAX_IMAGE_SIZE_MB) {
            socket.emit(
              "bot_reply",
              `Ảnh quá lớn (~${mb.toFixed(
                2
              )}MB). Vui lòng nén ảnh < ${MAX_IMAGE_SIZE_MB}MB.`
            );
            return;
          }
        }

        const systemPrompt = await getSystemPrompt();

        // Nội dung đa phương tiện cho user
        const userContent = buildVisionContent({
          text:
            prompt ||
            "Hãy mô tả ảnh này (vật thể, chữ, bối cảnh) và nêu các chi tiết đáng chú ý.",
          dataUrl: data,
          imageUrl: url,
        });

        console.log("Built vision content:", {
          contentLength: userContent.length,
          hasText: userContent.some(item => item.type === "text"),
          hasImage: userContent.some(item => item.type === "image_url")
        });

        // lưu vào history
        pushHistory(socket.id, "user", userContent);

        const messages = [
          { role: "system", content: systemPrompt },
          ...chatHistories[socket.id],
        ];

        console.log("Sending to OpenAI with messages count:", messages.length);

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini", // model có vision
          messages,
          max_tokens: 600,
          temperature: 0.5,
        });

        console.log("OpenAI response received");

        const reply =
          completion.choices?.[0]?.message?.content ??
          "Không đọc được ảnh. Hãy thử lại.";
        pushHistory(socket.id, "assistant", reply);
        socket.emit("bot_reply", reply);
      } catch (error) {
        console.error("Error in user_image:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          payload: {
            hasData: !!payload?.data,
            hasUrl: !!payload?.url,
            hasPrompt: !!payload?.prompt
          }
        });
        socket.emit("bot_reply", "Lỗi khi xử lý hình ảnh. Vui lòng thử lại.");
      }
    });

    // Combined text + image message
    socket.on("user_message_with_image", async (payload = {}) => {
      try {
        console.log("Received user_message_with_image:", {
          hasMessage: !!payload.message,
          hasImage: !!payload.image,
          messageLength: payload.message ? payload.message.length : 0
        });

        const { message, image } = payload;
        
        if (!message && !image) {
          socket.emit("bot_reply", "Không có nội dung tin nhắn hoặc hình ảnh.");
          return;
        }

        // If only text, use regular text handler
        if (message && !image) {
          socket.emit("user_message", message);
          return;
        }

        // If has image, use image handler
        if (image) {
          socket.emit("user_image", {
            data: image,
            prompt: message || "Hãy mô tả ảnh này."
          });
          return;
        }

      } catch (error) {
        console.error("Error in user_message_with_image:", error);
        socket.emit("bot_reply", "Lỗi khi xử lý tin nhắn với hình ảnh.");
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
      delete chatHistories[socket.id];
    });
  });
};

