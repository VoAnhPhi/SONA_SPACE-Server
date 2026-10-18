"use strict";

const { renderTemplate, deliver, getShopAddress } = require("./mailer");

/** Forward a customer's contact request to the shop mailbox. Returns true when sent. */
async function sendEmailFromCustomer(from, subject, data, templateName) {
  let html;
  try {
    html = await renderTemplate(templateName, data);
  } catch (ejsError) {
    throw new Error(`Không thể render template email: ${ejsError.message}`);
  }

  try {
    await deliver({
      from,
      to: getShopAddress(),
      subject,
      replyTo: from,
      text: "Yêu cầu hỗ trợ từ khách hàng",
      html,
    });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = { sendEmailFromCustomer };
