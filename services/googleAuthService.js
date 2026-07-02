const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const db = require("../config/database");

class GoogleAuthError extends Error {
	constructor(status, code, message, cause) {
		super(message);
		this.name = "GoogleAuthError";
		this.status = status;
		this.code = code;
		this.cause = cause;
	}
}

function isUsableClientId(value) {
	const clientId = String(value || "").trim();
	return clientId && !clientId.startsWith("<") && clientId.endsWith(".apps.googleusercontent.com");
}

function getGoogleClientId() {
	const candidates = [process.env.GOOGLE_CLIENT_ID, process.env.GG_CLIENT_ID].filter(isUsableClientId);
	if (!candidates.length) {
		throw new GoogleAuthError(500, "GOOGLE_CLIENT_ID_MISSING", "Google login is not configured on the server.");
	}
	return candidates[0].trim();
}

async function verifyGoogleIdToken(idToken) {
	if (!idToken) {
		throw new GoogleAuthError(400, "GOOGLE_TOKEN_MISSING", "Missing Google credential.");
	}

	const clientId = getGoogleClientId();
	const client = new OAuth2Client(clientId);

	try {
		const ticket = await client.verifyIdToken({
			idToken,
			audience: clientId,
		});
		const payload = ticket.getPayload();

		if (!payload?.email) {
			throw new GoogleAuthError(400, "GOOGLE_EMAIL_MISSING", "Google account did not provide an email address.");
		}

		if (payload.email_verified === false) {
			throw new GoogleAuthError(401, "GOOGLE_EMAIL_NOT_VERIFIED", "Google email is not verified.");
		}

		return {
			email: String(payload.email).trim().toLowerCase(),
			name: payload.name || payload.email,
			picture: payload.picture || null,
		};
	} catch (error) {
		if (error instanceof GoogleAuthError) {
			throw error;
		}
		throw new GoogleAuthError(401, "GOOGLE_TOKEN_INVALID", "Google credential is invalid or expired.", error);
	}
}

async function findOrCreateGoogleUser(profile) {
	const { rows: users } = await db.query(
		'SELECT user_id, user_gmail, user_name, user_image, user_role, created_at, user_address, user_number, user_email_active, user_disabled_at FROM "user" WHERE lower(trim(user_gmail)) = $1',
		[profile.email],
	);

	if (users.length > 0) {
		const existingUser = users[0];

		if (existingUser.user_disabled_at) {
			throw new GoogleAuthError(403, "ACCOUNT_DISABLED", "Account is disabled. Please contact an administrator.");
		}

		if (Number(existingUser.user_email_active) !== 1) {
			await db.query('UPDATE "user" SET user_email_active = 1, user_verified_at = NOW(), user_token = NULL WHERE user_id = $1', [existingUser.user_id]);
			existingUser.user_email_active = 1;
		}

		return {
			userId: existingUser.user_id,
			user: {
				id: existingUser.user_id,
				email: existingUser.user_gmail,
				full_name: existingUser.user_name,
				image: existingUser.user_image,
				address: existingUser.user_address,
				phone: existingUser.user_number,
				role: existingUser.user_role,
				created_at: existingUser.created_at,
			},
		};
	}

	const oauthOnlyPassword = await bcrypt.hash(crypto.randomUUID(), 10);
	const { rows: newUserRows } = await db.query(
		'INSERT INTO "user" (user_gmail, user_name, user_password, user_image, user_role, user_email_active, user_verified_at, created_at) VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW()) RETURNING user_id',
		[profile.email, profile.name, oauthOnlyPassword, profile.picture, "user"],
	);
	const userId = newUserRows[0].user_id;

	return {
		userId,
		user: {
			id: userId,
			email: profile.email,
			full_name: profile.name,
			image: profile.picture,
			address: null,
			phone: null,
			role: "user",
			created_at: new Date(),
		},
	};
}

async function authenticateGoogleUser(idToken) {
	const profile = await verifyGoogleIdToken(idToken);
	return findOrCreateGoogleUser(profile);
}

module.exports = {
	GoogleAuthError,
	authenticateGoogleUser,
	getGoogleClientId,
};
