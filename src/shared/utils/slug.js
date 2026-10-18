"use strict";

/** Lowercase ASCII slug: strips Vietnamese diacritics, maps đ to d, joins words with "-". */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\-+/g, "-");
}

module.exports = { slugify };
