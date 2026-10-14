const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const config = require("../config/env");

const message = (text) => ({ error: { message: text, code: "RATE_LIMITED" } });

/** Brute-force protection for credential endpoints (per IP + username). */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.username || "").toLowerCase()}`,
  message: message("Too many sign-in attempts. Please wait 15 minutes and try again."),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: message("Too many registration attempts from this network. Please try again later."),
});

/** General ceiling for the whole API. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.isTest ? 100000 : 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: message("Too many requests. Please slow down."),
});

module.exports = { loginLimiter, registerLimiter, apiLimiter };
