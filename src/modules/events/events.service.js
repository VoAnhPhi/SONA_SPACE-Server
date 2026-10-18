"use strict";

const cloudinary = require("cloudinary").v2;
const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");
const { extractPublicIdFromUrl } = require("../../shared/utils/cloudinary-public-id");

const SERVER_ERROR = { message: "Internal server error." };

// Unlike the shared positive-id parser, 0 is rejected by the callers but negative ids reach the query.
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

function requireId(rawId, body) {
  const id = parseId(rawId);
  if (!id) throw new HttpError(400, body);
  return id;
}

/** Create and update share the same required fields and status vocabulary. */
function validateEventPayload(payload) {
  const { title, start_date, end_date, status } = payload;

  if (!title || !start_date || !end_date || !status) {
    throw new HttpError(400, {
      success: false,
      message: "Missing required fields: title, start_date, end_date, status.",
    });
  }

  const mappedStatus = normalizeStatusToEventStatus(status);
  if (mappedStatus === null) {
    throw new HttpError(400, {
      success: false,
      message: "Invalid status value. Must be one of: active, scheduled, expired.",
    });
  }

  return mappedStatus;
}

/** Events that are running right now. */
function listActive() {
  return guard(SERVER_ERROR, async () => {
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

    return rows.map(mapEventRow);
  });
}

function listAll() {
  return guard(SERVER_ERROR, async () => {
    const { rows } = await db.query("SELECT * FROM events ORDER BY created_at DESC");
    return rows.map(mapEventRow);
  });
}

function getById(rawId) {
  return guard(SERVER_ERROR, async () => {
    const id = requireId(rawId, { message: "Invalid event ID." });

    const { rows } = await db.query("SELECT * FROM events WHERE event_id = $1", [id]);

    if (!rows.length) {
      throw new HttpError(404, { message: "Event not found." });
    }

    return mapEventRow(rows[0]);
  });
}

function create(body) {
  const { title, description, image_url, link_url, start_date, end_date, display_order } = body;

  return guard({ success: false, message: "Loi may chu khi tao su kien." }, async () => {
    const mappedStatus = validateEventPayload(body);

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
      [title, description || null, image_url || null, start_date, end_date, mappedStatus]
    );

    return {
      success: true,
      message: "Tao su kien thanh cong.",
      event_id: rows[0].event_id,
      link_url: link_url || null,
      display_order: display_order || 0,
    };
  });
}

function update(rawId, body) {
  const { title, description, image_url, link_url, start_date, end_date, display_order } = body;

  return guard({ success: false, message: "Loi may chu khi cap nhat su kien." }, async () => {
    const id = requireId(rawId, { success: false, message: "Invalid event ID." });
    const mappedStatus = validateEventPayload(body);

    const { rows: existingRows } = await db.query(
      "SELECT event_id FROM events WHERE event_id = $1",
      [id]
    );

    if (!existingRows.length) {
      throw new HttpError(404, { success: false, message: "Event not found." });
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
      [title, description || null, image_url || null, start_date, end_date, mappedStatus, id]
    );

    if (rowCount === 0) {
      throw new HttpError(404, { success: false, message: "Event not found." });
    }

    return {
      success: true,
      message: "Cap nhat su kien thanh cong!",
      link_url: link_url || null,
      display_order: display_order || 0,
    };
  });
}

/** scheduled -> active -> expired -> scheduled. */
function toggleStatus(rawId) {
  return guard({ message: "Failed to toggle event status" }, async () => {
    const id = requireId(rawId, { message: "Invalid event ID." });

    const { rows } = await db.query(
      "SELECT event_status, event_start, event_end FROM events WHERE event_id = $1",
      [id]
    );

    if (!rows.length) {
      throw new HttpError(404, { message: "Event not found." });
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

    return { message: "Event status updated", status: nextStatus };
  });
}

/** Deletes the event; its Cloudinary image is removed afterwards and a failure there is ignored. */
function remove(rawId) {
  return guard(SERVER_ERROR, async () => {
    const id = requireId(rawId, { message: "Invalid event ID." });

    const { rows: eventRows } = await db.query(
      "SELECT event_image FROM events WHERE event_id = $1",
      [id]
    );

    if (!eventRows.length) {
      throw new HttpError(404, { message: "Event not found." });
    }

    const { rowCount } = await db.query("DELETE FROM events WHERE event_id = $1", [id]);

    if (rowCount === 0) {
      throw new HttpError(404, { message: "Event not found." });
    }

    const imageUrl = eventRows[0].event_image;
    if (imageUrl) {
      try {
        const publicId = extractPublicIdFromUrl(imageUrl);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        }
      } catch (error) {
        // The event is already gone; an orphaned image is not worth failing the request
      }
    }

    return { message: "Event deleted successfully!" };
  });
}

module.exports = { listActive, listAll, getById, create, update, toggleStatus, remove };
