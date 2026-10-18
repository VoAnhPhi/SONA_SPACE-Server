"use strict";

const config = require("../config/env");
const { verifyToken } = require("../shared/middleware/auth");
const { markDeprecatedRoute } = require("../shared/middleware/deprecate-route");

// Mount table, in the order Express must see it. `use` lists middleware applied to the whole mount.
// Routers still live in routes/ until each one moves into its own module (see the migration plan).
const mounts = [
  { path: "/api/auth", router: require("../../routes/auth") },
  { path: "/dashboard", router: require("../../routes/dashboard") },

  // public
  { path: "/api/products", router: require("../../routes/products") },
  { path: "/api/categories", router: require("../../routes/categories") },
  { path: "/api/variants", router: require("../../routes/variants") },
  { path: "/api/rooms", router: require("../../routes/rooms") },
  { path: "/api/news", router: require("../../routes/news") },
  { path: "/api/news-categories", router: require("../../routes/newsCategories") },
  { path: "/api/contact-form-design", router: require("../../routes/contactFormsDesign") },
  { path: "/api/comments", router: require("../../routes/comments") },
  { path: "/api/debug", router: require("../../routes/debug"), enabled: !config.isProduction },
  { path: "/api/orders-id", router: require("../../routes/orders-id") },
  { path: "/api/wishlists-id", router: require("../../routes/wishlists-id") },

  // protected
  { path: "/api/users", router: require("../../routes/users") },
  { path: "/api/wishlists", use: [verifyToken], router: require("../../routes/wishlists") },
  { path: "/api/orders", router: require("../../routes/orders") },
  { path: "/api/order-status", use: [verifyToken], router: require("../../routes/orderStatus") },
  { path: "/api/payments", use: [verifyToken], router: require("../../routes/payments") },
  { path: "/api/couponcodes", use: [verifyToken], router: require("../../routes/couponcodes") },
  { path: "/api/color", router: require("../../routes/color") },
  { path: "/api/upload", router: require("../../routes/upload") },
  { path: "/api/banners", router: require("../../routes/banners") },
  { path: "/api/materials", router: require("../../routes/materials") },
  { path: "/api/revenue", router: require("../../routes/revenue") },
  { path: "/api/notify", router: require("../../routes/notify") },
  {
    path: "/api/notifications",
    use: [markDeprecatedRoute("/api/notifications")],
    router: require("../../routes/notify"),
  },
  { path: "/api/typeNotify", router: require("../../routes/typenotify") },
  { path: "/api/attribute", router: require("../../routes/attributes") },
  { path: "/api/events", router: require("../../routes/events") },
  { path: "/api/chat", router: require("../../routes/chat") },
  { path: "/api/contact-forms", router: require("../../routes/contactForms") },
];

function mountModules(app) {
  for (const { path, use = [], router, enabled = true } of mounts) {
    if (enabled) app.use(path, ...use, router);
  }
}

module.exports = { mounts, mountModules };
