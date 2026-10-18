"use strict";

const { renderTemplate, deliver } = require("./mailer");

const TEMPLATES = {
  apology: "apology",
  "order-failed": "orderfailed",
  "return-approved": "return-approved",
  "return-rejected": "return-rejected",
  order: "order",
};

/** Order, return and apology mails. Resolves to { success, info } or { success: false, error }. */
async function sendEmail1(to, subject, data, templateType = "order") {
  const html = await renderTemplate(TEMPLATES[templateType] || TEMPLATES.order, data);
  try {
    const info = await deliver({ to, subject, html });
    return { success: true, info };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail1 };
