const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const { sendEmail } = require("../services/mailService");

const isStaffRole = (req) => req.user?.role?.toLowerCase?.() === "staff";

const CONTACT_FORM_STATUSES = [
  "NEW",
  "PENDING",
  "IN_PROGRESS",
  "DEPOSIT",
  "RESOLVED",
  "REJECTED",
];

const VALID_STATUS_TRANSITIONS = {
  PENDING: ["IN_PROGRESS"],
  IN_PROGRESS: ["DEPOSIT"],
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

/**
 * @route   POST /api/contact-forms
 * @desc    Gui form lien he
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

    const { rows: duplicateRows } = await db.query(
      `
      SELECT contact_form_design_id
      FROM contact_form_design
      WHERE status IN ($1, $2, $3)
        AND created_at > NOW() - INTERVAL '1 day'
        AND (email = $4 OR phone = $5 OR name = $6)
      `,
      ["NEW", "PENDING", "IN_PROGRESS", email, phone || null, name]
    );

    if (duplicateRows.length > 0) {
      return res
        .status(400)
        .json({ error: "Dang co form dang xu ly voi thong tin trung lap" });
    }

    const insertColumns = [
      "name",
      "email",
      "phone",
      "room_name",
      "design_description",
      "require_design",
      "style_design",
      "budget",
      "different_information",
      "design_fee",
      "created_at",
      "updated_at",
    ];

    const insertValues = [
      name,
      email,
      phone || null,
      room_name || null,
      design_description,
      require_design || null,
      style_design || null,
      budget || null,
      different_information || null,
      design_fee || null,
    ];

    if (contact_form_design_id !== undefined && contact_form_design_id !== null && contact_form_design_id !== "") {
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

    const data = {
      name,
      email,
      phone,
      room_name,
      design_description,
      require_design,
      style_design,
      budget,
      different_information,
    };

    sendEmail(data.email, "Xac nhan Yeu cau Tu van Thiet ke", data);

    return res.status(200).json({
      data,
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
 * @route   GET /api/contact-forms
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
      params.push(req.query.status);
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
        cfd.contact_form_design_id,
        cfd.name,
        cfd.email,
        cfd.phone,
        cfd.room_name,
        cfd.require_design,
        cfd.style_design,
        cfd.budget,
        cfd.design_fee,
        cfd.status,
        cfd.created_at,
        cfd.updated_at,
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
      forms,
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
 * @route   GET /api/contact-forms/:id
 * @desc    Lay chi tiet mot form lien he
 * @access  Private (Admin only)
 */
router.get("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    const { rows: forms } = await db.query(
      `
      SELECT
        contact_form_design.*,
        u.user_name AS staff_name
      FROM contact_form_design
      LEFT JOIN "user" u ON u.user_id = contact_form_design.user_id
      WHERE contact_form_design.contact_form_design_id = $1
      `,
      [id]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: "Contact form not found" });
    }

    return res.json(forms[0]);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch contact form" });
  }
});

/**
 * @route   PUT /api/contact-forms/:id
 * @desc    Cap nhat trang thai form lien he
 * @access  Private (Admin only)
 */
router.put("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "Invalid contact form ID" });
    }

    const { status, remarks, ...rest } = req.body;
    const editableFields = [
      "name",
      "email",
      "phone",
      "room_name",
      "design_description",
      "require_design",
      "style_design",
      "budget",
      "different_information",
      "design_fee",
      "design_deposits",
      "user_id",
      "remarks",
      "drive",
    ];

    const { rows: forms } = await db.query(
      "SELECT * FROM contact_form_design WHERE contact_form_design_id = $1",
      [id]
    );
    if (forms.length === 0) {
      return res.status(404).json({ error: "Contact form not found" });
    }

    if (status !== undefined && status !== null && status !== "") {
      if (!CONTACT_FORM_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Trang thai khong hop le" });
      }

      const currentStatus = forms[0].status;
      const allowedNextStatuses = VALID_STATUS_TRANSITIONS[currentStatus] || [];

      if (status === "IN_PROGRESS" && forms[0].user_id === null) {
        return res.status(400).json({
          error: "Vui long chon nhan vien thuc hien truoc khi chuyen trang thai",
        });
      }

      if (status !== currentStatus && !allowedNextStatuses.includes(status)) {
        return res
          .status(400)
          .json({ error: "Trang thai khong duoc phep chuyen doi" });
      }
    }

    const budgetValue = toNullableNumber(rest.budget);
    if (Number.isNaN(budgetValue)) {
      return res.status(400).json({ error: "Budget phai la so" });
    }

    const designFeeValue = toNullableNumber(rest.design_fee);
    if (Number.isNaN(designFeeValue)) {
      return res.status(400).json({ error: "Design_fee phai la so" });
    }

    if (rest.budget !== undefined) {
      rest.budget = budgetValue;
    }
    if (rest.design_fee !== undefined) {
      rest.design_fee = designFeeValue;
    }

    const updates = [];
    const values = [];

    for (const key of editableFields) {
      if (rest[key] !== undefined) {
        values.push(rest[key]);
        updates.push(`${key} = $${values.length}`);
      }
    }

    if (status !== undefined && status !== null && status !== "") {
      values.push(status);
      updates.push(`status = $${values.length}`);
    }

    if (remarks !== undefined) {
      values.push(remarks);
      updates.push(`remarks = $${values.length}`);
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

    const { rows: updatedRows } = await db.query(
      "SELECT * FROM contact_form_design WHERE contact_form_design_id = $1",
      [id]
    );

    return res.json({
      message: "Contact form updated successfully",
      form: updatedRows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update contact form" });
  }
});

/**
 * @route   GET /api/contact-form-design/:id/details/debug
 * @desc    Debug - Get design details without auth
 */
router.get("/:id/details/debug", async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const { rows: details } = await db.query(
      `
      SELECT
        cfdd.*,
        v.variant_name,
        v.variant_price,
        v.variant_description,
        v.variant_product_list_image,
        v.variant_discount,
        p.product_name,
        p.product_description,
        p.product_code,
        vd.variant_default_id,
        vd.variant_default_name
      FROM contact_form_design_details cfdd
      LEFT JOIN variants v ON cfdd.variant_id = v.variant_id
      LEFT JOIN products p ON v.product_id = p.product_id
      LEFT JOIN variant_defaults vd ON v.variant_default_id = vd.variant_default_id
      WHERE cfdd.contact_form_design_id = $1
      `,
      [id]
    );

    return res.json({
      success: true,
      data: details,
      debug: {
        count: details.length,
        firstItemKeys: details.length > 0 ? Object.keys(details[0]) : [],
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Loi server" });
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
      SELECT
        d.*,
        v.variant_product_price,
        v.variant_product_list_image,
        v.color_id,
        c.color_code AS color_hex,
        c.color_name,
        p.product_name AS product_name
      FROM contact_form_design_details d
      JOIN variant_product v ON d.variant_id = v.variant_id
      JOIN color c ON v.color_id = c.color_id
      JOIN product p ON v.product_id = p.product_id
      WHERE d.contact_form_design_id = $1
      `,
      [contactFormDesignId]
    );

    const result = details.map((item) => {
      let firstImage = null;
      if (item.variant_product_list_image) {
        firstImage = item.variant_product_list_image
          .split(",")
          .map((img) => img.trim().replace(/^['\"]+|['\"]+$/g, ""))
          .find((img) => img);
      }

      const { variant_product_list_image, ...rest } = item;
      return {
        ...rest,
        first_image: firstImage || null,
      };
    });

    return res.json(result);
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

    let { variant_id, quantity, unit_price } = req.body;

    variant_id = Number(variant_id);
    quantity = Number(quantity);
    unit_price = Number(unit_price);

    if (!variant_id || !quantity || !unit_price) {
      return res.status(400).json({
        error: "variant_id, quantity, and unit_price are required and must be number",
      });
    }

    const { rows: forms } = await db.query(
      "SELECT * FROM contact_form_design WHERE contact_form_design_id = $1",
      [contactFormDesignId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: "Contact form not found" });
    }

    const { rows: variants } = await db.query(
      "SELECT * FROM variant_product WHERE variant_id = $1",
      [variant_id]
    );
    if (variants.length === 0) {
      return res.status(404).json({ error: "Variant not found" });
    }

    const { rows: existingVariantRows } = await db.query(
      `
      SELECT *
      FROM contact_form_design_details
      WHERE contact_form_design_id = $1 AND variant_id = $2
      `,
      [contactFormDesignId, variant_id]
    );

    if (existingVariantRows.length > 0) {
      const oldQuantity = Number(existingVariantRows[0].quantity);
      const newQuantity = oldQuantity + quantity;
      const newTotalPrice = newQuantity * unit_price;

      await db.query(
        `
        UPDATE contact_form_design_details
        SET quantity = $1, unit_price = $2, total_price = $3, updated_at = NOW()
        WHERE contact_form_design_id = $4 AND variant_id = $5
        `,
        [newQuantity, unit_price, newTotalPrice, contactFormDesignId, variant_id]
      );

      return res.status(200).json({
        message: "Da cap nhat so luong san pham trong form thiet ke.",
        variant_id,
        quantity: newQuantity,
        total_price: newTotalPrice,
      });
    }

    const totalPrice = quantity * unit_price;

    const { rows: insertedRows } = await db.query(
      `
      INSERT INTO contact_form_design_details (
        contact_form_design_id,
        variant_id,
        quantity,
        unit_price,
        total_price,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING contact_form_design_detail_id
      `,
      [contactFormDesignId, variant_id, quantity, unit_price, totalPrice]
    );

    return res.status(201).json({
      message: "Product variant added to design successfully",
      detailId: insertedRows[0].contact_form_design_detail_id,
      variant_id,
      quantity,
      total_price: totalPrice,
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

    let { quantity, unit_price } = req.body;

    const { rows: details } = await db.query(
      `
      SELECT *
      FROM contact_form_design_details
      WHERE contact_form_design_id = $1 AND variant_id = $2
      `,
      [contactFormDesignId, variantId]
    );

    if (details.length === 0) {
      return res.status(404).json({
        error: "Detail item not found or does not belong to this design",
      });
    }

    const currentDetail = details[0];

    quantity =
      quantity !== undefined ? Number(quantity) : Number(currentDetail.quantity);
    unit_price =
      unit_price !== undefined ? Number(unit_price) : Number(currentDetail.unit_price);

    if (quantity <= 0 || unit_price <= 0) {
      return res
        .status(400)
        .json({ error: "quantity and unit_price must be positive numbers" });
    }

    const totalPrice = quantity * unit_price;

    const { rowCount } = await db.query(
      `
      UPDATE contact_form_design_details
      SET quantity = $1, unit_price = $2, total_price = $3, updated_at = NOW()
      WHERE contact_form_design_id = $4 AND variant_id = $5
      `,
      [quantity, unit_price, totalPrice, contactFormDesignId, variantId]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: "Detail item not found" });
    }

    return res.json({
      message: "Design detail updated successfully",
      detail: {
        contact_form_design_id: contactFormDesignId,
        variant_id: variantId,
        quantity,
        unit_price,
        total_price: totalPrice,
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

    const { rowCount } = await db.query(
      `
      DELETE FROM contact_form_design_details
      WHERE contact_form_design_id = $1 AND variant_id = $2
      `,
      [contactFormDesignId, variantId]
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: "San pham khong ton tai trong form thiet ke",
      });
    }

    return res.json({ message: "San pham da duoc xoa khoi form thiet ke" });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Khong the xoa san pham khoi form thiet ke" });
  }
});

/**
 * @route   DELETE /api/contact-forms/:id
 * @desc    Xoa form lien he
 * @access  Private (Admin only)
 */
router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "ID contact form khong hop le" });
    }

    const { rows: forms } = await db.query(
      "SELECT * FROM contact_form_design WHERE contact_form_design_id = $1",
      [id]
    );

    if (forms.length === 0) {
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
