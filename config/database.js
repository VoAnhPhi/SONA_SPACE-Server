// db/postgres.pool.js
require("dotenv").config();

const { Pool } = require("pg");

/**
 * If you're connecting to Docker-exposed Postgres on the same machine:
 *  host=localhost, port=5432
 */
const PG_CONFIG = {
	host: process.env.PGHOST || "localhost",
	port: Number(process.env.PGPORT || 5432),
	user: process.env.PGUSER || "pguser",
	password: process.env.PGPASSWORD || "pgpass",
	database: process.env.PGDATABASE || "targetdb",

	// Pool settings (tương tự mysql2)
	max: Number(process.env.PGPOOL_MAX || 10),
	idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
	connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT_MS || 10000),
};

console.log("Using PostgreSQL config:", {
	host: PG_CONFIG.host,
	port: PG_CONFIG.port,
	user: PG_CONFIG.user,
	database: PG_CONFIG.database,
});
const pool = new Pool(PG_CONFIG);

// Test connection
pool.connect()
	.then((client) => {
		return client
			.query("SELECT NOW() AS now;")
			.then((res) => {
				console.log("PostgreSQL connected successfully:", res.rows[0]);
			})
			.finally(() => client.release());
	})
	.catch((err) => {
		console.error("Error connecting to PostgreSQL:", err.message);
	});

module.exports = pool;
