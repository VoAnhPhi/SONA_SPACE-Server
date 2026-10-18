"use strict";

const HttpError = require("./http-error");

/**
 * Run a service step and turn any unexpected failure into the 500 body the endpoint has always
 * returned. HttpError thrown inside (validation, 404, ...) passes through untouched.
 *
 * `failure` is what the endpoint answered on an unexpected error:
 *   - a string            -> { error: "<string>" }
 *   - an object           -> that exact body, e.g. { success: false, message: "..." }
 *   - (error) => body | HttpError, for endpoints that expose details or map database errors, e.g.
 *       (error) => error.code === "23505" ? new HttpError(409, {...}) : { error: "Failed", details: error.message }
 */
async function guard(failure, work) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const mapped =
      typeof failure === "function"
        ? failure(error)
        : typeof failure === "string"
          ? { error: failure }
          : failure;
    if (mapped instanceof HttpError) throw mapped;
    throw new HttpError(500, mapped);
  }
}

module.exports = guard;
