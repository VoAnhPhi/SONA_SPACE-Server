"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const categories = require("./categories.service");

// Route order matters: "/filter/", "/atts/:id" and "/admin/all" must stay ahead of "/:slug" lookups.
router.get("/filter/", asyncHandler(async (req, res) => {
  res.json(await categories.listForFilter());
}));

router.get("/", asyncHandler(async (req, res) => {
  res.json(await categories.listActive());
}));

router.get("/:slug", asyncHandler(async (req, res) => {
  res.json(await categories.getBySlug(req.params.slug));
}));

router.get("/atts/:categoryId", asyncHandler(async (req, res) => {
  res.status(200).json(await categories.listAttributes(req.params.categoryId));
}));

router.get("/admin/all", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await categories.listAll());
}));

router.post("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await categories.create(req.body));
}));

router.put("/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await categories.update(req.params.slug, req.body));
}));

router.delete("/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(200).json(await categories.remove(req.params.slug));
}));

router.get("/:slug/products", asyncHandler(async (req, res) => {
  res.json(await categories.listProducts(req.params.slug, req.query));
}));

router.get("/by-product/:slug", asyncHandler(async (req, res) => {
  res.json(await categories.listByProductSlug(req.params.slug));
}));

module.exports = router;
