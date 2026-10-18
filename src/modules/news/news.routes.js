"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const news = require("./news.service");

// Anonymous requests never carry req.user on these public routes, so they only see published articles.
const viewerOf = (req) => ({ isAdminViewer: Boolean(req.user && req.user.isAdmin) });

// Route order matters: fixed paths ("/simple", "/admin", "/views", "/category/:id") stay ahead of "/:slug".
router.get("/", asyncHandler(async (req, res) => {
  res.json(await news.list(req.query, viewerOf(req)));
}));

router.get("/simple", asyncHandler(async (req, res) => {
  res.json(await news.listSimple(req.query, viewerOf(req)));
}));

router.get("/admin", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await news.listForAdmin(req.query));
}));

router.get("/views", asyncHandler(async (req, res) => {
  res.json(await news.listMostViewed(req.query));
}));

router.get("/category/:categoryId", asyncHandler(async (req, res) => {
  res.json(await news.listByCategory(req.params.categoryId, req.query));
}));

router.post("/", verifyToken, asyncHandler(async (req, res) => {
  res.status(201).json(await news.create(req.body, req.user));
}));

router.get("/:slug", asyncHandler(async (req, res) => {
  res.json(await news.getBySlugAndCountView(req.params.slug));
}));

router.put("/:slug", verifyToken, asyncHandler(async (req, res) => {
  res.json(await news.update(req.params.slug, req.body));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await news.remove(req.params.id));
}));

module.exports = router;
