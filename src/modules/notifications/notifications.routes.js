"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const notifications = require("./notifications.service");

// Mounted twice in modules/index.js: /api/notify and the deprecated alias /api/notifications.
router.get("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(200).json(await notifications.listAll());
}));

router.get("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await notifications.listRecent());
}));

router.post("/", verifyToken, asyncHandler(async (req, res) => {
  res.status(201).json(await notifications.create(req.body, req.user));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await notifications.remove(req.params.id));
}));

module.exports = router;
