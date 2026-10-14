const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./config/env");
const prisma = require("./lib/prisma");
const api = require("./routes");
const { apiLimiter } = require("./middleware/rateLimit");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);

  app.use(
    helmet({
      // JSON API only — downloads are fetched via CORS by the portals.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / server-to-server requests (no Origin header) and configured portals.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
      exposedHeaders: ["Content-Disposition", "RateLimit", "RateLimit-Policy"],
      maxAge: 600,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  app.get("/", (_req, res) => res.json({ name: "Student Expressoo API", version: "2.0.0", docs: "/api/v1/health" }));

  app.get("/api/v1/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "connected", time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "degraded", database: "unreachable", time: new Date().toISOString() });
    }
  });

  app.use("/api/v1", apiLimiter, api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
