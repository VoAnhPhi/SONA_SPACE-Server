"use strict";

const { verifyToken, isAdmin } = require("../shared/middleware/auth");

/** Admin pages need an admin token (cookie or Authorization header); anyone else goes to the login page. */
function checkAuth(req, res, next) {
  const token =
    req.cookies.token ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);

  if (!token) {
    return res.redirect("/");
  }

  try {
    verifyToken(req, res, (err) => {
      if (err) {
        return res.redirect("/");
      }
      isAdmin(req, res, next);
    });
  } catch (error) {
    return res.redirect("/");
  }
}

module.exports = { checkAuth };
