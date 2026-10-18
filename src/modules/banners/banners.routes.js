"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const banners = require("./banners.service");
const { upload } = require("./banners.upload");

// Route order matters: fixed paths ("/page/...", "/pages", "/page-types") stay ahead of "/:id".
router.get("/", asyncHandler(async (req, res) => {
  res.json(await banners.listAll());
}));

router.get("/page/:pageType", asyncHandler(async (req, res) => {
  res.json(await banners.listForPage(req.params.pageType));
}));

router.post("/pages", asyncHandler(async (req, res) => {
  res.json(await banners.groupedForPageTypesFromBody(req.body));
}));

router.get("/pages", asyncHandler(async (req, res) => {
  res.json(await banners.groupedForPageTypesFromQuery(req.query));
}));

router.get("/page-types", (req, res) => {
  res.json(banners.listPageTypes());
});

router.get("/:id", asyncHandler(async (req, res) => {
  res.json(await banners.getById(req.params.id));
}));

router.post("/", verifyToken, isAdmin, upload.single("image"), asyncHandler(async (req, res) => {
  res.status(201).json(await banners.create(req.body, req.file));
}));

router.put("/:id", verifyToken, isAdmin, upload.single("image"), asyncHandler(async (req, res) => {
  res.json(await banners.update(req.params.id, req.body, req.file));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await banners.remove(req.params.id));
}));

router.put("/:id/toggle-status", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await banners.toggleStatus(req.params.id));
}));

module.exports = router;
