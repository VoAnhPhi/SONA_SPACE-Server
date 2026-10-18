"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const rooms = require("./rooms.service");

// Route order matters: fixed paths ("/admin", "/filter/", "/products") stay ahead of "/:slug".
router.get("/", asyncHandler(async (req, res) => {
  res.json(await rooms.listActive());
}));

router.get("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await rooms.listAll());
}));

router.get("/filter/", asyncHandler(async (req, res) => {
  res.json(await rooms.listForFilter());
}));

router.get("/products", asyncHandler(async (req, res) => {
  res.json(await rooms.listProductVariants());
}));

router.get("/:slug", asyncHandler(async (req, res) => {
  res.json(await rooms.getBySlug(req.params.slug));
}));

router.post("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await rooms.create(req.body));
}));

router.put("/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await rooms.update(req.params.slug, req.body));
}));

router.delete("/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await rooms.remove(req.params.slug));
}));

router.get("/:slug/products", asyncHandler(async (req, res) => {
  res.json(await rooms.listProducts(req.params.slug, req.query));
}));

router.post("/:slug/products", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await rooms.addProducts(req.params.slug, req.body));
}));

router.delete("/:slug/products/:productId", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await rooms.removeProduct(req.params.slug, req.params.productId));
}));

router.get("/by-product/:slug", asyncHandler(async (req, res) => {
  res.json(await rooms.listByProductSlug(req.params.slug));
}));

module.exports = router;
