"use strict";

const HttpError = require("./http-error");

/**
 * Run a service step and turn any unexpected failure into the 500 body the endpoint has always
 * returned. HttpError thrown inside (validation, 404, ...) passes through untouched.
 *
 * `failure` is the legacy message, or a function (error) => body | HttpError for endpoints that
 * expose details or map database errors, e.g.
 *   (error) => error.code === "23505" ? new HttpError(409, {...}) : { error: "Failed", details: error.message }
 */
async function guard(failure, work) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const mapped = typeof failure === "function" ? failure(error) : { error: failure };
    if (mapped instanceof HttpError) throw mapped;
    throw new HttpError(500, mapped);
  }
}

module.exports = guard;
