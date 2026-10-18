"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const events = require("./events.service");

router.get("/active", asyncHandler(async (req, res) => {
  res.json(await events.listActive());
}));

router.get("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await events.listAll());
}));

router.get("/admin/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await events.getById(req.params.id));
}));

router.post("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await events.create(req.body));
}));

router.put("/admin/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await events.update(req.params.id, req.body));
}));

router.put("/admin/:id/toggle-status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await events.toggleStatus(req.params.id));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await events.remove(req.params.id));
}));

module.exports = router;
