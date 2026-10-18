"use strict";

// The only place that loads .env. Every entry point reaches it through src/app.js, the config
// modules or the shared middleware, so `process.env` is filled before anything reads it.
// dotenv never overrides variables that already exist, so real environment settings win.
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const isProduction = process.env.NODE_ENV === "production";

// Needed for the server to behave correctly in production. Checked by bin/www at boot.
const REQUIRED_IN_PRODUCTION = [
  "JWT_SECRET",
  "PGHOST",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "CORS_ORIGINS",
  "EMAIL_USER",
  "EMAIL_PASS",
];

function missingKeys() {
  const required = isProduction ? REQUIRED_IN_PRODUCTION : ["JWT_SECRET"];
  return required.filter((key) => !String(process.env[key] || "").trim());
}

/** Exit with a clear message (names only, never values) when required settings are absent. */
function assertRequired() {
  const missing = missingKeys();
  if (!missing.length) return;
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = Object.freeze({
  isProduction,
  port: process.env.PORT || "3501",
  // Unset keeps the open policy outside production (local dev and QA scripts).
  corsOrigin: corsOrigins.length ? corsOrigins : isProduction ? false : "*",
  assertRequired,
});
