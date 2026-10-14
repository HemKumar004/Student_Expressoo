const config = require("./config/env");
const prisma = require("./lib/prisma");
const { createApp } = require("./app");

async function start() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ MySQL connected");
  } catch (err) {
    console.error("✗ Could not connect to MySQL. Check DATABASE_URL in server/.env and that the database is running.");
    console.error(`  ${err.message.split("\n").find((l) => l.trim()) || err.message}`);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`✓ Student Expressoo API listening on http://localhost:${config.port} (${config.env})`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log("✓ Connections closed");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
