"use strict";

/** Parse a route or query value into a positive integer id; returns null when it is not one. */
function parsePositiveId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = { parsePositiveId };
