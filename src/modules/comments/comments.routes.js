"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const comments = require("./comments.service");

// Route order matters: "/admin" and "/:comment_id/status" stay ahead of "/:id".
router.get("/", asyncHandler(async (req, res) => {
  res.json(await comments.list(req.query));
}));

router.get("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await comments.listForAdmin());
}));

router.put("/:comment_id/status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await comments.moderate(req.params.comment_id, req.body));
}));

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await comments.getById(req.params.id));
}));

router.get("/product/:productId", asyncHandler(async (req, res) => {
  res.json(await comments.listByProduct(req.params.productId, req.query));
}));

router.get("/user/:userId", verifyToken, asyncHandler(async (req, res) => {
  res.json(await comments.listByUser(req.params.userId, req.query, req.user));
}));

router.post("/", verifyToken, asyncHandler(async (req, res) => {
  res.status(201).json(await comments.create(req.body, req.user));
}));

router.put("/:id", verifyToken, asyncHandler(async (req, res) => {
  res.json(await comments.update(req.params.id, req.body, req.user));
}));

router.delete("/:id", verifyToken, asyncHandler(async (req, res) => {
  res.json(await comments.remove(req.params.id, req.user));
}));

router.put("/:id/toggle-status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await comments.toggleStatus(req.params.id));
}));

module.exports = router;
