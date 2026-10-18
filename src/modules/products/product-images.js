"use strict";

const cloudinary = require("../../config/cloudinary");

// Cloudinary public ids are rebuilt from delivery URLs in three slightly different ways, one per
// place the URL comes from. They are kept apart because their edge cases differ (version segment,
// extension length, query string).

/** Product and variant images when a product is deleted: tolerant of the version and the extension. */
function publicIdFromProductUrl(url) {
  if (!url) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w{3,4})?(?:\?.*)?$/);
  if (match && match[1]) {
    let publicId = match[1];
    const lastDotIndex = publicId.lastIndexOf(".");
    if (lastDotIndex > -1 && publicId.substring(lastDotIndex).length <= 5) {
      publicId = publicId.substring(0, lastDotIndex);
    }
    return publicId;
  }
  return null;
}

/** Images removed in the product editor: only jpg, jpeg, png, webp and gif files match. */
function publicIdFromRemovedImageUrl(imageUrl) {
  const matches = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)\.(jpg|jpeg|png|webp|gif)$/);
  return matches ? matches[1] : null;
}

/** Variant images: everything after "/upload/", minus an optional "v123" segment and the extension. */
function publicIdFromVariantUrl(url) {
  const parts = String(url || "").split("/upload/");
  if (parts.length < 2) {
    return null;
  }

  const pathParts = parts[1].split("/");
  if (pathParts[0]?.startsWith("v") && !Number.isNaN(Number(pathParts[0].slice(1)))) {
    pathParts.shift();
  }

  const fullPath = pathParts.join("/");
  return fullPath.replace(/\.(jpg|jpeg|png|webp|gif)$/i, "");
}

/** Destroys an image; a failure is swallowed because the database change is what matters. */
async function destroyQuietly(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // an orphaned image is not worth failing the request
  }
}

module.exports = {
  publicIdFromProductUrl,
  publicIdFromRemovedImageUrl,
  publicIdFromVariantUrl,
  destroyQuietly,
};
