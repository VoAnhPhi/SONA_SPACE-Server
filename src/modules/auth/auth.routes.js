"use strict";

const router = require("express").Router();
const { verifyToken } = require("../../shared/middleware/auth");
const asyncHandler = require("../../shared/http/async-handler");
const auth = require("./auth.service");
const passwordReset = require("./password-reset.service");

router.post("/register", asyncHandler(async (req, res) => {
  res.status(201).json(await auth.register(req.body));
}));

// Every outcome is a redirect to the frontend verification page
router.get("/verify-email", asyncHandler(async (req, res) => {
  res.redirect(await auth.verifyEmail(req.query.token));
}));

router.post("/google-login", asyncHandler(async (req, res) => {
  res.json(await auth.googleLogin(req.body));
}));

router.post("/login", asyncHandler(async (req, res) => {
  res.json(await auth.login(req.body));
}));

router.get("/profile", verifyToken, asyncHandler(async (req, res) => {
  res.json(await auth.getProfile(req.user));
}));

router.post("/change-password", verifyToken, asyncHandler(async (req, res) => {
  res.json(await auth.changePassword(req.body, req.user));
}));

// The admin pages authenticate with this cookie (see shared/middleware/auth verifyToken)
router.post("/admin-login", asyncHandler(async (req, res) => {
  const { token, body } = await auth.adminLogin(req.body);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: "lax",
  });

  res.json(body);
}));

router.get("/check-token", verifyToken, asyncHandler(async (req, res) => {
  res.json(await auth.checkToken(req.user));
}));

router.post("/logout", verifyToken, asyncHandler(async (req, res) => {
  const body = await auth.logout(req.user);
  res.clearCookie("token");
  res.json(body);
}));

router.post("/send-otp", asyncHandler(async (req, res) => {
  res.json(await passwordReset.sendOtp(req.body));
}));

router.post("/verify-otp", asyncHandler(async (req, res) => {
  res.json(await passwordReset.verifyOtp(req.body));
}));

router.post("/reset-password", asyncHandler(async (req, res) => {
  res.json(await passwordReset.resetPassword(req.body));
}));

module.exports = router;
