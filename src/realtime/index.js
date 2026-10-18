"use strict";

// Socket.IO features. Each chatbot keeps its own namespace: OpenAI on the default one and Gemini
// on /gemini; the admin chat-bot page and the storefront bubble connect to them by that name.
const attachOpenAiChatbot = require("./chatbot/openai.socket");
const attachGeminiChatbot = require("./chatbot/gemini.socket");

function attachRealtime(io) {
  attachOpenAiChatbot(io);
  attachGeminiChatbot(io);
}

module.exports = attachRealtime;
