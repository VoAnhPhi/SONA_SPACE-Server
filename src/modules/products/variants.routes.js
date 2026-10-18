"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const { markDeprecatedRoute } = require("../../shared/middleware/deprecate-route");
const asyncHandler = require("../../shared/http/async-handler");
const variants = require("./variants.service");

router.get("/", asyncHandler(async (req, res) => {
  res.json(await variants.list(req.query));
}));

router.get("/by-product/:slug", asyncHandler(async (req, res) => {
  res.json(await variants.listByProductSlug(req.params.slug));
}));

router.get("/:productSlug/:colorId", asyncHandler(async (req, res) => {
  res.json(await variants.getByProductSlugAndColor(req.params.productSlug, req.params.colorId));
}));

router.post("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await variants.create(req.body));
}));

// Deprecated routes below: the admin editor now saves variants together with the product
router.post("/:productId", markDeprecatedRoute("/api/variants/:productId"), verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await variants.createForProduct(req.params.productId, req.body));
}));

router.put("/:variantId", markDeprecatedRoute("/api/variants/:variantId"), verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await variants.update(req.params.variantId, req.body));
}));

router.delete("/:variantId", markDeprecatedRoute("/api/variants/:variantId"), verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await variants.remove(req.params.variantId));
}));

module.exports = router;
