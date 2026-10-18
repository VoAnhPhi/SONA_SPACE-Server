"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const reports = require("./reports.service");

router.get("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await reports.revenueSeries(req.query));
}));

router.get("/user", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await reports.userSeries(req.query));
}));

router.get("/stats", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await reports.dashboardStats());
}));

module.exports = router;
