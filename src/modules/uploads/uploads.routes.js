"use strict";

const router = require("express").Router();
const { verifyToken, isAdmin } = require("../../shared/middleware/auth");
const upload = require("../../shared/middleware/upload");
const asyncHandler = require("../../shared/http/async-handler");
const uploads = require("./uploads.service");

const adminImage = [verifyToken, isAdmin, upload.single("image")];

// category and room: the caller may name the Cloudinary folder
router.post("/category", ...adminImage, asyncHandler(async (req, res) => {
  res.status(200).json(await uploads.uploadImage(req.file, req.body, req.body.folder, req.body.subfolder));
}));

router.post("/room", ...adminImage, asyncHandler(async (req, res) => {
  res.status(200).json(await uploads.uploadImage(req.file, req.body, req.body.folder, req.body.subfolder));
}));

// the folder of a product image is built on the server from imageType and the slugs
router.post("/product", ...adminImage, asyncHandler(async (req, res) => {
  res.status(200).json(await uploads.uploadProductImage(req.file, req.body));
}));

router.delete("/:publicId(*)", verifyToken, isAdmin, asyncHandler(async (req, res) => {
  res.status(200).json(await uploads.deleteImage(req.params.publicId));
}));

router.post("/news", ...adminImage, asyncHandler(async (req, res) => {
  res.status(200).json(await uploads.uploadImage(req.file, req.body, "SonaSpace", "News"));
}));

router.post("/newscategorynews", ...adminImage, asyncHandler(async (req, res) => {
  res.status(200).json(await uploads.uploadImage(req.file, req.body, "SonaSpace", "NewsCategories"));
}));

router.post("/event", ...adminImage, asyncHandler(async (req, res) => {
  res.status(200).json(await uploads.uploadImage(req.file, req.body, "SonaSpace", "PopupAd"));
}));

module.exports = router;
