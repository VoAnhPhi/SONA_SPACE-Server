"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin, optionalAuth } = require("../../shared/middleware/auth");
const { markDeprecatedRoute } = require("../../shared/middleware/deprecate-route");
const asyncHandler = require("../../shared/http/async-handler");
const products = require("./products.service");
const admin = require("./products-admin.service");

const userIdOf = (req) => req.user?.id || 0;

// Route order matters: fixed paths stay ahead of the "/:slug" product page.
router.get("/all", optionalAuth, asyncHandler(async (req, res) => {
  res.json(await products.listBySlugFilters(req.query, userIdOf(req)));
}));

router.get("/", optionalAuth, asyncHandler(async (req, res) => {
  res.json(await products.listByNameFilters(req.query, userIdOf(req)));
}));

router.get("/search", asyncHandler(async (req, res) => {
  res.json(await products.search(req.query.q));
}));

router.get("/admin", markDeprecatedRoute("/api/products/admin"), verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await admin.list());
}));

router.get("/related/by-room/:productId", optionalAuth, asyncHandler(async (req, res) => {
  res.json(await products.relatedByRoom(req.params.productId, userIdOf(req)));
}));

router.get("/newest", optionalAuth, asyncHandler(async (req, res) => {
  res.json(await products.newest(req.query, userIdOf(req)));
}));

router.get("/variants", asyncHandler(async (req, res) => {
  res.json(await products.listVariants());
}));

router.get("/full-list-all", asyncHandler(async (req, res) => {
  res.json(await products.fullList());
}));

router.get("/ai-catalog", asyncHandler(async (req, res) => {
  res.json(await products.aiCatalog(req.query));
}));

router.get("/:slug", asyncHandler(async (req, res) => {
  res.json(await products.getBySlug(req.params.slug));
}));

// Original create/update API; superseded by POST /add and PUT /admin/:slug below
router.post("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await admin.legacyCreate(req.body));
}));

router.put("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await admin.legacyUpdate(req.params.id, req.body));
}));

router.delete("/:slug", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await admin.remove(req.params.slug));
}));

router.get("/featured/list", asyncHandler(async (req, res) => {
  res.json(await products.featured(req.query));
}));

router.get("/by-category/:categoryId", asyncHandler(async (req, res) => {
  res.json(await products.byCategory(req.params.categoryId, req.query));
}));

router.put("/status/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await admin.updateStatus(req.params.id, req.body));
}));

router.post("/add", markDeprecatedRoute("/api/products/add"), verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(201).json(await admin.add(req.body));
}));

router.put("/admin/:slug", markDeprecatedRoute("/api/products/admin/:slug"), verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await admin.updateBySlug(req.params.slug, req.body));
}));

router.get("/admin/:slug", markDeprecatedRoute("/api/products/admin/:slug"), verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await admin.getBySlug(req.params.slug));
}));

module.exports = router;
