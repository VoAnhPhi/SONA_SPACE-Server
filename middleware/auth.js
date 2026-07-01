require("dotenv").config();
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "furnitown-secret-key";

function isApiRequest(req) {
  return (
    req.originalUrl?.startsWith("/api/") ||
    req.baseUrl?.startsWith("/api/") ||
    req.path?.startsWith("/api/")
  );
}

function unauthorized(req, res, next, message) {
  if (isApiRequest(req)) {
    return res.status(401).json({ error: message });
  }

  if (typeof next === "function") {
    return next(new Error(message));
  }

  return res.redirect("/");
}

exports.verifyToken = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return unauthorized(req, res, next, "Khong duoc phep - Khong co token");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded.userId;
    const tokenRole = decoded.role;

    if (!userId) {
      return unauthorized(req, res, next, "Khong duoc phep - Token khong hop le");
    }

    const { rows: users } = await db.query(
      'SELECT user_id, user_gmail, user_role FROM "user" WHERE user_id = $1',
      [userId]
    );

    if (!users.length) {
      return unauthorized(
        req,
        res,
        next,
        "Khong duoc phep - User khong ton tai"
      );
    }

    req.user = {
      id: users[0].user_id,
      email: users[0].user_gmail,
      role: users[0].user_role || tokenRole,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return unauthorized(req, res, next, "Token khong hop le");
    }

    if (isApiRequest(req)) {
      return res.status(500).json({
        error: { message: "Token khong hop le", status: 500 },
      });
    }

    if (typeof next === "function") {
      return next(error);
    }

    return res.redirect("/");
  }
};

exports.isAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res
        .status(403)
        .json({ error: "Forbidden - Admin access required" });
    }

    const { rows: adminCheck } = await db.query(
      'SELECT user_role FROM "user" WHERE user_id = $1',
      [req.user.id]
    );
    const allowedRoles = ["admin", "staff"];

    if (
      adminCheck.length === 0 ||
      !adminCheck[0].user_role ||
      !allowedRoles.includes(adminCheck[0].user_role.toLowerCase())
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden - Admin or Staff access required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.generateToken = (userId) => {
  return jwt.sign({ id: userId, role: "user" }, JWT_SECRET, {
    expiresIn: "24h",
  });
};

exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded.userId;
    if (!userId) {
      return next();
    }

    const { rows } = await db.query(
      'SELECT user_id, user_gmail, user_role FROM "user" WHERE user_id = $1',
      [userId]
    );
    const user = rows[0];

    if (user) {
      req.user = {
        id: user.user_id,
        email: user.user_gmail,
        role: user.user_role || decoded.role || "user",
      };
    }

    next();
  } catch (err) {
    next();
  }
};

exports.isAdminOnly = async (req, res, next) => {
  if (!req.user || req.user.role.toLowerCase() !== "admin") {
    return res.status(403).json({
      error: "Chi quan tri vien moi duoc phep thuc hien hanh dong nay",
    });
  }

  next();
};
