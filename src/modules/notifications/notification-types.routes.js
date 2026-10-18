"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const types = require("./notification-types.service");

router.get("", asyncHandler(async (req, res) => {
  res.json(await types.list());
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await types.getById(req.params.id));
}));

router.post("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await types.create(req.body));
}));

router.put("/:id/status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await types.updateStatus(req.params.id, req.body));
}));

router.put("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await types.update(req.params.id, req.body));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await types.remove(req.params.id));
}));

module.exports = router;
