"use strict";

const HttpError = require("./http-error");

/**
 * Run a service step and turn any unexpected failure into the 500 body the endpoint has always
 * returned. HttpError thrown inside (validation, 404, ...) passes through untouched.
 */
async function guard(failureMessage, work) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, { error: failureMessage });
  }
}

module.exports = guard;
