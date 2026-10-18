"use strict";

const router = require("express").Router();
const { verifyToken } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const wishlists = require("./wishlists.service");

// Mounted with verifyToken in modules/index.js as well; every route keeps its own as before.
// Route order matters: "/clear", "/clearid", "/variant/:id", "/product/:id" stay ahead of "/:id".
router.get("/", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await wishlists.listForUser(req.user.id, req.query.status));
}));

router.get("/variant/:variantId", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await wishlists.hasVariant(req.params.variantId, req.user.id));
}));

router.post("/", verifyToken, asyncHandler(async (req, res) => {
  const { status, body } = await wishlists.add(req.body, req.user.id);
  res.status(status).json(body);
}));

router.put("/:id", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await wishlists.updateCartQuantity(req.params.id, req.body, req.user.id));
}));

router.delete("/clear", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await wishlists.clearCart(req.user.id));
}));

router.delete("/clearid", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await wishlists.clearSelectedCartItems(req.body, req.user.id));
}));

router.delete("/:id", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await wishlists.removeById(req.params.id, req.user.id));
}));

router.delete("/variant/:variantId", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await wishlists.removeByVariant(req.params.variantId, req.user.id));
}));

router.delete("/product/:productId", verifyToken, asyncHandler(async (req, res) => {
  res.json(await wishlists.removeByProduct(req.params.productId, req.user.id));
}));

router.get("/check/:productId", verifyToken, asyncHandler(async (req, res) => {
  res.json(await wishlists.checkProduct(req.params.productId, req.user.id));
}));

module.exports = router;
