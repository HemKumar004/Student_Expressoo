const jwt = require("jsonwebtoken");
const config = require("../config/env");
const prisma = require("../lib/prisma");
const { unauthorized, forbidden } = require("../utils/httpError");

const ISSUER = "student-expressoo";

/** Each portal only accepts accounts of one role. */
const PORTAL_ROLE = { student: "STUDENT", staff: "STAFF", admin: "ADMIN" };
const ROLE_PORTAL = { STUDENT: "student", STAFF: "staff", ADMIN: "admin" };

const userInclude = {
  student: { include: { section: { include: { course: true } } } },
  staff: { include: { department: true } },
};

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, portal: ROLE_PORTAL[user.role], ver: user.tokenVersion },
    config.jwt.secret,
    { algorithm: "HS256", expiresIn: config.jwt.expiresIn, issuer: ISSUER }
  );
}

/**
 * Verifies the Bearer token and loads the current account from MySQL on every request,
 * so deactivation, role changes and password resets take effect immediately.
 */
async function authenticate(req, _res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"], issuer: ISSUER });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw unauthorized("Your session has expired. Please sign in again.", "SESSION_EXPIRED");
    }
    throw unauthorized("Invalid session. Please sign in again.", "INVALID_TOKEN");
  }

  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) }, include: userInclude });
  if (!user || user.tokenVersion !== payload.ver || ROLE_PORTAL[user.role] !== payload.portal) {
    throw unauthorized("Your session is no longer valid. Please sign in again.", "SESSION_REVOKED");
  }
  if (user.status !== "ACTIVE") {
    throw unauthorized("Your account is not active. Contact the administrator.", "ACCOUNT_INACTIVE");
  }

  req.user = user;
  next();
}

/** Restrict a route to one or more roles. Always use after `authenticate`. */
const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };

/** Class Representatives and Ladies Representatives only. */
function requireRepresentative(req, _res, next) {
  const rep = req.user?.student?.representativeRole;
  if (req.user?.role !== "STUDENT" || !rep || rep === "NONE") {
    throw forbidden("Only Class Representatives and Ladies Representatives can use this feature.");
  }
  next();
}

module.exports = { authenticate, authorize, requireRepresentative, signToken, userInclude, PORTAL_ROLE, ROLE_PORTAL };
