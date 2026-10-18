"use strict";

const router = require("express").Router();
const asyncHandler = require("../../shared/http/async-handler");
const contact = require("./contact.service");

// POST /api/contact-forms - the "Lien he" form
router.post("/", asyncHandler(async (req, res) => {
  res.status(200).json(await contact.sendContactMessage(req.body));
}));

module.exports = router;
