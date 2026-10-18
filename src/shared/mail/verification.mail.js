"use strict";

const { renderTemplate, deliver } = require("./mailer");

/** Account verification and password-reset OTP mails. Returns true when sent, false when delivery failed. */
async function sendEmail(to, subject, data, templateName) {
  let html;
  try {
    html = await renderTemplate(templateName, data);
  } catch (ejsError) {
    throw new Error(`Không thể render template email: ${ejsError.message}`);
  }

  try {
    await deliver({ to, subject, html });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = { sendEmail };
