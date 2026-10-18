"use strict";

const db = require("../../config/database");
const HttpError = require("../../shared/http/http-error");
const guard = require("../../shared/http/guard");

// The signed-in user's own notification inbox. Served under /api/couponcodes for historical reasons.

function listForUser(userId) {
  return guard({ error: "Failed to fetch notifications" }, async () => {
    const { rows } = await db.query(
      `
      SELECT
        un.id AS user_notification_id,
        un.notification_id,
        n.title,
        n.link,
        n.message,
        n.created_at,
        un.is_read,
        un.read_at
      FROM user_notifications un
      JOIN notifications n ON un.notification_id = n.id
      WHERE un.user_id = $1 AND un.is_deleted = 0
      ORDER BY n.created_at DESC
    `,
      [userId]
    );

    return rows;
  });
}

function markRead(rawNotificationId, userId) {
  const notificationId = Number(rawNotificationId);

  if (isNaN(notificationId)) {
    throw new HttpError(400, { message: "Invalid notification ID" });
  }

  return guard({ message: "Failed to mark notification as read" }, async () => {
    const { rows } = await db.query(
      "SELECT id FROM user_notifications WHERE user_id = $1 AND notification_id = $2",
      [userId, notificationId]
    );

    if (rows.length === 0) {
      throw new HttpError(404, { message: "Notification not found" });
    }

    await db.query(
      "UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE user_id = $1 AND notification_id = $2",
      [userId, notificationId]
    );

    return { message: "Notification marked as read" };
  });
}

function markAllRead(userId) {
  return guard({ success: false, message: "Server error" }, async () => {
    const { rowCount } = await db.query(
      "UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE user_id = $1 AND is_read = 0",
      [userId]
    );

    return {
      success: true,
      message: "All notifications marked as read",
      updatedRows: rowCount,
    };
  });
}

/** Hides a notification from the user's inbox without deleting it for anyone else. */
function hide(rawNotificationId, userId) {
  return guard({ error: "Failed to delete notification" }, async () => {
    const notificationId = Number(rawNotificationId);

    if (isNaN(notificationId)) {
      throw new HttpError(400, { error: "Invalid notification ID" });
    }

    const { rowCount } = await db.query(
      `
      UPDATE user_notifications
      SET is_deleted = 1
      WHERE notification_id = $1 AND user_id = $2
    `,
      [notificationId, userId]
    );

    if (rowCount === 0) {
      throw new HttpError(404, { error: "Notification not found" });
    }

    return { message: "Notification deleted successfully" };
  });
}

module.exports = { listForUser, markRead, markAllRead, hide };
