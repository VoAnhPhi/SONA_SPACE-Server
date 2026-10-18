"use strict";

/** Express 4 does not catch rejected promises: forward them to the error handler. */
module.exports = function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
