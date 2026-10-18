const config = require("./config/env");
const createError = require("http-errors");
const express = require("express");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const HttpError = require("./shared/http/http-error");
const { mountModules } = require("./modules");

const ROOT = path.join(__dirname, "..");

const app = express();

// App version and startup time for health checks
app.locals.version = require("../package.json").version || "1.0.0";
app.locals.startTime = new Date();
app.locals.corsOrigin = config.corsOrigin;

// Set up view engine
app.set("views", path.join(ROOT, "views"));
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
app.use(express.static(path.join(ROOT, "public")));

app.use(cors({ origin: config.corsOrigin }));

// Add a health check endpoint
app.get("/health", function (req, res) {
  res.json({
    status: "ok",
    uptime: Math.floor((new Date() - app.locals.startTime) / 1000),
    version: app.locals.version,
    env: process.env.NODE_ENV,
  });
});

// Third-party assets used by the admin pages
app.use("/tom-select", express.static(path.join(ROOT, "node_modules", "tom-select")));
app.use("/tinymce", express.static(path.join(ROOT, "node_modules", "tinymce")));
app.use("/dayjs", express.static(path.join(ROOT, "node_modules", "dayjs")));

// Base routes
app.get("/", (req, res) => {
  res.render("index", {
    title: "Sona Space - Admin Login",
  });
});

// API and admin routes
mountModules(app);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  // Services end a request with an exact status and JSON body by throwing HttpError
  if (err instanceof HttpError) {
    return res.status(err.status).json(err.body);
  }

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
  res.render("error", { layout: "layouts/error" });
});

module.exports = app;
