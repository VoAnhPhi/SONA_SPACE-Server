"use strict";

const router = require("express").Router();

// Admin sign-in page; the page itself talks to /api/auth.
router.get("/", (req, res) => {
  res.render("index", {
    title: "Sona Space - Admin Login",
  });
});

module.exports = router;
