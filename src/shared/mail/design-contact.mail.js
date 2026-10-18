"use strict";

const { renderTemplate, deliver } = require("./mailer");

/** Confirmation sent to a customer who requested a design consultation. Returns true when sent. */
async function sendEmail(to, subject, data) {
  const html = await renderTemplate("contactDesign", data);
  try {
    await deliver({ to, subject, html });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = { sendEmail };
