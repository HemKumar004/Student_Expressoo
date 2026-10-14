const { PrismaClient } = require("@prisma/client");
const config = require("../config/env");

const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
  log: config.isProduction ? ["error"] : ["warn", "error"],
});

module.exports = prisma;
