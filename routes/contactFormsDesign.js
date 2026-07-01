const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { sendEmail } = require("../services/mailService");

const isStaffRole = (req) => req.user?.role?.toLowerCase?.() === "staff";

const STATUS_CODE_TO_LABEL = {
  0: "NEW",
  1: "PENDING",
  2: "IN_PROGRESS",
  3: "DEPOSIT",
  4: "RESOLVED",
  5: "REJECTED",
};

const STATUS_LABEL_TO_CODE = Object.entries(STATUS_CODE_TO_LABEL).reduce(
  (acc, [code, label]) => {
    acc[label] = Number(code);
    return acc;
  },
  {}
);

const VALID_STATUS_TRANSITIONS = {
  NEW: ["PENDING", "IN_PROGRESS", "REJECTED"],
  PENDING: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["DEPOSIT", "REJECTED"],
  DEPOSIT: ["RESOLVED", "REJECTED"],
};

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

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

  return String(images)
    .split(",")
    .map((image) => image.trim().replace(/^['"]+|['"]+$/g, ""))
    .find(Boolean) || null;
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

/**
 * @route   POST /api/contact-form-design
 * @desc    Gui form lien he thiet ke
 * @access  Public
 */
router.post("/", async (req, res) => {
  try {
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
    } = req.body;

    if (!name || !email || !design_description) {
      return res
        .status(400)
        .json({ error: "Name, email, and design description are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const activeStatusCodes = [
      STATUS_LABEL_TO_CODE.NEW,
      STATUS_LABEL_TO_CODE.PENDING,
      STATUS_LABEL_TO_CODE.IN_PROGRESS,
      STATUS_LABEL_TO_CODE.DEPOSIT,
    ];

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
      return res
        .status(400)
        .json({ error: "Dang co form dang xu ly voi thong tin trung lap" });
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
        return res.status(400).json({ error: "Invalid contact_form_design_id" });
      }

      insertColumns.unshift("contact_form_design_id");
      insertValues.unshift(customId);
    }

    const paramPlaceholders = insertValues
      .map((_, index) => `$${index + 1}`)
      .join(", ");

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

    Promise.resolve(
      sendEmail(email, "Xac nhan Yeu cau Tu van Thiet ke", mapped)
    ).catch(() => {});

    return res.status(200).json({
      data: mapped,
      success: true,
      message: "Gui yeu cau thanh cong",
      contactId: insertedRows[0].contact_form_design_id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Gui yeu cau that bai",
    });
  }
});

/**
 * @route   GET /api/contact-form-design
 * @desc    Lay danh sach cac form lien he
 * @access  Private (Admin only)
 */
router.get("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10);
    const offset = (page - 1) * limit;

    const whereParts = [];
    const params = [];

    if (req.query.status) {
      const statusLabel = normalizeStatusLabel(req.query.status);
      if (!statusLabel) {
        return res.status(400).json({ error: "Trang thai khong hop le" });
      }

      params.push(STATUS_LABEL_TO_CODE[statusLabel]);
      whereParts.push(`cfd.status = $${params.length}`);
    }

    if (isStaffRole(req)) {
      params.push(req.user.id);
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

    return res.json({
      forms: forms.map((form) =>
        mapContactFormRow(form, { servicer_name: form.servicer_name || null })
      ),
      pagination: {
        currentPage: page,
        totalPages,
        totalForms,
        formsPerPage: limit,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch contact forms" });
  }
});

/**
 * @route   GET /api/contact-form-design/:id
 * @desc    Lay chi tiet mot form lien he
 * @access  Private (Admin only)
 */
router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    const form = await getContactFormById(id);

    if (!form) {
      return res.status(404).json({ error: "Contact form not found" });
    }

    return res.json(
      mapContactFormRow(form, {
        staff_name: form.staff_name || null,
      })
    );
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch contact form" });
  }
});

/**
 * @route   PUT /api/contact-form-design/:id
 * @desc    Cap nhat form lien he
 * @access  Private (Admin only)
 */
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    const existing = await getContactFormById(id);
    if (!existing) {
      return res.status(404).json({ error: "Contact form not found" });
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
      if (req.body[inputKey] !== undefined) {
        values.push(req.body[inputKey] || null);
        updates.push(`${columnName} = $${values.length}`);
      }
    }

    if (req.body.user_id !== undefined) {
      if (req.body.user_id === null || req.body.user_id === "") {
        values.push(null);
      } else {
        const assignedUserId = parseId(req.body.user_id);
        if (!assignedUserId) {
          return res.status(400).json({ error: "user_id khong hop le" });
        }
        values.push(assignedUserId);
      }
      updates.push(`user_id = $${values.length}`);
    }

    let nextStatusLabel = statusCodeToLabel(existing.status);
    if (req.body.status !== undefined && req.body.status !== null && req.body.status !== "") {
      const normalizedStatus = normalizeStatusLabel(req.body.status);
      if (!normalizedStatus) {
        return res.status(400).json({ error: "Trang thai khong hop le" });
      }

      const allowedNextStatuses =
        VALID_STATUS_TRANSITIONS[nextStatusLabel] || [];

      if (
        normalizedStatus === "IN_PROGRESS" &&
        Number(req.body.user_id || existing.user_id || 0) === 0
      ) {
        return res.status(400).json({
          error: "Vui long chon nhan vien thuc hien truoc khi chuyen trang thai",
        });
      }

      if (
        normalizedStatus !== nextStatusLabel &&
        !allowedNextStatuses.includes(normalizedStatus)
      ) {
        return res
          .status(400)
          .json({ error: "Trang thai khong duoc phep chuyen doi" });
      }

      nextStatusLabel = normalizedStatus;
      values.push(STATUS_LABEL_TO_CODE[normalizedStatus]);
      updates.push(`status = $${values.length}`);
    }

    const compatFields = [
      "require_design",
      "different_information",
      "remarks",
      "drive",
      "note",
    ];

    for (const field of compatFields) {
      if (req.body[field] !== undefined) {
        currentCompat[field] = req.body[field] || null;
      }
    }

    const numericCompatFields = ["budget", "design_fee", "design_deposits"];
    for (const field of numericCompatFields) {
      if (req.body[field] !== undefined) {
        const numericValue = toNullableNumber(req.body[field]);
        if (Number.isNaN(numericValue)) {
          return res.status(400).json({ error: `${field} phai la so` });
        }
        currentCompat[field] = numericValue;
      }
    }

    if (
      req.body.require_design !== undefined ||
      req.body.different_information !== undefined ||
      req.body.remarks !== undefined ||
      req.body.drive !== undefined ||
      req.body.note !== undefined ||
      req.body.budget !== undefined ||
      req.body.design_fee !== undefined ||
      req.body.design_deposits !== undefined
    ) {
      values.push(serializeCompatNote(currentCompat));
      updates.push(`note = $${values.length}`);
    }

    updates.push("updated_at = NOW()");

    if (updates.length === 1) {
      return res.status(400).json({ error: "Khong co du lieu cap nhat" });
    }

    values.push(id);

    await db.query(
      `UPDATE contact_form_design SET ${updates.join(", ")} WHERE contact_form_design_id = $${values.length}`,
      values
    );

    const updated = await getContactFormById(id);

    return res.json({
      message: "Contact form updated successfully",
      form: mapContactFormRow(updated, {
        staff_name: updated?.staff_name || null,
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update contact form" });
  }
});

/**
 * @route   GET /api/contact-form-design/:id/details
 * @desc    Lay danh sach san pham trong chi tiet thiet ke
 * @access  Private (Admin only)
 */
router.get("/:id/details", verifyToken, isAdmin, async (req, res) => {
  try {
    const contactFormDesignId = parseId(req.params.id);
    if (!contactFormDesignId) {
      return res.status(400).json({ error: "Invalid contact form ID" });
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

    return res.json(details.map(mapDetailRow));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch design details" });
  }
});

/**
 * @route   POST /api/contact-form-design/:id/details
 * @desc    Them san pham vao chi tiet thiet ke
 * @access  Private (Admin only)
 */
router.post("/:id/details", verifyToken, isAdmin, async (req, res) => {
  try {
    const contactFormDesignId = parseId(req.params.id);
    if (!contactFormDesignId) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    const variantId = Number(req.body.variant_id);
    const quantity = Number(req.body.quantity);
    const unitPrice = Number(req.body.unit_price);

    if (!variantId || !quantity || !unitPrice) {
      return res.status(400).json({
        error: "variant_id, quantity, and unit_price are required and must be number",
      });
    }

    const form = await getContactFormById(contactFormDesignId);
    if (!form) {
      return res.status(404).json({ error: "Contact form not found" });
    }

    const variant = await getVariantMeta(variantId);
    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
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

      return res.status(200).json({
        message: "Da cap nhat so luong san pham trong form thiet ke.",
        detailId: existingDetail.contact_form_design_detail_id,
        variant_id: variantId,
        quantity: nextQuantity,
        total_price: nextTotalPrice,
      });
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

    return res.status(201).json({
      message: "Product variant added to design successfully",
      detailId: insertedRows[0].contact_form_design_detail_id,
      variant_id: variantId,
      quantity,
      total_price: quantity * unitPrice,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to add product variant to design" });
  }
});

/**
 * @route   PUT /api/contact-form-design/:id/details/:variant_id
 * @desc    Cap nhat san pham trong chi tiet thiet ke
 * @access  Private (Admin only)
 */
router.put("/:id/details/:variant_id", verifyToken, isAdmin, async (req, res) => {
  try {
    const contactFormDesignId = parseId(req.params.id);
    const variantId = parseId(req.params.variant_id);

    if (!contactFormDesignId || !variantId) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const existingDetail = await findDetailByVariant(contactFormDesignId, variantId);
    if (!existingDetail) {
      return res.status(404).json({
        error: "Detail item not found or does not belong to this design",
      });
    }

    const currentCompat = parseCompatNote(existingDetail.note);
    const quantity =
      req.body.quantity !== undefined
        ? Number(req.body.quantity)
        : Number(existingDetail.quantity);
    const unitPrice =
      req.body.unit_price !== undefined
        ? Number(req.body.unit_price)
        : Number(currentCompat.unit_price || 0);

    if (quantity <= 0 || unitPrice <= 0) {
      return res
        .status(400)
        .json({ error: "quantity and unit_price must be positive numbers" });
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

    return res.json({
      message: "Design detail updated successfully",
      detail: {
        contact_form_design_id: contactFormDesignId,
        variant_id: variantId,
        quantity,
        unit_price: unitPrice,
        total_price: quantity * unitPrice,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update design detail" });
  }
});

/**
 * @route   DELETE /api/contact-form-design/:id/details/:variant_id
 * @desc    Xoa san pham khoi chi tiet thiet ke
 * @access  Private (Admin only)
 */
router.delete("/:id/details/:variant_id", verifyToken, isAdmin, async (req, res) => {
  try {
    const contactFormDesignId = parseId(req.params.id);
    const variantId = parseId(req.params.variant_id);

    if (!contactFormDesignId || !variantId) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const existingDetail = await findDetailByVariant(contactFormDesignId, variantId);
    if (!existingDetail) {
      return res.status(404).json({
        error: "San pham khong ton tai trong form thiet ke",
      });
    }

    await db.query(
      "DELETE FROM contact_form_design_details WHERE contact_form_design_detail_id = $1",
      [existingDetail.contact_form_design_detail_id]
    );

    return res.json({ message: "San pham da duoc xoa khoi form thiet ke" });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Khong the xoa san pham khoi form thiet ke" });
  }
});

/**
 * @route   DELETE /api/contact-form-design/:id
 * @desc    Xoa form lien he
 * @access  Private (Admin only)
 */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID contact form khong hop le" });
    }

    const form = await getContactFormById(id);
    if (!form) {
      return res.status(404).json({ error: "Form lien he khong ton tai" });
    }

    await db.query(
      "DELETE FROM contact_form_design_details WHERE contact_form_design_id = $1",
      [id]
    );

    await db.query("DELETE FROM contact_form_design WHERE contact_form_design_id = $1", [
      id,
    ]);

    return res.json({ message: "Form lien he da duoc xoa thanh cong" });
  } catch (error) {
    return res.status(500).json({ error: "Khong the xoa form lien he" });
  }
});

module.exports = router;
