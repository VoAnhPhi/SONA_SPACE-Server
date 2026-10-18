"use strict";

const router = require("express").Router();
const { verifyToken } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const wishlists = require("./wishlists.service");

// GET /api/wishlists-id/:userId - owner, admin or staff
router.get("/:userId", verifyToken, asyncHandler(async (req, res) => {
  res.json(await wishlists.listByUserId(req.params.userId, req.user));
}));

module.exports = router;
