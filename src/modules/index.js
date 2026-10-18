"use strict";

const config = require("../config/env");
const { verifyToken } = require("../shared/middleware/auth");
const { markDeprecatedRoute } = require("../shared/middleware/deprecate-route");

// Mount table, in the order Express must see it. `use` lists middleware applied to the whole mount.
const mounts = [
  { path: "/", router: require("../admin/login.routes") },
  { path: "/api/auth", router: require("./auth/auth.routes") },
  { path: "/dashboard", router: require("../admin/admin.routes") },

  // public
  { path: "/api/products", router: require("./products/products.routes") },
  { path: "/api/categories", router: require("./categories/categories.routes") },
  { path: "/api/variants", router: require("./products/variants.routes") },
  { path: "/api/rooms", router: require("./rooms/rooms.routes") },
  { path: "/api/news", router: require("./news/news.routes") },
  { path: "/api/news-categories", router: require("./news/news-categories.routes") },
  { path: "/api/contact-form-design", router: require("./contact/design-forms.routes") },
  { path: "/api/comments", router: require("./comments/comments.routes") },
  { path: "/api/debug", router: require("./debug/debug.routes"), enabled: !config.isProduction },
  { path: "/api/orders-id", router: require("./orders/customer-orders.routes") },
  { path: "/api/wishlists-id", router: require("./wishlists/wishlists-by-user.routes") },

  // protected
  { path: "/api/users", router: require("./users/users.routes") },
  { path: "/api/wishlists", use: [verifyToken], router: require("./wishlists/wishlists.routes") },
  { path: "/api/orders", router: require("./orders/orders.routes") },
  { path: "/api/order-status", use: [verifyToken], router: require("./orders/order-status.routes") },
  { path: "/api/payments", use: [verifyToken], router: require("./payments/payments.routes") },
  { path: "/api/couponcodes", use: [verifyToken], router: require("./coupons/coupons.routes") },
  { path: "/api/color", router: require("./colors/colors.routes") },
  { path: "/api/upload", router: require("./uploads/uploads.routes") },
  { path: "/api/banners", router: require("./banners/banners.routes") },
  { path: "/api/materials", router: require("./materials/materials.routes") },
  { path: "/api/revenue", router: require("./reports/reports.routes") },
  { path: "/api/notify", router: require("./notifications/notifications.routes") },
  {
    path: "/api/notifications",
    use: [markDeprecatedRoute("/api/notifications")],
    router: require("./notifications/notifications.routes"),
  },
  { path: "/api/typeNotify", router: require("./notifications/notification-types.routes") },
  { path: "/api/attribute", router: require("./categories/attributes.routes") },
  { path: "/api/events", router: require("./events/events.routes") },
  { path: "/api/chat", router: require("./chat/chat.routes") },
  { path: "/api/contact-forms", router: require("./contact/contact.routes") },
];

function mountModules(app) {
  for (const { path, use = [], router, enabled = true } of mounts) {
    if (enabled) app.use(path, ...use, router);
  }
}

module.exports = { mounts, mountModules };
