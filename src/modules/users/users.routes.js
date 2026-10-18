"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const upload = require("../../shared/middleware/upload");
const asyncHandler = require("../../shared/http/async-handler");
const users = require("./users.service");

// Route order matters: "/simple", "/admin", "/staff" and "/admin/:id" stay ahead of "/:id".
router.get("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await users.list(req.query));
}));

router.get("/simple", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await users.listSimple());
}));

router.get("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await users.listForAdmin(req.user));
}));

router.get("/staff", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await users.listStaff());
}));

router.get("/admin/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await users.getForAdmin(req.params.id));
}));

router.put("/admin/:id", verifyToken, isAdmin, upload.single("image"), asyncHandler(async (req, res) => {
  res.json(await users.updateForAdmin(req.params.id, req.body, req.file, req.user));
}));

router.get("/:id", verifyToken, asyncHandler(async (req, res) => {
  res.json(await users.getById(req.params.id, req.user));
}));

router.put("/:id", verifyToken, asyncHandler(async (req, res) => {
  res.json(await users.update(req.params.id, req.body, req.user));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await users.remove(req.params.id, req.user));
}));

router.get("/:id/orders", verifyToken, asyncHandler(async (req, res) => {
  res.json(await users.listOrders(req.params.id, req.user));
}));

router.get("/:id/wishlist", verifyToken, asyncHandler(async (req, res) => {
  res.json(await users.listWishlist(req.params.id, req.user));
}));

router.get("/:id/reviews", verifyToken, asyncHandler(async (req, res) => {
  res.json(await users.listReviews(req.params.id, req.user));
}));

module.exports = router;
