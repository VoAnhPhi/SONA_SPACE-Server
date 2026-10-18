"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const materials = require("./materials.service");

router.get("/", asyncHandler(async (req, res) => {
  res.status(200).json(await materials.list());
}));

router.get("/:slug", asyncHandler(async (req, res) => {
  res.status(200).json(await materials.getBySlug(req.params.slug));
}));

router.post("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await materials.create(req.body));
}));

router.put("/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(200).json(await materials.update(req.params.slug, req.body));
}));

router.put("/:slug/toggle-status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await materials.toggleStatus(req.params.slug));
}));

router.delete("/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(200).json(await materials.remove(req.params.slug));
}));

module.exports = router;
