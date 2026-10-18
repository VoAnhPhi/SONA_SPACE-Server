"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const forms = require("./design-forms.service");

// POST is public (the design service page); everything else is for admin and staff.
router.post("/", asyncHandler(async (req, res) => {
  res.status(200).json(await forms.submit(req.body));
}));

router.get("/", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await forms.list(req.query, req.user));
}));

router.get("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await forms.getById(req.params.id));
}));

router.put("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await forms.update(req.params.id, req.body));
}));

router.get("/:id/details", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await forms.listDetails(req.params.id));
}));

router.post("/:id/details", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  const { status, body } = await forms.addDetail(req.params.id, req.body);
  res.status(status).json(body);
}));

router.put("/:id/details/:variant_id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await forms.updateDetail(req.params.id, req.params.variant_id, req.body));
}));

router.delete("/:id/details/:variant_id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await forms.removeDetail(req.params.id, req.params.variant_id));
}));

router.delete("/:id", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.json(await forms.remove(req.params.id));
}));

module.exports = router;
