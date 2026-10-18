"use strict";

/**
 * An error a service throws to end a request with a specific status and JSON body.
 * The body is sent as is, so modules keep the exact response shapes clients already depend on.
 */
class HttpError extends Error {
  constructor(status, body) {
    const payload = typeof body === "string" ? { error: body } : body || {};
    super(payload.error || payload.message || `HTTP ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.body = payload;
  }
}

module.exports = HttpError;
