"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const coupons = require("./coupons.service");
const userNotifications = require("../notifications/user-notifications.service");

// Mounted with verifyToken in modules/index.js as well; every route keeps its own as before.
// Route order matters: fixed paths ("/notification", "/codes", "/admin", ...) stay ahead of "/:id".
router.get("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await coupons.listAll());
}));

// The user's own notification inbox lives under this prefix for historical reasons
router.get("/notification", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await userNotifications.listForUser(req.user.id));
}));

router.patch("/notification/read/:id", verifyToken, asyncHandler(async (req, res) => {
  res.status(200).json(await userNotifications.markRead(req.params.id, req.user.id));
}));

router.get("/user-has-coupon", verifyToken, asyncHandler(async (req, res) => {
  res.json(await coupons.listUserCoupons(req.user.id));
}));

router.get("/codes", verifyToken, asyncHandler(async (req, res) => {
  res.json(await coupons.listAvailableForUser(req.user.id));
}));

router.get("/admin", verifyToken, asyncHandler(async (req, res) => {
  res.json(await coupons.listUnexpired());
}));

router.get("/userCoupon", verifyToken, asyncHandler(async (req, res) => {
  res.json(await coupons.listAssignedToUser(req.user.id));
}));

router.get("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await coupons.getById(req.params.id));
}));

router.post("/mark-all-read", verifyToken, asyncHandler(async (req, res) => {
  res.json(await userNotifications.markAllRead(req.user.id));
}));

router.post("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await coupons.create(req.body, req.user));
}));

router.put("/:id/status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await coupons.updateStatus(req.params.id, req.body));
}));

router.put("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await coupons.update(req.params.id, req.body));
}));

router.delete("/notification/:id", verifyToken, asyncHandler(async (req, res) => {
  res.json(await userNotifications.hide(req.params.id, req.user.id));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await coupons.remove(req.params.id));
}));

router.post("/validate", verifyToken, asyncHandler(async (req, res) => {
  res.json(await coupons.validate(req.body, req.user));
}));

module.exports = router;
