const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;

function parseId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeStatusToEventStatus(status) {
  const statusText = String(status || "").toLowerCase();
  if (!["active", "scheduled", "expired"].includes(statusText)) {
    return null;
  }

  if (statusText === "expired") {
    return 0;
  }

  return 1;
}

function deriveStatusLabel(eventStatus, eventStart, eventEnd) {
  if (Number(eventStatus) !== 1) {
    return "expired";
  }

  const now = new Date();
  const startDate = eventStart ? new Date(eventStart) : null;
  const endDate = eventEnd ? new Date(eventEnd) : null;

  if (startDate && startDate > now) {
    return "scheduled";
  }

  if (endDate && endDate < now) {
    return "expired";
  }

  return "active";
}

function mapEventRow(row) {
  return {
    id: row.event_id,
    title: row.event_title,
    description: row.event_description,
    image_url: row.event_image,
    link_url: null,
    start_date: row.event_start,
    end_date: row.event_end,
    display_order: 0,
    status: deriveStatusLabel(row.event_status, row.event_start, row.event_end),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

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

router.get("/active", async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT *
      FROM events
      WHERE event_status = 1
        AND event_start <= NOW()
        AND event_end >= NOW()
      ORDER BY event_start ASC
      `
    );

    if (rows.length === 0) {
      return res.json([]);
    }

    return res.json(rows.map(mapEventRow));
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/admin", verifyToken, isAdmin, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM events ORDER BY created_at DESC");
    return res.json(rows.map(mapEventRow));
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.get("/admin/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const { rows } = await db.query("SELECT * FROM events WHERE event_id = $1", [id]);

    if (!rows.length) {
      return res.status(404).json({ message: "Event not found." });
    }

    return res.json(mapEventRow(rows[0]));
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
});

router.post("/admin", verifyToken, isAdmin, async (req, res) => {
  const {
    title,
    description,
    image_url,
    link_url,
    start_date,
    end_date,
    display_order,
    status,
  } = req.body;

  try {
    if (!title || !start_date || !end_date || !status) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, start_date, end_date, status.",
      });
    }

    const mappedStatus = normalizeStatusToEventStatus(status);
    if (mappedStatus === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value. Must be one of: active, scheduled, expired.",
      });
    }

    const { rows } = await db.query(
      `
      INSERT INTO events (
        event_title,
        event_description,
        event_image,
        event_start,
        event_end,
        event_status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING event_id
      `,
      [
        title,
        description || null,
        image_url || null,
        start_date,
        end_date,
        mappedStatus,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Tao su kien thanh cong.",
      event_id: rows[0].event_id,
      link_url: link_url || null,
      display_order: display_order || 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Loi may chu khi tao su kien.",
    });
  }
});

router.put("/admin/:id", verifyToken, isAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  const {
    title,
    description,
    image_url,
    link_url,
    start_date,
    end_date,
    display_order,
    status,
  } = req.body;

  try {
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    if (!title || !start_date || !end_date || !status) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, start_date, end_date, status.",
      });
    }

    const mappedStatus = normalizeStatusToEventStatus(status);
    if (mappedStatus === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value. Must be one of: active, scheduled, expired.",
      });
    }

    const { rows: existingRows } = await db.query(
      "SELECT event_id FROM events WHERE event_id = $1",
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const { rowCount } = await db.query(
      `
      UPDATE events
      SET
        event_title = $1,
        event_description = $2,
        event_image = $3,
        event_start = $4,
        event_end = $5,
        event_status = $6,
        updated_at = NOW()
      WHERE event_id = $7
      `,
      [
        title,
        description || null,
        image_url || null,
        start_date,
        end_date,
        mappedStatus,
        id,
      ]
    );

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    return res.json({
      success: true,
      message: "Cap nhat su kien thanh cong!",
      link_url: link_url || null,
      display_order: display_order || 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Loi may chu khi cap nhat su kien.",
    });
  }
});

router.put("/admin/:id/toggle-status", verifyToken, isAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  try {
    if (!id) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const { rows } = await db.query(
      "SELECT event_status, event_start, event_end FROM events WHERE event_id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Event not found." });
    }

    const currentStatus = deriveStatusLabel(
      rows[0].event_status,
      rows[0].event_start,
      rows[0].event_end
    );

    let nextStatus;
    if (currentStatus === "scheduled") {
      nextStatus = "active";
    } else if (currentStatus === "active") {
      nextStatus = "expired";
    } else {
      nextStatus = "scheduled";
    }

    const mappedStatus = normalizeStatusToEventStatus(nextStatus);
    await db.query(
      "UPDATE events SET event_status = $1, updated_at = NOW() WHERE event_id = $2",
      [mappedStatus, id]
    );

    return res.json({ message: "Event status updated", status: nextStatus });
  } catch (error) {
    return res.status(500).json({ message: "Failed to toggle event status" });
  }
});

router.delete("/:id", verifyToken, isAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  try {
    if (!id) {
      return res.status(400).json({ message: "Invalid event ID." });
    }

    const { rows: eventRows } = await db.query(
      "SELECT event_image FROM events WHERE event_id = $1",
      [id]
    );

    if (!eventRows.length) {
      return res.status(404).json({ message: "Event not found." });
    }

    const { rowCount } = await db.query("DELETE FROM events WHERE event_id = $1", [id]);

    if (rowCount === 0) {
      return res.status(404).json({ message: "Event not found." });
    }

    const imageUrl = eventRows[0].event_image;
    if (imageUrl) {
      try {
        const publicId = extractPublicIdFromUrl(imageUrl);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        }
      } catch (error) {
        return res.json({ message: "Event deleted successfully!" });
      }
    }

    return res.json({ message: "Event deleted successfully!" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error." });
  }
});

module.exports = router;
