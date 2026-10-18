"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const chat = require("./chat.service");

router.get("/", asyncHandler(async (req, res) => {
  res.json(await chat.getContext());
}));

router.put("/context", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await chat.updateContext(req.body));
}));

module.exports = router;
