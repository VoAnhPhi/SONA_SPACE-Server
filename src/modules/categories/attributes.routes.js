"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const attributes = require("./attributes.service");

router.post("/:categoryId", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await attributes.create(req.params.categoryId, req.body));
}));

router.get("/:categoryId/attributes", asyncHandler(async (req, res) => {
  res.status(200).json(await attributes.listByCategory(req.params.categoryId));
}));

module.exports = router;
