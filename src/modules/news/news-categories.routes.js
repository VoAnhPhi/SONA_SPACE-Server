"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const categories = require("./news-categories.service");

router.get("/", asyncHandler(async (req, res) => {
  res.json(await categories.list());
}));

router.get("/:slug", asyncHandler(async (req, res) => {
  res.json(await categories.getBySlug(req.params.slug));
}));

router.post("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await categories.create(req.body));
}));

router.put("/:id/status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await categories.updateStatus(req.params.id, req.body));
}));

router.put("/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await categories.update(req.params.slug, req.body));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await categories.remove(req.params.id));
}));

router.get("/news/:slug", asyncHandler(async (req, res) => {
  res.json(await categories.listNewsBySlug(req.params.slug));
}));

module.exports = router;
