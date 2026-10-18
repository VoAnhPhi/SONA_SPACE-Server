"use strict";

const cloudinary = require("../../config/cloudinary");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

function buildBase64Image(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

function resolveFolder(folder, subfolder) {
  return subfolder ? `${folder}/${subfolder}` : folder;
}

function sanitizeFolderSegment(value) {
  if (typeof value !== "string") return "";

  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Product images live in SonaSpace/Product/<product>/main or .../variants/<variant>. */
function resolveProductImageFolder(body) {
  const imageType = String(body.imageType || "").trim().toLowerCase();
  const productSlug = sanitizeFolderSegment(body.productSlug);
  const variantSlug = sanitizeFolderSegment(body.variantSlug);

  if (!["main", "variant"].includes(imageType)) {
    throw new HttpError(400, {
      error: "Loai anh san pham khong hop le",
      field: "imageType",
      detail: "imageType phai la main hoac variant",
    });
  }

  if (!productSlug) {
    throw new HttpError(400, {
      error: "Thieu slug san pham",
      field: "productSlug",
      detail: "productSlug la bat buoc de tao thu muc Cloudinary",
    });
  }

  if (imageType === "variant" && !variantSlug) {
    throw new HttpError(400, {
      error: "Thieu slug bien the",
      field: "variantSlug",
      detail: "variantSlug la bat buoc khi imageType la variant",
    });
  }

  return imageType === "main"
    ? `SonaSpace/Product/${productSlug}/main`
    : `SonaSpace/Product/${productSlug}/variants/${variantSlug}`;
}

/** Generic image upload; the folder defaults to the endpoint's own unless the request names one. */
function uploadImage(file, body, defaultFolder, defaultSubfolder) {
  const failure = (error) => ({ error: "Loi upload anh", detail: error.message });

  return guard(failure, async () => {
    if (!file) {
      throw new HttpError(400, { error: "Thieu file anh" });
    }

    const folder = body.folder || defaultFolder;
    const subfolder = body.subfolder || defaultSubfolder;
    const result = await cloudinary.uploader.upload(buildBase64Image(file), {
      folder: resolveFolder(folder, subfolder),
    });

    return {
      message: "Upload thanh cong",
      url: result.secure_url,
      public_id: result.public_id,
    };
  });
}

/** Product image upload with strict validation and a server-built folder. */
function uploadProductImage(file, body) {
  const failure = {
    error: "Loi khong xac dinh khi upload anh",
    detail: "Khong the upload anh san pham",
  };

  return guard(failure, async () => {
    if (!file) {
      throw new HttpError(400, {
        error: "Thieu file anh",
        field: "image",
        detail: "Vui long chon mot file anh de upload",
      });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new HttpError(400, {
        error: "Dinh dang anh khong hop le",
        field: "image",
        detail: "Chi chap nhan file anh JPEG, PNG hoac WEBP",
      });
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new HttpError(400, {
        error: "Anh vuot qua dung luong cho phep",
        field: "image",
        detail: "Anh phai nho hon 5MB",
      });
    }

    const folder = resolveProductImageFolder(body);

    const result = await cloudinary.uploader.upload(buildBase64Image(file), { folder });

    return {
      message: "Upload thanh cong",
      url: result.secure_url,
      public_id: result.public_id,
    };
  });
}

function deleteImage(publicId) {
  const failure = (error) => ({ error: "Loi xoa anh", detail: error.message });

  return guard(failure, async () => {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    if (result.result === "not found") {
      throw new HttpError(404, { error: "Khong tim thay anh", detail: result });
    }

    if (result.result !== "ok") {
      throw new HttpError(500, { error: "Loi xoa anh", detail: result });
    }

    return { message: "Xoa anh thanh cong" };
  });
}

module.exports = { uploadImage, uploadProductImage, deleteImage };
