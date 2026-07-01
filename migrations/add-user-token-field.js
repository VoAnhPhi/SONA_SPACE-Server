/**
 * Migration script to ensure `user_token` and `updated_at` exist in table `"user"`.
 * Run: node migrations/add-user-token-field.js
 */

const db = require("../config/database");

async function columnExists(columnName) {
  const { rows } = await db.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user'
      AND column_name = $1
    LIMIT 1
    `,
    [columnName]
  );

  return rows.length > 0;
}

async function addUserTokenField() {
  try {
    console.log("Starting migration: ensure user_token and updated_at columns on \"user\"");

    const hasUserToken = await columnExists("user_token");
    if (!hasUserToken) {
      await db.query('ALTER TABLE "user" ADD COLUMN user_token VARCHAR(255)');
      console.log("Added column: user_token");
    } else {
      console.log("Column already exists: user_token");
    }

    const hasUpdatedAt = await columnExists("updated_at");
    if (!hasUpdatedAt) {
      await db.query(
        'ALTER TABLE "user" ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
      );
      console.log("Added column: updated_at");
    } else {
      console.log("Column already exists: updated_at");
    }

    console.log("Migration completed");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

addUserTokenField();
