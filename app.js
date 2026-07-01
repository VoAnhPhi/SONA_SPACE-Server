// Load environment variables from .env file
const dotenv = require("dotenv");
const result = dotenv.config();

// Log environment loading status
if (result.error) {
} else {
}

// Log important environment variables for debugging
var createError = require("http-errors");
var express = require("express");
var cors = require("cors");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

// Authentication middleware
const authMiddleware = require("./middleware/auth");
const { markDeprecatedRoute } = require("./middleware/deprecateRoute");

// Import all route files
var usersRouter = require("./routes/users");
var productsRouter = require("./routes/products");
var categoriesRouter = require("./routes/categories");
var variantsRouter = require("./routes/variants");
var roomsRouter = require("./routes/rooms");
var wishlistsRouter = require("./routes/wishlists");
var ordersRouter = require("./routes/orders");
var orderStatusRouter = require("./routes/orderStatus");
var paymentsRouter = require("./routes/payments");
var contactFormsDesignRouter = require("./routes/contactFormsDesign");
var couponcodesRouter = require("./routes/couponcodes");
var commentsRouter = require("./routes/comments");
var newsRouter = require("./routes/news");
var newsCategoriesRouter = require("./routes/newsCategories");
var authRouter = require("./routes/auth");
var debugRouter = require("./routes/debug");
var colorRouter = require("./routes/color");
var dashboardRouter = require("./routes/dashboard");
var ordersIdRouter = require("./routes/orders-id");
var wishlistsIdRouter = require("./routes/wishlists-id");
var uploadRouter = require("./routes/upload");
var bannersRouter = require("./routes/banners");
var materialsRouter = require("./routes/materials");
var revenueRouter = require("./routes/revenue");
var NotifyRouter = require("./routes/notify");
var typeNotifyRouter = require("./routes/typenotify");
var attributeRouter = require("./routes/attributes");
var eventsRouter = require("./routes/events");
var chatRouter = require("./routes/chat");
var contactFormsRouter = require("./routes/contactForms");
var app = express();

// App version and startup time for health checks
app.locals.version = require("./package.json").version || "1.0.0";
app.locals.startTime = new Date();

// Set up view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Configure express-ejs-layouts
const expressLayouts = require("express-ejs-layouts");
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("layout extractScripts", true);

app.use(logger("dev"));
// Tăng giới hạn kích thước body để tránh lỗi "request entity too large"
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: false, limit: "20mb" }));
app.use(cookieParser());
// Serve static files
app.use(express.static(path.join(__dirname, "public")));

app.use(cors());

// Add a health check endpoint
app.get("/health", function (req, res) {
  res.json({
    status: "ok",
    uptime: Math.floor((new Date() - app.locals.startTime) / 1000),
    version: app.locals.version,
    env: process.env.NODE_ENV,
  });
});

// tom select
app.use(
  "/tom-select",
  express.static(path.join(__dirname, "node_modules", "tom-select"))
);
app.use(
  "/tom-select/dist/css/tom-select.bootstrap5.min.css",
  express.static(
    path.join(
      __dirname,
      "node_modules",
      "tom-select",
      "dist",
      "css",
      "tom-select.bootstrap5.min.css"
    )
  )
);

// tinymce
app.use(
  "/tinymce",
  express.static(path.join(__dirname, "node_modules", "tinymce"))
);

// Base routes
app.get("/", (req, res) => {
  res.render("index", {
    title: "Sona Space - Admin Login",
  });
});

// dayjs
app.use(
  "/dayjs",
  express.static(path.join(__dirname, "node_modules", "dayjs"))
);

// API routes
app.use("/api/auth", authRouter);
app.use("/dashboard", dashboardRouter);

// API routes - public
app.use("/api/products", productsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/variants", variantsRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/news", newsRouter);
app.use("/api/news-categories", newsCategoriesRouter);
app.use("/api/contact-form-design", contactFormsDesignRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/debug", debugRouter);
app.use("/api/orders-id", ordersIdRouter);
app.use("/api/wishlists-id", wishlistsIdRouter);
// API routes - protected
app.use("/api/users", usersRouter);
app.use("/api/wishlists", authMiddleware.verifyToken, wishlistsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/order-status", authMiddleware.verifyToken, orderStatusRouter);
app.use("/api/payments", authMiddleware.verifyToken, paymentsRouter);
app.use("/api/couponcodes", authMiddleware.verifyToken, couponcodesRouter);
app.use("/api/color", colorRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/banners", bannersRouter);
app.use("/api/materials", materialsRouter);
app.use("/api/revenue", revenueRouter);
app.use("/api/notify", NotifyRouter);
app.use("/api/notifications", markDeprecatedRoute("/api/notifications"), NotifyRouter);
app.use("/api/typeNotify", typeNotifyRouter);
app.use("/api/attribute", attributeRouter);
app.use("/api/events", eventsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/contact-forms", contactFormsRouter);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  // Log the error for server-side debugging
  // Return JSON error response for API requests
  if (req.path.startsWith("/api/")) {
    return res.status(err.status || 500).json({
      error: {
        message: err.message,
        status: err.status || 500,
      },
    });
  }

  // Render error page for web requests
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;

