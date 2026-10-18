"use strict";

/**
 * Public id of a Cloudinary asset from its delivery URL: everything after "upload/<version>/",
 * without the file extension. Returns null when the URL does not look like a Cloudinary upload.
 *   https://res.cloudinary.com/x/image/upload/v123/SonaSpace/Event/a.jpg -> SonaSpace/Event/a
 */
function extractPublicIdFromUrl(url) {
  if (!url) {
    return null;
  }

  try {
    const urlParts = String(url).split("/");
    const uploadIndex = urlParts.indexOf("upload");
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      const publicIdParts = urlParts.slice(uploadIndex + 2);
      return publicIdParts.join("/").replace(/\.[^/.]+$/, "");
    }
  } catch (error) {
    return null;
  }

  return null;
}

module.exports = { extractPublicIdFromUrl };
