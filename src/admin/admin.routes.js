"use strict";

const router = require("express").Router();
const { checkAuth } = require("./admin-session");
const { pages } = require("./admin-pages");

// Mounted at /dashboard; every page requires an admin session.
router.use(checkAuth);

for (const { path, view, title, locals, redirectTo, handler, middleware = [] } of pages) {
  if (handler) {
    router.get(path, ...middleware, handler);
  } else if (redirectTo) {
    router.get(path, (req, res) => res.redirect(redirectTo(req)));
  } else {
    router.get(path, (req, res) => {
      res.render(view, {
        title,
        layout: "layouts/dashboard",
        ...(locals ? locals(req) : {}),
      });
    });
  }
}

module.exports = router;
