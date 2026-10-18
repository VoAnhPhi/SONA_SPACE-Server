"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { sendEmail } = require("../../shared/mail/design-contact.mail");
const { EMAIL_REGEX } = require("./contact.service");
const {
  STATUS_CODE_TO_LABEL,
  STATUS_LABEL_TO_CODE,
  VALID_STATUS_TRANSITIONS,
} = require("./contact.constants");

// Design consultation requests. Fields the table has no column for (budget, fees, remarks, ...)
// travel as JSON inside the `note` column and are unpacked by parseCompatNote.

const isStaffRole = (user) => user?.role?.toLowerCase?.() === "staff";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

// Any integer passes; callers reject 0 through `!id`.
function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseCompatNote(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return {
        different_information: value,
      };
    }
  }

  return {};
}

function serializeCompatNote(note) {
  const entries = Object.entries(note).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  if (entries.length === 0) {
    return null;
  }

  return JSON.stringify(Object.fromEntries(entries));
}

function normalizeStatusLabel(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
    const code = Number(value);
    return STATUS_CODE_TO_LABEL[code] || null;
  }

  const normalized = String(value).trim().toUpperCase();
  return STATUS_LABEL_TO_CODE[normalized] !== undefined ? normalized : null;
}

function statusCodeToLabel(value) {
  if (typeof value === "string" && STATUS_LABEL_TO_CODE[value.trim().toUpperCase()] !== undefined) {
    return value.trim().toUpperCase();
  }

  const numeric = Number(value);
  return STATUS_CODE_TO_LABEL[numeric] || "NEW";
}

function extractFirstImage(images) {
  if (!images) {
    return null;
  }

  return (
    String(images)
      .split(",")
      .map((image) => image.trim().replace(/^['"]+|['"]+$/g, ""))
      .find(Boolean) || null
  );
}

function mapContactFormRow(row, extraFields = {}) {
  const compat = parseCompatNote(row.note);
  const status = statusCodeToLabel(row.status);

  return {
    contact_form_design_id: row.contact_form_design_id,
    name: row.full_name,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone_number,
    phone_number: row.phone_number,
    room_name: row.room_type,
    room_type: row.room_type,
    design_description: row.room_type_details,
    room_type_details: row.room_type_details,
    different_information: compat.different_information || null,
    style_design: row.design_style,
    design_style: row.design_style,
    require_design: compat.require_design || null,
    budget: compat.budget ?? null,
    design_fee: compat.design_fee ?? null,
    design_deposits: compat.design_deposits ?? null,
    remarks: compat.remarks || null,
    drive: compat.drive || null,
    status,
    status_code: Number(row.status ?? 0),
    user_id: row.user_id,
    note: compat.note || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    ...extraFields,
  };
}

function mapDetailRow(row) {
  const compat = parseCompatNote(row.note);
  const quantity = Number(row.quantity || 0);
  const unitPrice = Number(compat.unit_price || 0);
  const totalPrice = Number(compat.total_price || quantity * unitPrice);

  return {
    contact_form_design_detail_id: row.contact_form_design_detail_id,
    detail_id: row.contact_form_design_detail_id,
    id: row.contact_form_design_detail_id,
    contact_form_design_id: row.contact_form_design_id,
    variant_id: compat.variant_id ?? null,
    product_name: compat.product_name || row.product_type || "Unknown product",
    product_type: row.product_type || null,
    material: compat.material || row.material || null,
    color: compat.color_name || row.color || null,
    color_name: compat.color_name || row.color || null,
    color_hex: compat.color_hex || null,
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
    first_image: compat.first_image || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

async function getContactFormById(contactFormDesignId) {
  const { rows } = await db.query(
    `
    SELECT
      cfd.*,
      u.user_name AS staff_name
    FROM contact_form_design cfd
    LEFT JOIN "user" u ON u.user_id = cfd.user_id
    WHERE cfd.contact_form_design_id = $1
    `,
    [contactFormDesignId]
  );

  return rows[0] || null;
}

async function getVariantMeta(variantId) {
  const { rows } = await db.query(
    `
    SELECT
      vp.variant_id,
      vp.product_id,
      vp.variant_product_list_image,
      p.product_name,
      c.color_name,
      c.color_code AS color_hex
    FROM variant_product vp
    JOIN product p ON p.product_id = vp.product_id
    LEFT JOIN color c ON c.color_id = vp.color_id
    WHERE vp.variant_id = $1
    `,
    [variantId]
  );

  return rows[0] || null;
}

async function findDetailByVariant(contactFormDesignId, variantId) {
  const { rows } = await db.query(
    `
    SELECT *
    FROM contact_form_design_details
    WHERE contact_form_design_id = $1 AND deleted_at IS NULL
    ORDER BY contact_form_design_detail_id
    `,
    [contactFormDesignId]
  );

  for (const row of rows) {
    const compat = parseCompatNote(row.note);
    if (Number(compat.variant_id) === Number(variantId)) {
      return row;
    }
  }

  return null;
}

/** Public: a visitor requests a design consultation. Sends a confirmation mail without waiting for it. */
function submit(body) {
  return guard((error) => ({ success: false, error: error.message || "Gui yeu cau that bai" }), async () => {
    const {
      contact_form_design_id,
      name,
      email,
      phone,
      room_name,
      design_description,
      require_design,
      style_design,
      budget,
      different_information,
      design_fee,
    } = body;

    if (!name || !email || !design_description) {
      throw new HttpError(400, { error: "Name, email, and design description are required" });
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new HttpError(400, { error: "Invalid email format" });
    }

    const activeStatusCodes = [
      STATUS_LABEL_TO_CODE.NEW,
      STATUS_LABEL_TO_CODE.PENDING,
      STATUS_LABEL_TO_CODE.IN_PROGRESS,
      STATUS_LABEL_TO_CODE.DEPOSIT,
    ];

    // The same person may not have two open requests within a day
    const { rows: duplicateRows } = await db.query(
      `
      SELECT contact_form_design_id
      FROM contact_form_design
      WHERE status = ANY($1::int[])
        AND created_at > NOW() - INTERVAL '1 day'
        AND (email = $2 OR phone_number = $3 OR full_name = $4)
      `,
      [activeStatusCodes, email, phone || null, name]
    );

    if (duplicateRows.length > 0) {
      throw new HttpError(400, { error: "Dang co form dang xu ly voi thong tin trung lap" });
    }

    const compatNote = serializeCompatNote({
      require_design: require_design || null,
      budget: budget ?? null,
      design_fee: design_fee ?? null,
      different_information: different_information || null,
    });

    const insertColumns = [
      "user_id",
      "full_name",
      "phone_number",
      "email",
      "room_type",
      "room_type_details",
      "design_style",
      "note",
      "status",
      "created_at",
      "updated_at",
    ];

    const insertValues = [
      null,
      name,
      phone || null,
      email,
      room_name || null,
      design_description,
      style_design || null,
      compatNote,
      STATUS_LABEL_TO_CODE.NEW,
    ];

    if (
      contact_form_design_id !== undefined &&
      contact_form_design_id !== null &&
      contact_form_design_id !== ""
    ) {
      const customId = parseId(contact_form_design_id);
      if (!customId) {
        throw new HttpError(400, { error: "Invalid contact_form_design_id" });
      }

      insertColumns.unshift("contact_form_design_id");
      insertValues.unshift(customId);
    }

    const paramPlaceholders = insertValues.map((_, index) => `$${index + 1}`).join(", ");

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO contact_form_design (
        ${insertColumns.join(", ")}
      ) VALUES (
        ${paramPlaceholders},
        NOW(),
        NOW()
      )
      RETURNING contact_form_design_id
      `,
      insertValues
    );

    const created = await getContactFormById(insertedRows[0].contact_form_design_id);
    const mapped = mapContactFormRow(created);

    Promise.resolve(sendEmail(email, "Xac nhan Yeu cau Tu van Thiet ke", mapped)).catch(() => {});

    return {
      data: mapped,
      success: true,
      message: "Gui yeu cau thanh cong",
      contactId: insertedRows[0].contact_form_design_id,
    };
  });
}

/** Admin list; staff members only see the forms assigned to them. */
function list(query, requester) {
  return guard({ error: "Failed to fetch contact forms" }, async () => {
    const page = parsePositiveInt(query.page, 1);
    const limit = parsePositiveInt(query.limit, 10);
    const offset = (page - 1) * limit;

    const whereParts = [];
    const params = [];

    if (query.status) {
      const statusLabel = normalizeStatusLabel(query.status);
      if (!statusLabel) {
        throw new HttpError(400, { error: "Trang thai khong hop le" });
      }

      params.push(STATUS_LABEL_TO_CODE[statusLabel]);
      whereParts.push(`cfd.status = $${params.length}`);
    }

    if (isStaffRole(requester)) {
      params.push(requester.id);
      whereParts.push(`cfd.user_id = $${params.length}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM contact_form_design cfd ${whereClause}`,
      params
    );

    const totalForms = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalForms / limit);

    const listParams = [...params, limit, offset];
    const limitIndex = `$${params.length + 1}`;
    const offsetIndex = `$${params.length + 2}`;

    const { rows: forms } = await db.query(
      `
      SELECT
        cfd.*,
        u.user_name AS servicer_name
      FROM contact_form_design cfd
      LEFT JOIN "user" u ON u.user_id = cfd.user_id
      ${whereClause}
      ORDER BY cfd.created_at DESC
      LIMIT ${limitIndex} OFFSET ${offsetIndex}
      `,
      listParams
    );

    return {
      forms: forms.map((form) =>
        mapContactFormRow(form, { servicer_name: form.servicer_name || null })
      ),
      pagination: {
        currentPage: page,
        totalPages,
        totalForms,
        formsPerPage: limit,
      },
    };
  });
}

function getById(rawId) {
  return guard({ error: "Failed to fetch contact form" }, async () => {
    const id = parseId(rawId);
    if (!id) {
      throw new HttpError(400, { error: "Invalid contact form ID" });
    }

    const form = await getContactFormById(id);

    if (!form) {
      throw new HttpError(404, { error: "Contact form not found" });
    }

    return mapContactFormRow(form, {
      staff_name: form.staff_name || null,
    });
  });
}

function update(rawId, body) {
  return guard({ error: "Failed to update contact form" }, async () => {
    const id = parseId(rawId);
    if (!id) {
      throw new HttpError(400, { error: "Invalid contact form ID" });
    }

    const existing = await getContactFormById(id);
    if (!existing) {
      throw new HttpError(404, { error: "Contact form not found" });
    }

    const currentCompat = parseCompatNote(existing.note);
    const updates = [];
    const values = [];

    const fieldMappings = {
      name: "full_name",
      email: "email",
      phone: "phone_number",
      room_name: "room_type",
      design_description: "room_type_details",
      style_design: "design_style",
    };

    for (const [inputKey, columnName] of Object.entries(fieldMappings)) {
      if (body[inputKey] !== undefined) {
        values.push(body[inputKey] || null);
        updates.push(`${columnName} = $${values.length}`);
      }
    }

    if (body.user_id !== undefined) {
      if (body.user_id === null || body.user_id === "") {
        values.push(null);
      } else {
        const assignedUserId = parseId(body.user_id);
        if (!assignedUserId) {
          throw new HttpError(400, { error: "user_id khong hop le" });
        }
        values.push(assignedUserId);
      }
      updates.push(`user_id = $${values.length}`);
    }

    let nextStatusLabel = statusCodeToLabel(existing.status);
    if (body.status !== undefined && body.status !== null && body.status !== "") {
      const normalizedStatus = normalizeStatusLabel(body.status);
      if (!normalizedStatus) {
        throw new HttpError(400, { error: "Trang thai khong hop le" });
      }

      const allowedNextStatuses = VALID_STATUS_TRANSITIONS[nextStatusLabel] || [];

      if (
        normalizedStatus === "IN_PROGRESS" &&
        Number(body.user_id || existing.user_id || 0) === 0
      ) {
        throw new HttpError(400, {
          error: "Vui long chon nhan vien thuc hien truoc khi chuyen trang thai",
        });
      }

      if (normalizedStatus !== nextStatusLabel && !allowedNextStatuses.includes(normalizedStatus)) {
        throw new HttpError(400, { error: "Trang thai khong duoc phep chuyen doi" });
      }

      nextStatusLabel = normalizedStatus;
      values.push(STATUS_LABEL_TO_CODE[normalizedStatus]);
      updates.push(`status = $${values.length}`);
    }

    const compatFields = ["require_design", "different_information", "remarks", "drive", "note"];

    for (const field of compatFields) {
      if (body[field] !== undefined) {
        currentCompat[field] = body[field] || null;
      }
    }

    const numericCompatFields = ["budget", "design_fee", "design_deposits"];
    for (const field of numericCompatFields) {
      if (body[field] !== undefined) {
        const numericValue = toNullableNumber(body[field]);
        if (Number.isNaN(numericValue)) {
          throw new HttpError(400, { error: `${field} phai la so` });
        }
        currentCompat[field] = numericValue;
      }
    }

    if (
      body.require_design !== undefined ||
      body.different_information !== undefined ||
      body.remarks !== undefined ||
      body.drive !== undefined ||
      body.note !== undefined ||
      body.budget !== undefined ||
      body.design_fee !== undefined ||
      body.design_deposits !== undefined
    ) {
      values.push(serializeCompatNote(currentCompat));
      updates.push(`note = $${values.length}`);
    }

    updates.push("updated_at = NOW()");

    if (updates.length === 1) {
      throw new HttpError(400, { error: "Khong co du lieu cap nhat" });
    }

    values.push(id);

    await db.query(
      `UPDATE contact_form_design SET ${updates.join(", ")} WHERE contact_form_design_id = $${values.length}`,
      values
    );

    const updated = await getContactFormById(id);

    return {
      message: "Contact form updated successfully",
      form: mapContactFormRow(updated, {
        staff_name: updated?.staff_name || null,
      }),
    };
  });
}

function listDetails(rawId) {
  return guard({ error: "Failed to fetch design details" }, async () => {
    const contactFormDesignId = parseId(rawId);
    if (!contactFormDesignId) {
      throw new HttpError(400, { error: "Invalid contact form ID" });
    }

    const { rows: details } = await db.query(
      `
      SELECT *
      FROM contact_form_design_details
      WHERE contact_form_design_id = $1 AND deleted_at IS NULL
      ORDER BY contact_form_design_detail_id
      `,
      [contactFormDesignId]
    );

    return details.map(mapDetailRow);
  });
}

/** Adds a product variant to the design; adding the same variant again increases its quantity. */
function addDetail(rawId, body) {
  return guard({ error: "Failed to add product variant to design" }, async () => {
    const contactFormDesignId = parseId(rawId);
    if (!contactFormDesignId) {
      throw new HttpError(400, { error: "Invalid contact form ID" });
    }

    const variantId = Number(body.variant_id);
    const quantity = Number(body.quantity);
    const unitPrice = Number(body.unit_price);

    if (!variantId || !quantity || !unitPrice) {
      throw new HttpError(400, {
        error: "variant_id, quantity, and unit_price are required and must be number",
      });
    }

    const form = await getContactFormById(contactFormDesignId);
    if (!form) {
      throw new HttpError(404, { error: "Contact form not found" });
    }

    const variant = await getVariantMeta(variantId);
    if (!variant) {
      throw new HttpError(404, { error: "Variant not found" });
    }

    const existingDetail = await findDetailByVariant(contactFormDesignId, variantId);
    const detailMeta = {
      variant_id: variantId,
      product_id: variant.product_id,
      product_name: variant.product_name,
      color_name: variant.color_name || null,
      color_hex: variant.color_hex || null,
      first_image: extractFirstImage(variant.variant_product_list_image),
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
    };

    if (existingDetail) {
      const nextQuantity = Number(existingDetail.quantity || 0) + quantity;
      const nextTotalPrice = nextQuantity * unitPrice;

      await db.query(
        `
        UPDATE contact_form_design_details
        SET
          product_type = $1,
          material = $2,
          color = $3,
          quantity = $4,
          note = $5,
          updated_at = NOW()
        WHERE contact_form_design_detail_id = $6
        `,
        [
          variant.product_name,
          null,
          variant.color_name || null,
          nextQuantity,
          serializeCompatNote({
            ...detailMeta,
            quantity: nextQuantity,
            total_price: nextTotalPrice,
          }),
          existingDetail.contact_form_design_detail_id,
        ]
      );

      return {
        status: 200,
        body: {
          message: "Da cap nhat so luong san pham trong form thiet ke.",
          detailId: existingDetail.contact_form_design_detail_id,
          variant_id: variantId,
          quantity: nextQuantity,
          total_price: nextTotalPrice,
        },
      };
    }

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO contact_form_design_details (
        contact_form_design_id,
        product_type,
        material,
        color,
        quantity,
        note,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING contact_form_design_detail_id
      `,
      [
        contactFormDesignId,
        variant.product_name,
        null,
        variant.color_name || null,
        quantity,
        serializeCompatNote({
          ...detailMeta,
          quantity,
        }),
      ]
    );

    return {
      status: 201,
      body: {
        message: "Product variant added to design successfully",
        detailId: insertedRows[0].contact_form_design_detail_id,
        variant_id: variantId,
        quantity,
        total_price: quantity * unitPrice,
      },
    };
  });
}

function updateDetail(rawId, rawVariantId, body) {
  return guard({ error: "Failed to update design detail" }, async () => {
    const contactFormDesignId = parseId(rawId);
    const variantId = parseId(rawVariantId);

    if (!contactFormDesignId || !variantId) {
      throw new HttpError(400, { error: "Invalid ID" });
    }

    const existingDetail = await findDetailByVariant(contactFormDesignId, variantId);
    if (!existingDetail) {
      throw new HttpError(404, {
        error: "Detail item not found or does not belong to this design",
      });
    }

    const currentCompat = parseCompatNote(existingDetail.note);
    const quantity =
      body.quantity !== undefined ? Number(body.quantity) : Number(existingDetail.quantity);
    const unitPrice =
      body.unit_price !== undefined
        ? Number(body.unit_price)
        : Number(currentCompat.unit_price || 0);

    if (quantity <= 0 || unitPrice <= 0) {
      throw new HttpError(400, { error: "quantity and unit_price must be positive numbers" });
    }

    const nextCompat = {
      ...currentCompat,
      quantity,
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
    };

    await db.query(
      `
      UPDATE contact_form_design_details
      SET
        quantity = $1,
        note = $2,
        updated_at = NOW()
      WHERE contact_form_design_detail_id = $3
      `,
      [quantity, serializeCompatNote(nextCompat), existingDetail.contact_form_design_detail_id]
    );

    return {
      message: "Design detail updated successfully",
      detail: {
        contact_form_design_id: contactFormDesignId,
        variant_id: variantId,
        quantity,
        unit_price: unitPrice,
        total_price: quantity * unitPrice,
      },
    };
  });
}

function removeDetail(rawId, rawVariantId) {
  return guard({ error: "Khong the xoa san pham khoi form thiet ke" }, async () => {
    const contactFormDesignId = parseId(rawId);
    const variantId = parseId(rawVariantId);

    if (!contactFormDesignId || !variantId) {
      throw new HttpError(400, { error: "Invalid ID" });
    }

    const existingDetail = await findDetailByVariant(contactFormDesignId, variantId);
    if (!existingDetail) {
      throw new HttpError(404, { error: "San pham khong ton tai trong form thiet ke" });
    }

    await db.query(
      "DELETE FROM contact_form_design_details WHERE contact_form_design_detail_id = $1",
      [existingDetail.contact_form_design_detail_id]
    );

    return { message: "San pham da duoc xoa khoi form thiet ke" };
  });
}

function remove(rawId) {
  return guard({ error: "Khong the xoa form lien he" }, async () => {
    const id = parseId(rawId);
    if (!id) {
      throw new HttpError(400, { error: "ID contact form khong hop le" });
    }

    const form = await getContactFormById(id);
    if (!form) {
      throw new HttpError(404, { error: "Form lien he khong ton tai" });
    }

    await db.query("DELETE FROM contact_form_design_details WHERE contact_form_design_id = $1", [id]);
    await db.query("DELETE FROM contact_form_design WHERE contact_form_design_id = $1", [id]);

    return { message: "Form lien he da duoc xoa thanh cong" };
  });
}

module.exports = {
  submit,
  list,
  getById,
  update,
  listDetails,
  addDetail,
  updateDetail,
  removeDetail,
  remove,
};
