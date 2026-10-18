"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const colors = require("./colors.service");

// Public catalog
router.get("/filter", asyncHandler(async (req, res) => {
  res.json(await colors.listActive());
}));

router.get("/by-product/:slug", asyncHandler(async (req, res) => {
  res.json(await colors.listByProductSlug(req.params.slug));
}));

// Admin
router.get("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await colors.listAll());
}));

router.get("/admin/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await colors.getBySlug(req.params.slug));
}));

router.post("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await colors.create(req.body));
}));

router.put("/admin/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await colors.update(req.params.id, req.body));
}));

router.put("/admin/:id/toggle-status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await colors.toggleStatus(req.params.id));
}));

router.delete("/admin/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await colors.remove(req.params.id));
}));

module.exports = router;
