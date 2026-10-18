"use strict";

const path = require("path");
const ejs = require("ejs");
const nodemailer = require("nodemailer");
require("../../config/env");

const TEMPLATE_DIR = path.join(__dirname, "templates");

function getCredentials() {
  return { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };
}

/** The shop mailbox: sender of every mail and recipient of customer contact requests. */
function getShopAddress() {
  return process.env.EMAIL_USER;
}

function renderTemplate(templateName, data) {
  return ejs.renderFile(path.join(TEMPLATE_DIR, `${templateName}.ejs`), data);
}

/** Build the transporter per send so a changed EMAIL_PASS is picked up without a restart of this module. */
function createTransporter() {
  return nodemailer.createTransport({ service: "gmail", auth: getCredentials() });
}

/** Send one mail from the shop mailbox. Rejects when the transport fails; callers choose how to report it. */
async function deliver({ from = getShopAddress(), ...options }) {
  const transporter = createTransporter();
  return transporter.sendMail({ from, ...options });
}

module.exports = { renderTemplate, deliver, getShopAddress };
